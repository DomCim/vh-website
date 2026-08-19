import type { CollectionConfig } from 'payload'

import { office } from '../access'
import { betraege } from '../lib/betraege'
import { naechsteAngebotsnummer } from '../lib/nummernkreis'
import { liveHooks } from '../lib/liveHooks'

/**
 * Angebote fürs Projektgeschäft.
 *
 * Der Weg im Betrieb: Anfrage → Angebot → Auftrag → Rechnung. Shop-Käufe
 * gehen an den Angeboten vorbei, dort steht der Preis ja schon auf der
 * Website.
 *
 * Die Nummer wird erst beim Versenden vergeben — ein verworfener Entwurf
 * soll keine Lücke in der Reihe hinterlassen.
 */
export const Quotes: CollectionConfig = {
  slug: 'quotes',
  labels: {
    singular: 'Angebot',
    plural: 'Angebote',
  },
  admin: {
    useAsTitle: 'quoteNumber',
    defaultColumns: ['quoteNumber', 'customerName', 'issueDate', 'total', 'status'],
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
  hooks: {
    afterDelete: liveHooks('angebote').afterDelete,
    afterChange: liveHooks('angebote').afterChange,
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        const summen = betraege(data.items ?? [], {
          discountKind: data.discountKind,
          discountValue: data.discountValue,
        })
        data.subtotal = summen.subtotal
        data.discountTotal = summen.discountTotal
        data.netTotal = summen.netTotal
        data.vatTotal = summen.vatTotal
        data.total = summen.total

        const wirdVersendet =
          data.status && data.status !== 'entwurf' && originalDoc?.status === 'entwurf'
        const neuUndVersendet = operation === 'create' && data.status && data.status !== 'entwurf'
        if ((wirdVersendet || neuUndVersendet) && !data.quoteNumber) {
          data.quoteNumber = await naechsteAngebotsnummer(req.payload)
          if (!data.issueDate) data.issueDate = new Date().toISOString()
          data.revision = 1
        }

        // Nachverhandelt: Die Nummer bleibt — darunter führt der Kunde das
        // Gespräch —, aber die Fassung zählt hoch, damit auf dem Tisch nicht
        // zwei verschiedene Angebote mit derselben Bezeichnung liegen.
        if (operation === 'update' && originalDoc?.quoteNumber) {
          const geaendert =
            summen.total !== originalDoc.total ||
            JSON.stringify(data.items ?? []) !== JSON.stringify(originalDoc.items ?? [])
          if (geaendert) {
            data.revision = (originalDoc.revision ?? 1) + 1
            data.revisedAt = new Date().toISOString()
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'quoteNumber',
      label: 'Angebotsnummer',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'entwurf',
      options: [
        { label: 'Entwurf', value: 'entwurf' },
        { label: 'Versendet', value: 'versendet' },
        { label: 'Angenommen', value: 'angenommen' },
        { label: 'Abgelehnt', value: 'abgelehnt' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'title', label: 'Bezeichnung', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'customer', label: 'Kunde', type: 'relationship', relationTo: 'contacts' },
        { name: 'customerName', label: 'Kunde (Text)', type: 'text' },
      ],
    },
    { name: 'customerAddress', label: 'Anschrift', type: 'textarea' },
    {
      type: 'row',
      fields: [
        {
          name: 'sentAt',
          label: 'Verschickt am',
          type: 'date',
          admin: {
            readOnly: true,
            description: 'Wird beim Versenden gesetzt und ist der Beginn des Nachfassens.',
          },
        },
        {
          name: 'lastFollowUpAt',
          label: 'Zuletzt nachgefasst am',
          type: 'date',
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'issueDate', label: 'Angebotsdatum', type: 'date' },
        {
          name: 'validUntil',
          label: 'Gültig bis',
          type: 'date',
          admin: { description: 'Bei Stahlpreisen üblich: 30 Tage.' },
        },
      ],
    },
    {
      name: 'items',
      label: 'Positionen',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Position', plural: 'Positionen' },
      fields: [
        { name: 'description', label: 'Beschreibung', type: 'text', required: true },
        {
          type: 'row',
          fields: [
            { name: 'quantity', label: 'Menge', type: 'number', required: true, defaultValue: 1 },
            { name: 'unit', label: 'Einheit', type: 'text', defaultValue: 'Stück' },
            {
              name: 'unitPrice',
              label: 'Einzelpreis netto (EUR)',
              type: 'number',
              required: true,
              min: 0,
            },
            {
              name: 'vatRate',
              label: 'Steuersatz (%)',
              type: 'number',
              required: true,
              defaultValue: 20,
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'discountKind',
          label: 'Nachlass',
          type: 'select',
          defaultValue: 'kein',
          options: [
            { label: 'Kein Nachlass', value: 'kein' },
            { label: 'Prozent', value: 'prozent' },
            { label: 'Fester Betrag (EUR)', value: 'betrag' },
          ],
          admin: {
            description:
              'Wird anteilig auf die Positionen verteilt, damit die Steuer stimmt.',
          },
        },
        { name: 'discountValue', label: 'Höhe', type: 'number', min: 0 },
        {
          name: 'discountReason',
          label: 'Begründung',
          type: 'text',
          admin: { description: 'Steht so auf dem Angebot, z.B. „Projektnachlass".' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'subtotal', label: 'Netto vor Nachlass', type: 'number', admin: { readOnly: true } },
        { name: 'discountTotal', label: 'Nachlass', type: 'number', admin: { readOnly: true } },
        { name: 'netTotal', label: 'Netto', type: 'number', admin: { readOnly: true } },
        { name: 'vatTotal', label: 'Steuer', type: 'number', admin: { readOnly: true } },
        { name: 'total', label: 'Brutto', type: 'number', admin: { readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'revision',
          label: 'Fassung',
          type: 'number',
          defaultValue: 1,
          admin: {
            readOnly: true,
            position: 'sidebar',
            description: 'Zählt bei jeder Änderung nach dem Versenden hoch. Die Nummer bleibt.',
          },
        },
        {
          name: 'revisedAt',
          label: 'Zuletzt nachverhandelt',
          type: 'date',
          admin: { readOnly: true, position: 'sidebar' },
        },
      ],
    },
    {
      /*
       * Die Annahme — und wie sie zustande kam.
       *
       * Ein Angebot wird meist am Telefon angenommen, und danach steht im
       * Büro nur noch ein Status. Wer später fragt „wann haben Sie
       * zugestimmt?", bekommt keine Antwort. Nimmt die Kundschaft im Portal
       * an, ist die Frage beantwortet: Zeitpunkt, Name und der Weg stehen
       * am Angebot.
       *
       * Deshalb auch `acceptedVia`: „telefonisch" ist eine ehrliche Angabe,
       * „im Portal angenommen" ist ein Beleg. Beides gehört unterschieden.
       */
      type: 'row',
      fields: [
        {
          name: 'acceptedAt',
          label: 'Angenommen am',
          type: 'date',
          admin: { readOnly: true, description: 'Wird beim Annehmen gesetzt.' },
        },
        {
          name: 'acceptedVia',
          label: 'Angenommen über',
          type: 'select',
          options: [
            { label: 'Kundenportal', value: 'portal' },
            { label: 'Im Büro erfasst', value: 'buero' },
          ],
          admin: { readOnly: true },
        },
        {
          name: 'acceptedName',
          label: 'Angenommen von',
          type: 'text',
          admin: { readOnly: true, description: 'Der Name, den die Kundschaft dabei angegeben hat.' },
        },
      ],
    },
    {
      name: 'productionTime',
      label: 'Zugesagte Fertigungszeit',
      type: 'text',
      admin: { description: 'z.B. „6–8 Wochen ab Auftragserteilung"' },
    },
    { name: 'note', label: 'Hinweis auf dem Angebot', type: 'textarea' },
    {
      name: 'inquiry',
      label: 'Aus Anfrage entstanden',
      type: 'relationship',
      relationTo: 'inquiries',
    },
  ],
}
