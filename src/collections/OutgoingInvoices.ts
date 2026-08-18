import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { naechsteRechnungsnummer } from '../lib/nummernkreis'

/**
 * Ausgangsrechnungen fürs Projektgeschäft — alles, was nicht über den Shop
 * läuft: Kommunen, Gewerbe, Sonderanfertigungen.
 *
 * Die Rechnungsnummer wird erst beim Festschreiben vergeben. Solange die
 * Rechnung Entwurf ist, hat sie keine — sonst entstünden Lücken in der Reihe,
 * sobald ein Entwurf verworfen wird.
 */
export const OutgoingInvoices: CollectionConfig = {
  slug: 'outgoing-invoices',
  labels: {
    singular: 'Ausgangsrechnung',
    plural: 'Ausgangsrechnungen',
  },
  admin: {
    useAsTitle: 'invoiceNumber',
    defaultColumns: ['invoiceNumber', 'customerName', 'issueDate', 'total', 'status'],
    group: 'Büro',
    description: 'Rechnungen an Kommunen, Gewerbe und Privat außerhalb des Shops.',
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
        // Summen immer neu rechnen — nie dem übergebenen Wert vertrauen
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

        // Nummer erst beim Festschreiben vergeben, und nur einmal
        const wirdFestgeschrieben =
          data.status && data.status !== 'entwurf' && originalDoc?.status === 'entwurf'
        const istNeuUndFest = operation === 'create' && data.status && data.status !== 'entwurf'
        if ((wirdFestgeschrieben || istNeuUndFest) && !data.invoiceNumber) {
          data.invoiceNumber = await naechsteRechnungsnummer(req.payload)
          if (!data.issueDate) data.issueDate = new Date().toISOString()
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
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'entwurf',
      options: [
        { label: 'Entwurf', value: 'entwurf' },
        { label: 'Gestellt', value: 'gestellt' },
        { label: 'Bezahlt', value: 'bezahlt' },
        { label: 'Storniert', value: 'storniert' },
      ],
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
      name: 'reverseCharge',
      label: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Bei Geschäftskunden im EU-Ausland mit gültiger USt-IdNr. — dann alle Sätze auf 0 setzen; der Hinweis erscheint auf der Rechnung.',
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
  ],
}
