import type { GlobalConfig } from 'payload'

import { admins, anyone } from '../access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Website-Einstellungen',
  admin: {
    group: 'Verwaltung',
  },
  access: {
    read: anyone,
    update: admins,
  },
  fields: [
    {
      name: 'siteName',
      label: 'Website-Name',
      type: 'text',
      defaultValue: 'Vincent Hellmann',
    },
    {
      name: 'tagline',
      label: 'Slogan',
      type: 'text',
      localized: true,
    },
    {
      name: 'contact',
      label: 'Kontaktdaten',
      type: 'group',
      fields: [
        {
          name: 'phone',
          label: 'Telefon',
          type: 'text',
        },
        {
          name: 'email',
          label: 'E-Mail',
          type: 'email',
        },
        {
          name: 'company',
          label: 'Firma',
          type: 'text',
        },
        {
          name: 'address',
          label: 'Adresse',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'social',
      label: 'Social Media',
      type: 'group',
      fields: [
        {
          name: 'facebook',
          label: 'Facebook-URL',
          type: 'text',
        },
        {
          name: 'instagram',
          label: 'Instagram-URL',
          type: 'text',
        },
        {
          name: 'youtube',
          label: 'YouTube-URL',
          type: 'text',
        },
      ],
    },
    {
      name: 'pinterestVerification',
      label: 'Pinterest-Verifizierungscode',
      type: 'text',
      admin: {
        description:
          'Der Code aus dem Pinterest-Meta-Tag (Business-Konto → Einstellungen → Website beanspruchen). Nur der content-Wert, nicht das ganze Tag.',
      },
    },
    {
      name: 'seo',
      label: 'SEO-Standardwerte',
      type: 'group',
      fields: [
        {
          name: 'metaTitle',
          label: 'Meta-Titel',
          type: 'text',
          localized: true,
        },
        {
          name: 'metaDescription',
          label: 'Meta-Beschreibung',
          type: 'textarea',
          localized: true,
        },
      ],
    },
  ],
}
