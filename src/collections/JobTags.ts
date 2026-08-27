import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Laufmarken — die QR-Codes an der Magnettafel.
 *
 * Eine Marke ist ein Stück Blech mit aufgedrucktem QR-Code, das mit dem Teil
 * durch die Fertigung wandert: an den Auftrag geheftet, mit zum Verzinker,
 * zurück, weiter zum Beschichter. Wer sie scannt, sieht je nach Anmeldung
 * verschiedenes — das Büro den Auftrag mit Knöpfen, der Dienstleister nur
 * seinen Schritt, alle anderen nichts (siehe api/m/[code]).
 *
 * **Wiederverwendbar, deshalb ein Datensatz je Marke.** Der QR-Code trägt nur
 * den stabilen Code (`M-001`); an welchem Auftrag die Marke gerade hängt,
 * steht hier — und lässt sich umhängen, ohne neue Marken zu drucken. Ein
 * signierter Link (wie bei der Dateiweitergabe) könnte das nicht: Er kann per
 * Bauart weder widerrufen noch umgehängt werden.
 *
 * **Frei heißt: `auftrag` ist leer.** Bewusst kein zweites Statusfeld daneben
 * — es könnte der Relation widersprechen, und dann glaubte eine Sicht das
 * eine und die andere das andere.
 */
export const JobTags: CollectionConfig = {
  slug: 'job-tags',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
  labels: {
    singular: 'Laufmarke',
    plural: 'Laufmarken',
  },
  hooks: liveHooks('laufmarken'),
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'auftrag', 'gekoppeltAm'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office/laufmarken
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
      name: 'code',
      label: 'Code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Steht als QR-Code auf der Marke — z.B. M-001.' },
    },
    {
      name: 'auftrag',
      label: 'Hängt am Auftrag',
      type: 'relationship',
      relationTo: 'jobs',
      index: true,
      admin: { description: 'Leer = die Marke ist frei und hängt an der Tafel.' },
    },
    { name: 'gekoppeltAm', label: 'Gekoppelt am', type: 'date' },
    {
      name: 'notiz',
      label: 'Notiz',
      type: 'text',
      admin: { description: 'z.B. „Tafel Reihe 2" — wo die Marke physisch wohnt.' },
    },
    {
      /*
       * Der Verlauf als Abschrift der Auftragsnummer, nicht als Verknüpfung:
       * Er ist Geschichte, und ein später gelöschter Auftrag darf sie nicht
       * löchern. Rein intern — die Scan-API gibt ihn nie heraus, sonst sähe
       * der nächste Dienstleister, was vorher an der Marke hing.
       */
      name: 'verlauf',
      label: 'Verlauf',
      type: 'array',
      labels: { singular: 'Einsatz', plural: 'Verlauf' },
      admin: { readOnly: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'jobNumber', label: 'Auftrag', type: 'text' },
            { name: 'gekoppeltAm', label: 'Von', type: 'date' },
            { name: 'entkoppeltAm', label: 'Bis', type: 'date' },
          ],
        },
      ],
    },
  ],
}
