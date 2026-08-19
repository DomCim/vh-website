import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Werkstattdateien — was zum Bauen eines Artikels gebraucht wird.
 *
 * Laserdatei, Fräsprogramm, Zusammenbauzeichnung, NC-Code: Das gehört an die
 * **Variante** und nicht an den Artikel. Ein Kübel in 100 × 50 hat eine andere
 * Laserdatei als derselbe in 60 × 30 — beim gemeinsamen Ablegen schneidet
 * irgendwann jemand das falsche Blech, und das merkt man erst am Schrott.
 *
 * Warum eine eigene Sammlung und nicht die Mediathek:
 *
 * **Die Mediathek ist öffentlich lesbar.** Sie muss es sein, sie liefert die
 * Bilder der Website aus. Eine Laserdatei dort abzulegen hieße, sie ins Netz
 * zu stellen — das ist die Arbeit von Wochen, und sie liegt dann unter einer
 * ratbaren Adresse. Hier gilt: nur, wer im Büro angemeldet ist.
 *
 * **Bilder werden dort verkleinert.** Eine DXF ist kein Bild; Payload soll
 * sie nicht anfassen, sondern Byte für Byte so ausliefern, wie sie hereinkam.
 *
 * Abgelegt wird unter `media/werkstattdateien` — also im selben Volume wie
 * die Bilder. Das ist Absicht: Dieses Volume gibt es bereits, es ist
 * persistent, und die nächtliche Sicherung packt es mit ein. Ein eigenes
 * Volume wäre die sauberere Schublade, aber eine, die beim ersten Ausrollen
 * ohne angepassten Stack alle Dateien verliert.
 */
export const ProductFiles: CollectionConfig = {
  slug: 'product-files',
  labels: {
    singular: 'Werkstattdatei',
    plural: 'Werkstattdateien',
  },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'product', 'variantTitle', 'folder'],
    group: 'Büro',
    // Gepflegt wird das im Büro am Artikel
    hidden: true,
  },
  access: {
    /*
     * Lesen darf jeder im Büro — die Werkstatt braucht die Zeichnung, auch
     * wenn sie keine Preise ändern darf. Anlegen und Löschen prüft die
     * Schnittstelle zusätzlich gegen `website.pflegen`.
     */
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  hooks: liveHooks('werkstattdateien'),
  upload: {
    staticDir: 'media/werkstattdateien',
    // Keine Bildgrößen: Eine Fräsdatei ist kein Bild und wird nicht angefasst.
    disableLocalStorage: false,
  },
  fields: [
    {
      name: 'product',
      label: 'Artikel',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          /*
           * Die Kennung der Variantenzeile. Leer heißt: gilt für den Artikel
           * als Ganzes — wie bei der Stückliste die Grundlage.
           *
           * Gesucht wird später über die Kennung und nicht über den Namen:
           * Der ist übersetzt und änderbar, und wer eine Variante umbenennt,
           * hätte ihr sonst sämtliche Zeichnungen abgeschnitten.
           */
          name: 'variantId',
          label: 'Variante (Kennung)',
          type: 'text',
          index: true,
        },
        {
          name: 'variantTitle',
          label: 'Variante (Bezeichnung)',
          type: 'text',
          admin: { description: 'Nur zur Anzeige — maßgeblich ist die Kennung.' },
        },
      ],
    },
    {
      /*
       * Der Ordner, in dem die Datei liegt — als schlichter Name.
       *
       * Die Ordner selbst stehen am Artikel (`fileFolders`), damit ein leerer
       * Ordner existieren kann: Man legt die Struktur an und füllt sie
       * danach. Läge der Ordner nur an der Datei, wäre ein Ordner ohne Datei
       * beim nächsten Laden wieder weg.
       */
      name: 'folder',
      label: 'Ordner',
      type: 'text',
      index: true,
    },
    {
      name: 'label',
      label: 'Bezeichnung',
      type: 'text',
      admin: { description: 'Wie die Datei im Büro heißt. Leer = Dateiname.' },
    },
    { name: 'note', label: 'Bemerkung', type: 'textarea' },
  ],
}
