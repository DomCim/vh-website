import type { GlobalConfig } from 'payload'

import { admins, anyone } from '../access'
import { LAENDER } from '../lib/versand'

/**
 * Versandzonen — wohin geliefert wird und was der Weg dorthin kostet.
 *
 * Gelesen wird das an drei Stellen, und zwar überall aus dieser einen
 * (`lib/versand.ts`): die Kasse rechnet damit, der Produktfeed nennt die
 * Länder gegenüber Google, und die strukturierten Daten der Artikelseite
 * zeichnen sie aus. Vorher stand jede der drei Stellen für sich, und sie
 * waren auseinandergelaufen.
 *
 * **Solange hier nichts steht, gilt der bisherige Zustand** — Frankreich,
 * Deutschland und Österreich zum Versandbetrag des Artikels. Eine leere
 * Einstellung hält den Shop also nicht an.
 */
export const Versand: GlobalConfig = {
  slug: 'versand',
  label: 'Versandzonen',
  admin: {
    group: 'Verwaltung',
    description:
      'Wohin geliefert wird. Ein Land, das in keiner Zone steht, wird in der Kasse nicht angeboten. Ohne Zone gilt: Frankreich, Deutschland, Österreich zum Versandbetrag des Artikels.',
  },
  access: {
    // Die Kasse im Browser muss wissen, wohin geliefert wird — das ist keine
    // Betriebsangelegenheit, das steht ohnehin auf jeder Artikelseite.
    read: anyone,
    update: admins,
  },
  fields: [
    {
      name: 'zonen',
      label: 'Zonen',
      type: 'array',
      labels: { singular: 'Zone', plural: 'Zonen' },
      admin: {
        description:
          'Reihenfolge zählt: Steht ein Land in zwei Zonen, gilt die obere. In der Kasse erscheinen die Länder in dieser Reihenfolge.',
      },
      fields: [
        {
          name: 'name',
          label: 'Bezeichnung',
          type: 'text',
          required: true,
          admin: { description: 'Nur zur Orientierung, z. B. „Frankreich und Nachbarn".' },
        },
        {
          name: 'laender',
          label: 'Länder',
          type: 'select',
          hasMany: true,
          required: true,
          options: LAENDER.map((l) => ({ value: l.code, label: `${l.de} (${l.code})` })),
        },
        {
          name: 'aufschlag',
          label: 'Aufschlag je Stück (€)',
          type: 'number',
          defaultValue: 0,
          admin: {
            description:
              'Kommt zum Versandbetrag des Artikels dazu. 0 = derselbe Betrag wie im Inland. Bewusst ein fester Aufschlag und kein Faktor: Beim Speditionsgut steigt der Preis mit Entfernung und Zollpapier, nicht mit dem Warenwert.',
          },
        },
        {
          name: 'hinweis',
          label: 'Hinweis in der Kasse',
          type: 'text',
          localized: true,
          admin: {
            description:
              'Steht unter der Länderauswahl, sobald ein Land dieser Zone gewählt ist — z. B. „zzgl. Zoll und Einfuhrumsatzsteuer".',
          },
        },
      ],
    },
  ],
}
