import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Übergabemappe — der Ordner, in den die Kundschaft ihre Unterlagen legt.
 *
 * Bei Lohnfertigung kommen die Daten **vor** der Entscheidung: Zeichnung,
 * Stückzahl, Werkstoff — und erst danach sagt man zu oder ab. Per Mail geht
 * das schlecht: Anhänge sind begrenzt, eine Revision überschreibt nichts, und
 * am Ende liegen drei Fassungen in drei Postfächern.
 *
 * Vincent legt hier eine Mappe an, schickt Link und Passwort, und der
 * Auftraggeber lädt hoch — in dieselben Ordner, in denen später die Werkstatt
 * nachsieht. Was er hochlädt, sieht er auch; wer nachliefern will, bekommt
 * einen neuen Link auf dieselbe Mappe.
 *
 * Die Dateien selbst liegen in `product-files` — dieselbe Sammlung wie die
 * eigenen Werkstattdateien, mit denselben Ordnern, derselben Zugangsregel und
 * demselben Download. Sie unterscheiden sich nur im Anker: dort ein Artikel,
 * hier eine Mappe.
 *
 * **Die Mappe hängt an einem Menschen, nicht in der Luft.** Ein Ordner für
 * sich genommen ist in einem halben Jahr ein Rätsel: „Zeichnungen 3" sagt
 * niemandem, wessen Zeichnungen. Deshalb verlangt die Schnittstelle einen
 * Geschäftspartner oder eine Anfrage — daraus ergibt sich auch die
 * Bezeichnung von selbst. Angebot und Auftrag kommen später dazu, wenn aus
 * der Anfrage etwas wird.
 *
 * **Sie geht in beide Richtungen.** Hinein legt der Auftraggeber seine
 * Unterlagen; heraus gehen Fertigungszeichnung zur Freigabe, Prüfprotokoll,
 * Messschrieb. Welche Hausdatei er sehen darf, entscheidet das Häkchen
 * `freigabe` an der Datei — nie die Zugehörigkeit zur Mappe allein.
 */
export const CustomerUploads: CollectionConfig = {
  slug: 'customer-uploads',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
  labels: {
    singular: 'Übergabemappe',
    plural: 'Übergabemappen',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'email', 'updatedAt'],
    group: 'Büro',
    // Gepflegt wird das im Büro unter /office/uebergabe
    hidden: true,
  },
  access: {
    /*
     * Nur das Büro. Der Auftraggeber kommt nicht über diese Sammlung herein,
     * sondern über seinen Link — geprüft wird der in der eigenen
     * Schnittstelle, mit Passwort und Ablaufdatum.
     */
    read: office,
    create: office,
    update: office,
    delete: office,
  },
  hooks: liveHooks('mappen'),
  fields: [
    {
      /*
       * Leer lassen ist erlaubt — dann setzt die Schnittstelle den Namen aus
       * Geschäftspartner und Anfrage zusammen (`mappenTitel`). Ein Pflichtfeld
       * vor der eigentlichen Arbeit wird sonst mit „Test" gefüllt.
       */
      name: 'title',
      label: 'Bezeichnung',
      type: 'text',
      admin: { description: 'Leer = aus Geschäftspartner und Anfrage gebildet.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'contact',
          label: 'Geschäftspartner',
          type: 'relationship',
          relationTo: 'contacts',
          index: true,
          admin: { description: 'Woran die Mappe hängt — hier oder eine Anfrage.' },
        },
        {
          name: 'email',
          label: 'E-Mail des Auftraggebers',
          type: 'email',
          admin: { description: 'Dorthin geht der Link.' },
        },
      ],
    },
    {
      /*
       * Die Ordner der Mappe.
       *
       * Sie stehen hier und nicht an der Datei, damit ein leerer Ordner
       * bestehen bleibt: Vincent bereitet „Zeichnungen", „Stückliste",
       * „Freigaben" vor, und der Auftraggeber sieht, was erwartet wird.
       * Dieselbe Lesart wie bei den Ordnern am Artikel.
       */
      name: 'folders',
      label: 'Ordner',
      type: 'array',
      labels: { singular: 'Ordner', plural: 'Ordner' },
      fields: [{ name: 'name', label: 'Name', type: 'text', required: true }],
    },
    {
      /*
       * Die ausgegebenen Zugänge.
       *
       * Mehrere, und bewusst als Liste: Wer nachliefern will, bekommt einen
       * neuen Link auf dieselbe Mappe — der alte wird davon nicht ungültig,
       * er läuft nur aus. So steht am Ende auch da, wer wann Zugang hatte.
       */
      name: 'zugaenge',
      label: 'Ausgegebene Zugänge',
      type: 'array',
      labels: { singular: 'Zugang', plural: 'Zugänge' },
      admin: { readOnly: true, description: 'Wird beim Erzeugen eines Links gefüllt.' },
      fields: [
        { name: 'token', label: 'Kennung', type: 'text', index: true },
        {
          name: 'passwort',
          label: 'Passwort (verwahrt)',
          type: 'text',
          admin: { description: 'Salz und Abdruck — das Passwort selbst steht nirgends.' },
        },
        {
          type: 'row',
          fields: [
            { name: 'erzeugtAm', label: 'Erzeugt am', type: 'date' },
            { name: 'gueltigBis', label: 'Gültig bis', type: 'date' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'anEmail', label: 'Verschickt an', type: 'text' },
            { name: 'zuletztGenutzt', label: 'Zuletzt geöffnet', type: 'date' },
          ],
        },
        { name: 'zurueckgezogen', label: 'Zurückgezogen', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      /*
       * Der Vorgang, zu dem die Mappe gehört.
       *
       * Die Anfrage steht meist von Anfang an fest — sie ist der Grund, aus
       * dem überhaupt jemand Unterlagen schickt. Angebot und Auftrag kommen
       * dazu, sobald aus der Anfrage etwas wird; von da an findet die
       * Werkstatt die Zeichnungen dort, wo sie ohnehin nachsieht.
       */
      type: 'row',
      fields: [
        {
          name: 'anfrage',
          label: 'Anfrage',
          type: 'relationship',
          relationTo: 'inquiries',
          index: true,
        },
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
      name: 'geschlossen',
      label: 'Geschlossen',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Es kann nichts mehr hochgeladen werden; Ansehen bleibt möglich.' },
    },
    { name: 'note', label: 'Interne Notiz', type: 'textarea' },
  ],
}
