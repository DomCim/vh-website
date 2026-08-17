import type { GlobalConfig } from 'payload'

import { admins } from '../access'

/**
 * Zugangsdaten für E-Mail, Stripe und Facebook — pflegbar im Admin.
 * Leere Felder fallen auf die gleichnamigen Umgebungsvariablen zurück.
 * Nur für eingeloggte Benutzer lesbar (enthält Geheimnisse!).
 */
export const Integrations: GlobalConfig = {
  slug: 'integrations',
  label: 'Integrationen',
  admin: {
    group: 'Verwaltung',
    description:
      'Zugangsdaten für E-Mail-Versand, Stripe und Facebook. Leere Felder nutzen die im Server hinterlegten Umgebungsvariablen.',
  },
  access: {
    read: admins,
    update: admins,
  },
  fields: [
    {
      name: 'email',
      label: 'E-Mail-Versand (SMTP)',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'smtpHost',
              label: 'SMTP-Server',
              type: 'text',
              admin: { description: 'z.B. smtp.strato.de' },
            },
            {
              name: 'smtpPort',
              label: 'Port',
              type: 'number',
              admin: { description: '587 (STARTTLS) oder 465 (SSL)' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'smtpUser',
              label: 'Benutzername',
              type: 'text',
            },
            {
              name: 'smtpPass',
              label: 'Passwort',
              type: 'text',
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'fromAddress',
              label: 'Absender-Adresse',
              type: 'email',
              admin: { description: 'z.B. info@vincent-hellmann.com' },
            },
            {
              name: 'fromName',
              label: 'Absender-Name',
              type: 'text',
              admin: { description: 'z.B. Vincent Hellmann' },
            },
          ],
        },
        {
          name: 'notificationEmail',
          label: 'Benachrichtigungen an',
          type: 'email',
          admin: {
            description: 'Empfängt Kontaktanfragen und Bestell-Benachrichtigungen',
          },
        },
      ],
    },
    {
      name: 'stripe',
      label: 'Stripe (Zahlungen)',
      type: 'group',
      fields: [
        {
          name: 'secretKey',
          label: 'Secret Key',
          type: 'text',
          admin: {
            description: 'sk_test_… oder sk_live_… (Stripe-Dashboard → API-Keys)',
          },
        },
        {
          name: 'webhookSecret',
          label: 'Webhook Signing Secret',
          type: 'text',
          admin: {
            description: 'whsec_… des Webhook-Endpunkts /api/stripe-webhook',
          },
        },
      ],
    },
    {
      name: 'facebook',
      label: 'Facebook (News-Autopost)',
      type: 'group',
      fields: [
        {
          name: 'pageId',
          label: 'Seiten-ID',
          type: 'text',
        },
        {
          name: 'accessToken',
          label: 'Page Access Token',
          type: 'text',
          admin: {
            description: 'Langlebiger Token einer Meta-App mit pages_manage_posts',
          },
        },
      ],
    },
  ],
}
