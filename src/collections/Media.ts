import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Medien',
    plural: 'Medien',
  },
  admin: {
    group: 'Verwaltung',
  },
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 480,
        withoutEnlargement: true,
      },
      {
        name: 'card',
        width: 900,
        withoutEnlargement: true,
      },
      {
        name: 'large',
        width: 1800,
        withoutEnlargement: true,
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      label: 'Alternativtext',
      type: 'text',
      localized: true,
    },
  ],
}
