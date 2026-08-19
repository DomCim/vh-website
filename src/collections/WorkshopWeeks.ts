import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Werkstattwochen — wie viel Zeit in einer bestimmten Woche wirklich da ist.
 *
 * Die Voreinstellung in den Einstellungen („Fertigungsstunden je Woche") ist
 * eine Faustregel, und Faustregeln stimmen bei einem Nebenerwerb selten: Die
 * Werkstatt läuft neben einem Hauptberuf, und dann sind es in der einen Woche
 * fünf Stunden und in der anderen fünfundzwanzig. Urlaub, ein Projekt im
 * Hauptberuf, ein langes Wochenende — jede dieser Wochen hat eine andere Zahl.
 *
 * Ein Datensatz je Kalenderwoche, und nur für die Wochen, die von der Regel
 * abweichen. Was hier nicht steht, zählt mit der Voreinstellung; so bleibt die
 * Liste kurz und die Auslastung stimmt trotzdem.
 *
 * Der Schlüssel ist `2026-38` — Jahr und ISO-Kalenderwoche, sortierbar und
 * eindeutig. Ein Datum wäre die falsche Wahl: Eine Woche hat sieben davon, und
 * dann stünde dieselbe Woche siebenmal in der Liste.
 */
export const WorkshopWeeks: CollectionConfig = {
  slug: 'workshop-weeks',
  labels: {
    singular: 'Werkstattwoche',
    plural: 'Werkstattwochen',
  },
  hooks: liveHooks('werkstattwochen'),
  admin: {
    useAsTitle: 'woche',
    defaultColumns: ['woche', 'stunden', 'notiz'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office/auslastung — dort, wo man
    // ohnehin sieht, was die Woche schon trägt.
    hidden: true,
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  fields: [
    {
      name: 'woche',
      label: 'Kalenderwoche',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Jahr und ISO-Woche, z.B. „2026-38".' },
    },
    {
      name: 'stunden',
      label: 'Verfügbare Stunden',
      type: 'number',
      required: true,
      min: 0,
      max: 168,
      admin: { description: '0 heißt: in dieser Woche geht nichts — Urlaub, Hauptberuf, krank.' },
    },
    {
      name: 'notiz',
      label: 'Warum',
      type: 'text',
      admin: { description: 'Steht in der Auslastung neben der Woche, z.B. „Urlaub".' },
    },
  ],
}
