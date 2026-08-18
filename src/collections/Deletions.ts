import type { CollectionConfig } from 'payload'

import { office } from '../access'

/**
 * Grabsteine: Merkzettel über gelöschte Datensätze.
 *
 * Warum das nötig ist: Ein Gerät, das den Bestand des Büros bei sich führt,
 * fragt beim Wiederverbinden „was hat sich seit gestern Abend geändert?".
 * Geänderte Datensätze findet es über ihren Änderungszeitpunkt — Gelöschtes
 * aber ist weg und hinterlässt keine Spur. Ohne diesen Merkzettel bliebe ein
 * gelöschter Beleg auf dem Tablet stehen, bis jemand die App neu einrichtet.
 *
 * Ein Eintrag ist winzig (Bereich und Kennung) und wird nach der
 * Aufbewahrungsfrist wieder weggeräumt. Wer länger als das offline war, holt
 * sich den Bestand von vorn — das ist billiger als Grabsteine für immer.
 */
export const Deletions: CollectionConfig = {
  slug: 'deletions',
  labels: {
    singular: 'Gelöschtes',
    plural: 'Gelöschtes',
  },
  admin: {
    useAsTitle: 'datensatz',
    defaultColumns: ['bereich', 'datensatz', 'createdAt'],
    group: 'Büro',
    // Reine Verwaltung, für Menschen uninteressant
    hidden: true,
  },
  access: {
    read: office,
    // Entsteht ausschließlich in den Hooks der anderen Sammlungen
    create: () => false,
    update: () => false,
    // Räumt der Wartungslauf weg
    delete: () => false,
  },
  fields: [
    {
      name: 'bereich',
      label: 'Bereich',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'datensatz',
      label: 'Kennung',
      type: 'text',
      required: true,
    },
  ],
}
