import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'
import { naechsteLieferantenbestellnummer } from '../lib/nummernkreis'

/**
 * Was bei einem Lieferanten angefragt und bestellt wurde.
 *
 * **Warum es das bisher nicht gab — und was gefehlt hat.** Nachbestellen
 * konnte eine Anfrage verschicken und setzte danach am Inventarposten ein
 * Datum: `reorderedAt`. Mehr wurde nirgends festgehalten. Daraus folgten vier
 * Lücken, die Dominik am 11.09.2026 aufgefallen sind:
 *
 *  1. **Die bestellte Menge war weg.** Sie stand nur im Mailtext. „Unterwegs"
 *     sagte nicht, wie viel kommt, und der Wareneingang belegte nicht mit der
 *     bestellten Menge vor, sondern rechnete sie neu aus.
 *  2. **Eine Anfrage galt sofort als Bestellung.** Preis und Verfügbarkeit
 *     stehen bei einer Anfrage aber gerade nicht fest. Antwortet der
 *     Lieferant mit „nicht lieferbar", stand der Posten trotzdem unter
 *     „bestellt, aber noch nicht da".
 *  3. **Es gab keinen Beleg.** Keine Historie, keine Nummer, nichts, wogegen
 *     man die Rechnung des Lieferanten prüfen konnte.
 *  4. **Eine Teillieferung hob den Riegel aus.** Jeder Zugang löschte
 *     `reorderedAt`, auch ein einziges Stück. Der Posten lag weiter unter dem
 *     Mindestbestand, stand am nächsten Tag wieder in der Liste — und wäre
 *     ein zweites Mal bestellt worden. Genau das sollte das Feld verhindern.
 *
 * **Der Zuschnitt.** Derselbe Gedanke wie beim Wareneingang: Eine Bestellung
 * ist ein *Vorgang* und kein Haken an einem Posten. Sie hat einen Lieferanten,
 * eine Nummer, mehrere Zeilen mit Mengen und Preisen, und sie durchläuft
 * Stände. Der Wareneingang bleibt daneben stehen, was er ist — der Beleg über
 * das, was tatsächlich ankam.
 *
 * **Die Stände und was sie bedeuten:**
 *
 *  - `angefragt` — die Mail ist raus, Preis und Termin stehen aus.
 *  - `bestellt` — der Lieferant hat bestätigt, oder es wurde am Telefon
 *    bestellt. Ab hier gilt die Menge als unterwegs.
 *  - `teilgeliefert` — etwas ist da, aber nicht alles. Setzt der Wareneingang
 *    selbst, sobald er rechnen kann.
 *  - `geliefert` — vollständig da.
 *  - `storniert` — kommt nicht. Die Posten stehen wieder in der Nachbestellliste.
 */
export const SupplierOrders: CollectionConfig = {
  slug: 'supplier-orders',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht
  trash: true,
  labels: {
    singular: 'Lieferantenbestellung',
    plural: 'Lieferantenbestellungen',
  },
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'supplierName', 'orderedAt', 'expectedAt'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office/nachbestellen
    hidden: true,
  },
  access: {
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  hooks: {
    afterDelete: liveHooks('lieferantenbestellungen').afterDelete,
    afterChange: liveHooks('lieferantenbestellungen').afterChange,
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create' && !data.orderNumber) {
          data.orderNumber = await naechsteLieferantenbestellnummer(req.payload)
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'orderNumber',
      label: 'Nummer',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'status',
      label: 'Stand',
      type: 'select',
      required: true,
      defaultValue: 'angefragt',
      index: true,
      options: [
        { label: 'Angefragt', value: 'angefragt' },
        { label: 'Bestellt', value: 'bestellt' },
        { label: 'Teilgeliefert', value: 'teilgeliefert' },
        { label: 'Geliefert', value: 'geliefert' },
        { label: 'Storniert', value: 'storniert' },
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
        {
          /*
           * Der Name als Text daneben — aus demselben Grund wie beim
           * Wareneingang: Ein Lieferant, der später umbenannt wird, soll den
           * Beleg von damals nicht mit umschreiben.
           */
          name: 'supplierName',
          label: 'Lieferant (Text)',
          type: 'text',
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'requestedAt', label: 'Angefragt am', type: 'date', index: true },
        { name: 'orderedAt', label: 'Bestellt am', type: 'date', index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'expectedAt',
          label: 'Zugesagt zum',
          type: 'date',
          admin: { description: 'Was der Lieferant auf die Anfrage geantwortet hat.' },
        },
        { name: 'deliveredAt', label: 'Vollständig geliefert am', type: 'date' },
      ],
    },
    {
      name: 'lines',
      label: 'Posten',
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
            { name: 'quantity', label: 'Bestellt', type: 'number', required: true, min: 0 },
            {
              /*
               * Was davon schon da ist — der Wareneingang schreibt hier mit.
               *
               * Ohne diese Zahl gäbe es keine Teillieferung: Man wüsste nur,
               * dass *etwas* kam, nicht ob noch etwas aussteht.
               */
              name: 'deliveredQuantity',
              label: 'Davon geliefert',
              type: 'number',
              min: 0,
              defaultValue: 0,
            },
            {
              name: 'price',
              label: 'Preis je Einheit (netto)',
              type: 'number',
              min: 0,
              admin: { description: 'Was der Lieferant auf die Anfrage genannt hat.' },
            },
          ],
        },
        { name: 'note', label: 'Bemerkung', type: 'text' },
      ],
    },
    {
      name: 'note',
      label: 'Notiz',
      type: 'textarea',
      admin: { description: 'Was am Telefon besprochen wurde, Bestellnummer des Lieferanten …' },
    },
  ],
}
