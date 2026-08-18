import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { naechsteAngebotsnummer } from '../lib/nummernkreis'

/**
 * Angebote fürs Projektgeschäft.
 *
 * Der Weg im Betrieb: Anfrage → Angebot → Auftrag → Rechnung. Shop-Käufe
 * gehen an den Angeboten vorbei, dort steht der Preis ja schon auf der
 * Website.
 *
 * Die Nummer wird erst beim Versenden vergeben — ein verworfener Entwurf
 * soll keine Lücke in der Reihe hinterlassen.
 */
export const Quotes: CollectionConfig = {
  slug: 'quotes',
  labels: {
    singular: 'Angebot',
    plural: 'Angebote',
  },
  admin: {
    useAsTitle: 'quoteNumber',
    defaultColumns: ['quoteNumber', 'customerName', 'issueDate', 'total', 'status'],
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
      async ({ data, originalDoc, req, operation }) => {
        const positionen = (data.items ?? []) as {
          quantity?: number
          unitPrice?: number
          vatRate?: number
        }[]
        let netto = 0
        let steuer = 0
        for (const p of positionen) {
          const zeile = (p.quantity ?? 0) * (p.unitPrice ?? 0)
          netto += zeile
          steuer += zeile * ((p.vatRate ?? 0) / 100)
        }
        const runden = (n: number) => Math.round(n * 100) / 100
        data.subtotal = runden(netto)
        data.vatTotal = runden(steuer)
        data.total = runden(netto + steuer)

        const wirdVersendet =
          data.status && data.status !== 'entwurf' && originalDoc?.status === 'entwurf'
        const neuUndVersendet = operation === 'create' && data.status && data.status !== 'entwurf'
        if ((wirdVersendet || neuUndVersendet) && !data.quoteNumber) {
          data.quoteNumber = await naechsteAngebotsnummer(req.payload)
          if (!data.issueDate) data.issueDate = new Date().toISOString()
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'quoteNumber',
      label: 'Angebotsnummer',
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
      defaultValue: 'entwurf',
      options: [
        { label: 'Entwurf', value: 'entwurf' },
        { label: 'Versendet', value: 'versendet' },
        { label: 'Angenommen', value: 'angenommen' },
        { label: 'Abgelehnt', value: 'abgelehnt' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'title', label: 'Bezeichnung', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'customer', label: 'Kunde', type: 'relationship', relationTo: 'contacts' },
        { name: 'customerName', label: 'Kunde (Text)', type: 'text' },
      ],
    },
    { name: 'customerAddress', label: 'Anschrift', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'issueDate', label: 'Angebotsdatum', type: 'date' },
        {
          name: 'validUntil',
          label: 'Gültig bis',
          type: 'date',
          admin: { description: 'Bei Stahlpreisen üblich: 30 Tage.' },
        },
      ],
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
          type: 'row',
          fields: [
            { name: 'quantity', label: 'Menge', type: 'number', required: true, defaultValue: 1 },
            { name: 'unit', label: 'Einheit', type: 'text', defaultValue: 'Stück' },
            {
              name: 'unitPrice',
              label: 'Einzelpreis netto (EUR)',
              type: 'number',
              required: true,
              min: 0,
            },
            {
              name: 'vatRate',
              label: 'Steuersatz (%)',
              type: 'number',
              required: true,
              defaultValue: 20,
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'subtotal', label: 'Netto', type: 'number', admin: { readOnly: true } },
        { name: 'vatTotal', label: 'Steuer', type: 'number', admin: { readOnly: true } },
        { name: 'total', label: 'Brutto', type: 'number', admin: { readOnly: true } },
      ],
    },
    {
      name: 'productionTime',
      label: 'Zugesagte Fertigungszeit',
      type: 'text',
      admin: { description: 'z.B. „6–8 Wochen ab Auftragserteilung"' },
    },
    { name: 'note', label: 'Hinweis auf dem Angebot', type: 'textarea' },
    {
      name: 'inquiry',
      label: 'Aus Anfrage entstanden',
      type: 'relationship',
      relationTo: 'inquiries',
    },
  ],
}
