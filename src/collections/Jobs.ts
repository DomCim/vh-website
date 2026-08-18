import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { naechsteAuftragsnummer } from '../lib/nummernkreis'

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
        if (operation !== 'update') return doc

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
              })
              // Versand nur, wenn eine Sendungsnummer vorliegt — sonst ginge
              // die Versandmail ohne Sendungsverfolgung raus
              const versandOhneNummer = neuerStatus === 'shipped' && !bestellung?.trackingNumber
              if (bestellung && bestellung.status !== neuerStatus && !versandOhneNummer) {
                await req.payload.update({
                  collection: 'orders',
                  id: bestellId,
                  overrideAccess: true,
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

        // Material erst beim Abschluss abbuchen — vorher steht es nur als Plan
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
              })
              if (!posten) continue
              await req.payload.update({
                collection: 'inventory-items',
                id,
                overrideAccess: true,
                data: { quantity: Math.round(((posten.quantity ?? 0) - zeile.quantity) * 100) / 100 },
              })
            } catch (err) {
              req.payload.logger.error({ err }, `Auftrag ${doc.jobNumber}: Material ${id} nicht abgebucht`)
            }
          }
          await req.payload.update({
            collection: 'jobs',
            id: doc.id,
            overrideAccess: true,
            data: { materialGebucht: true },
            context: { skipHooks: true },
          })
        }

        return doc
      },
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
    { name: 'notes', label: 'Notizen zur Fertigung', type: 'textarea' },
    {
      name: 'order',
      label: 'Shop-Bestellung',
      type: 'relationship',
      relationTo: 'orders',
      admin: { readOnly: true },
    },
    { name: 'quote', label: 'Angebot', type: 'relationship', relationTo: 'quotes' },
    { name: 'invoice', label: 'Rechnung', type: 'relationship', relationTo: 'outgoing-invoices' },
    { name: 'project', label: 'Referenz', type: 'relationship', relationTo: 'projects' },
  ],
}
