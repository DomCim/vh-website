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
              admin: { components: { Field: '/components/admin/GeheimFeld#GeheimFeld' } },
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
                components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
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
            {
              name: 'smtpPass',
              label: 'Passwort',
              type: 'text',
              admin: { components: { Field: '/components/admin/GeheimFeld#GeheimFeld' } },
            },
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
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'webhookSecret',
          label: 'Webhook Signing Secret',
          type: 'text',
          admin: {
            description: 'whsec_… des Webhook-Endpunkts /api/stripe-webhook',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
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
          admin: { components: { Field: '/components/admin/GeheimFeld#GeheimFeld' } },
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
          admin: {
            description: 'Beginnt mit sk-ant-…',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
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
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'readonlyKey',
          label: 'Schlüssel (nur lesen)',
          type: 'text',
          admin: {
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
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
      name: 'wartung',
      label: 'Takt (Automatik)',
      type: 'group',
      admin: {
        description:
          'Der Server sieht selbst regelmäßig nach, ob etwas ansteht — Sicherung, Erinnerung an fällige Belege, Angebote nachfassen, Aufräumen, neue Post. Änderungen hier greifen binnen einer Minute; niemand muss dafür an den Server.',
      },
      // Ohne `row`: In dieser Payload-Fassung bleibt eine Zeile innerhalb einer
      // Gruppe im Admin leer — die Felder darin sind schlicht nicht da. Lieber
      // untereinander und sichtbar als nebeneinander und unauffindbar.
      fields: [
        {
          name: 'aktiv',
          label: 'Automatik läuft',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Abschalten heißt: keine nächtliche Sicherung, keine Erinnerungen, keine Meldung über neue Post.',
          },
        },
        {
          name: 'intervalMinuten',
          label: 'Wartung alle … Minuten',
          type: 'number',
          defaultValue: 15,
          min: 1,
          max: 1440,
          admin: {
            description:
              'Bestimmt nur, wie genau die eingestellte Sicherungszeit getroffen wird — 60 reicht ebenso. Die Arbeiten selbst laufen höchstens einmal am Tag.',
          },
        },
        {
          name: 'postfachMinuten',
          label: 'Postfach alle … Minuten',
          type: 'number',
          defaultValue: 5,
          min: 1,
          max: 120,
          admin: {
            description:
              'Wie schnell neue Post gemeldet wird. IMAP meldet sich nicht von allein, hier zahlt sich häufiger aus.',
          },
        },
        {
          name: 'mailprotokollMonate',
          label: 'Ausgangsprotokoll aufbewahren (Monate)',
          type: 'number',
          defaultValue: 12,
          min: 1,
          max: 120,
          admin: {
            description:
              'Ältere Einträge räumt die Wartung weg. Nur Kopfdaten, kein Inhalt — aber auch die müssen nicht ewig liegen.',
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
          name: 'smbServer',
          label: 'Server (IP oder Name)',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll !== 'webdav' },
        },
        {
          name: 'smbFreigabe',
          label: 'Freigabe',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll !== 'webdav' },
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
          name: 'smbBenutzer',
          label: 'Benutzer',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll !== 'webdav' },
        },
        {
          name: 'smbPasswort',
          label: 'Passwort',
          type: 'text',
          admin: {
            condition: (_, gesch) => gesch?.protokoll !== 'webdav',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'webdavUrl',
          label: 'WebDAV-Ordner-Adresse',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll === 'webdav' },
        },
        {
          name: 'webdavBenutzer',
          label: 'Benutzer',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll === 'webdav' },
        },
        {
          name: 'webdavPasswort',
          label: 'Passwort',
          type: 'text',
          admin: {
            condition: (_, gesch) => gesch?.protokoll === 'webdav',
            description: 'Bei Nextcloud/ownCloud ein App-Passwort verwenden.',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'automatik',
          label: 'Jede Nacht automatisch sichern',
          type: 'checkbox',
          defaultValue: true,
        },
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
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
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
