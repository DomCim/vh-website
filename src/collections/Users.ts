import type { CollectionConfig } from 'payload'

import { admins } from '../access'
import { mfaBeimLogin } from '../lib/mfa'
import { passkeyStrategie } from '../lib/passkeyStrategie'

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
     * Wie lange eine Anmeldung gilt: eine Woche — und sie verlängert sich,
     * solange sie benutzt wird.
     *
     * Payloads Standard sind zwei Stunden. Das ist für ein Redaktionssystem
     * gedacht, an dem jemand eine Stunde arbeitet, nicht für ein Tablet in
     * der Werkstatt, das den ganzen Tag am Auftrag hängt und bei jeder
     * Anmeldung einen Code aus der Authenticator-App verlangt. Dreimal
     * täglich neu anmelden führt nur dazu, dass irgendwann der zweite Faktor
     * abgeschaltet wird.
     *
     * Eine Woche mit Verlängerung ist dabei sicherer als ein starres langes
     * Fenster: Wer das Büro täglich benutzt, bleibt angemeldet; ein Gerät,
     * das eine Woche lang nicht angefasst wurde, ist es nicht mehr. Die
     * Verlängerung stößt das Büro selbst an (siehe components/office/
     * SitzungVerlaengern.tsx), das Admin-Panel macht es von sich aus.
     *
     * Wer ein Gerät verliert, ändert das Passwort — damit sind alle
     * bestehenden Anmeldungen ungültig.
     */
    tokenExpiration: 7 * 24 * 60 * 60,
    /**
     * Zusätzlich zur Anmeldung mit Passwort: Wer sich per Passkey ausgewiesen
     * hat (Face ID, Fingerabdruck, Geräte-PIN), bekommt ein eigenes,
     * signiertes Cookie. Diese Strategie liest es — für den Rest des Systems
     * ist der Benutzer damit ganz normal angemeldet.
     */
    strategies: [passkeyStrategie],
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
      /*
       * Die Rolle als Datensatz — daran hängen die Rechte.
       *
       * Das alte Auswahlfeld darunter bleibt vorerst stehen. Es ist der
       * Rückweg für Konten, die der Umzug nicht erwischt hat: `hatRecht`
       * erkennt einen alten Inhaber auch daran und lässt ihn weiterarbeiten,
       * statt ihn an einem halb fertigen Umbau auszusperren.
       */
      name: 'rolle',
      label: 'Rolle',
      type: 'relationship',
      relationTo: 'roles',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Bestimmt, was dieses Konto im Büro darf.',
      },
    },
    {
      name: 'role',
      label: 'Rolle (alt)',
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
          'Vorgänger der Rollen. Wird nicht mehr gepflegt — maßgeblich ist das Feld „Rolle" darüber.',
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
    {
      name: 'passkeySetup',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/admin/PasskeyVerwaltung#PasskeyVerwaltung',
        },
      },
    },
    {
      /**
       * Hinterlegte Passkeys: je Gerät ein öffentlicher Schlüssel.
       *
       * Der geheime Teil verlässt das Gerät nie — hier liegt nur der
       * öffentliche Gegenpart, mit dem sich Unterschriften prüfen lassen.
       * Gestohlen nützt diese Tabelle niemandem etwas.
       */
      name: 'passkeys',
      label: 'Passkeys',
      type: 'array',
      admin: {
        hidden: true,
      },
      access: { create: () => false, update: () => false },
      fields: [
        { name: 'credentialId', type: 'text', required: true, index: true },
        { name: 'publicKey', type: 'text', required: true },
        { name: 'counter', type: 'number', defaultValue: 0 },
        { name: 'transports', type: 'text' },
        { name: 'label', label: 'Gerät', type: 'text' },
        { name: 'lastUsedAt', label: 'Zuletzt benutzt', type: 'date' },
      ],
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
