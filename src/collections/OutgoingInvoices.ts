import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { betraege } from '../lib/betraege'
import { naechsteRechnungsnummer } from '../lib/nummernkreis'
import { liveHooks } from '../lib/liveHooks'

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
    // Gepflegt wird das im Büro unter /office — Payload ist die
    // öffentliche Verwaltung, alles Interne hat dort genau einen Platz.
    hidden: true,
    description: 'Rechnungen an Kommunen, Gewerbe und Privat außerhalb des Shops.',
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  hooks: {
    afterDelete: liveHooks('rechnungen').afterDelete,
    afterChange: liveHooks('rechnungen').afterChange,
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        // Summen immer neu rechnen — nie dem übergebenen Wert vertrauen
        const summen = betraege(data.items ?? [], {
          discountKind: data.discountKind,
          discountValue: data.discountValue,
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
    {
      name: 'quote',
      label: 'Aus Angebot entstanden',
      type: 'relationship',
      relationTo: 'quotes',
      admin: { readOnly: true, description: 'Wird beim Umwandeln eines Angebots gesetzt.' },
    },
  ],
}
