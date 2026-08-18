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
      name: 'push',
      label: 'Benachrichtigungen (Büro-App)',
      type: 'group',
      admin: {
        description:
          'Schlüssel für die Push-Benachrichtigungen der Büro-App. Wird beim ersten Mal automatisch erzeugt — hier ist nichts einzutragen. Wer den Schlüssel austauscht, muss alle Geräte neu anmelden.',
      },
      fields: [
        {
          name: 'publicKey',
          label: 'Öffentlicher Schlüssel',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'privateKey',
          label: 'Privater Schlüssel',
          type: 'text',
          admin: { readOnly: true, hidden: true },
        },
        {
          name: 'subject',
          label: 'Kontaktadresse für den Push-Dienst',
          type: 'text',
          defaultValue: 'mailto:info@vincent-hellmann.com',
          admin: {
            description: 'Verlangen die Push-Dienste, falls es Rückfragen zum Versand gibt.',
          },
        },
      ],
    },
    {
      name: 'mailboxes',
      label: 'Postfächer (IMAP)',
      labels: { singular: 'Postfach', plural: 'Postfächer' },
      type: 'array',
      admin: {
        description:
          'Postfächer, die im Büro unter /office/post gelesen und beantwortet werden — z.B. info@ und bestellungen@. Die Website selbst verschickt weiterhin über die Absenderadresse oben (noreply@), die hier nicht eingetragen werden muss.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'label',
              label: 'Bezeichnung',
              type: 'text',
              required: true,
              admin: { description: 'z.B. „Info" — steht so in der Auswahl im Büro.' },
            },
            {
              name: 'address',
              label: 'E-Mail-Adresse',
              type: 'email',
              required: true,
              admin: { description: 'Wird beim Antworten als Absender verwendet.' },
            },
            {
              name: 'isDefault',
              label: 'Beim Öffnen zeigen',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'imapHost',
              label: 'IMAP-Server',
              type: 'text',
              required: true,
              admin: { description: 'z.B. imap.strato.de' },
            },
            {
              name: 'imapPort',
              label: 'Port',
              type: 'number',
              defaultValue: 993,
              admin: { description: '993 (SSL) oder 143 (STARTTLS)' },
            },
            {
              name: 'imapSecure',
              label: 'Verschlüsselt (SSL)',
              type: 'checkbox',
              defaultValue: true,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'user', label: 'Benutzername', type: 'text', required: true },
            {
              name: 'pass',
              label: 'Passwort',
              type: 'text',
              required: true,
              admin: {
                description: 'Wird nur serverseitig verwendet und nie an den Browser ausgeliefert.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'sentMailbox',
              label: 'Ordner „Gesendet"',
              type: 'text',
              defaultValue: 'Sent',
              admin: { description: 'Bei manchen Anbietern „Gesendete Objekte" oder „INBOX.Sent".' },
            },
            {
              name: 'trashMailbox',
              label: 'Ordner „Papierkorb"',
              type: 'text',
              defaultValue: 'Trash',
            },
          ],
        },
        {
          name: 'signature',
          label: 'Signatur',
          type: 'textarea',
          admin: {
            description:
              'Wird unter jede Mail gesetzt, die aus dem Büro rausgeht. Ohne Eintrag entsteht sie aus Absendername und den Kontaktdaten der Website-Einstellungen. Firmierung, SIRET und TVA werden ohnehin automatisch angehängt — das ist Pflicht.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'smtpHost',
              label: 'Eigener SMTP-Server (optional)',
              type: 'text',
              admin: {
                description:
                  'Nur nötig, wenn dieses Postfach über einen anderen Server verschickt als oben eingestellt.',
              },
            },
            { name: 'smtpPort', label: 'Port', type: 'number' },
            { name: 'smtpUser', label: 'Benutzername', type: 'text' },
            { name: 'smtpPass', label: 'Passwort', type: 'text' },
          ],
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
      name: 'paypal',
      label: 'PayPal (Zahlungen)',
      type: 'group',
      fields: [
        {
          name: 'clientId',
          label: 'Client-ID',
          type: 'text',
          admin: {
            description: 'Aus dem PayPal-Developer-Dashboard (REST-App)',
          },
        },
        {
          name: 'clientSecret',
          label: 'Client Secret',
          type: 'text',
        },
        {
          name: 'sandbox',
          label: 'Sandbox-Modus (Testumgebung)',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Aktivieren, solange mit Sandbox-Zugangsdaten getestet wird',
          },
        },
      ],
    },
    {
      name: 'anthropic',
      label: 'KI-Funktionen (Claude)',
      type: 'group',
      admin: {
        description:
          'Schlüssel von console.anthropic.com. Damit liest die Verwaltung hochgeladene Belege aus und schlägt Texte und Übersetzungen vor. Ohne Schlüssel bleiben diese Knöpfe einfach aus.',
      },
      fields: [
        {
          name: 'apiKey',
          label: 'Anthropic API-Schlüssel',
          type: 'text',
          admin: { description: 'Beginnt mit sk-ant-…' },
        },
        {
          name: 'model',
          label: 'Modell',
          type: 'text',
          defaultValue: 'claude-opus-5',
          admin: {
            description: 'Nur ändern, wenn es einen Grund gibt. Standard: claude-opus-5.',
          },
        },
      ],
    },
    {
      name: 'mcp',
      label: 'KI-Assistent (MCP-Server)',
      type: 'group',
      admin: {
        description:
          'Zugang für die Verwaltung per Claude. Ohne Schlüssel ist der Endpunkt abgeschaltet.',
      },
      fields: [
        {
          name: 'apiKey',
          label: 'Schlüssel (voller Zugriff)',
          type: 'text',
          admin: {
            description:
              'Wirkt wie ein Admin-Passwort — nur an vertrauenswürdige Geräte weitergeben.',
          },
        },
        {
          name: 'readonlyKey',
          label: 'Schlüssel (nur lesen)',
          type: 'text',
          admin: {
            description:
              'Optional. Mit diesem Schlüssel lassen sich Inhalte und Auswertungen nur ansehen.',
          },
        },
        {
          name: 'zugang',
          type: 'ui',
          admin: {
            components: {
              Field: '/components/admin/McpZugang#McpZugang',
            },
          },
        },
      ],
    },
    {
      name: 'sicherung',
      label: 'Sicherung (Netzwerkspeicher)',
      type: 'group',
      admin: {
        description:
          'Jede Sicherung enthält die vollständige Datenbank und alle Bilder. Ohne zweiten Ort ist sie nur eine Schönwetter-Kopie — deshalb hier die NAS eintragen. Bedient wird das Ganze im Büro unter Sicherung.',
      },
      fields: [
        {
          name: 'protokoll',
          label: 'Übertragungsweg',
          type: 'select',
          defaultValue: 'smb',
          options: [
            { label: 'Samba/Windows (CIFS) — für die NAS', value: 'smb' },
            { label: 'WebDAV (Nextcloud/ownCloud)', value: 'webdav' },
          ],
        },
        {
          type: 'row',
          admin: { condition: (_, gesch) => gesch?.protokoll !== 'webdav' },
          fields: [
            { name: 'smbServer', label: 'Server (IP oder Name)', type: 'text' },
            { name: 'smbFreigabe', label: 'Freigabe', type: 'text' },
          ],
        },
        {
          name: 'smbPfad',
          label: 'Unterordner in der Freigabe',
          type: 'text',
          admin: {
            condition: (_, gesch) => gesch?.protokoll !== 'webdav',
            description: 'Optional, z.B. sicherungen/vh — der Ordner muss auf der NAS schon bestehen.',
          },
        },
        {
          type: 'row',
          admin: { condition: (_, gesch) => gesch?.protokoll !== 'webdav' },
          fields: [
            { name: 'smbBenutzer', label: 'Benutzer', type: 'text' },
            { name: 'smbPasswort', label: 'Passwort', type: 'text' },
          ],
        },
        {
          name: 'webdavUrl',
          label: 'WebDAV-Ordner-Adresse',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll === 'webdav' },
        },
        {
          type: 'row',
          admin: { condition: (_, gesch) => gesch?.protokoll === 'webdav' },
          fields: [
            { name: 'webdavBenutzer', label: 'Benutzer', type: 'text' },
            {
              name: 'webdavPasswort',
              label: 'Passwort',
              type: 'text',
              admin: { description: 'Bei Nextcloud/ownCloud ein App-Passwort verwenden.' },
            },
          ],
        },
        {
          name: 'automatik',
          label: 'Jede Nacht automatisch sichern',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'uhrzeit',
              label: 'Uhrzeit',
              type: 'text',
              defaultValue: '03:30',
              admin: { description: 'Format HH:MM, Zeitzone des Servers.' },
            },
            {
              name: 'behaltenLokal',
              label: 'Kopien auf dem Server behalten',
              type: 'number',
              defaultValue: 7,
              min: 1,
              max: 50,
            },
            {
              name: 'behaltenNas',
              label: 'Kopien auf der NAS behalten',
              type: 'number',
              defaultValue: 30,
              min: 1,
              max: 365,
            },
          ],
        },
      ],
    },
    {
      name: 'facebook',
      label: 'Facebook & Instagram (News-Autopost)',
      type: 'group',
      fields: [
        {
          name: 'pageId',
          label: 'Facebook-Seiten-ID',
          type: 'text',
        },
        {
          name: 'accessToken',
          label: 'Page Access Token',
          type: 'text',
          admin: {
            description:
              'Langlebiger Token einer Meta-App mit pages_manage_posts (für Instagram zusätzlich instagram_content_publish)',
          },
        },
        {
          name: 'instagramAccountId',
          label: 'Instagram-Business-Account-ID',
          type: 'text',
          admin: {
            description:
              'ID des mit der Facebook-Seite verknüpften Instagram-Business-Kontos — nur nötig für den Instagram-Autopost',
          },
        },
      ],
    },
  ],
}
