import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Termine — was im Kalender steht, ohne an einem Vorgang zu hängen.
 *
 * Der Kalender war bis hierher ein reiner Ableitungskalender: Er zeigte
 * Fertigstellungen, Liefertermine, ablaufende Angebote und fällige Belege —
 * alles gerechnet aus anderen Sammlungen. Was er nicht konnte, war das
 * Naheliegendste: einen Termin eintragen. „Dienstag 9 Uhr Steuerberater"
 * gehört zu keinem Auftrag und hatte deshalb nirgends Platz.
 *
 * Diese Sammlung ist dieser Platz. Sie ist die einzige Quelle im Kalender,
 * die von Hand gefüllt wird — und die einzige, die auch von außen geschrieben
 * werden darf: Über CalDAV legt das Telefon seine Termine genau hier ab
 * (siehe lib/kalender/caldav.ts). Alles andere bleibt lesend, denn ein am
 * iPhone verschobener Rechnungstermin wäre eine stille Zusage an die
 * Kundschaft, die niemand geprüft hat.
 *
 * Zeiten stehen bewusst als volle Zeitpunkte in der Datenbank und nicht als
 * Datum plus Uhrzeit-Text: Das Telefon schickt UTC, das Büro rechnet in
 * Ortszeit, und jede Umrechnung, die man sich sparen kann, ist eine
 * Fehlerquelle weniger. Ganztägige Termine tragen zusätzlich `ganztaegig`,
 * weil iCalendar sie anders schreibt (DATE statt DATE-TIME) und ein Termin
 * ohne dieses Kennzeichen am Telefon sonst als „00:00 bis 00:00" erschiene.
 */
export const Appointments: CollectionConfig = {
  slug: 'appointments',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
  labels: {
    singular: 'Termin',
    plural: 'Termine',
  },
  hooks: liveHooks('termine'),
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'start', 'ende'],
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
    { name: 'title', label: 'Worum geht es?', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'start',
          label: 'Beginn',
          type: 'date',
          required: true,
          index: true,
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'ende',
          label: 'Ende',
          type: 'date',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Leer lassen für einen Termin ohne feste Dauer.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'ganztaegig',
          label: 'Ganztägig',
          type: 'checkbox',
          defaultValue: false,
          index: true,
        },
        { name: 'ort', label: 'Ort', type: 'text' },
      ],
    },
    { name: 'notiz', label: 'Notiz', type: 'textarea' },
    {
      /*
       * Der Bezug ist optional, aus demselben Grund wie bei den
       * Wiedervorlagen: „Werkstatttor streichen" gehört zu keinem Vorgang,
       * und ein Pflichtfeld hätte den halben Zweck genommen.
       */
      type: 'row',
      fields: [
        {
          name: 'contact',
          label: 'Geschäftspartner',
          type: 'relationship',
          relationTo: 'contacts',
          index: true,
        },
        { name: 'job', label: 'Auftrag', type: 'relationship', relationTo: 'jobs', index: true },
      ],
    },
    {
      /*
       * Die Kennung, unter der dieser Termin nach außen auftritt.
       *
       * iCalendar erkennt Termine an ihrer UID, nicht an ihrer Stelle in der
       * Datei. Ohne feste UID bekäme das Telefon bei jedem Abruf lauter neue
       * Termine statt geänderter — der Kalender wüchse bei jedem Abgleich,
       * statt sich zu aktualisieren.
       *
       * Vergeben wird sie beim Anlegen (siehe lib/kalender/ical.ts). Kommt der
       * Termin vom Telefon, gilt dessen UID, damit beide Seiten von demselben
       * Termin sprechen.
       */
      name: 'uid',
      label: 'Kalender-Kennung',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      /*
       * Woher der Termin kam. Nur zur Anzeige — geschrieben wird beides
       * gleich, aber wer im Büro einen Termin sieht, den er dort nie
       * eingetragen hat, soll erkennen können, dass er vom Telefon stammt.
       */
      name: 'quelle',
      label: 'Angelegt über',
      type: 'select',
      defaultValue: 'buero',
      options: [
        { label: 'Büro', value: 'buero' },
        { label: 'Telefon (CalDAV)', value: 'caldav' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'createdBy',
      label: 'Angelegt von',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
