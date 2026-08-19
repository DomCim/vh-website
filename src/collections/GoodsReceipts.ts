import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'
import { naechsteWareneingangsnummer } from '../lib/nummernkreis'
import { wareneingangBuchen } from '../lib/wareneingang'

/**
 * Wareneingang — was geliefert wurde, mit Lieferschein.
 *
 * Der Unterschied zur Bestandskorrektur am Posten: Eine Korrektur ist eine
 * Berichtigung („zwei Meter außerhalb verbraucht"), ein Wareneingang ist ein
 * **Vorgang**. Er hat einen Lieferanten, ein Datum, mehrere Posten und ein
 * Papier, das man später wiederfinden muss — beim Prüfen der Rechnung, bei
 * einer Reklamation, bei der Frage „wann kam das eigentlich?".
 *
 * Deshalb ein eigener Datensatz und nicht ein Haken mehr am Inventarposten:
 * Eine Lieferung mit fünf Positionen wäre sonst fünf zusammenhanglose
 * Korrekturen, und der Lieferschein hinge an keiner davon.
 *
 * Gebucht wird beim Anlegen: Jede Zeile erhöht den Bestand ihres Postens,
 * schreibt eine Zeile in dessen Verlauf und nimmt den Merker „nachbestellt"
 * wieder weg. Danach bleibt der Wareneingang ein Beleg — wer sich vertan hat,
 * bucht eine Korrektur, statt die Buchung stillschweigend zu ändern.
 */
export const GoodsReceipts: CollectionConfig = {
  slug: 'goods-receipts',
  labels: {
    singular: 'Wareneingang',
    plural: 'Wareneingänge',
  },
  admin: {
    useAsTitle: 'receiptNumber',
    defaultColumns: ['receiptNumber', 'receivedAt', 'supplierName', 'deliveryNote'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office/wareneingang
    hidden: true,
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  hooks: {
    afterDelete: liveHooks('wareneingaenge').afterDelete,
    afterChange: [
      /*
       * Buchen sitzt am Datenmodell und nicht in der Schnittstelle: So greift
       * es auch, wenn ein Wareneingang aus dem Admin-Panel oder über den
       * KI-Zugang entsteht. Der Haken `booked` sorgt dafür, dass es genau
       * einmal passiert.
       */
      async ({ doc, operation, req, context }) => {
        if (operation !== 'create' || doc.booked || context?.skipHooks) return doc
        try {
          await wareneingangBuchen(req.payload, doc, req)
          await req.payload.update({
            collection: 'goods-receipts',
            id: doc.id,
            overrideAccess: true,
            req,
            data: { booked: true },
            context: { skipHooks: true },
          })
        } catch (err) {
          req.payload.logger.error({ err }, `Wareneingang ${doc.receiptNumber} nicht gebucht`)
        }
        return doc
      },
      ...liveHooks('wareneingaenge').afterChange,
    ],
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create' && !data.receiptNumber) {
          data.receiptNumber = await naechsteWareneingangsnummer(req.payload)
        }
        if (!data.receivedAt) data.receivedAt = new Date().toISOString()
        return data
      },
    ],
  },
  fields: [
    {
      name: 'receiptNumber',
      label: 'Nummer',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        { name: 'receivedAt', label: 'Geliefert am', type: 'date', required: true, index: true },
        {
          name: 'deliveryNote',
          label: 'Lieferscheinnummer',
          type: 'text',
          admin: { description: 'Steht auf dem Papier des Lieferanten.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'supplier',
          label: 'Lieferant',
          type: 'relationship',
          relationTo: 'contacts',
          index: true,
        },
        { name: 'supplierName', label: 'Lieferant (Text)', type: 'text' },
      ],
    },
    {
      /*
       * Der Lieferschein als Bild oder PDF.
       *
       * Der Zettel im Karton ist nach zwei Wochen weg, und gebraucht wird er
       * genau dann: wenn die Rechnung kommt und die Mengen nicht stimmen. Ein
       * Foto beim Auspacken kostet zehn Sekunden.
       */
      name: 'document',
      label: 'Lieferschein',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Foto oder PDF — beim Auspacken abfotografiert genügt.' },
    },
    {
      name: 'lines',
      label: 'Gelieferte Posten',
      type: 'array',
      labels: { singular: 'Posten', plural: 'Posten' },
      minRows: 1,
      fields: [
        {
          name: 'item',
          label: 'Posten aus dem Inventar',
          type: 'relationship',
          relationTo: 'inventory-items',
          required: true,
        },
        {
          type: 'row',
          fields: [
            { name: 'quantity', label: 'Menge', type: 'number', required: true, min: 0 },
            { name: 'note', label: 'Bemerkung', type: 'text' },
          ],
        },
      ],
    },
    {
      /*
       * Gebucht ja oder nein.
       *
       * Der Haken verhindert, dass eine zweite Speicherung denselben Bestand
       * noch einmal erhöht — etwa wenn jemand später die Lieferscheinnummer
       * nachträgt. Er wird vom Auslöser gesetzt, nicht von Hand.
       */
      name: 'booked',
      label: 'Auf den Bestand gebucht',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'expense',
      label: 'Zugehöriger Beleg',
      type: 'relationship',
      relationTo: 'expenses',
      admin: {
        description:
          'Die Rechnung zur Lieferung, sobald sie da ist — dann liegen Papier und Zahlen beieinander.',
      },
    },
    { name: 'note', label: 'Notiz', type: 'textarea' },
  ],
}
