import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Kontobewegungen — was die Bank meldet.
 *
 * Warum das überhaupt hier liegt und nicht nur beim Zuordnen durchgereicht
 * wird: Ein Kontoauszug wird mit Überschneidung geholt, und dieselbe Buchung
 * kommt dann zweimal. Nur wer sie behält, erkennt sie wieder. Und wer eine
 * Zahlung bewusst liegen lässt („das ist die Rückerstattung, keine Rechnung"),
 * will sie beim nächsten Import nicht wieder vorgelegt bekommen.
 *
 * Gespeichert wird ausschließlich, was auf dem Auszug steht. Es ist kein
 * zweites Buchhaltungssystem: Die Bewegung führt zur Rechnung, und die Rechnung
 * bleibt die Wahrheit.
 */
export const BankTransactions: CollectionConfig = {
  slug: 'bank-transactions',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
  labels: {
    singular: 'Kontobewegung',
    plural: 'Kontobewegungen',
  },
  hooks: liveHooks('kontobewegungen'),
  admin: {
    useAsTitle: 'purpose',
    defaultColumns: ['bookingDate', 'counterparty', 'amount', 'status'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office — Payload ist die
    // öffentliche Verwaltung, alles Interne hat dort genau einen Platz.
    hidden: true,
    description: 'Eingelesene Kontoauszüge und ihre Zuordnung zu Rechnungen.',
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  fields: [
    {
      /*
       * Der Fingerabdruck aus Tag, Betrag, Gegenpartei und Zweck.
       *
       * Eindeutig, damit derselbe Auszug zweimal eingelesen nichts verdoppelt.
       * Die Datenbank ist hier der bessere Wächter als eine Abfrage vorher:
       * Zwei gleichzeitige Importe würden sich sonst gegenseitig durchlassen.
       */
      name: 'fingerprint',
      label: 'Fingerabdruck',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'status',
      label: 'Stand',
      type: 'select',
      required: true,
      defaultValue: 'offen',
      options: [
        { label: 'Offen', value: 'offen' },
        { label: 'Zugeordnet', value: 'zugeordnet' },
        { label: 'Beiseite gelegt', value: 'ignoriert' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        { name: 'bookingDate', label: 'Buchungstag', type: 'date', required: true, index: true },
        {
          name: 'amount',
          label: 'Betrag (EUR)',
          type: 'number',
          required: true,
          admin: { description: 'Positiv ist ein Eingang, negativ eine Abbuchung.' },
        },
      ],
    },
    { name: 'counterparty', label: 'Gegenpartei', type: 'text' },
    {
      name: 'purpose',
      label: 'Verwendungszweck',
      type: 'textarea',
      admin: { description: 'Hier steht die Rechnungsnummer, wenn der GiroCode benutzt wurde.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'iban', label: 'IBAN der Gegenpartei', type: 'text' },
        { name: 'currency', label: 'Währung', type: 'text', defaultValue: 'EUR' },
      ],
    },
    {
      name: 'invoice',
      label: 'Zugeordnete Rechnung',
      type: 'relationship',
      relationTo: 'outgoing-invoices',
      index: true,
      admin: { description: 'Wird beim Zuordnen gesetzt und setzt die Rechnung auf „bezahlt".' },
    },
    {
      name: 'matchedAt',
      label: 'Zugeordnet am',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'source',
      label: 'Herkunft',
      type: 'select',
      defaultValue: 'csv',
      options: [
        { label: 'CSV-Datei', value: 'csv' },
        { label: 'CAMT.053', value: 'camt' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'note', label: 'Notiz', type: 'textarea' },
  ],
}
