import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { naechsteAuftragsnummer } from '../lib/nummernkreis'
import { liveHooks } from '../lib/liveHooks'
import { entwurfFuerStufe } from '../lib/rechnungsstufen'

/**
 * Fertigungsaufträge — der Durchlauf eines Stücks durch die Werkstatt.
 *
 * Zwei Wege führen hierher:
 *  - Shop-Bestellung: entsteht automatisch beim Bezahlen, mit dem Preis von
 *    der Website. Vincent muss dafür nichts schreiben.
 *  - Projektgeschäft: aus einem angenommenen Angebot.
 *
 * Der Status spiegelt sich in die Bestellung zurück: Geht der Auftrag in
 * Fertigung, bekommt die Kundschaft die Fertigungs-Mail.
 */
export const Jobs: CollectionConfig = {
  slug: 'jobs',
  labels: {
    singular: 'Auftrag',
    plural: 'Fertigungsaufträge',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['jobNumber', 'title', 'status', 'dueDate'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office — Payload ist die
    // öffentliche Verwaltung, alles Interne hat dort genau einen Platz.
    hidden: true,
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  hooks: {
    afterDelete: liveHooks('auftraege').afterDelete,
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' && !data.jobNumber) {
          data.jobNumber = await naechsteAuftragsnummer(req.payload)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        /*
         * Die drei Auslöser der gestuften Zahlung. Jeder legt einen Entwurf an
         * und sonst nichts — verschickt wird von Hand (siehe
         * lib/rechnungsstufen.ts).
         */
        if (operation === 'create') {
          // Der Auftrag entsteht: Das ist die Auftragsbestätigung.
          await entwurfFuerStufe(req.payload, doc.id, 'anzahlung', req).catch((err) =>
            req.payload.logger.error({ err }, `Auftrag ${doc.jobNumber}: Anzahlung nicht vorbereitet`),
          )
          return doc
        }
        if (operation !== 'update') return doc

        // Meilenstein erreicht — das Datum ist der Auslöser, nicht ein Status
        if (doc.meilenstein?.erreichtAm && !previousDoc?.meilenstein?.erreichtAm) {
          await entwurfFuerStufe(req.payload, doc.id, 'zwischen', req).catch((err) =>
            req.payload.logger.error(
              { err },
              `Auftrag ${doc.jobNumber}: Zwischenrechnung nicht vorbereitet`,
            ),
          )
        }

        // Fertig heißt: Die Schlussrechnung gehört gestellt, bevor geliefert wird
        if (doc.status === 'fertig' && previousDoc?.status !== 'fertig') {
          await entwurfFuerStufe(req.payload, doc.id, 'schluss', req).catch((err) =>
            req.payload.logger.error(
              { err },
              `Auftrag ${doc.jobNumber}: Schlussrechnung nicht vorbereitet`,
            ),
          )
        }

        // Bestellung mitziehen: der Kunde erfährt vom Fertigungsstart
        const bestellId = typeof doc.order === 'object' ? doc.order?.id : doc.order
        if (bestellId && doc.status !== previousDoc?.status) {
          const neuerStatus =
            doc.status === 'inFertigung' ? 'inProduction' : doc.status === 'geliefert' ? 'shipped' : null
          if (neuerStatus) {
            try {
              const bestellung = await req.payload.findByID({
                collection: 'orders',
                id: bestellId,
                depth: 0,
                overrideAccess: true,
                req,
              })
              // Versand nur, wenn eine Sendungsnummer vorliegt — sonst ginge
              // die Versandmail ohne Sendungsverfolgung raus
              const versandOhneNummer = neuerStatus === 'shipped' && !bestellung?.trackingNumber
              if (bestellung && bestellung.status !== neuerStatus && !versandOhneNummer) {
                await req.payload.update({
                  collection: 'orders',
                  id: bestellId,
                  overrideAccess: true,
                  req,
                  data: {
                    status: neuerStatus,
                    ...(doc.dueDate && neuerStatus === 'inProduction'
                      ? { expectedReady: new Date(doc.dueDate).toLocaleDateString('de-DE') }
                      : {}),
                  },
                })
              }
            } catch (err) {
              req.payload.logger.error({ err }, `Auftrag ${doc.jobNumber}: Bestellung nicht aktualisiert`)
            }
          }
        }

        /*
         * Material erst beim Abschluss abbuchen — vorher steht es nur als Plan.
         *
         * Alle Abfragen hier tragen `req`. Ohne das nimmt jede eine eigene
         * Verbindung, und die letzte schreibt an den Auftrag zurück, der
         * gerade geschrieben wird: Die zweite Verbindung wartet auf die Sperre
         * der ersten, die erste wartet auf diesen Hook. Damit blieb jedes
         * Fertigmelden hängen, bis irgendwann eine Zeitüberschreitung kam.
         */
        const fertigJetzt = doc.status === 'fertig' && previousDoc?.status !== 'fertig'
        if (fertigJetzt && !doc.materialGebucht) {
          for (const zeile of doc.material ?? []) {
            const id = typeof zeile.item === 'object' ? zeile.item?.id : zeile.item
            if (!id || !zeile.quantity) continue
            try {
              const posten = await req.payload.findByID({
                collection: 'inventory-items',
                id,
                depth: 0,
                overrideAccess: true,
                req,
              })
              if (!posten) continue
              const rest = Math.round(((posten.quantity ?? 0) - zeile.quantity) * 100) / 100
              await req.payload.update({
                collection: 'inventory-items',
                id,
                overrideAccess: true,
                req,
                data: {
                  quantity: rest,
                  /*
                   * Auch die automatische Abbuchung gehört in den Verlauf.
                   * Sonst stünden dort nur die Korrekturen von Hand, und der
                   * größte Teil der Bewegungen fehlte — genau der, den man
                   * beim Nachrechnen sucht.
                   */
                  movements: [
                    ...(posten.movements ?? []),
                    {
                      day: new Date().toISOString(),
                      delta: -zeile.quantity,
                      rest,
                      reason: `Auftrag ${doc.jobNumber}${doc.title ? ` — ${doc.title}` : ''}`,
                    },
                  ],
                },
              })
            } catch (err) {
              req.payload.logger.error({ err }, `Auftrag ${doc.jobNumber}: Material ${id} nicht abgebucht`)
            }
          }
          await req.payload.update({
            collection: 'jobs',
            id: doc.id,
            overrideAccess: true,
            req,
            data: { materialGebucht: true },
            context: { skipHooks: true },
          })
        }

        return doc
      },
      ...liveHooks('auftraege').afterChange,
    ],
  },
  fields: [
    {
      name: 'jobNumber',
      label: 'Auftragsnummer',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'geplant',
      options: [
        { label: 'Geplant', value: 'geplant' },
        { label: 'In Fertigung', value: 'inFertigung' },
        { label: 'Fertig', value: 'fertig' },
        { label: 'Geliefert', value: 'geliefert' },
        { label: 'Abgebrochen', value: 'abgebrochen' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Bei einer Shop-Bestellung löst „In Fertigung" die E-Mail an die Kundschaft aus.',
      },
    },
    {
      /*
       * Wie dieser Auftrag bezahlt wird.
       *
       * Die Sätze stehen am Artikel — dort gehören sie hin, weil ein Regal
       * anders bezahlt wird als ein Sofa nach Maß. Hierher kommen sie als
       * Abschrift beim Anlegen und werden dann nicht mehr nachgeführt: Was mit
       * der Kundschaft vereinbart wurde, darf sich nicht ändern, weil jemand
       * Monate später den Artikel im Shop anfasst.
       *
       * Beide auf 0 heißt: eine Rechnung am Ende, wie bisher.
       */
      name: 'zahlplan',
      label: 'Zahlung in Stufen',
      type: 'group',
      admin: {
        description:
          'Anzahlung und Zwischenrechnung als Anteil am Auftragswert. Der Rest ist die Schlussrechnung.',
      },
      fields: [
        {
          name: 'anzahlungProzent',
          label: 'Anzahlung (%)',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 0,
          admin: { description: 'Fällig mit der Auftragsbestätigung, vor Fertigungsbeginn.' },
        },
        {
          name: 'zwischenProzent',
          label: 'Zwischenrechnung (%)',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 0,
          admin: { description: 'Fällig, sobald der Meilenstein unten erreicht ist.' },
        },
      ],
    },
    {
      /*
       * Der Punkt, an dem die Zwischenrechnung fällig wird.
       *
       * Bewusst kein weiterer Status: Der Auftrag bleibt „In Fertigung", auch
       * wenn der Rohbau steht — es ist kein anderer Zustand, sondern ein
       * erreichter Punkt darin. Als Status müsste man ihn durchlaufen und
       * wieder verlassen, und beim Zurückspringen wäre unklar, ob die
       * Rechnung nun gilt oder nicht.
       *
       * Das Datum ist der Auslöser. Wer es setzt, sagt: Ab hier ist genug
       * Arbeit drin, dass sie bezahlt gehört.
       */
      name: 'meilenstein',
      label: 'Meilenstein',
      type: 'group',
      admin: {
        description: 'Erreicht der Auftrag diesen Punkt, wird die Zwischenrechnung vorbereitet.',
      },
      fields: [
        {
          name: 'bezeichnung',
          label: 'Was ist erreicht?',
          type: 'text',
          defaultValue: 'Rohbau fertig',
        },
        {
          name: 'erreichtAm',
          label: 'Erreicht am',
          type: 'date',
          admin: {
            description:
              'Sobald hier ein Datum steht, legt das Büro die Zwischenrechnung als Entwurf an.',
          },
        },
      ],
    },
    { name: 'title', label: 'Bezeichnung', type: 'text', required: true },
    {
      name: 'source',
      label: 'Herkunft',
      type: 'select',
      required: true,
      defaultValue: 'manuell',
      options: [
        { label: 'Shop-Bestellung', value: 'shop' },
        { label: 'Angebot', value: 'angebot' },
        { label: 'Von Hand angelegt', value: 'manuell' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      type: 'row',
      fields: [
        { name: 'customerName', label: 'Kunde', type: 'text' },
        { name: 'contact', label: 'Geschäftspartner', type: 'relationship', relationTo: 'contacts' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startDate', label: 'Start', type: 'date' },
        {
          name: 'dueDate',
          label: 'Fertig bis',
          type: 'date',
          admin: { description: 'Wird der Kundschaft als voraussichtlicher Termin gemeldet.' },
        },
      ],
    },
    {
      name: 'positions',
      label: 'Was gefertigt wird',
      type: 'array',
      labels: { singular: 'Position', plural: 'Positionen' },
      fields: [
        { name: 'description', label: 'Beschreibung', type: 'text', required: true },
        {
          type: 'row',
          fields: [
            { name: 'quantity', label: 'Menge', type: 'number', defaultValue: 1 },
            {
              name: 'price',
              label: 'Preis (EUR)',
              type: 'number',
              admin: { description: 'Bei Shop-Bestellungen der Preis von der Website.' },
            },
          ],
        },
      ],
    },
    {
      name: 'material',
      label: 'Geplantes Material',
      type: 'array',
      labels: { singular: 'Materialposten', plural: 'Material' },
      admin: {
        description:
          'Wird erst beim Abschließen des Auftrags vom Inventar abgezogen — vorher ist es nur Planung.',
      },
      fields: [
        {
          name: 'item',
          label: 'Posten',
          type: 'relationship',
          relationTo: 'inventory-items',
          required: true,
        },
        { name: 'quantity', label: 'Menge', type: 'number', required: true },
      ],
    },
    {
      name: 'materialGebucht',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
    {
      /*
       * Wie viele Werkstattstunden dieser Auftrag zusagt.
       *
       * Steht am Auftrag und nicht am Artikel, obwohl die Zahl von dort kommt:
       * Aus einer Shop-Bestellung wird sie beim Anlegen übernommen (Summe der
       * Fertigungszeiten mal Menge), im Projektgeschäft trägt sie jemand ein.
       * Danach gehört sie dem Auftrag — was mit der Kundschaft vereinbart ist,
       * darf sich nicht ändern, weil Monate später jemand den Artikel anfasst.
       *
       * Ohne diese Zahl ist die Auslastung blind: Der Kalender zeigt dann zwar
       * Termine, aber nicht, ob die Woche schon voll ist.
       */
      name: 'plannedMinutes',
      label: 'Geplante Fertigungszeit (Minuten)',
      type: 'number',
      min: 0,
      admin: {
        description:
          'Grundlage der Wochen-Auslastung. Bei Shop-Bestellungen aus der Fertigungszeit der Artikel vorbelegt.',
      },
    },
    {
      name: 'runningSince',
      label: 'Uhr läuft seit',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Gesetzt, solange die Stoppuhr im Büro läuft.',
      },
    },
    {
      name: 'timeEntries',
      label: 'Arbeitszeit',
      type: 'array',
      admin: {
        description:
          'Ohne Stunden weiß niemand, ob der Preis den Aufwand deckt — Material und Dienstleister sind nur die halbe Rechnung.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'day', label: 'Tag', type: 'date' },
            { name: 'minutes', label: 'Minuten', type: 'number', required: true, min: 1 },
          ],
        },
        { name: 'note', label: 'Woran', type: 'text' },
      ],
    },
    { name: 'notes', label: 'Notizen zur Fertigung', type: 'textarea' },
    {
      name: 'order',
      label: 'Shop-Bestellung',
      type: 'relationship',
      relationTo: 'orders',
      admin: { readOnly: true },
    },
    { name: 'quote', label: 'Angebot', type: 'relationship', relationTo: 'quotes' },
    {
      type: 'collapsible',
      label: 'Bestellung des Kunden',
      admin: {
        description:
          'Im Projektgeschäft bestellt die Kundschaft auf Grundlage des Angebots — meist per Mail, Bestellschein oder Kommunal-Auftrag. Was sie geschickt hat, gehört hierher; die Auftragsbestätigung geht darauf zurück.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'customerOrderRef',
              label: 'Bestellnummer des Kunden',
              type: 'text',
              admin: { description: 'Muss auf Auftragsbestätigung und Rechnung stehen.' },
            },
            { name: 'orderedAt', label: 'Bestellt am', type: 'date' },
            {
              name: 'confirmedAt',
              label: 'Bestätigt am',
              type: 'date',
              admin: { readOnly: true, description: 'Wird beim Erzeugen der Bestätigung gesetzt.' },
            },
          ],
        },
        {
          name: 'orderDocument',
          label: 'Bestellung des Kunden (Scan)',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Bestellschein, Mail-Ausdruck oder Auftragsschreiben.' },
        },
      ],
    },
    {
      /*
       * Die gemeinsame Nummer aller Rechnungen zu diesem Auftrag.
       *
       * Vergeben wird sie einmal — wenn die erste Stufe gestellt wird — und
       * danach nie wieder. Die einzelnen Rechnungen heißen dann
       * `RE-2026-0042-1/3`, `-2/3`, `-3/3`.
       */
      name: 'rechnungsBasis',
      label: 'Rechnungsnummer (gemeinsam)',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Entsteht mit der ersten Rechnung zu diesem Auftrag.',
      },
    },
    {
      /*
       * Wie viele Rechnungen es zusammen sein werden — der Nenner.
       *
       * Eingefroren beim Stellen der ersten Stufe. Er darf sich danach nicht
       * mehr ändern: Eine Rechnung, die beim Kunden liegt, behält ihre
       * Nummer. Würde aus `-1/2` nachträglich `-1/3`, gäbe es zwei Papiere
       * mit verschiedenen Nummern für denselben Vorgang, und beim Prüfen
       * fehlt dann eines von beiden.
       */
      name: 'stufenGesamt',
      label: 'Anzahl der Rechnungen',
      type: 'number',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Steht fest, sobald die erste Rechnung gestellt ist.',
      },
    },
    { name: 'invoice', label: 'Rechnung', type: 'relationship', relationTo: 'outgoing-invoices' },
    { name: 'project', label: 'Referenz', type: 'relationship', relationTo: 'projects' },
  ],
}
