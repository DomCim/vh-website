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
    /**
     * Wie lange eine Anmeldung gilt: 30 Tage.
     *
     * Payloads Standard sind zwei Stunden. Das ist für ein Redaktionssystem
     * gedacht, an dem jemand eine Stunde arbeitet — nicht für ein Tablet in
     * der Werkstatt, das den ganzen Tag am Auftrag hängt und bei dem jede
     * Anmeldung zusätzlich einen Code aus der Authenticator-App verlangt.
     * Dreimal täglich neu anmelden führt nur dazu, dass die Zwei-Faktor-
     * Anmeldung irgendwann abgeschaltet wird.
     *
     * Vertretbar ist das, weil davor eine Sperre nach zehn Fehlversuchen
     * steht, der zweite Faktor beim Anmelden gilt und das Büro nur die
     * Inhaberrolle hereinlässt. Wer ein Gerät verliert, ändert das Passwort —
     * damit sind alle bestehenden Anmeldungen ungültig.
     */
    tokenExpiration: 30 * 24 * 60 * 60,
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
