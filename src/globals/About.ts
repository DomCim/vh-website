import type { GlobalConfig } from 'payload'

import { admins, anyone } from '../access'

export const About: GlobalConfig = {
  slug: 'about',
  label: 'Über uns',
  admin: {
    group: 'Inhalte',
  },
  access: {
    read: anyone,
    update: admins,
  },
  fields: [
    {
      name: 'heroImage',
      label: 'Titelbild',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'title',
      label: 'Überschrift',
      type: 'text',
      localized: true,
    },
    {
      name: 'intro',
      label: 'Einleitung',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'timeline',
      label: 'Stationen (Timeline)',
      type: 'array',
      labels: {
        singular: 'Station',
        plural: 'Stationen',
      },
      fields: [
        {
          name: 'year',
          label: 'Jahr',
          type: 'text',
          required: true,
          admin: {
            description: 'z.B. "2025" oder "seit 2020"',
          },
        },
        {
          name: 'title',
          label: 'Titel',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'text',
          label: 'Text',
          type: 'textarea',
          localized: true,
        },
        {
          name: 'image',
          label: 'Bild (optional)',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'gallery',
      label: 'Werkstatt-Bilder',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
    },
  ],
}
