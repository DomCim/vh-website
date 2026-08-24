import type { CollectionConfig } from 'payload'

import { admins } from '../access'
import { ANFRAGE_STATUS } from '../lib/listen'
import { benachrichtige } from '../lib/push'
import { liveHooks } from '../lib/liveHooks'

/**
 * Kontakt-, Produkt- und Maßanfertigungs-Anfragen.
 *
 * Angelegt wird ausschließlich server-seitig über die Local API — damit ein
 * Lead auch dann erhalten bleibt, wenn der Mailversand scheitert.
 */
export const Inquiries: CollectionConfig = {
  slug: 'inquiries',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
  labels: {
    singular: 'Anfrage',
    plural: 'Anfragen',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'status', 'createdAt'],
    group: 'Shop',
    // Geführt wird das im Büro unter /office — Payload bleibt die
    // öffentliche Verwaltung.
    hidden: true,
    description: 'Eingegangene Anfragen über Kontaktformular, Produktseite und Maßanfertigung.',
  },
  access: {
    read: admins,
    create: () => false,
    update: admins,
    delete: admins,
  },
  hooks: {
    afterDelete: liveHooks('anfragen').afterDelete,
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        // Eine Anfrage, die drei Tage liegen bleibt, ist meist verloren
        await benachrichtige(req.payload, {
          titel: 'Neue Anfrage',
          text: `${doc.name}: ${String(doc.message ?? '').slice(0, 120)}`,
          url: `/office/anfragen/${doc.id}`,
          tag: `anfrage-${doc.id}`,
        }).catch(() => undefined)
        return doc
      },
      ...liveHooks('anfragen').afterChange,
    ],
  },
  fields: [
    {
      name: 'type',
      label: 'Art',
      type: 'select',
      required: true,
      defaultValue: 'kontakt',
      options: [
        { label: 'Kontaktformular', value: 'kontakt' },
        { label: 'Produktanfrage', value: 'produkt' },
        { label: 'Maßanfertigung', value: 'massanfertigung' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'neu',
      options: [...ANFRAGE_STATUS],
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'E-Mail', type: 'email', required: true },
      ],
    },
    { name: 'phone', label: 'Telefon', type: 'text' },
    { name: 'message', label: 'Nachricht', type: 'textarea', required: true },
    {
      name: 'product',
      label: 'Zugehöriges Produkt',
      type: 'relationship',
      relationTo: 'products',
      admin: { description: 'Bei Anfragen direkt am Artikel' },
    },
    {
      type: 'row',
      fields: [
        { name: 'productTitle', label: 'Produkt (Bezeichnung)', type: 'text' },
        { name: 'productUrl', label: 'Produkt-Link', type: 'text' },
      ],
    },
    /*
     * Woher die Anfrage kam, wenn sie von einer Referenz ausging.
     *
     * Über „So etwas anfragen" auf einer Referenzseite. Das steht zwar auch
     * im vorbelegten Text — aber den überschreibt mancher, und dann bleibt
     * nur noch „ich hätte gern so etwas". Als eigenes Feld überlebt es das.
     */
    {
      type: 'row',
      fields: [
        { name: 'referenceTitle', label: 'Referenz (Bezeichnung)', type: 'text' },
        { name: 'referenceUrl', label: 'Referenz-Link', type: 'text' },
      ],
    },
    {
      name: 'custom',
      label: 'Angaben zur Maßanfertigung',
      type: 'group',
      admin: {
        condition: (data) => data?.type === 'massanfertigung',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'width', label: 'Breite (cm)', type: 'number' },
            { name: 'depth', label: 'Tiefe (cm)', type: 'number' },
            { name: 'height', label: 'Höhe (cm)', type: 'number' },
          ],
        },
        { name: 'color', label: 'Wunschfarbe (RAL)', type: 'text' },
        { name: 'purpose', label: 'Verwendungszweck', type: 'text' },
        { name: 'desiredDate', label: 'Wunschtermin', type: 'text' },
      ],
    },
    {
      name: 'attachments',
      label: 'Angehängte Bilder (Skizzen, Fotos)',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
    },
    {
      name: 'locale',
      label: 'Sprachfassung der Anfrage',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'internalNote',
      label: 'Interne Notiz',
      type: 'textarea',
      admin: { description: 'Nur im Backend sichtbar.' },
    },
  ],
}
