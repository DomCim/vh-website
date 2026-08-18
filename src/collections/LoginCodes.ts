import type { CollectionConfig } from 'payload'

/**
 * Kurzlebige Zahlencodes für das Kundenportal.
 *
 * Bewusst kein Magic Link: Outlook/Microsoft Safe Links ruft Links in E-Mails
 * vorab auf und würde einen Einmal-Link verbrauchen, bevor der Kunde klickt.
 * Der Kunde tippt stattdessen einen sechsstelligen Code ab.
 *
 * Der Code selbst wird nie gespeichert, nur sein SHA-256-Hash.
 */
export const LoginCodes: CollectionConfig = {
  slug: 'login-codes',
  labels: {
    singular: 'Anmeldecode',
    plural: 'Anmeldecodes',
  },
  admin: {
    hidden: true,
  },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
  ],
}
