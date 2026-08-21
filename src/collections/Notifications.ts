import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Meldungen — was das Büro gesagt hat, und zwar nachlesbar.
 *
 * Push war bisher reines Hinausrufen: Die Meldung erschien auf dem Sperr-
 * bildschirm, und mit dem Wischen war sie weg. Wer sie im Vorbeigehen
 * weggeräumt hat — oder wessen Handy gerade aus war —, konnte nirgends
 * nachsehen, was da gemeldet wurde. Ausgerechnet die Meldungen, die etwas
 * wollen („Entwurf liegt bereit", „Rechnung überfällig"), verschwanden am
 * leichtesten.
 *
 * Jetzt legt `lib/push.ts` jede Meldung hier ab, bevor sie hinausgeht. Damit
 * hängt die Liste an keinem Gerät: Sie kommt über den Abgleich ins Handy, ins
 * Tablet und an den Rechner, und „gelesen" gilt überall.
 *
 * Geschrieben wird ausschließlich aus dem Programm — aus `benachrichtige` und
 * aus der Büro-Schnittstelle, beide mit `overrideAccess`. Eine Meldung von
 * Hand anzulegen ergäbe keinen Sinn; sie ist die Spur eines Vorgangs, nicht
 * selbst einer.
 */

/** Gelesenes verfällt schnell — es hat seinen Zweck erfüllt. */
export const MELDUNG_GELESEN_TAGE = 30

/** Ungelesenes lebt länger, aber auch nicht ewig. */
export const MELDUNG_TAGE = 90

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: {
    singular: 'Meldung',
    plural: 'Meldungen',
  },
  hooks: liveHooks('meldungen'),
  admin: {
    useAsTitle: 'titel',
    defaultColumns: ['titel', 'zuletztAm', 'gelesen'],
    group: 'Büro',
    hidden: true,
  },
  access: {
    read: office,
    // Wie bei den Grabsteinen: Angelegt und geändert wird nur aus dem
    // Programm heraus, und das geht an der Zugriffsprüfung vorbei.
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'titel', label: 'Titel', type: 'text', required: true },
    { name: 'text', label: 'Text', type: 'textarea' },
    {
      name: 'url',
      label: 'Ziel',
      type: 'text',
      defaultValue: '/office',
      admin: { description: 'Wohin der Tipp auf die Meldung führt.' },
    },
    {
      name: 'tag',
      label: 'Kennung',
      type: 'text',
      index: true,
      admin: {
        description:
          'Gleiche Kennung ersetzt eine ältere, noch ungelesene Meldung, statt sie zu stapeln.',
      },
    },
    {
      name: 'anzahl',
      label: 'Zusammengefasst',
      type: 'number',
      defaultValue: 1,
      admin: { description: 'Wie oft dieselbe Meldung ausgelöst wurde.' },
    },
    {
      /*
       * Danach sortiert die Liste — und deshalb ist es ein eigenes Feld.
       *
       * `updatedAt` täte es nicht: Eine zusammengefasste Meldung soll nach oben
       * springen, aber „gelesen" zu setzen darf die Liste nicht unter dem
       * Finger umsortieren.
       */
      name: 'zuletztAm',
      label: 'Zuletzt ausgelöst',
      type: 'date',
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'gelesen', label: 'Gelesen', type: 'checkbox', defaultValue: false, index: true },
        { name: 'gelesenAm', label: 'Gelesen am', type: 'date', admin: { readOnly: true } },
      ],
    },
  ],
}
