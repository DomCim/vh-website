import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Neuerungen — was sich getan hat, im Büro nachlesbar.
 *
 * Geschrieben wird das nicht hier, sondern in `src/neuerungen.ts`: Der Server
 * spielt die Einträge beim Start ein (`lib/neuerungenEinspielen.ts`). Damit
 * steht ein Eintrag genau dann in der Datenbank, wenn die Fassung läuft, die
 * ihn mitbringt — „ausgerollt" braucht kein eigenes Kästchen, es ist einfach
 * das, was dasteht.
 *
 * Warum überhaupt eine Sammlung, wo die Einträge doch im Abbild liegen: Weil
 * eine Datei kein Gedächtnis dafür hat, wer sie gelesen hat. Der Banner im
 * Büro vergleicht die höchste Nummer mit `users.neuerungGesehen`, und beides
 * muss dafür an derselben Stelle liegen. Nebenbei kommen die Einträge über
 * den ganz normalen Abgleich ins Gerät und sind damit auch ohne Netz da.
 *
 * Von Hand geändert wird hier nichts — was hier stünde, wäre beim nächsten
 * Ausrollen nicht mehr die Quelle, sondern eine zweite Wahrheit daneben.
 */
export const Changelog: CollectionConfig = {
  slug: 'changelog',
  labels: {
    singular: 'Neuerung',
    plural: 'Neuerungen',
  },
  hooks: liveHooks('neuerungen'),
  admin: {
    useAsTitle: 'titel',
    defaultColumns: ['nummer', 'titel', 'datum'],
    group: 'Büro',
    hidden: true,
  },
  access: {
    // Lesen darf, wer das Büro öffnen darf — mehr steht hier nicht drin
    read: office,
    // Angelegt wird ausschließlich beim Einspielen, und das geht an der
    // Zugriffsprüfung vorbei (`overrideAccess`)
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      /*
       * Fortlaufend und stabil — daran hängt, was jemand schon gesehen hat.
       *
       * Nicht die Kennung der Zeile: Die vergibt die Datenbank, und sie wäre
       * je nach Reihenfolge des Einspielens eine andere. Die Nummer steht in
       * der Quelldatei und bleibt über jeden Neuaufbau der Datenbank hinweg
       * dieselbe.
       */
      name: 'nummer',
      label: 'Nummer',
      type: 'number',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'titel', label: 'Titel', type: 'text', required: true },
    {
      /*
       * Der Tag, an dem der Eintrag zum ersten Mal eingespielt wurde — also
       * der Tag, an dem er wirklich lief. Beim Schreiben ist der noch nicht
       * bekannt: Zwischen „fertig" und „ausgerollt" liegt hier ein Wort von
       * Vincent, und das kann Wochen dauern.
       */
      name: 'datum',
      label: 'Ausgerollt am',
      type: 'date',
      index: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'punkte',
      label: 'Punkte',
      type: 'array',
      fields: [
        { name: 'text', label: 'Text', type: 'textarea', required: true },
        {
          name: 'unter',
          label: 'Erläuterungen',
          type: 'array',
          fields: [{ name: 'text', label: 'Text', type: 'textarea', required: true }],
        },
      ],
    },
  ],
}
