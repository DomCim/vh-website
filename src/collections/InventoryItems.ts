import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Inventar — Material, Werkzeug und Maschinen.
 *
 * Der Bestand hier ist der laufende Wert; verbindlich für den Jahresabschluss
 * ist immer die gezählte Inventur (siehe Stocktakes).
 */
export const InventoryItems: CollectionConfig = {
  slug: 'inventory-items',
  labels: {
    singular: 'Inventar-Posten',
    plural: 'Inventar',
  },
  // Offene Büro-Seiten über Änderungen unterrichten
  hooks: liveHooks('inventar'),
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'quantity', 'unit', 'location'],
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
  fields: [
    { name: 'name', label: 'Bezeichnung', type: 'text', required: true, index: true },
    {
      name: 'type',
      label: 'Art',
      type: 'select',
      required: true,
      defaultValue: 'material',
      options: [
        { label: 'Material & Rohstoff', value: 'material' },
        { label: 'Werkzeug', value: 'werkzeug' },
        { label: 'Maschine & Anlage', value: 'maschine' },
        { label: 'Fertiges Stück', value: 'fertigware' },
        { label: 'Sonstiges', value: 'sonstiges' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        { name: 'quantity', label: 'Bestand', type: 'number', required: true, defaultValue: 0 },
        { name: 'unit', label: 'Einheit', type: 'text', defaultValue: 'Stück' },
        {
          name: 'minQuantity',
          label: 'Mindestbestand',
          type: 'number',
          admin: { description: 'Darunter erscheint der Posten in der Übersicht als knapp.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'unitValue',
          label: 'Wert je Einheit netto (EUR)',
          type: 'number',
          min: 0,
          admin: { description: 'Einkaufspreis — Grundlage für die Bewertung zum Stichtag.' },
        },
        { name: 'location', label: 'Lagerort', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'purchaseDate',
          label: 'Angeschafft am',
          type: 'date',
          admin: { description: 'Bei Maschinen wichtig für die Abschreibung.' },
        },
        {
          name: 'purchaseValue',
          label: 'Anschaffungswert netto (EUR)',
          type: 'number',
          min: 0,
        },
      ],
    },
    {
      name: 'supplier',
      label: 'Bezogen von',
      type: 'relationship',
      relationTo: 'contacts',
    },
    {
      name: 'product',
      label: 'Zugehöriges Shop-Produkt',
      type: 'relationship',
      relationTo: 'products',
      admin: { description: 'Nur bei fertigen Stücken, die im Shop stehen.' },
    },
    {
      /*
       * Der Verlauf des Bestands.
       *
       * Warum es das braucht: Der Bestand ändert sich nicht nur beim
       * Fertigmelden eines Auftrags. Es wird etwas nachgeschweißt, ein Stück
       * Blech verschnitten, zwei Meter Draht für eine Reparatur außerhalb
       * gebraucht. Bisher blieb dafür nur, die Zahl im Feld zu überschreiben —
       * und danach wusste niemand mehr, warum aus 50 plötzlich 48 wurden.
       *
       * Jede Korrektur steht deshalb als eigene Zeile: wie viel, warum, wann
       * und von wem. Die Zahl im Feld `quantity` bleibt der Bestand; dieser
       * Verlauf erklärt ihn.
       */
      name: 'movements',
      label: 'Bestandsverlauf',
      type: 'array',
      labels: { singular: 'Bewegung', plural: 'Bewegungen' },
      admin: {
        readOnly: true,
        description: 'Gebucht wird im Büro unter Inventar — hier steht nur, was passiert ist.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'day', label: 'Wann', type: 'date' },
            {
              name: 'delta',
              label: 'Veränderung',
              type: 'number',
              admin: { description: 'Negativ ist ein Abgang, positiv ein Zugang.' },
            },
            { name: 'rest', label: 'Bestand danach', type: 'number' },
          ],
        },
        { name: 'reason', label: 'Grund', type: 'text' },
        { name: 'who', label: 'Von', type: 'text' },
      ],
    },
    { name: 'photo', label: 'Foto', type: 'upload', relationTo: 'media' },
    { name: 'notes', label: 'Notiz', type: 'textarea' },
  ],
}
