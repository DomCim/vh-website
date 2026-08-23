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
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
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
    /*
     * Der Datensatz darf ohne beigelegte Datei entstehen.
     *
     * Nicht, weil Einträge ohne Datei erwünscht wären — sondern weil große
     * Dateien einen anderen Weg gehen: Sie werden stückweise in diesen Ordner
     * geschrieben und der Datensatz danach mit `filename`, `mimeType` und
     * `filesize` von Hand angelegt (siehe `lib/dateiAblage.ts`). Payloads
     * eigener Weg läse eine 500-MB-Zeichnung komplett in den Arbeitsspeicher,
     * und zwar zweimal.
     *
     * Die Schnittstellen legen nie einen Eintrag an, bevor die Datei liegt;
     * scheitert das Anlegen, wird die Datei wieder weggeräumt.
     */
    filesRequiredOnCreate: false,
  },
  fields: [
    {
      /*
       * Woran die Datei hängt — genau eines davon.
       *
       * Am Anfang war das immer ein Artikel: die Laserdatei zur eigenen
       * Variante. Bei Lohnfertigung gibt es aber keinen Artikel — dort gehört
       * die Zeichnung an den Vorgang, und zwar schon bevor es einen Auftrag
       * gibt. Deshalb sind alle Anker freiwillig; die Schnittstelle besteht
       * darauf, dass einer gesetzt ist.
       */
      name: 'product',
      label: 'Artikel',
      type: 'relationship',
      relationTo: 'products',
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'mappe',
          label: 'Übergabemappe',
          type: 'relationship',
          relationTo: 'customer-uploads',
          index: true,
        },
        {
          name: 'anfrage',
          label: 'Anfrage',
          type: 'relationship',
          relationTo: 'inquiries',
          index: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'angebot',
          label: 'Angebot',
          type: 'relationship',
          relationTo: 'quotes',
          index: true,
        },
        {
          name: 'auftrag',
          label: 'Auftrag',
          type: 'relationship',
          relationTo: 'jobs',
          index: true,
        },
      ],
    },
    {
      /*
       * Wer die Datei abgelegt hat.
       *
       * „Kunde" heißt: Sie kam über einen Übergabelink herein. Das gehört
       * sichtbar dazu — eine Zeichnung vom Auftraggeber ist etwas anderes als
       * eine, die im Haus entstanden ist, und bei Rückfragen zählt der
       * Unterschied.
       */
      name: 'herkunft',
      label: 'Herkunft',
      type: 'select',
      defaultValue: 'haus',
      options: [
        { label: 'Aus dem Haus', value: 'haus' },
        { label: 'Vom Auftraggeber', value: 'kunde' },
      ],
    },
    {
      /*
       * Darf der Auftraggeber diese Datei über seinen Link herunterladen?
       *
       * Die Übergabemappe geht in beide Richtungen: Hinein legt der
       * Auftraggeber seine Zeichnungen, heraus gehen Fertigungszeichnung zur
       * Freigabe, Prüfprotokoll, Messschrieb, das unterschriebene Angebot.
       *
       * Gespeichert ist voreingestellt **nein**: Was im Haus entsteht, ist
       * erst einmal Hausarbeit — Kalkulationsblatt, Zwischenstand, Notiz. Eine
       * Datei, die still freigegeben wird, weil sie zufällig an einer Mappe
       * hängt, ist genau der Weg, auf dem irgendwann der falsche
       * Zwischenstand beim Kunden liegt.
       *
       * In der Mappenansicht steht das Häkchen beim Hochladen trotzdem
       * angekreuzt — wer eine Datei in den Ordner **des Auftraggebers** legt,
       * will sie in aller Regel dort haben. Das ist keine stille
       * Voreinstellung: Das Kästchen steht sichtbar neben dem Knopf und lässt
       * sich abwählen, bevor das erste Byte hinausgeht.
       *
       * Was der Auftraggeber selbst hochgeladen hat, sieht er ohnehin —
       * dafür braucht es dieses Häkchen nicht (siehe `fuerKunden`).
       */
      name: 'freigabe',
      label: 'Für den Auftraggeber sichtbar',
      type: 'checkbox',
      defaultValue: false,
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
    {
      /*
       * Gehört diese Datei zum Download eines digitalen Artikels?
       *
       * **Warum das Häkchen daneben nicht genügt.** `freigabe` heißt „Der
       * Auftraggeber darf sie in seiner Mappe sehen" — eine Frage, die sich
       * bei Lohnfertigung stellt. Hier geht es um etwas anderes: Was bekommt
       * jeder, der diesen Artikel kauft? Ein Bauplan wird verkauft, das
       * Fertigungsprogramm daneben bleibt im Haus. Zwei Bedeutungen an einem
       * Kästchen laufen früher oder später auseinander, und das merkt man
       * erst, wenn es beim Kunden liegt.
       */
      name: 'download',
      label: 'Gehört zum Download dieses Artikels',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description: 'Nur bei digitaler Ware. Wer den Artikel kauft, bekommt genau diese Dateien.',
      },
    },
    { name: 'note', label: 'Bemerkung', type: 'textarea' },
  ],
}
