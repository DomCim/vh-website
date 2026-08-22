import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'
import { postNewsToFacebook } from '../lib/facebook'
import { indexNowHooks } from '../lib/indexnow'
import { autoSlug } from '../lib/slug'

/**
 * Nur Veröffentlichtes wird gemeldet — ein Entwurf hat draußen keine Seite,
 * und eine gemeldete Adresse, hinter der nichts steht, ist eine Fehlerseite
 * im Suchergebnis.
 */
const indexNowNews = indexNowHooks((doc) =>
  doc._status === 'published' && doc.slug ? `/news/${doc.slug}` : null,
)

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
    beforeValidate: [autoSlug()],
    // Ein Beitrag, den niemand kennt, ist kein Beitrag: veröffentlichte
    // Beiträge werden den Suchdiensten sofort gemeldet (siehe lib/indexnow.ts)
    afterChange: [postNewsToFacebook, ...indexNowNews.afterChange],
    afterDelete: indexNowNews.afterDelete,
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
      name: 'type',
      label: 'Rubrik',
      type: 'select',
      required: true,
      defaultValue: 'news',
      options: [
        { label: 'News', value: 'news' },
        { label: 'Ratgeber', value: 'ratgeber' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Ratgeber-Artikel bringen dauerhaft Google-Traffic (z.B. Material- und Pflegetipps)',
      },
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
        components: {
          afterInput: ['/components/admin/KiTextHilfe#KiNewsTeaser'],
        },
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
    {
      name: 'postToInstagram',
      label: 'Beim Veröffentlichen auf Instagram posten',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Postet Titelbild + Teaser auf das verknüpfte Instagram-Business-Konto',
      },
    },
    {
      name: 'instagramPostId',
      label: 'Instagram Post-ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'instagramPostError',
      label: 'Instagram-Fehler',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
