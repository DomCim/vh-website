import type { CollectionConfig } from 'payload'

import { ALLE_RECHTE, INHABER, RECHTE, type Recht, hatRecht } from '../lib/rechte'

/**
 * Rollen — damit das System mitwächst, ohne dass jemand Code anfasst.
 *
 * Vorher gab es zwei feste Werte in einem Auswahlfeld. Wer eine dritte Rolle
 * brauchte — Werkstatt ohne Umsätze, Buchhaltung ohne Preise —, brauchte
 * dafür eine Änderung an der Anwendung. Jetzt ist eine Rolle ein Datensatz:
 * Name, ein paar Haken, fertig.
 *
 * Zwei Rollen sind eingebaut und lassen sich nicht löschen. Das ist keine
 * Bequemlichkeit, sondern Selbstschutz: Ein Betrieb, der sich beim Umbauen
 * der Rechte aussperrt, steht am Freitagabend vor einer verschlossenen Tür,
 * und niemand kann ihn hereinlassen — dazu fehlte ja gerade das Recht.
 */
export const Roles: CollectionConfig = {
  slug: 'roles',
  labels: {
    singular: 'Rolle',
    plural: 'Rollen',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'schluessel', 'eingebaut'],
    group: 'Verwaltung',
    description: 'Verwaltet wird das im Büro unter Einstellungen → Benutzer.',
  },
  access: {
    // Lesen darf jeder Angemeldete — die Oberfläche muss wissen, was sie
    // anzeigen darf, und die Rechte selbst sind kein Geheimnis
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => hatRecht(user, 'benutzer.verwalten'),
    update: ({ req: { user } }) => hatRecht(user, 'benutzer.verwalten'),
    delete: ({ req: { user } }) => hatRecht(user, 'benutzer.verwalten'),
  },
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        const rolle = await req.payload.findByID({
          collection: 'roles',
          id,
          overrideAccess: true,
        })
        if (rolle?.eingebaut) {
          throw new Error('Eingebaute Rollen lassen sich nicht löschen.')
        }

        /*
         * Eine Rolle mitsamt ihren Leuten zu löschen hieße, Konten ohne Rolle
         * zurückzulassen — und die dürfen dann nichts mehr. Lieber vorher
         * umhängen, und das soll der Mensch entscheiden.
         */
        const dran = await req.payload.count({
          collection: 'users',
          where: { rolle: { equals: id } },
          overrideAccess: true,
        })
        if (dran.totalDocs > 0) {
          throw new Error(
            `Dieser Rolle sind noch ${dran.totalDocs} Konten zugeordnet — erst umhängen, dann löschen.`,
          )
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      admin: { description: 'Wie die Rolle im Büro heißt, z.B. „Werkstatt" oder „Buchhaltung".' },
    },
    {
      /*
       * Der Schlüssel bleibt, auch wenn der Name sich ändert. Daran hängt die
       * eingebaute Inhaberrolle — würde sie über ihren Namen erkannt, wäre
       * ein Umbenennen genug, um sie zu entwaffnen.
       */
      name: 'schluessel',
      label: 'Schlüssel',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Unveränderlicher Bezeichner, z.B. „werkstatt". Kleinbuchstaben ohne Umlaute.',
      },
    },
    {
      name: 'rechte',
      label: 'Rechte',
      type: 'select',
      hasMany: true,
      options: ALLE_RECHTE.map((wert) => ({ value: wert, label: RECHTE[wert] })),
      admin: {
        description:
          'Was diese Rolle darf. Die Inhaberrolle darf immer alles, unabhängig von den Haken.',
      },
    },
    {
      name: 'eingebaut',
      label: 'Eingebaut',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Eingebaute Rollen lassen sich nicht löschen.',
      },
    },
  ],
}

/**
 * Die zwei Rollen, die es geben muss.
 *
 * Sie werden beim Umzug angelegt und bei jedem Start nachgezogen, falls sie
 * jemand von Hand entfernt hat. Ohne die Inhaberrolle käme niemand mehr ins
 * Büro, und ohne einen Weg zurück wäre das endgültig.
 */
export const EINGEBAUTE_ROLLEN = [
  {
    schluessel: INHABER,
    name: 'Inhaber',
    // Bewusst leer: `hatRecht` erkennt die Inhaberrolle am Schlüssel und gibt
    // ihr alles. Stünde hier eine Liste, fehlte nach dem nächsten neuen Recht
    // ausgerechnet dem Inhaber genau dieses.
    rechte: [] as Recht[],
    eingebaut: true,
  },
  {
    schluessel: 'redaktion',
    name: 'Redaktion',
    rechte: ['website.pflegen'] as Recht[],
    eingebaut: true,
  },
]
