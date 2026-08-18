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
    { name: 'photo', label: 'Foto', type: 'upload', relationTo: 'media' },
    { name: 'notes', label: 'Notiz', type: 'textarea' },
  ],
}
