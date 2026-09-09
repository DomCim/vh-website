import type { CollectionConfig } from 'payload'

import { admins } from '../access'
import { locales } from '../lib/i18n'

/**
 * Unter welcher Adresse ein Stück einmal zu finden war.
 *
 * **Wozu.** Eine Adresse ist ein Versprechen — sie steht in Lesezeichen, in
 * Mails, im Index von Google. Seit jede Sprachfassung ihre eigene Adresse
 * bekommt, werden reihenweise Adressen geändert: Aus
 * `/fr/moebel/outdoor-sofa-os` wird `/fr/mobilier/canape-os`. Ohne Gedächtnis
 * liefe jeder alte Link ab dem Tag ins Leere.
 *
 * Geschrieben wird hier von einem Haken an der jeweiligen Sammlung
 * (`adresseMerken` in `lib/slug.ts`), gelesen von der Seite, die unter der
 * gerufenen Adresse nichts findet: Sie sieht hier nach und leitet dauerhaft
 * auf die heutige weiter.
 *
 * **Warum nicht in der `next.config`.** Dort stehen die Adressen der alten
 * TYPO3-Seite — die ändern sich nie mehr. Was das Büro umbenennt, muss ohne
 * Ausrollen wirken; deshalb steht es in der Datenbank.
 *
 * **Warum nichts gelöscht wird.** Ein Eintrag kostet eine Zeile. Eine Adresse,
 * die nach zwei Jahren noch jemand aufruft, ist genau die, bei der eine
 * Umleitung sich lohnt.
 */
export const AddressHistory: CollectionConfig = {
  slug: 'address-history',
  labels: { singular: 'Frühere Adresse', plural: 'Frühere Adressen' },
  admin: {
    useAsTitle: 'adresse',
    defaultColumns: ['adresse', 'bereich', 'sprache', 'seit'],
    group: 'System',
    description:
      'Wird automatisch geschrieben, wenn eine Adresse geändert wird. Wer eine alte Adresse aufruft, wird von hier aus weitergeleitet.',
  },
  access: {
    read: admins,
    create: admins,
    update: admins,
    delete: admins,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'bereich',
          label: 'Bereich',
          type: 'select',
          required: true,
          index: true,
          options: [
            { label: 'Artikel', value: 'products' },
            { label: 'Kategorie', value: 'categories' },
            { label: 'Beitrag', value: 'news' },
            { label: 'Referenz', value: 'projects' },
          ],
        },
        {
          name: 'sprache',
          label: 'Sprache',
          type: 'select',
          required: true,
          index: true,
          options: locales.map((l) => ({ label: l.toUpperCase(), value: l })),
        },
      ],
    },
    {
      name: 'adresse',
      label: 'Frühere Adresse',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Nur der Slug, ohne Sprachkürzel und ohne Kategorie.' },
    },
    {
      name: 'dokument',
      label: 'Gehört zu (Kennung)',
      type: 'number',
      required: true,
      index: true,
    },
    { name: 'seit', label: 'Umbenannt am', type: 'date' },
  ],
}
