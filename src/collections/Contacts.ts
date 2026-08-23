import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Geschäftspartner — Lieferanten für Belege, Kunden für Ausgangsrechnungen.
 * Bewusst eine gemeinsame Sammlung: viele Partner sind beides.
 */
export const Contacts: CollectionConfig = {
  slug: 'contacts',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
  labels: {
    singular: 'Geschäftspartner',
    plural: 'Geschäftspartner',
  },
  // Offene Büro-Seiten über Änderungen unterrichten
  hooks: liveHooks('partner'),
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'city'],
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
  fields: [
    { name: 'name', label: 'Name / Firma', type: 'text', required: true, index: true },
    {
      name: 'role',
      label: 'Art',
      type: 'select',
      defaultValue: 'beides',
      options: [
        { label: 'Lieferant', value: 'lieferant' },
        { label: 'Kunde', value: 'kunde' },
        { label: 'Dienstleister', value: 'dienstleister' },
        { label: 'Beides', value: 'beides' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        { name: 'email', label: 'E-Mail', type: 'email' },
        { name: 'phone', label: 'Telefon', type: 'text' },
      ],
    },
    { name: 'line1', label: 'Straße & Hausnummer', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'postalCode', label: 'PLZ', type: 'text' },
        { name: 'city', label: 'Ort', type: 'text' },
      ],
    },
    { name: 'country', label: 'Land', type: 'text', defaultValue: 'Frankreich' },
    {
      type: 'row',
      fields: [
        {
          name: 'vatId',
          label: 'USt-IdNr. / TVA',
          type: 'text',
          admin: {
            description:
              'Bei Geschäftskunden im EU-Ausland nötig — dann geht die Rechnung ohne Steuer raus (Reverse Charge).',
          },
        },
        { name: 'siret', label: 'SIRET', type: 'text' },
      ],
    },
    {
      name: 'defaultCategory',
      label: 'Übliche Ausgaben-Kategorie',
      type: 'text',
      admin: {
        description:
          'Wird bei neuen Belegen dieses Lieferanten vorgeschlagen — spart bei wiederkehrenden Rechnungen Zeit.',
      },
    },
    {
      /*
       * In welcher Sprache dieser Betrieb angeschrieben wird.
       *
       * Die Werkstatt steht in Frankreich und hat Kundschaft auf beiden Seiten
       * der Grenze. Ohne diese Angabe müsste jede Mail raten — am Land etwa,
       * und das geht schief, sobald jemand mit deutschem Namen in Frankreich
       * wohnt oder umgekehrt. Einmal eingestellt, stimmt es danach immer.
       */
      name: 'sprache',
      label: 'Sprache für Mails',
      type: 'select',
      defaultValue: 'de',
      options: [
        { label: 'Deutsch', value: 'de' },
        { label: 'Französisch', value: 'fr' },
        { label: 'Englisch', value: 'en' },
      ],
    },
    { name: 'notes', label: 'Notiz', type: 'textarea' },
  ],
}
