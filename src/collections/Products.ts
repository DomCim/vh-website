import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'
import { autoSlug } from '../lib/slug'
import { liveHooks } from '../lib/liveHooks'
import { arbeitsplanFeld } from '../lib/arbeitsplan'

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
    // Offene Büro-Seiten über Änderungen unterrichten
    afterChange: liveHooks('artikel').afterChange,
    afterDelete: liveHooks('artikel').afterDelete,
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
      /*
       * Zahlung in Stufen — je Artikel, weil es je Artikel verschieden ist.
       *
       * Ein Regal aus dem Lager wird bezahlt und geht raus. Ein Sofa nach Maß
       * bindet wochenlang Material und Arbeitszeit, bevor es überhaupt etwas
       * zu liefern gibt — und das Geld dafür soll nicht die Werkstatt
       * vorstrecken.
       *
       * Beide Sätze auf 0 heißt: eine Rechnung wie bisher. Nur Anzahlung
       * gesetzt heißt: zwei Rechnungen. Der Rest ist immer die
       * Schlussrechnung, sie wird nicht eingetragen — sonst müsste jemand
       * darauf achten, dass die drei Zahlen zusammen hundert ergeben, und
       * genau das geht irgendwann daneben.
       */
      name: 'anzahlungProzent',
      label: 'Anzahlung (%)',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: {
        description: 'Fällig bei Auftragsbestätigung, vor Fertigungsbeginn. 0 = keine Anzahlung.',
      },
    },
    {
      name: 'zwischenProzent',
      label: 'Zwischenrechnung (%)',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: {
        description: 'Fällig, wenn der Meilenstein am Auftrag erreicht ist. 0 = keine.',
      },
    },
    {
      /*
       * Die Ordner für die Werkstattdateien — Fräsen, Laser, Zusammenbau, NC.
       *
       * Sie stehen am Artikel und nicht an der Datei, damit ein **leerer**
       * Ordner existieren kann: Man legt die Struktur an und füllt sie
       * danach. Läge der Ordner nur an der Datei, wäre ein Ordner ohne Datei
       * beim nächsten Laden wieder weg — und niemand könnte eine Struktur
       * vorbereiten.
       *
       * Eine flache Liste für Artikel und Varianten zusammen: `variantId`
       * leer heißt „Grundlage", genau wie bei der Stückliste. Ein
       * verschachteltes Feld in jeder Variante wäre dasselbe in umständlich.
       */
      name: 'fileFolders',
      label: 'Ordner für Werkstattdateien',
      type: 'array',
      labels: { singular: 'Ordner', plural: 'Ordner' },
      admin: {
        // Gepflegt wird das im Büro unter /office/artikel
        hidden: true,
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'variantId', label: 'Variante (Kennung)', type: 'text' },
            { name: 'name', label: 'Name', type: 'text', required: true },
          ],
        },
      ],
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
        {
          /*
           * Was diese Variante an Material braucht.
           *
           * Der Punkt, an dem eine gemeinsame Stückliste falsch wird: Ein
           * Kübel in 100 × 50 braucht mehr Blech als derselbe in 60 × 30 —
           * aber gleich viele Füße. Ein Faktor über die ganze Liste träfe
           * deshalb beides falsch; hier steht die Liste, wie sie ist.
           *
           * Leer heißt: Es gilt die Grundliste am Artikel. Bei Varianten, die
           * sich nur in der Farbe unterscheiden, ist das der Normalfall — und
           * niemand pflegt dieselbe Liste dreimal.
           */
          name: 'billOfMaterials',
          label: 'Stückliste dieser Variante',
          type: 'array',
          labels: { singular: 'Materialposten', plural: 'Stückliste' },
          admin: {
            // Gepflegt wird das im Büro unter /office/artikel, neben dem
            // Inventar — in der Website-Verwaltung hat es nichts zu suchen.
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
                { name: 'quantity', label: 'Menge je Stück', type: 'number', required: true, min: 0 },
                { name: 'note', label: 'Bemerkung', type: 'text' },
              ],
            },
          ],
        },
        {
          /*
           * Größer heißt meistens auch länger. Leer heißt: Es gilt die Zeit
           * vom Artikel — sonst stünde bei jeder Farbvariante dieselbe Zahl.
           */
          name: 'productionMinutes',
          label: 'Arbeitszeit dieser Variante (Minuten)',
          type: 'number',
          min: 0,
          admin: {
            hidden: true,
          },
        },
        arbeitsplanFeld(
          false,
          'Die Reihenfolge, in der dieses Stück entsteht — eigene Arbeit und Fremdleistung ' +
            'im Wechsel. Wird beim Anlegen eines Auftrags als Vorlage übernommen und dort ' +
            'abgehakt. Leer heißt: kein fester Ablauf.',
        ),
        {
          /*
           * Auch die Fremdleistung hängt an der Größe: Verzinken wird nach
           * Gewicht abgerechnet, Beschichten nach Fläche. Ein großes Stück
           * kostet dort mehr als ein kleines — mit einem gemeinsamen Preis
           * rechnet die Kalkulation das kleine teuer und das große billig.
           *
           * Leer heißt wie überall hier: Es gilt die Grundlage am Artikel.
           */
          name: 'serviceProviders',
          label: 'Dienstleister dieser Variante',
          type: 'array',
          labels: { singular: 'Dienstleister', plural: 'Dienstleister' },
          admin: { hidden: true },
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
                { name: 'service', label: 'Leistung', type: 'text', required: true },
                { name: 'cost', label: 'Kosten netto je Stück (EUR)', type: 'number', min: 0 },
                { name: 'leadTime', label: 'Vorlaufzeit', type: 'text' },
              ],
            },
            { name: 'note', label: 'Bemerkung', type: 'text' },
          ],
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
      name: 'productionMinutes',
      label: 'Arbeitszeit je Stück (Minuten)',
      type: 'number',
      min: 0,
      admin: {
        description:
          'Reine Werkstattzeit. Zusammen mit dem Stundensatz ergibt sie den größten Teil der Kosten — ohne sie ist jede Nachkalkulation geschönt.',
      },
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
