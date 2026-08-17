import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'
import { postNewsToFacebook } from '../lib/facebook'

export const News: CollectionConfig = {
  slug: 'news',
  labels: {
    singular: 'News-Beitrag',
    plural: 'News',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedDate', '_status', 'facebookPostId'],
    group: 'Inhalte',
  },
  versions: {
    drafts: true,
  },
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  hooks: {
    afterChange: [postNewsToFacebook],
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
      name: 'publishedDate',
      label: 'Veröffentlichungsdatum',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: 'sidebar',
        date: {
          displayFormat: 'dd.MM.yyyy',
        },
      },
    },
    {
      name: 'coverImage',
      label: 'Titelbild',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'excerpt',
      label: 'Teaser / Kurztext',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Wird in der News-Übersicht und beim Facebook-Post verwendet',
      },
    },
    {
      name: 'content',
      label: 'Inhalt',
      type: 'richText',
      localized: true,
    },
    {
      name: 'postToFacebook',
      label: 'Beim Veröffentlichen auf Facebook posten',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Postet Titel, Teaser, Bild und Link auf die Facebook-Seite',
      },
    },
    {
      name: 'facebookPostId',
      label: 'Facebook Post-ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Wird automatisch gesetzt, wenn der Post erfolgreich war',
      },
    },
    {
      name: 'facebookPostError',
      label: 'Facebook-Fehler',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
