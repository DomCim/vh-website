import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Wiedervorlagen — was man sich selbst vorlegt.
 *
 * Das Büro fasst schon von allein nach: bei Angeboten ohne Antwort, fälligen
 * Belegen, überfälligen Rechnungen, Kundenstimmen. Alles davon hängt an einem
 * Datensatz und einer Frist. Was fehlte, war das Gegenstück ohne beides:
 * „Herrn Müller im Oktober wegen des zweiten Kübels anrufen."
 *
 * Solche Sätze standen bisher auf einem Zettel am Monitor oder gar nicht. Sie
 * sind der Unterschied zwischen einem CRM und einer Adressliste: Ein Kunde,
 * der einmal gekauft hat, kauft wieder — aber nur, wenn sich jemand meldet.
 *
 * Bewusst mit optionalem Bezug: Eine Wiedervorlage darf an einem Partner, an
 * einem Auftrag oder an gar nichts hängen. Ein Pflichtfeld hätte den halben
 * Zweck genommen — „Werkstatttor streichen" gehört zu keinem Vorgang.
 */
export const FollowUps: CollectionConfig = {
  slug: 'follow-ups',
  labels: {
    singular: 'Wiedervorlage',
    plural: 'Wiedervorlagen',
  },
  hooks: liveHooks('wiedervorlagen'),
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'dueDate', 'done'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office — Payload ist die
    // öffentliche Verwaltung, alles Interne hat dort genau einen Platz.
    hidden: true,
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  fields: [
    { name: 'title', label: 'Was ist zu tun?', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'dueDate',
          label: 'Wiedervorlage am',
          type: 'date',
          required: true,
          index: true,
          admin: { description: 'An diesem Tag meldet sich das Büro aufs Handy.' },
        },
        {
          name: 'done',
          label: 'Erledigt',
          type: 'checkbox',
          defaultValue: false,
          index: true,
        },
      ],
    },
    { name: 'note', label: 'Notiz', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'contact', label: 'Geschäftspartner', type: 'relationship', relationTo: 'contacts', index: true },
        { name: 'job', label: 'Auftrag', type: 'relationship', relationTo: 'jobs', index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'quote', label: 'Angebot', type: 'relationship', relationTo: 'quotes' },
        {
          name: 'invoice',
          label: 'Rechnung',
          type: 'relationship',
          relationTo: 'outgoing-invoices',
        },
      ],
    },
    {
      name: 'doneAt',
      label: 'Erledigt am',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      /*
       * Wann zuletzt gemeldet wurde.
       *
       * Ohne diesen Merker käme die Meldung bei jedem Wartungslauf neu — also
       * viermal in der Stunde. Eine Erinnerung, die zur Tapete wird, erinnert
       * an nichts mehr.
       */
      name: 'remindedAt',
      label: 'Zuletzt gemeldet am',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'createdBy',
      label: 'Angelegt von',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
