import type { CollectionConfig } from 'payload'

import { admins } from '../access'
import { mfaBeimLogin } from '../lib/mfa'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Benutzer',
    plural: 'Benutzer',
  },
  auth: {
    // Bremst Rateversuche aus, bevor überhaupt der zweite Faktor greift
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    useAsTitle: 'email',
    group: 'Verwaltung',
  },
  access: {
    read: admins,
    create: admins,
    update: admins,
    delete: admins,
  },
  hooks: {
    beforeLogin: [mfaBeimLogin],
  },
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
    },
    {
      name: 'role',
      label: 'Rolle',
      type: 'select',
      required: true,
      defaultValue: 'redaktion',
      options: [
        { label: 'Redaktion (Website-Inhalte)', value: 'redaktion' },
        { label: 'Inhaber (zusätzlich Büro & Zahlen)', value: 'inhaber' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Nur die Inhaberrolle sieht Belege, Rechnungen, Inventar und den Steuer-Export unter /office.',
      },
    },
    {
      name: 'mfaEnabled',
      label: 'Zwei-Faktor-Anmeldung aktiv',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Wird über die Einrichtung unten aktiviert.',
      },
    },
    {
      name: 'mfaSetup',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/admin/MfaSetup#MfaSetup',
        },
      },
    },
    // ── Nicht anzeigen, nicht über die API ausliefern ────────────────────────
    {
      name: 'mfaSecret',
      type: 'text',
      hidden: true,
      access: { read: () => false, create: () => false, update: () => false },
    },
    {
      name: 'mfaPendingSecret',
      type: 'text',
      hidden: true,
      access: { read: () => false, create: () => false, update: () => false },
    },
    {
      name: 'mfaBackupCodes',
      type: 'array',
      hidden: true,
      access: { read: () => false, create: () => false, update: () => false },
      fields: [{ name: 'hash', type: 'text' }],
    },
  ],
}
