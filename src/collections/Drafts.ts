import type { CollectionConfig } from 'payload'

/**
 * Angefangenes, das noch nicht gespeichert ist.
 *
 * Der Fall, für den es das gibt: Jemand fängt am Handy eine Rechnung an,
 * kommt bis zur dritten Position, setzt sich an den Rechner und will
 * weitermachen. Bisher war der halbe Stand dort weg — er lag im Formular des
 * anderen Geräts und nirgends sonst.
 *
 * Ein Entwurf ist deshalb bewusst am **Benutzer** festgemacht und nicht am
 * Gerät. Er gehört dem, der ihn angefangen hat, und ihm allein: Ein zweiter
 * Mensch, der dieselbe Rechnung öffnet, soll nicht plötzlich fremde
 * Zwischenstände sehen, die vielleicht nie abgeschickt werden.
 *
 * Was hier **nicht** passiert: Entwürfe werden nicht zu Datensätzen. Ein
 * angefangener Beleg taucht in keiner Liste auf, in keiner Summe, in keinem
 * Steuer-Export. Er ist Papier auf dem Schreibtisch, nicht in der Ablage —
 * und verschwindet in dem Moment, in dem der Datensatz wirklich gespeichert
 * wird.
 */
export const Drafts: CollectionConfig = {
  slug: 'drafts',
  labels: {
    singular: 'Entwurf',
    plural: 'Entwürfe',
  },
  admin: {
    useAsTitle: 'schluessel',
    defaultColumns: ['schluessel', 'benutzer', 'geraet', 'updatedAt'],
    group: 'Büro',
    // Zwischenstände sind nichts, was jemand im Admin-Panel durchblättert
    hidden: true,
  },
  access: {
    /*
     * Jeder sieht nur seine eigenen — auch die Inhaberrolle.
     *
     * Das ist keine Förmlichkeit: Ein Entwurf ist unfertiges Denken. Wer
     * weiß, dass jemand mitliest, schreibt anders, und ein halber Satz in
     * einem Angebot liest sich morgen anders als heute.
     */
    read: ({ req: { user } }) => (user ? { benutzer: { equals: user.id } } : false),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => (user ? { benutzer: { equals: user.id } } : false),
    delete: ({ req: { user } }) => (user ? { benutzer: { equals: user.id } } : false),
  },
  fields: [
    {
      name: 'benutzer',
      label: 'Benutzer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      /*
       * Welches Formular. Aufgebaut als `bereich:kennung`, wobei die Kennung
       * bei einem neuen Datensatz `neu` heißt — also `rechnungen:neu` oder
       * `belege:214`.
       *
       * Warum nicht zwei Felder: Nachgeschlagen wird immer über beides
       * zusammen, und ein einzelner Schlüssel macht das Nachschlagen eindeutig
       * und den Index klein. Getrennt gäbe es zwei Felder, die nie einzeln
       * gebraucht werden.
       */
      name: 'schluessel',
      label: 'Formular',
      type: 'text',
      required: true,
      index: true,
    },
    {
      /*
       * Der Formularstand, so wie ihn das Formular selbst führt.
       *
       * Bewusst als JSON und nicht als nachgebaute Felder: Ein Entwurf ist
       * kein Datensatz, sondern ein Abzug dessen, was gerade auf dem Bildschirm
       * steht — halb ausgefüllt, mit Positionen ohne Preis und Feldern, die es
       * morgen vielleicht nicht mehr gibt. Ein Schema darüber zu legen hieße,
       * es beim ersten Feld, das dazukommt, wieder abzureißen.
       */
      name: 'stand',
      label: 'Stand',
      type: 'json',
      required: true,
    },
    {
      /*
       * Woher der Entwurf kommt, in Menschensprache („iPhone", „Rechner").
       *
       * Steht in der Frage, die das Büro beim Öffnen stellt: „Am Handy um
       * 14:22 angefangen — weitermachen?" Ohne diese Angabe müsste man raten,
       * ob der Entwurf der eigene von vorhin ist oder einer von gestern Abend.
       */
      name: 'geraet',
      label: 'Gerät',
      type: 'text',
    },
  ],
  indexes: [
    // Nachgeschlagen wird immer „mein Entwurf für dieses Formular"
    { fields: ['benutzer', 'schluessel'], unique: true },
  ],
}
