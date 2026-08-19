import type { CollectionConfig } from 'payload'

import { admins } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Empfänger des Newsletters.
 *
 * Angemeldet wird im zwei Schritten (Double-Opt-In): Wer seine Adresse
 * einträgt, bekommt erst eine Mail mit einem Bestätigungslink. Ohne diesen
 * Klick geht nie ein Newsletter raus — sonst könnte jeder fremde Adressen
 * eintragen, und genau daran hängt die Rechtmäßigkeit der ganzen Liste.
 *
 * Abgemeldete Adressen werden nicht gelöscht, sondern auf „abgemeldet"
 * gesetzt: Nur so lässt sich belegen, dass jemand nicht mehr angeschrieben
 * werden wollte.
 */
export const NewsletterSubscribers: CollectionConfig = {
  slug: 'newsletter-subscribers',
  labels: {
    singular: 'Newsletter-Anmeldung',
    plural: 'Newsletter',
  },
  // Offene Büro-Seiten über Änderungen unterrichten
  hooks: liveHooks('newsletter'),
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'locale', 'confirmedAt'],
    group: 'Verwaltung',
    description: 'Nur bestätigte Adressen bekommen Post.',
  },
  access: {
    read: admins,
    create: () => false,
    update: admins,
    delete: admins,
  },
  fields: [
    { name: 'email', label: 'E-Mail', type: 'email', required: true, index: true },
    {
      name: 'status',
      label: 'Stand',
      type: 'select',
      required: true,
      defaultValue: 'offen',
      options: [
        { label: 'Bestätigung ausstehend', value: 'offen' },
        { label: 'Bestätigt', value: 'bestaetigt' },
        { label: 'Abgemeldet', value: 'abgemeldet' },
      ],
    },
    {
      name: 'locale',
      label: 'Sprache',
      type: 'select',
      defaultValue: 'de',
      options: [
        { label: 'Deutsch', value: 'de' },
        { label: 'Français', value: 'fr' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      name: 'token',
      label: 'Schlüssel',
      type: 'text',
      index: true,
      admin: { readOnly: true, hidden: true },
    },
    { name: 'confirmedAt', label: 'Bestätigt am', type: 'date', admin: { readOnly: true } },
    { name: 'unsubscribedAt', label: 'Abgemeldet am', type: 'date', admin: { readOnly: true } },
    {
      name: 'source',
      label: 'Woher',
      type: 'text',
      admin: { readOnly: true, description: 'Wo die Anmeldung herkam — für den Nachweis.' },
    },
    {
      name: 'lastMailAt',
      label: 'Zuletzt angeschrieben',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
}
