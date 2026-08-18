import type { CollectionConfig } from 'payload'

import { office } from '../access'

/**
 * Geschäftspartner — Lieferanten für Belege, Kunden für Ausgangsrechnungen.
 * Bewusst eine gemeinsame Sammlung: viele Partner sind beides.
 */
export const Contacts: CollectionConfig = {
  slug: 'contacts',
  labels: {
    singular: 'Geschäftspartner',
    plural: 'Geschäftspartner',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'city'],
    group: 'Büro',
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
    { name: 'notes', label: 'Notiz', type: 'textarea' },
  ],
}
