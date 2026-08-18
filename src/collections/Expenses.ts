import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { AUSGABEN_KATEGORIEN } from '../lib/listen'
import { liveHooks } from '../lib/liveHooks'

export { AUSGABEN_KATEGORIEN }


/**
 * Eingangsrechnungen und Belege.
 *
 * Der Scan bleibt immer am Eintrag hängen — zu jeder Buchung gehört ein Beleg,
 * sonst nützt die schönste Aufstellung dem Steuerberater nichts.
 */
export const Expenses: CollectionConfig = {
  slug: 'expenses',
  labels: {
    singular: 'Beleg',
    plural: 'Belege & Ausgaben',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'invoiceDate', 'grossAmount', 'category', 'paid'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office — Payload ist die
    // öffentliche Verwaltung, alles Interne hat dort genau einen Platz.
    hidden: true,
    description: 'Eingangsrechnungen, Quittungen und alles, was Geld gekostet hat.',
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  hooks: {
    afterDelete: liveHooks('belege').afterDelete,
    afterChange: liveHooks('belege').afterChange,
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        // Steuer aus Netto und Satz ableiten, wenn sie nicht ausdrücklich dasteht.
        const netto = typeof data.netAmount === 'number' ? data.netAmount : null
        const satz = typeof data.vatRate === 'number' ? data.vatRate : null
        if (netto !== null && satz !== null) {
          const steuer = Math.round(netto * (satz / 100) * 100) / 100
          if (data.vatAmount === undefined || data.vatAmount === null) data.vatAmount = steuer
          if (data.grossAmount === undefined || data.grossAmount === null) {
            data.grossAmount = Math.round((netto + steuer) * 100) / 100
          }
        }
        // Sprechender Titel, falls keiner gesetzt wurde
        if (!data.title) {
          const teile = [data.supplierName, data.invoiceNumber].filter(Boolean)
          if (teile.length) data.title = teile.join(' · ')
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'document',
      label: 'Beleg (Scan oder PDF)',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Foto oder PDF der Rechnung. Wird für den Steuer-Export mit ausgegeben.',
      },
    },
    { name: 'title', label: 'Bezeichnung', type: 'text' },
    {
      type: 'row',
      fields: [
        {
          name: 'supplier',
          label: 'Lieferant',
          type: 'relationship',
          relationTo: 'contacts',
        },
        {
          name: 'supplierName',
          label: 'Lieferant (Text)',
          type: 'text',
          admin: { description: 'Falls noch kein Geschäftspartner angelegt ist.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'invoiceNumber', label: 'Rechnungsnummer', type: 'text' },
        { name: 'invoiceDate', label: 'Rechnungsdatum', type: 'date', required: true },
        {
          name: 'dueDate',
          label: 'Zahlbar bis',
          type: 'date',
          admin: {
            description:
              'Steht ein Zahlungsziel auf dem Beleg, liest die KI es mit. Vorher bleibt es still; ab drei Tagen vor Fälligkeit meldet sich das Büro jeden Tag, bis der Beleg auf „bezahlt" steht.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'netAmount', label: 'Netto (EUR)', type: 'number', min: 0 },
        { name: 'vatRate', label: 'Steuersatz (%)', type: 'number', min: 0, max: 30 },
        { name: 'vatAmount', label: 'Steuer (EUR)', type: 'number', min: 0 },
        { name: 'grossAmount', label: 'Brutto (EUR)', type: 'number', required: true, min: 0 },
      ],
    },
    {
      name: 'category',
      label: 'Kategorie',
      type: 'select',
      required: true,
      defaultValue: 'sonstiges',
      options: [...AUSGABEN_KATEGORIEN],
      admin: { position: 'sidebar' },
    },
    {
      name: 'paymentMethod',
      label: 'Bezahlt per',
      type: 'select',
      options: [
        { label: 'Überweisung', value: 'ueberweisung' },
        { label: 'Karte', value: 'karte' },
        { label: 'Bar', value: 'bar' },
        { label: 'Lastschrift', value: 'lastschrift' },
        { label: 'PayPal', value: 'paypal' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'paid',
      label: 'Bezahlt',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    {
      // Damit die tägliche Erinnerung wirklich täglich kommt und nicht bei
      // jedem Lauf des Wartungs-Cron. Wird ausschließlich vom Cron gesetzt.
      name: 'reminderSentAt',
      label: 'Zuletzt erinnert am',
      type: 'date',
      admin: { readOnly: true, hidden: true },
    },
    {
      name: 'deductible',
      label: 'Steuerlich absetzbar',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Abwählen bei privaten Anteilen — erscheint dann nicht im Steuer-Export.',
      },
    },
    { name: 'notes', label: 'Notiz', type: 'textarea' },
    {
      name: 'extraction',
      label: 'Automatisch ausgelesen',
      type: 'group',
      admin: {
        description: 'Ergebnis der KI-Auslesung — bitte immer gegen den Beleg prüfen.',
        condition: (data) => Boolean(data?.extraction?.status),
      },
      fields: [
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Ausgelesen, ungeprüft', value: 'ungeprueft' },
            { label: 'Geprüft und bestätigt', value: 'bestaetigt' },
            { label: 'Auslesen fehlgeschlagen', value: 'fehler' },
          ],
          admin: { readOnly: true },
        },
        { name: 'confidence', label: 'Sicherheit', type: 'number', admin: { readOnly: true } },
        { name: 'note', label: 'Hinweis der KI', type: 'textarea', admin: { readOnly: true } },
      ],
    },
  ],
}
