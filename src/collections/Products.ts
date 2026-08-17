import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'

export const Products: CollectionConfig = {
  slug: 'products',
  labels: {
    singular: 'Produkt',
    plural: 'Produkte',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'price', 'available'],
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
      name: 'slug',
      label: 'URL-Pfad (Slug)',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'category',
      label: 'Kategorie',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
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
      name: 'shortDescription',
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
      name: 'price',
      label: 'Grundpreis (EUR)',
      type: 'number',
      min: 0,
      admin: {
        description: 'Preis in Euro, z.B. 1490.00. Bei Varianten gilt der Variantenpreis.',
        condition: (data) => !data?.onRequestOnly,
      },
    },
    {
      name: 'variants',
      label: 'Varianten',
      type: 'array',
      labels: {
        singular: 'Variante',
        plural: 'Varianten',
      },
      admin: {
        description: 'z.B. Größen oder Ausführungen mit eigenem Preis',
        condition: (data) => !data?.onRequestOnly,
      },
      fields: [
        {
          name: 'title',
          label: 'Bezeichnung',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'price',
          label: 'Preis (EUR)',
          type: 'number',
          required: true,
          min: 0,
        },
      ],
    },
    {
      name: 'colorOptions',
      label: 'Farboptionen',
      type: 'array',
      labels: {
        singular: 'Farbe',
        plural: 'Farben',
      },
      admin: {
        description: 'Wählbare Farben (RAL o.ä.), ohne Aufpreis',
      },
      fields: [
        {
          name: 'name',
          label: 'Farbname',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'hex',
          label: 'Farbwert (Hex, optional)',
          type: 'text',
          admin: {
            description: 'z.B. #b32428 — für die Farbvorschau',
          },
        },
      ],
    },
    {
      name: 'onRequestOnly',
      label: 'Nur auf Anfrage (kein Online-Kauf)',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Statt Warenkorb wird ein Anfrage-Button angezeigt',
      },
    },
    {
      name: 'available',
      label: 'Verfügbar',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'featured',
      label: 'Auf Startseite hervorheben',
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
        description: 'Kleinere Zahl = weiter vorne in der Kategorie',
      },
    },
  ],
}
