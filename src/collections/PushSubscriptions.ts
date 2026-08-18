import type { CollectionConfig } from 'payload'

import { office } from '../access'

/**
 * Angemeldete Geräte für Push-Benachrichtigungen.
 *
 * Ein Eintrag je Gerät und Browser — das Handy in der Werkstatt, der Rechner
 * im Büro. Meldet ein Gerät sich ab oder wird die App gelöscht, antwortet der
 * Push-Dienst mit 410; der Eintrag wird dann automatisch entfernt.
 */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  labels: {
    singular: 'Gerät für Benachrichtigungen',
    plural: 'Geräte für Benachrichtigungen',
  },
  admin: {
    useAsTitle: 'label',
    hidden: true,
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  fields: [
    { name: 'endpoint', label: 'Endpunkt', type: 'text', required: true, unique: true, index: true },
    { name: 'p256dh', type: 'text', required: true },
    { name: 'auth', type: 'text', required: true },
    { name: 'label', label: 'Gerät', type: 'text' },
    { name: 'user', label: 'Benutzer', type: 'relationship', relationTo: 'users' },
  ],
}
