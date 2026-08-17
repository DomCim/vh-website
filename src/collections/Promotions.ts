import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'

export const Promotions: CollectionConfig = {
  slug: 'promotions',
  labels: {
    singular: 'Aktion',
    plural: 'Aktionen',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'discountType', 'discountValue', 'startDate', 'endDate', 'active'],
    group: 'Shop',
  },
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  fields: [
    {
      name: 'title',
      label: 'Titel',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'description',
      label: 'Beschreibung',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'image',
      label: 'Banner-Bild',
      type: 'upload',
      relationTo: 'media',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'discountType',
          label: 'Rabattart',
          type: 'select',
          required: true,
          defaultValue: 'percent',
          options: [
            { label: 'Prozent (%)', value: 'percent' },
            { label: 'Fester Betrag (EUR)', value: 'fixed' },
          ],
        },
        {
          name: 'discountValue',
          label: 'Rabattwert',
          type: 'number',
          required: true,
          min: 0,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startDate',
          label: 'Gültig ab',
          type: 'date',
          required: true,
          admin: {
            date: { displayFormat: 'dd.MM.yyyy' },
          },
        },
        {
          name: 'endDate',
          label: 'Gültig bis',
          type: 'date',
          required: true,
          admin: {
            date: { displayFormat: 'dd.MM.yyyy' },
          },
        },
      ],
    },
    {
      name: 'appliesTo',
      label: 'Gilt für',
      type: 'select',
      required: true,
      defaultValue: 'all',
      options: [
        { label: 'Alle Produkte', value: 'all' },
        { label: 'Bestimmte Kategorien', value: 'categories' },
        { label: 'Bestimmte Produkte', value: 'products' },
      ],
    },
    {
      name: 'categories',
      label: 'Kategorien',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        condition: (data) => data?.appliesTo === 'categories',
      },
    },
    {
      name: 'products',
      label: 'Produkte',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        condition: (data) => data?.appliesTo === 'products',
      },
    },
    {
      name: 'code',
      label: 'Gutscheincode (optional)',
      type: 'text',
      admin: {
        position: 'sidebar',
        description:
          'Mit Code: Rabatt gilt nur nach Eingabe im Warenkorb. Ohne Code: Rabatt gilt automatisch.',
      },
    },
    {
      name: 'active',
      label: 'Aktiv',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
