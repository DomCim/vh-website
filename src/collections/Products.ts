import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'
import { autoSlug } from '../lib/slug'

export const Products: CollectionConfig = {
  slug: 'products',
  labels: {
    singular: 'Produkt',
    plural: 'Produkte',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'price', 'available'],
    group: 'Shop',
  },
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  hooks: {
    beforeValidate: [autoSlug()],
  },
  fields: [
    {
      name: 'title',
      label: 'Titel',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      label: 'URL-Pfad (Slug)',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Leer lassen = wird automatisch aus dem Titel erzeugt',
      },
    },
    {
      name: 'category',
      label: 'Kategorie',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'images',
      label: 'Bilder',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      required: true,
    },
    {
      name: 'shortDescription',
      label: 'Kurzbeschreibung',
      type: 'textarea',
      localized: true,
      admin: {
        components: {
          afterInput: ['/components/admin/KiTextHilfe#KiProduktKurz'],
        },
      },
    },
    {
      name: 'description',
      label: 'Beschreibung',
      type: 'richText',
      localized: true,
    },
    {
      name: 'price',
      label: 'Grundpreis (EUR)',
      type: 'number',
      min: 0,
      admin: {
        description: 'Preis in Euro, z.B. 1490.00. Bei Varianten gilt der Variantenpreis.',
        condition: (data) => !data?.onRequestOnly,
      },
    },
    {
      name: 'shippingCost',
      label: 'Versandkosten (EUR, pro Stück)',
      type: 'number',
      min: 0,
      admin: {
        description:
          'z.B. 150 für Speditionslieferung. Leer oder 0 = versandkostenfrei. Bei Abholung entfallen die Versandkosten automatisch.',
        condition: (data) => !data?.onRequestOnly,
      },
    },
    {
      name: 'variants',
      label: 'Varianten',
      type: 'array',
      labels: {
        singular: 'Variante',
        plural: 'Varianten',
      },
      admin: {
        description: 'z.B. Größen oder Ausführungen mit eigenem Preis',
        condition: (data) => !data?.onRequestOnly,
      },
      fields: [
        {
          name: 'title',
          label: 'Bezeichnung',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'price',
          label: 'Preis (EUR)',
          type: 'number',
          required: true,
          min: 0,
        },
      ],
    },
    {
      name: 'colorOptions',
      label: 'Farboptionen',
      type: 'array',
      labels: {
        singular: 'Farbe',
        plural: 'Farben',
      },
      admin: {
        description: 'Wählbare Farben (RAL o.ä.), ohne Aufpreis',
      },
      fields: [
        {
          name: 'name',
          label: 'Farbname',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'hex',
          label: 'Farbwert (Hex, optional)',
          type: 'text',
          admin: {
            description: 'z.B. #b32428 — für die Farbvorschau',
          },
        },
      ],
    },
    {
      name: 'billOfMaterials',
      label: 'Stückliste (Materialbedarf je Stück)',
      type: 'array',
      labels: { singular: 'Materialposten', plural: 'Stückliste' },
      admin: {
        // Gepflegt wird die Stückliste im Büro unter /office/artikel — dort
        // steht sie neben dem Inventar, wo sie hingehört.
        hidden: true,
      },
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
            {
              name: 'quantity',
              label: 'Menge je Stück',
              type: 'number',
              required: true,
              min: 0,
            },
            { name: 'note', label: 'Bemerkung', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'serviceProviders',
      label: 'Externe Dienstleister',
      type: 'array',
      labels: { singular: 'Dienstleister', plural: 'Dienstleister' },
      admin: {
        // Wie die Stückliste eine Sache des Betriebs: gepflegt im Büro unter
        // /office/artikel, in der Website-Verwaltung hat sie nichts zu suchen.
        hidden: true,
      },
      fields: [
        {
          name: 'contact',
          label: 'Betrieb',
          type: 'relationship',
          relationTo: 'contacts',
          required: true,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'service',
              label: 'Leistung',
              type: 'text',
              required: true,
              admin: { description: 'z.B. Verzinken, Pulverbeschichten, Lasern' },
            },
            {
              name: 'cost',
              label: 'Kosten netto je Stück (EUR)',
              type: 'number',
              min: 0,
            },
            {
              name: 'leadTime',
              label: 'Vorlaufzeit',
              type: 'text',
              admin: { description: 'z.B. „10 Werktage" — geht in die zugesagte Lieferzeit ein.' },
            },
          ],
        },
        { name: 'note', label: 'Bemerkung', type: 'text' },
      ],
    },
    {
      name: 'productionTime',
      label: 'Fertigungszeit',
      type: 'text',
      localized: true,
      admin: {
        description:
          'z.B. „3–4 Wochen". Jedes Stück wird einzeln gefertigt — leer lassen übernimmt den Standardwert aus den Website-Einstellungen.',
      },
    },
    {
      name: 'readyMade',
      label: 'Fertiges Stück — sofort lieferbar',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Steht fertig in der Werkstatt. Wird nach dem Verkauf automatisch auf „nicht verfügbar" gesetzt.',
      },
    },
    {
      name: 'onRequestOnly',
      label: 'Nur auf Anfrage (kein Online-Kauf)',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Statt Warenkorb wird ein Anfrage-Button angezeigt',
      },
    },
    {
      name: 'available',
      label: 'Verfügbar',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'featured',
      label: 'Auf Startseite hervorheben',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'order',
      label: 'Reihenfolge',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Kleinere Zahl = weiter vorne in der Kategorie',
      },
    },
  ],
}
