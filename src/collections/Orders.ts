import type { CollectionConfig } from 'payload'

import { admins } from '../access'
import { BESTELL_STATUS } from '../lib/listen'
import { notifyOnProduction, notifyOnShipped } from '../lib/orderHooks'
import { liveHooks } from '../lib/liveHooks'

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: {
    singular: 'Bestellung',
    plural: 'Bestellungen',
  },
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'total', 'createdAt'],
    group: 'Shop',
    // Geführt wird das im Büro unter /office — Payload bleibt die
    // öffentliche Verwaltung.
    hidden: true,
  },
  hooks: {
    afterDelete: liveHooks('bestellungen').afterDelete,
    afterChange: [notifyOnProduction, notifyOnShipped, ...liveHooks('bestellungen').afterChange],
  },
  access: {
    // Bestellungen sind nur im Backend sichtbar; angelegt werden sie server-seitig (Local API)
    read: admins,
    create: admins,
    update: admins,
    delete: admins,
  },
  fields: [
    {
      name: 'orderNumber',
      label: 'Bestellnummer',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [...BESTELL_STATUS],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'expectedReady',
      label: 'Voraussichtlich fertig',
      type: 'text',
      admin: {
        position: 'sidebar',
        description:
          'z.B. „Ende April" oder „KW 18" — wird beim Umstellen auf „In Fertigung" an den Kunden gemeldet.',
      },
    },
    {
      name: 'trackingNumber',
      label: 'Trackingnummer',
      type: 'text',
      admin: {
        position: 'sidebar',
        description:
          'Vor dem Umstellen auf „Versendet" eintragen — sie wird in der Versand-Mail an den Kunden mitgeschickt.',
      },
    },
    {
      name: 'trackingUrl',
      label: 'Tracking-Link (optional)',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'z.B. der DHL-/Speditions-Link zur Sendungsverfolgung',
      },
    },
    {
      name: 'accessToken',
      label: 'Zugangsschlüssel (Bestellstatus-Seite)',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Teil des Links, den der Kunde in seiner Bestellbestätigung bekommt.',
      },
    },
    {
      name: 'items',
      label: 'Positionen',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'product',
          label: 'Produkt',
          type: 'relationship',
          relationTo: 'products',
        },
        {
          name: 'titleSnapshot',
          label: 'Bezeichnung',
          type: 'text',
          required: true,
        },
        {
          name: 'variantTitle',
          label: 'Variante',
          type: 'text',
        },
        {
          /*
           * Die Kennung der Variantenzeile am Artikel.
           *
           * Die Bezeichnung allein reicht nicht: Sie ist übersetzt (eine
           * französische Bestellung trägt den französischen Namen) und
           * änderbar. Für die Frage „welche Stückliste gilt für dieses Stück?"
           * braucht es etwas, das beides überlebt.
           */
          name: 'variantId',
          label: 'Variantenkennung',
          type: 'text',
          admin: { readOnly: true, description: 'Zeigt auf die Variante am Artikel.' },
        },
        {
          name: 'color',
          label: 'Farbe',
          type: 'text',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'quantity',
              label: 'Menge',
              type: 'number',
              required: true,
              min: 1,
            },
            {
              name: 'unitPrice',
              label: 'Einzelpreis (EUR)',
              type: 'number',
              required: true,
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'subtotal',
          label: 'Zwischensumme (EUR)',
          type: 'number',
          required: true,
        },
        {
          name: 'discount',
          label: 'Rabatt (EUR)',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'shippingTotal',
          label: 'Versand (EUR)',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'total',
          label: 'Gesamt (EUR)',
          type: 'number',
          required: true,
        },
      ],
    },
    {
      name: 'deliveryMethod',
      label: 'Versandart',
      type: 'select',
      required: true,
      defaultValue: 'shipping',
      options: [
        { label: 'Lieferung', value: 'shipping' },
        { label: 'Abholung', value: 'pickup' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'promotionTitle',
      label: 'Angewendete Aktion',
      type: 'text',
    },
    {
      name: 'customer',
      label: 'Kunde',
      type: 'group',
      fields: [
        {
          name: 'name',
          label: 'Name',
          type: 'text',
          required: true,
        },
        {
          name: 'email',
          label: 'E-Mail',
          type: 'email',
          required: true,
        },
        {
          name: 'phone',
          label: 'Telefon',
          type: 'text',
        },
      ],
    },
    {
      name: 'shippingAddress',
      label: 'Lieferadresse',
      type: 'group',
      admin: {
        description: 'Bei Abholung leer',
      },
      fields: [
        {
          name: 'line1',
          label: 'Straße & Hausnummer',
          type: 'text',
        },
        {
          name: 'line2',
          label: 'Adresszusatz',
          type: 'text',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'postalCode',
              label: 'PLZ',
              type: 'text',
            },
            {
              name: 'city',
              label: 'Ort',
              type: 'text',
            },
          ],
        },
        {
          name: 'country',
          label: 'Land',
          type: 'text',
          defaultValue: 'Deutschland',
        },
      ],
    },
    {
      name: 'paymentProvider',
      label: 'Zahlungsanbieter',
      type: 'select',
      defaultValue: 'paypal',
      /*
       * „Stripe" steht hier weiter zur Auswahl, obwohl darüber nichts mehr
       * hereinkommt: Bestellungen aus der Stripe-Zeit tragen den Wert, und ein
       * Datensatz, dessen Zahlungsart nicht mehr benannt werden kann, ist im
       * Zweifel bei einer Prüfung nichts wert.
       */
      options: [
        { label: 'PayPal', value: 'paypal' },
        { label: 'Rechnung (Überweisung)', value: 'rechnung' },
        { label: 'Stripe (nicht mehr in Gebrauch)', value: 'stripe' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'stripeSessionId',
      label: 'Stripe Session-ID',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        // Nur noch an alten Bestellungen — an neuen wäre es eine leere Zeile
        condition: (data) => Boolean(data?.stripeSessionId),
      },
    },
    {
      name: 'stripePaymentIntentId',
      label: 'Stripe PaymentIntent-ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        condition: (data) => Boolean(data?.stripePaymentIntentId),
      },
    },
    {
      name: 'paypalOrderId',
      label: 'PayPal Order-ID',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'paypalCaptureId',
      label: 'PayPal Capture-ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'reviewRequestedAt',
      label: 'Um Kundenstimme gebeten am',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'shippedAt',
      label: 'Versendet am',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'consent',
      label: 'Bestätigt beim Bestellen',
      type: 'group',
      admin: {
        description:
          'Wird beim Absenden der Kasse festgehalten. Im Streitfall zählt nicht, was auf der Seite stand, sondern was belegbar ist.',
      },
      fields: [
        {
          name: 'termsAt',
          label: 'AGB und Widerrufsbelehrung bestätigt am',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'waiver',
          label: 'Kein Widerrufsrecht bei Einzelanfertigung bestätigt',
          type: 'checkbox',
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'customerNote',
      label: 'Anmerkung des Kunden',
      type: 'textarea',
    },
  ],
}
