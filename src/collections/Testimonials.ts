import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'
import { liveHooks } from '../lib/liveHooks'

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
  labels: {
    singular: 'Kundenstimme',
    plural: 'Kundenstimmen',
  },
  // Offene Büro-Seiten über Änderungen unterrichten
  hooks: liveHooks('kundenstimmen'),
  admin: {
    useAsTitle: 'author',
    defaultColumns: ['author', 'context', 'featured'],
    group: 'Inhalte',
    description:
      'Nur echte Stimmen mit Einverständnis der Kunden eintragen — erfundene Bewertungen sind wettbewerbswidrig.',
  },
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  fields: [
    {
      name: 'quote',
      label: 'Zitat',
      type: 'textarea',
      required: true,
      localized: true,
    },
    {
      name: 'author',
      label: 'Name',
      type: 'text',
      required: true,
      admin: {
        description: 'z.B. "Familie M." oder "Stadt Naila" — so wie es öffentlich stehen darf',
      },
    },
    {
      /*
       * Die Bewertung in Sternen — **freiwillig**.
       *
       * Ursprünglich stand hier bewusst keine: „Bei fünf Stücken im Monat sagt
       * 4,6 von 5 nichts." Das stimmt für den Menschen, der die Seite liest —
       * er liest den Satz, nicht die Zahl. Für Google gilt es nicht: Ohne eine
       * Zahl gibt es keine Sterne im Suchergebnis, und die entscheiden mit
       * darüber, ob überhaupt jemand klickt.
       *
       * Deshalb der Kompromiss: Der Satz bleibt Pflicht und die Hauptsache,
       * die Sterne sind ein Zusatz. Wer keine vergibt, dessen Stimme steht
       * trotzdem — und in den Durchschnitt geht nur ein, was wirklich vergeben
       * wurde.
       */
      name: 'rating',
      label: 'Sterne (freiwillig)',
      type: 'number',
      min: 1,
      max: 5,
      admin: {
        description: '1 bis 5. Leer lassen, wenn die Kundschaft keine vergeben hat.',
        step: 1,
      },
    },
    {
      name: 'context',
      label: 'Kontext (optional)',
      type: 'text',
      localized: true,
      admin: {
        description: 'z.B. "Outdoor-Sofa OS, München"',
      },
    },
    {
      name: 'product',
      label: 'Zugehöriges Produkt (optional)',
      type: 'relationship',
      relationTo: 'products',
      admin: {
        description: 'Wird dann auf der Produktseite angezeigt',
      },
    },
    {
      name: 'pending',
      label: 'Zur Prüfung eingegangen',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Von der Kundschaft selbst eingereicht. Solange der Haken steht, erscheint die Stimme nicht auf der Website — erst lesen, dann freigeben.',
      },
    },
    {
      name: 'submittedEmail',
      label: 'Eingereicht von',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'orderNumber',
      label: 'Zur Bestellung',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'featured',
      label: 'Auf Startseite zeigen',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
