import type { GlobalConfig } from 'payload'

import { admins, anyone } from '../access'

export const Legal: GlobalConfig = {
  slug: 'legal',
  label: 'Rechtliches',
  admin: {
    group: 'Inhalte',
  },
  access: {
    read: anyone,
    update: admins,
  },
  fields: [
    {
      name: 'impressum',
      label: 'Impressum',
      type: 'richText',
      localized: true,
    },
    {
      name: 'datenschutz',
      label: 'Datenschutzerklärung',
      type: 'richText',
      localized: true,
    },
    {
      name: 'agb',
      label: 'AGB',
      type: 'richText',
      localized: true,
    },
  ],
}
