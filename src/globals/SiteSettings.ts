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
      name: 'company',
      label: 'Firmen-/Steuerangaben',
      type: 'group',
      admin: {
        description:
          'Pflichtangaben für Bestellbestätigungen (französische SAS): SIRET und TVA-Nummer erscheinen in der Fußzeile der Bestell-Mails.',
      },
      fields: [
        {
          name: 'siret',
          label: 'SIRET-Nummer',
          type: 'text',
        },
        {
          name: 'vatId',
          label: 'TVA-Nummer (intracommunautaire)',
          type: 'text',
          admin: {
            description: 'z.B. FR12345678901',
          },
        },
        {
          name: 'vatRate',
          label: 'MwSt.-/TVA-Satz (%)',
          type: 'number',
          defaultValue: 20,
          min: 0,
          max: 30,
          admin: {
            description:
              'Wird für den Steuerausweis aus den Bruttopreisen herausgerechnet (Frankreich: 20). Hinweis: Ab 10.000 € EU-Fernverkauf/Jahr greift das OSS-Verfahren — mit dem Steuerberater klären.',
          },
        },
      ],
    },
    {
      name: 'craft',
      label: 'Handarbeit & Fertigung',
      type: 'group',
      admin: {
        description:
          'Es gibt keine Serienfertigung — jedes Stück entsteht einzeln. Diese Texte erscheinen am Produkt, in der Kasse und in den Bestellmails.',
      },
      fields: [
        {
          name: 'notice',
          label: 'Handarbeits-Hinweis',
          type: 'textarea',
          localized: true,
          admin: {
            description:
              'Kündigt Abweichungen vor dem Kauf an — das ist der rechtlich saubere Weg.',
          },
        },
        {
          name: 'defaultProductionTime',
          label: 'Standard-Fertigungszeit',
          type: 'text',
          localized: true,
          admin: {
            description: 'Gilt für alle Produkte ohne eigene Angabe, z.B. „3–4 Wochen".',
          },
        },
      ],
    },
    {
      name: 'analytics',
      label: 'Besucherstatistik (optional)',
      type: 'group',
      admin: {
        description:
          'Für cookiefreie Statistik wie selbst gehostetes Plausible oder Umami — dann ist kein Cookie-Banner nötig. Leer lassen = keine Statistik.',
      },
      fields: [
        {
          name: 'scriptUrl',
          label: 'Skript-URL',
          type: 'text',
          admin: { description: 'z.B. https://statistik.example.com/script.js' },
        },
        {
          name: 'domain',
          label: 'Erfasste Domain',
          type: 'text',
          admin: { description: 'z.B. vincent-hellmann.com' },
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
