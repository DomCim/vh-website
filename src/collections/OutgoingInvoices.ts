import type { CollectionConfig, Payload, PayloadRequest, Where } from 'payload'

import { office } from '../access'
import { hatRecht } from '../lib/rechte'
import { geplanteStufen } from '../lib/anzahlung'
import { RECHNUNG_STATUS, RECHNUNG_STUFEN, STEUERFAELLE } from '../lib/listen'
import { betraege } from '../lib/betraege'
import { ablageFeld, absenderAbschrift, absenderFeld } from '../lib/absender'
import { kundenAbschrift } from '../lib/kundenabschrift'
import { naechsteRechnungsBasis, naechsteRechnungsnummer, stufenNummer } from '../lib/nummernkreis'
import { liveHooks } from '../lib/liveHooks'
import { markOrderPaid } from '../lib/orderHooks'

/**
 * Die Nummer einer Stufe: `RE-2026-0042-2/3`.
 *
 * Basis und Nenner entstehen beim Stellen der **ersten** Stufe und werden am
 * Auftrag eingefroren. Sie dürfen sich danach nicht mehr ändern: Eine Rechnung,
 * die beim Kunden liegt, behält ihre Nummer — würde aus `-1/2` nachträglich
 * `-1/3`, gäbe es zwei Papiere mit verschiedenen Nummern für denselben Vorgang.
 *
 * Der Zähler ist bewusst „die wievielte gestellte Rechnung", nicht die Stelle
 * der Stufe im Plan. Der Plan kann sich zwischendurch ändern; die Reihenfolge,
 * in der gestellt wurde, kann es nicht.
 */
async function stufenNummerVergeben(
  payload: Payload,
  auftragId: number | string,
  req: PayloadRequest,
): Promise<string> {
  const id = typeof auftragId === 'object' ? (auftragId as { id?: number })?.id : auftragId
  const auftrag = await payload
    .findByID({ collection: 'jobs', id: id as number, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!auftrag) return naechsteRechnungsnummer(payload)

  let basis = auftrag.rechnungsBasis
  let gesamt = auftrag.stufenGesamt

  if (!basis) {
    basis = await naechsteRechnungsBasis(payload)
    gesamt = geplanteStufen(auftrag.zahlplan).length || 1
    await payload.update({
      collection: 'jobs',
      id: auftrag.id,
      overrideAccess: true,
      data: { rechnungsBasis: basis, stufenGesamt: gesamt },
      context: { skipHooks: true },
      req,
    })
  }

  const { totalDocs } = await payload.count({
    collection: 'outgoing-invoices',
    where: {
      auftrag: { equals: auftrag.id },
      invoiceNumber: { exists: true },
      stufe: { not_equals: 'vollstaendig' },
    },
    overrideAccess: true,
    req,
  })

  const nenner = Math.max(gesamt || 1, totalDocs + 1)
  return stufenNummer(basis, totalDocs + 1, nenner)
}

/** Fällig am — Vorgabe je Stufe aus den Einstellungen. */
async function faelligAm(
  payload: Payload,
  stufe: string,
  ab: string,
  req: PayloadRequest,
): Promise<string | undefined> {
  try {
    const integrationen = (await payload.findGlobal({ slug: 'integrations', depth: 0, req })) as {
      zahlungsziele?: Record<string, number | null | undefined>
    }
    const tage =
      stufe === 'anzahlung'
        ? integrationen?.zahlungsziele?.anzahlungTage
        : stufe === 'zwischen'
          ? integrationen?.zahlungsziele?.zwischenTage
          : integrationen?.zahlungsziele?.schlussTage
    if (!tage) return undefined
    const datum = new Date(ab)
    datum.setDate(datum.getDate() + Number(tage))
    return datum.toISOString()
  } catch {
    return undefined
  }
}

/**
 * Ausgangsrechnungen fürs Projektgeschäft — alles, was nicht über den Shop
 * läuft: Kommunen, Gewerbe, Sonderanfertigungen.
 *
 * Die Rechnungsnummer wird erst beim Festschreiben vergeben. Solange die
 * Rechnung Entwurf ist, hat sie keine — sonst entstünden Lücken in der Reihe,
 * sobald ein Entwurf verworfen wird.
 */
/**
 * Was gelöscht werden darf: nur, was nie hinausgegangen ist.
 *
 * Dieselbe Bedingung prüft die Büro-Schnittstelle schon vor dem Löschen; hier
 * steht sie noch einmal als Einschränkung an der Sammlung, damit auch die
 * Website-Verwaltung sie nicht umgehen kann.
 */
const NUR_ENTWUERFE: Where = {
  and: [{ invoiceNumber: { exists: false } }, { status: { equals: 'entwurf' } }],
}

export const OutgoingInvoices: CollectionConfig = {
  slug: 'outgoing-invoices',
  // Auch ein verworfener Entwurf bleibt liegen — die Zugriffsregel unten gilt
  // ebenso fürs Wegwerfen, eine gestellte Rechnung verschwindet also nicht.
  trash: true,
  labels: {
    singular: 'Ausgangsrechnung',
    plural: 'Ausgangsrechnungen',
  },
  admin: {
    useAsTitle: 'invoiceNumber',
    defaultColumns: ['invoiceNumber', 'customerName', 'issueDate', 'total', 'status'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office — Payload ist die
    // öffentliche Verwaltung, alles Interne hat dort genau einen Platz.
    hidden: true,
    description: 'Rechnungen an Kommunen, Gewerbe und Privat außerhalb des Shops.',
  },
  access: {
    read: office,
    create: office,
    update: office,
    /*
     * Eine gestellte Rechnung wird storniert, nicht gelöscht — und das ist
     * hier keine Hausregel, sondern eine Bedingung, an der die Abfrage
     * scheitert.
     *
     * Der Weg über das Büro war längst dicht: Die Schnittstelle lässt das
     * Löschen nur zu, solange kein `invoiceNumber` vergeben und der Status
     * „entwurf" ist. Die Sammlung selbst stand aber offen, und über die
     * Website-Verwaltung wäre damit jede Rechnung löschbar gewesen. Ein
     * Fehlklick reißt dort ein Loch in den Nummernkreis, und lückenlose
     * Nummern sind das Erste, was eine Prüfung ansieht.
     *
     * Zurückgegeben wird deshalb keine Erlaubnis, sondern eine Einschränkung:
     * Gelöscht werden darf, was nie hinausgegangen ist. Das ist dieselbe
     * Bedingung wie im Büro — nur eine Ebene tiefer, wo sie niemand vergessen
     * kann.
     *
     * Der automatisch entstandene Entwurf, den niemand braucht, bleibt damit
     * wegwerfbar: Genau dafür gibt es ihn.
     */
    delete: ({ req: { user } }) => (hatRecht(user, 'buero.oeffnen') ? NUR_ENTWUERFE : false),
  },
  hooks: {
    afterDelete: liveHooks('rechnungen').afterDelete,
    afterChange: [
      ...liveHooks('rechnungen').afterChange,
      /*
       * Kauf auf Rechnung: Die bezahlte Anzahlung (oder die bezahlte
       * vollständige Rechnung) ist der Moment, in dem eine Rechnungs-
       * Bestellung zur bezahlten Bestellung wird — Bestätigungsmail,
       * Fertigungsstart, Ausbuchen der Lagerware. Bei PayPal übernimmt das
       * der Rücksprung von PayPal; hier übernimmt es der Haken „bezahlt"
       * an der Rechnung. `markOrderPaid` ist idempotent, doppelt passiert
       * nichts.
       */
      async ({ doc, previousDoc, req }) => {
        if (doc.status !== 'bezahlt' || previousDoc?.status === 'bezahlt') return doc
        if (doc.stufe !== 'anzahlung' && doc.stufe !== 'vollstaendig') return doc

        const auftragId = typeof doc.auftrag === 'object' ? doc.auftrag?.id : doc.auftrag
        if (!auftragId) return doc
        try {
          const auftrag = await req.payload.findByID({
            collection: 'jobs',
            id: auftragId,
            depth: 0,
            overrideAccess: true,
            req,
          })
          const bestellId = typeof auftrag?.order === 'object' ? auftrag.order?.id : auftrag?.order
          if (!bestellId) return doc
          const bestellung = await req.payload.findByID({
            collection: 'orders',
            id: bestellId,
            depth: 0,
            overrideAccess: true,
            req,
          })
          if (bestellung?.paymentProvider === 'rechnung' && bestellung.status === 'pending') {
            await markOrderPaid(req.payload, bestellId)
          }
        } catch (err) {
          req.payload.logger.error({ err }, 'Rechnungskauf: Bestellung nicht auf bezahlt gezogen')
        }
        return doc
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        // Summen immer neu rechnen — nie dem übergebenen Wert vertrauen
        const summen = betraege(data.items ?? [], {
          discountKind: data.discountKind,
          discountValue: data.discountValue,
          /*
           * Reverse Charge muss mit, sonst steht hier eine Steuer, die auf
           * keinem Papier auftaucht: PDF und Factur-X rechnen sie längst
           * heraus, dieser Haken tat es nicht — und der Steuer-Export nimmt
           * seine Zahlen von hier.
           */
          reverseCharge: data.reverseCharge ?? originalDoc?.reverseCharge,
        })
        data.subtotal = summen.subtotal
        data.discountTotal = summen.discountTotal
        data.netTotal = summen.netTotal
        data.vatTotal = summen.vatTotal
        data.total = summen.total

        // Nummer erst beim Festschreiben vergeben, und nur einmal
        const wirdFestgeschrieben =
          data.status && data.status !== 'entwurf' && originalDoc?.status === 'entwurf'
        const istNeuUndFest = operation === 'create' && data.status && data.status !== 'entwurf'
        /*
         * Der alte Haken folgt dem Steuerfall, immer und ohne Ausnahme.
         *
         * Er ist die Weiche, an der Summenrechnung, PDF und Factur-X hängen;
         * der Steuerfall sagt, warum. Würden beide auseinanderlaufen, stünde
         * auf dem Blatt ein Grund und in den Zahlen ein anderer.
         */
        const fall = data.steuerfall ?? originalDoc?.steuerfall ?? 'inland'
        data.reverseCharge = fall !== 'inland'

        if ((wirdFestgeschrieben || istNeuUndFest) && !data.invoiceNumber) {
          if (!data.issueDate) data.issueDate = new Date().toISOString()

          const stufe = data.stufe ?? originalDoc?.stufe
          const auftragId = data.auftrag ?? originalDoc?.auftrag
          const gestuft = stufe && stufe !== 'vollstaendig' && auftragId

          data.invoiceNumber = gestuft
            ? await stufenNummerVergeben(req.payload, auftragId, req)
            : await naechsteRechnungsnummer(req.payload)

          /*
           * Mit der Nummer werden die eigenen Firmenangaben abgeschrieben.
           *
           * Ab hier ist die Rechnung ein Beleg und keine Absicht mehr. Was
           * darauf steht — Anschrift, USt-IdNr, SIRET, IBAN, Zahlungsziel —,
           * gilt für diesen Tag und darf sich nicht mehr mitbewegen, wenn der
           * Betrieb umzieht oder die Bank wechselt. Siehe `lib/absender.ts`.
           */
          data.absender = await absenderAbschrift(req.payload, req)

          /*
           * Und dasselbe für den Empfänger — aber nur, was noch fehlt.
           *
           * Der Entwurf entsteht oft Wochen vorher, und die Nummer des Kunden
           * kommt manchmal erst danach dazu. Genau so ist einmal eine Rechnung
           * ohne die USt-IdNr des Empfängers hinausgegangen: Sie stand beim
           * Anlegen noch nicht am Geschäftspartner, wurde später nachgetragen,
           * und der Entwurf wusste nichts davon. Eine gestellte Rechnung lässt
           * sich nicht mehr ändern — sie musste storniert und neu geschrieben
           * werden.
           *
           * Getippte Angaben bleiben unangetastet; ergänzt wird nur Leeres.
           */
          Object.assign(
            data,
            await kundenAbschrift(
              req.payload,
              data.customer ?? originalDoc?.customer,
              {
                customerName: (data.customerName ?? originalDoc?.customerName) || '',
                customerAddress: (data.customerAddress ?? originalDoc?.customerAddress) || '',
                customerSiret: (data.customerSiret ?? originalDoc?.customerSiret) || '',
                customerVatId: (data.customerVatId ?? originalDoc?.customerVatId) || '',
              },
              req,
            ),
          )

          // Zahlungsziel je Stufe — an der Rechnung bleibt es änderbar
          if (!data.dueDate && gestuft) {
            data.dueDate = await faelligAm(req.payload, stufe, data.issueDate, req)
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'invoiceNumber',
      label: 'Rechnungsnummer',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Wird beim Festschreiben automatisch und lückenlos vergeben.',
      },
    },
    absenderFeld(),
    ablageFeld(
      'Wird beim Festschreiben einmal gebaut und liegt unter `media/belege`. ' +
        'Angesehen und verschickt wird diese Datei — erzeugt wird nur, wenn keine da ist.',
    ),
    {
      /*
       * Welche Stufe der Zahlung diese Rechnung ist.
       *
       * Bei einem Stück, das Wochen in der Werkstatt liegt, wird nicht einmal
       * kassiert, sondern dreimal: bei der Bestätigung, beim erreichten
       * Meilenstein, und vor der Lieferung. Für die Buchhaltung sind das drei
       * verschiedene Dinge — und die Schlussrechnung muss die beiden ersten
       * aufführen und abziehen, samt Umsatzsteuer. Ohne diese Angabe wüsste
       * sie nicht, welche das sind.
       */
      name: 'stufe',
      label: 'Stufe',
      type: 'select',
      defaultValue: 'vollstaendig',
      options: [...RECHNUNG_STUFEN],
      admin: {
        position: 'sidebar',
        description: 'Bei Zahlung in Stufen — sonst bleibt es bei „Vollständige Rechnung".',
      },
    },
    {
      /*
       * Woran diese Rechnung hängt. Erst darüber findet die Schlussrechnung
       * ihre Vorgänger — und der Auftrag weiß, was schon gestellt ist.
       */
      name: 'auftrag',
      label: 'Auftrag',
      type: 'relationship',
      relationTo: 'jobs',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Bei Zahlung in Stufen: der Auftrag, zu dem diese Rechnung gehört.',
      },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'entwurf',
      options: [...RECHNUNG_STATUS],
      admin: {
        position: 'sidebar',
        description: 'Ab „Gestellt" bekommt die Rechnung ihre Nummer und ist verbindlich.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'customer',
          label: 'Kunde',
          type: 'relationship',
          relationTo: 'contacts',
        },
        { name: 'customerName', label: 'Kunde (Text)', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'customerSiret',
          label: 'SIRET/SIREN des Kunden',
          type: 'text',
          admin: {
            description:
              'Für die elektronische Rechnung Pflicht, wenn der Kunde ein Unternehmen ist. Bei Privatkundschaft leer lassen.',
          },
        },
        {
          name: 'customerVatId',
          label: 'TVA-Nummer des Kunden',
          type: 'text',
        },
      ],
    },
    {
      name: 'customerAddress',
      label: 'Rechnungsanschrift',
      type: 'textarea',
      admin: { description: 'Wird aus dem Geschäftspartner übernommen, wenn dort hinterlegt.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'issueDate', label: 'Rechnungsdatum', type: 'date' },
        { name: 'dueDate', label: 'Fällig am', type: 'date' },
        { name: 'paidDate', label: 'Bezahlt am', type: 'date' },
        {
          name: 'deliveryDate',
          label: 'Liefer-/Leistungsdatum',
          type: 'date',
          admin: {
            description: 'Pflichtangabe, wenn es vom Rechnungsdatum abweicht.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'businessType',
          label: 'Art des Geschäfts',
          type: 'select',
          defaultValue: 'lieferung',
          options: [
            { label: 'Lieferung von Waren', value: 'lieferung' },
            { label: 'Dienstleistung', value: 'dienstleistung' },
            { label: 'Beides gemischt', value: 'gemischt' },
          ],
          admin: {
            description: 'Steht auf der E-Rechnung und entscheidet über den Zeitpunkt der Steuer.',
          },
        },
        {
          name: 'buyerReference',
          label: 'Bestellnummer des Kunden',
          type: 'text',
          admin: {
            description:
              'Aktenzeichen, Bestell- oder Vergabenummer. Öffentliche Auftraggeber brauchen das, sonst bleibt die Rechnung liegen.',
          },
        },
      ],
    },
    {
      name: 'deliveryAddress',
      label: 'Abweichende Lieferanschrift',
      type: 'textarea',
      admin: {
        description: 'Nur ausfüllen, wenn woandershin geliefert wurde als abgerechnet wird.',
      },
    },
    {
      name: 'items',
      label: 'Positionen',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Position', plural: 'Positionen' },
      fields: [
        { name: 'description', label: 'Beschreibung', type: 'text', required: true },
        {
          /*
           * Welche Position des Auftrags hier abgerechnet wird.
           *
           * Gebraucht, seit eine Rechnung nur einen Teil des Auftrags
           * abdecken darf: Liefert Vincent ein Sofa und baut es vor Ort auf,
           * ist das eine Lieferung und eine Leistung — zwei Steuerfälle, zwei
           * Rechnungen, ein Auftrag. Ohne diesen Verweis wüsste niemand,
           * welche Position schon berechnet ist, und der Auftrag ginge
           * entweder doppelt oder gar nicht hinaus.
           *
           * Die Kennung der Array-Zeile, nicht ihr Text: Der Text darf sich
           * auf der Rechnung von der Auftragszeile unterscheiden, er ist
           * verhandelt.
           */
          name: 'auftragPosition',
          label: 'Position des Auftrags',
          type: 'text',
          index: true,
          admin: {
            readOnly: true,
            description: 'Gesetzt, wenn die Rechnung aus einem Auftrag entstanden ist.',
          },
        },
        {
          /*
           * Welcher Artikel gemeint ist — freiwillig.
           *
           * Die Beschreibung bleibt der maßgebliche Text: Sie steht auf dem
           * Papier, sie ist verhandelt, und sie darf von der Artikelbezeichnung
           * abweichen. Der Bezug hängt nur daran, damit im Büro und auf dem
           * Papier das Bild dazu erscheint — man sieht dann auf einen Blick,
           * worum es geht, statt eine Zeile Text zu lesen.
           *
           * Aus einer Shop-Bestellung wird er von selbst gesetzt. Wer eine
           * Position von Hand schreibt, kann ihn wählen oder leer lassen.
           */
          name: 'product',
          label: 'Artikel (für das Bild)',
          type: 'relationship',
          relationTo: 'products',
        },
        {
          type: 'row',
          fields: [
            { name: 'quantity', label: 'Menge', type: 'number', required: true, defaultValue: 1 },
            { name: 'unit', label: 'Einheit', type: 'text', defaultValue: 'Stück' },
            {
              /*
               * Ohne Untergrenze — und das ist Absicht.
               *
               * Die Schlussrechnung eines gestuften Auftrags führt die schon
               * gestellten Anzahlungen einzeln auf und zieht sie ab; solche
               * Zeilen sind negativ. Eine Untergrenze von 0 hat genau das
               * verhindert: Der Entwurf der Schlussrechnung entstand nicht,
               * und im Protokoll stand nur eine Validierungsmeldung, die
               * niemand liest.
               */
              name: 'unitPrice',
              label: 'Einzelpreis netto (EUR)',
              type: 'number',
              required: true,
            },
            {
              name: 'vatRate',
              label: 'Steuersatz (%)',
              type: 'number',
              required: true,
              defaultValue: 20,
              min: 0,
              max: 30,
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'discountKind',
          label: 'Nachlass',
          type: 'select',
          defaultValue: 'kein',
          options: [
            { label: 'Kein Nachlass', value: 'kein' },
            { label: 'Prozent', value: 'prozent' },
            { label: 'Fester Betrag (EUR)', value: 'betrag' },
          ],
          admin: {
            description:
              'Ein gewährter Nachlass muss auf der Rechnung stehen — er wird anteilig auf die Positionen verteilt, damit die Steuer stimmt.',
          },
        },
        { name: 'discountValue', label: 'Höhe', type: 'number', min: 0 },
        { name: 'discountReason', label: 'Begründung', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'discountTotal', label: 'Nachlass (EUR)', type: 'number', admin: { readOnly: true } },
        { name: 'netTotal', label: 'Netto nach Nachlass', type: 'number', admin: { readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'subtotal',
          label: 'Netto gesamt',
          type: 'number',
          admin: { readOnly: true },
        },
        { name: 'vatTotal', label: 'Steuer gesamt', type: 'number', admin: { readOnly: true } },
        { name: 'total', label: 'Brutto gesamt', type: 'number', admin: { readOnly: true } },
      ],
    },
    {
      name: 'reminders',
      label: 'Verschickte Mahnungen',
      type: 'array',
      admin: {
        readOnly: true,
        description:
          'Wird beim Verschicken fortgeschrieben. Die nächste Stufe ergibt sich daraus von selbst.',
      },
      fields: [
        {
          name: 'level',
          label: 'Stufe',
          type: 'number',
        },
        { name: 'sentAt', label: 'Verschickt am', type: 'date' },
        { name: 'lateFee', label: 'Pauschale (EUR)', type: 'number' },
        /*
         * Die gesetzte Frist gehört an die Zeile und nicht in die Rechnung.
         *
         * Sie wurde bisher beim Bauen als „heute + zehn Tage" gerechnet. Wer
         * die verschickte Mahnung eine Woche später noch einmal öffnete, sah
         * eine andere Frist als der Kunde auf seinem Blatt — bei genau dem
         * Schreiben, bei dem die Frist der ganze Punkt ist.
         */
        { name: 'fristBis', label: 'Frist bis', type: 'date' },
        {
          name: 'pdfAblage',
          label: 'Abgelegtes PDF',
          type: 'text',
          admin: { description: 'Das Schreiben, das tatsächlich hinausgegangen ist.' },
        },
      ],
    },
    {
      /*
       * Welcher Grund die Umsatzsteuer wegfallen lässt.
       *
       * **Hier stand einmal ein einziger Haken „Reverse Charge".** Der Betrag
       * war damit richtig — null Umsatzsteuer —, aber der Beleg behauptete
       * zwei verschiedene Dinge gleichzeitig: Auf dem Papier stand der Satz
       * zur **innergemeinschaftlichen Lieferung** (§ 4 Nr. 1 b i.V.m. § 6 a
       * UStG, also Ware), in der eingebetteten Factur-X-Datei stand
       * `CategoryCode AE`, also **Reverse Charge** (sonstige Leistung). Zur
       * Lieferung gehört nach EN 16931 der Code `K`.
       *
       * Das ist kein Schönheitsfehler. Der Empfänger stützt seine eigene
       * Steuerschuld auf diesen Beleg, und bei einer E-Rechnung ist die
       * maschinenlesbare Datei die rechtlich maßgebliche — auf dem Blatt stand
       * also das eine, verbindlich war das andere.
       *
       * **Warum es zwei Fälle sein müssen und nicht einer:** Liefert Vincent
       * ein Sofa nach Deutschland, ist das eine Lieferung (K). Baut er es dort
       * auf, ist das eine sonstige Leistung (AE). Kommt beides in einem
       * Auftrag vor, gehört es auf zwei Rechnungen — deshalb lassen sich
       * Rechnungen je Position stellen (siehe `lib/rechnungsstufen.ts`).
       *
       * Beide bedeuten null Umsatzsteuer, aus zwei Gründen, und nur einer darf
       * auf dem Beleg stehen.
       */
      name: 'steuerfall',
      label: 'Steuerfall',
      type: 'select',
      /*
       * Vorgabe statt Pflicht. In der Spalte steht `NOT NULL DEFAULT
       * 'inland'`, und `beforeChange` fällt ebenfalls darauf zurück — fehlen
       * kann er also nicht. `required` würde nur jeden der acht Orte, an denen
       * eine Rechnung entsteht, zwingen, den Normalfall hinzuschreiben.
       */
      defaultValue: 'inland',
      options: [...STEUERFAELLE],
      admin: {
        position: 'sidebar',
        description:
          'Inland: normale Umsatzsteuer. Die beiden anderen setzen alle Sätze auf 0 und drucken ihren Hinweis.',
      },
    },
    {
      /*
       * Der alte Haken bleibt als abgeleiteter Wert stehen.
       *
       * Er wird nicht mehr getippt, sondern in `beforeChange` aus dem
       * Steuerfall gesetzt. Daran hängen die Summenrechnung, das PDF und die
       * Factur-X-Datei an einem Dutzend Stellen; sie alle auf einmal
       * umzuschreiben wäre ein zweiter, größerer Eingriff mit demselben
       * Ergebnis. Wer neu baut, fragt `steuerfall`.
       */
      name: 'reverseCharge',
      label: 'Ohne Umsatzsteuer (abgeleitet)',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'Ergibt sich aus dem Steuerfall — nicht von Hand setzen.',
      },
    },
    {
      name: 'note',
      label: 'Hinweis auf der Rechnung',
      type: 'textarea',
      admin: { description: 'z.B. Bezug zum Angebot oder Zahlungsziel-Abrede.' },
    },
    {
      name: 'project',
      label: 'Zugehörige Referenz',
      type: 'relationship',
      relationTo: 'projects',
      admin: { description: 'Optional — verbindet die Rechnung mit dem gezeigten Projekt.' },
    },
    {
      /*
       * Storno und Original zeigen aufeinander.
       *
       * Eine gestellte Rechnung wird nicht geändert — sie liegt beim Kunden
       * und steht in dessen Buchhaltung. Korrigiert wird über eine
       * Gegenrechnung, und die braucht den Bezug: Ohne ihn stehen zwei
       * Vorgänge im Ordner, einer mit positiven und einer mit negativen
       * Zahlen, und niemand weiß, dass sie zusammengehören.
       *
       * Beide Richtungen, weil beide Fragen vorkommen: „Was hebt diese
       * Rechnung auf?" und „Gilt diese Rechnung noch?".
       */
      name: 'stornoVon',
      label: 'Storniert die Rechnung',
      type: 'relationship',
      relationTo: 'outgoing-invoices',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Gesetzt, wenn diese Rechnung eine Stornorechnung ist.',
      },
    },
    {
      name: 'storniertDurch',
      label: 'Storniert durch',
      type: 'relationship',
      relationTo: 'outgoing-invoices',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Die Stornorechnung, die diese Rechnung aufhebt.',
      },
    },
    {
      name: 'stornoGrund',
      label: 'Grund der Stornierung',
      type: 'text',
      admin: { description: 'Steht als Hinweis auf der Stornorechnung.' },
    },
    {
      name: 'quote',
      label: 'Aus Angebot entstanden',
      type: 'relationship',
      relationTo: 'quotes',
      admin: { readOnly: true, description: 'Wird beim Umwandeln eines Angebots gesetzt.' },
    },
  ],
}
