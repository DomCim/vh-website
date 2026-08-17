import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  labels: {
    singular: 'Kundenstimme',
    plural: 'Kundenstimmen',
  },
  admin: {
    useAsTitle: 'author',
    defaultColumns: ['author', 'context', 'featured'],
    group: 'Inhalte',
    description:
      'Nur echte Stimmen mit Einverständnis der Kunden eintragen — erfundene Bewertungen sind wettbewerbswidrig.',
  },
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  fields: [
    {
      name: 'quote',
      label: 'Zitat',
      type: 'textarea',
      required: true,
      localized: true,
    },
    {
      name: 'author',
      label: 'Name',
      type: 'text',
      required: true,
      admin: {
        description: 'z.B. "Familie M." oder "Stadt Naila" — so wie es öffentlich stehen darf',
      },
    },
    {
      name: 'context',
      label: 'Kontext (optional)',
      type: 'text',
      localized: true,
      admin: {
        description: 'z.B. "Outdoor-Sofa OS, München"',
      },
    },
    {
      name: 'product',
      label: 'Zugehöriges Produkt (optional)',
      type: 'relationship',
      relationTo: 'products',
      admin: {
        description: 'Wird dann auf der Produktseite angezeigt',
      },
    },
    {
      name: 'featured',
      label: 'Auf Startseite zeigen',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
