import type { GlobalConfig } from 'payload'

import { admins, anyone } from '../access'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Startseite',
  admin: {
    group: 'Inhalte',
  },
  access: {
    read: anyone,
    update: admins,
  },
  fields: [
    {
      name: 'heroSlides',
      label: 'Hero-Slider',
      type: 'array',
      labels: {
        singular: 'Slide',
        plural: 'Slides',
      },
      maxRows: 8,
      fields: [
        {
          name: 'image',
          label: 'Bild',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'title',
          label: 'Titel',
          type: 'text',
          localized: true,
        },
        {
          name: 'subtitle',
          label: 'Untertitel',
          type: 'text',
          localized: true,
        },
        {
          name: 'link',
          label: 'Link (z.B. /outdoor-moebel)',
          type: 'text',
        },
      ],
    },
    {
      name: 'missionTitle',
      label: 'Mission — Überschrift',
      type: 'text',
      localized: true,
    },
    {
      name: 'missionText',
      label: 'Mission — Text',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'gallery',
      label: 'Werkstatt-Galerie',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
    },
    {
      name: 'highlights',
      label: 'Service-Highlights',
      type: 'array',
      labels: {
        singular: 'Highlight',
        plural: 'Highlights',
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
          name: 'text',
          label: 'Text',
          type: 'textarea',
          localized: true,
        },
      ],
    },
    {
      name: 'values',
      label: 'Werte',
      type: 'array',
      labels: {
        singular: 'Wert',
        plural: 'Werte',
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
          name: 'text',
          label: 'Text',
          type: 'textarea',
          localized: true,
        },
      ],
    },
  ],
}
