import type { CollectionConfig } from 'payload'

/**
 * Fortlaufende Zähler für Nummernkreise (Rechnungen, Bestellungen).
 *
 * Frankreich verlangt eine lückenlose, chronologische Nummerierung. Deshalb
 * ein eigener Zähler statt „Anzahl vorhandener Datensätze + 1": Beim Zählen
 * würde eine gelöschte Bestellung dieselbe Nummer ein zweites Mal vergeben.
 *
 * Hochgezählt wird über ein einzelnes atomares SQL-Statement — siehe
 * src/lib/nummernkreis.ts. Von Hand wird hier nichts geändert.
 */
export const Counters: CollectionConfig = {
  slug: 'counters',
  labels: {
    singular: 'Nummernkreis',
    plural: 'Nummernkreise',
  },
  admin: {
    useAsTitle: 'key',
    hidden: true,
  },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'lastNumber', type: 'number', required: true, defaultValue: 0 },
  ],
}
