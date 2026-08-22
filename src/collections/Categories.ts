import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { admins, anyone } from '../access'
import { indexNowHooks } from '../lib/indexnow'

const indexNowKategorie = indexNowHooks((doc) => (doc.slug ? `/${doc.slug}` : null))

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: 'Kategorie',
    plural: 'Kategorien',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'parent', 'order'],
    group: 'Shop',
  },
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  hooks: {
    // Die Kategorieseite den Suchdiensten melden (siehe lib/indexnow.ts)
    afterChange: indexNowKategorie.afterChange,
    afterDelete: indexNowKategorie.afterDelete,
    beforeDelete: [
      /**
       * Eine Kategorie, in der noch Artikel liegen, wird nicht gelöscht — und
       * das steht hier, damit es *als Satz* ankommt.
       *
       * Ohne diesen Hook scheitert das Löschen trotzdem, nur unverständlich:
       * Am Artikel ist die Kategorie Pflicht, die Spalte also NOT NULL. Der
       * Fremdschlüssel will beim Löschen aber genau dorthin ein NULL
       * schreiben. Postgres versucht, was es selbst verbietet, und wirft
       * `23502 not_null_violation` — im Admin erscheint dann „Failed query:
       * delete from categories", und man sucht den Fehler bei sich.
       *
       * Aufgelöst wird der Widerspruch nicht dadurch, dass die Kategorie am
       * Artikel wegfallen darf: Ein Artikel ohne Kategorie taucht in keiner
       * Übersicht mehr auf, wäre also verschwunden, ohne gelöscht zu sein.
       * Das Löschen abzulehnen ist die ehrlichere Antwort — es sagt, was zu
       * tun ist, statt Ware still aus dem Laden zu räumen.
       *
       * Unterkategorien hindern nicht: Deren `parent` darf leer sein, sie
       * rücken beim Löschen einfach eine Ebene nach oben.
       */
      async ({ id, req }) => {
        const artikel = await req.payload.find({
          collection: 'products',
          where: { category: { equals: id } },
          limit: 3,
          depth: 0,
          req,
          overrideAccess: true,
        })
        if (artikel.totalDocs === 0) return

        const namen = artikel.docs.map((d) => `„${(d as { title?: string }).title ?? '?'}"`)
        const weitere = artikel.totalDocs - namen.length
        const liste = namen.join(', ') + (weitere > 0 ? ` und ${weitere} weitere` : '')

        throw new APIError(
          `Diese Kategorie lässt sich nicht löschen: Es ${artikel.totalDocs === 1 ? 'liegt noch 1 Artikel' : `liegen noch ${artikel.totalDocs} Artikel`} darin — ${liste}. ` +
            'Ordne die Artikel zuerst einer anderen Kategorie zu, dann geht es.',
          400,
        )
      },
    ],
  },
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      label: 'URL-Pfad (Slug)',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'z.B. "outdoor-moebel" — wird in der URL verwendet',
      },
    },
    {
      name: 'description',
      label: 'Beschreibung',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'image',
      label: 'Titelbild',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'parent',
      label: 'Übergeordnete Kategorie',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        description: 'Leer lassen für Hauptkategorien (erscheinen im Menü)',
      },
    },
    {
      name: 'order',
      label: 'Reihenfolge',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Kleinere Zahl = weiter vorne im Menü',
      },
    },
  ],
}
