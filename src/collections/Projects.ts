import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'
import { autoSlug } from '../lib/slug'

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: {
    singular: 'Referenz-Projekt',
    plural: 'Referenzen',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sector', 'year', 'featured'],
    group: 'Inhalte',
  },
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  hooks: {
    beforeValidate: [autoSlug()],
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
      name: 'slug',
      label: 'URL-Pfad (Slug)',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Leer lassen = wird automatisch aus dem Titel erzeugt',
      },
    },
    {
      name: 'sector',
      label: 'Bereich',
      type: 'select',
      required: true,
      defaultValue: 'gewerbe',
      options: [
        { label: 'Kommunen & öffentliche Hand', value: 'kommunal' },
        { label: 'Gewerbe & Unternehmen', value: 'gewerbe' },
        { label: 'Privat', value: 'privat' },
      ],
    },
    {
      name: 'images',
      label: 'Bilder',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      required: true,
    },
    {
      name: 'summary',
      label: 'Kurzbeschreibung',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'description',
      label: 'Beschreibung',
      type: 'richText',
      localized: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'client',
          label: 'Auftraggeber / Ort (optional)',
          type: 'text',
        },
        {
          name: 'year',
          label: 'Jahr',
          type: 'number',
          min: 2000,
          max: 2100,
        },
      ],
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
    {
      name: 'order',
      label: 'Reihenfolge',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
