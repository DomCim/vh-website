import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: 'Kategorie',
    plural: 'Kategorien',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'parent', 'order'],
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
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      label: 'URL-Pfad (Slug)',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'z.B. "outdoor-moebel" — wird in der URL verwendet',
      },
    },
    {
      name: 'description',
      label: 'Beschreibung',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'image',
      label: 'Titelbild',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'parent',
      label: 'Übergeordnete Kategorie',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        description: 'Leer lassen für Hauptkategorien (erscheinen im Menü)',
      },
    },
    {
      name: 'order',
      label: 'Reihenfolge',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Kleinere Zahl = weiter vorne im Menü',
      },
    },
  ],
}
