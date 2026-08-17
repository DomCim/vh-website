import type { CollectionConfig } from 'payload'

import { admins } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Benutzer',
    plural: 'Benutzer',
  },
  auth: true,
  admin: {
    useAsTitle: 'email',
    group: 'Verwaltung',
  },
  access: {
    read: admins,
    create: admins,
    update: admins,
    delete: admins,
  },
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
    },
  ],
}
