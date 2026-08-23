import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { bewegung } from '../lib/bestandsbewegung'
import { liveHooks } from '../lib/liveHooks'

/**
 * Inventur — der gezählte Bestand zu einem Stichtag.
 *
 * Beim Abschließen werden die gezählten Mengen in das Inventar übernommen und
 * der Gesamtwert eingefroren. Danach ist der Lauf gesperrt: Ein nachträglich
 * veränderbarer Inventurbestand wäre für den Jahresabschluss wertlos.
 */
export const Stocktakes: CollectionConfig = {
  slug: 'stocktakes',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
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
    // Offene Büro-Seiten über Änderungen unterrichten
    afterDelete: liveHooks('inventur').afterDelete,
    beforeChange: [
      ({ data, originalDoc }) => {
        if (originalDoc?.status === 'abgeschlossen' && data.status === 'abgeschlossen') {
          /*
           * Abgeschlossene Läufe bleiben, wie sie sind — bis auf den
           * Papierkorb. Wegwerfen ist für Payload eine gewöhnliche Änderung;
           * gäbe diese Zeile stur den alten Stand zurück, schluckte sie das
           * `deletedAt` mit, und der Knopf täte wortlos nichts.
           */
          return { ...originalDoc, deletedAt: data.deletedAt ?? null }
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
        /*
         * Gezählte Mengen ins Inventar zurückschreiben — als Buchung mit
         * Verlaufszeile, nicht als stilles Setzen. Die Inventur ist die
         * größte Korrektur im Jahr; ausgerechnet sie fehlte im Verlauf.
         */
        for (const zeile of doc.lines ?? []) {
          const id = typeof zeile.item === 'object' ? zeile.item?.id : zeile.item
          if (!id || typeof zeile.counted !== 'number') continue
          try {
            const posten = await req.payload.findByID({
              collection: 'inventory-items',
              id,
              depth: 0,
              overrideAccess: true,
              req,
            })
            if (!posten) continue
            const delta = Math.round((zeile.counted - (posten.quantity ?? 0)) * 1000) / 1000
            // Stimmt die Zählung mit dem Bestand überein, gibt es nichts zu buchen
            if (delta === 0) continue
            await req.payload.update({
              collection: 'inventory-items',
              id,
              overrideAccess: true,
              req,
              data: bewegung(posten, delta, `Inventur „${doc.title ?? ''}"`),
            })
          } catch (err) {
            req.payload.logger.error({ err }, `Inventur: Posten ${id} nicht aktualisiert`)
          }
        }
        req.payload.logger.info(`Inventur "${doc.title}" abgeschlossen`)
        return doc
      },
      ...liveHooks('inventur').afterChange,
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
