import type { CollectionConfig } from 'payload'

import { admins } from '../access'

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
      options: [
        { label: 'Offen (unbezahlt)', value: 'pending' },
        { label: 'Bezahlt', value: 'paid' },
        { label: 'Versendet', value: 'shipped' },
        { label: 'Storniert', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
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
      name: 'stripeSessionId',
      label: 'Stripe Session-ID',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'stripePaymentIntentId',
      label: 'Stripe PaymentIntent-ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'customerNote',
      label: 'Anmerkung des Kunden',
      type: 'textarea',
    },
  ],
}
