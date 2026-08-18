import type { CollectionConfig } from 'payload'

import { office } from '../access'

/**
 * Ausgangsprotokoll für alles, was das System verschickt.
 *
 * Bestellbestätigungen, Versandmails, Zugangscodes — sie gehen automatisch
 * raus, und niemand sieht sie. Kommt die Frage „ich habe nie eine Bestätigung
 * bekommen", steht hier, ob sie verschickt wurde, an welche Adresse und was
 * der Mailserver dazu gesagt hat.
 *
 * Nur Kopfdaten, kein Inhalt: Ein vollständiges Archiv aller Kundenmails wäre
 * mehr gespeicherte Nachricht, als für die Frage nötig ist.
 */
export const MailLog: CollectionConfig = {
  slug: 'mail-log',
  labels: {
    singular: 'Ausgangsprotokoll',
    plural: 'Ausgangsprotokoll',
  },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'to', 'status', 'createdAt'],
    // Zu sehen im Büro unter /office/post/protokoll
    hidden: true,
  },
  access: {
    read: office,
    create: () => false,
    update: () => false,
    delete: office,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'to', label: 'Empfänger', type: 'text', required: true, index: true },
        { name: 'from', label: 'Absender', type: 'text' },
      ],
    },
    { name: 'subject', label: 'Betreff', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          label: 'Ergebnis',
          type: 'select',
          required: true,
          defaultValue: 'gesendet',
          options: [
            { label: 'Gesendet', value: 'gesendet' },
            { label: 'Fehlgeschlagen', value: 'fehler' },
            { label: 'Nur protokolliert (kein SMTP)', value: 'ohneVersand' },
          ],
          index: true,
        },
        {
          name: 'kind',
          label: 'Anlass',
          type: 'select',
          defaultValue: 'sonstiges',
          options: [
            { label: 'Bestellbestätigung', value: 'bestellung' },
            { label: 'Fertigung begonnen', value: 'fertigung' },
            { label: 'Versandmeldung', value: 'versand' },
            { label: 'Anfrage eingegangen', value: 'anfrage' },
            { label: 'Zugangscode', value: 'zugangscode' },
            { label: 'Aus dem Postfach geschrieben', value: 'postfach' },
            { label: 'Sonstiges', value: 'sonstiges' },
          ],
          index: true,
        },
      ],
    },
    {
      name: 'error',
      label: 'Fehlermeldung',
      type: 'textarea',
      admin: { description: 'Antwort des Mailservers, wenn der Versand nicht geklappt hat.' },
    },
    {
      name: 'attachments',
      label: 'Anhänge',
      type: 'text',
      admin: { description: 'Dateinamen, durch Komma getrennt.' },
    },
    { name: 'order', label: 'Bestellung', type: 'relationship', relationTo: 'orders' },
    { name: 'inquiry', label: 'Anfrage', type: 'relationship', relationTo: 'inquiries' },
  ],
}
