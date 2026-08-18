import type { CollectionConfig } from 'payload'

/**
 * Merkzettel des Servers: Wann lief die Sicherung, wann der Wartungslauf,
 * wann hat das Postfach zuletzt nachgesehen.
 *
 * Zwei Aufgaben: Ein Tages-Riegel verhindert, dass die nächtliche Sicherung
 * mehrfach anläuft, wenn der Cron alle Viertelstunde klopft. Und weil jeder
 * Lauf seinen Zeitpunkt hinterlässt, fällt endlich auf, wenn etwas stillsteht
 * — vorher hätte es niemand gemerkt.
 */
export const SystemState: CollectionConfig = {
  slug: 'system-state',
  labels: {
    singular: 'Systemzustand',
    plural: 'Systemzustand',
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
    { name: 'key', label: 'Kennung', type: 'text', required: true, unique: true, index: true },
    { name: 'lastRun', label: 'Zuletzt gelaufen', type: 'date' },
    { name: 'ok', label: 'Ohne Fehler', type: 'checkbox', defaultValue: true },
    { name: 'note', label: 'Hinweis', type: 'text' },
  ],
}
