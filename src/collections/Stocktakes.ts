import type { CollectionConfig } from 'payload'

import { office } from '../access'

/**
 * Inventur — der gezählte Bestand zu einem Stichtag.
 *
 * Beim Abschließen werden die gezählten Mengen in das Inventar übernommen und
 * der Gesamtwert eingefroren. Danach ist der Lauf gesperrt: Ein nachträglich
 * veränderbarer Inventurbestand wäre für den Jahresabschluss wertlos.
 */
export const Stocktakes: CollectionConfig = {
  slug: 'stocktakes',
  labels: {
    singular: 'Inventur',
    plural: 'Inventuren',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'date', 'status', 'totalValue'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office — Payload ist die
    // öffentliche Verwaltung, alles Interne hat dort genau einen Platz.
    hidden: true,
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (originalDoc?.status === 'abgeschlossen' && data.status === 'abgeschlossen') {
          // Abgeschlossene Läufe bleiben, wie sie sind
          return originalDoc
        }
        const zeilen = (data.lines ?? []) as { counted?: number; unitValue?: number }[]
        data.totalValue =
          Math.round(
            zeilen.reduce((s, z) => s + (z.counted ?? 0) * (z.unitValue ?? 0), 0) * 100,
          ) / 100
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (doc.status !== 'abgeschlossen' || previousDoc?.status === 'abgeschlossen') return doc
        // Gezählte Mengen ins Inventar zurückschreiben
        for (const zeile of doc.lines ?? []) {
          const id = typeof zeile.item === 'object' ? zeile.item?.id : zeile.item
          if (!id || typeof zeile.counted !== 'number') continue
          try {
            await req.payload.update({
              collection: 'inventory-items',
              id,
              overrideAccess: true,
              data: { quantity: zeile.counted },
            })
          } catch (err) {
            req.payload.logger.error({ err }, `Inventur: Posten ${id} nicht aktualisiert`)
          }
        }
        req.payload.logger.info(`Inventur "${doc.title}" abgeschlossen`)
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', label: 'Bezeichnung', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'date', label: 'Stichtag', type: 'date', required: true },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          defaultValue: 'offen',
          options: [
            { label: 'Offen (wird gezählt)', value: 'offen' },
            { label: 'Abgeschlossen', value: 'abgeschlossen' },
          ],
        },
      ],
    },
    {
      name: 'lines',
      label: 'Gezählte Posten',
      type: 'array',
      labels: { singular: 'Posten', plural: 'Posten' },
      fields: [
        {
          name: 'item',
          label: 'Posten',
          type: 'relationship',
          relationTo: 'inventory-items',
          required: true,
        },
        {
          type: 'row',
          fields: [
            { name: 'expected', label: 'Soll', type: 'number', admin: { readOnly: true } },
            { name: 'counted', label: 'Gezählt', type: 'number', required: true },
            {
              name: 'unitValue',
              label: 'Wert je Einheit (EUR)',
              type: 'number',
              admin: { description: 'Stand zum Stichtag — wird beim Anlegen übernommen.' },
            },
          ],
        },
        { name: 'note', label: 'Bemerkung', type: 'text' },
      ],
    },
    {
      name: 'totalValue',
      label: 'Gesamtwert (EUR)',
      type: 'number',
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'notes', label: 'Notiz', type: 'textarea' },
  ],
}
