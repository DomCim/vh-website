import type { CollectionConfig } from 'payload'

import { admins, anyone } from '../access'
import { liveHooks } from '../lib/liveHooks'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Medien',
    plural: 'Medien',
  },
  admin: {
    group: 'Verwaltung',
  },
  // Offene Büro-Seiten über Änderungen unterrichten
  hooks: liveHooks('medien'),
  access: {
    read: anyone,
    create: admins,
    update: admins,
    delete: admins,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'video/mp4', 'video/webm'],
    /**
     * Fünf Stufen statt drei, und alle als WebP.
     *
     * Vorher lud ein Handy dieselbe 900-Pixel-Datei wie ein Rechner, und auf
     * einem großen Bildschirm wurde eine 1800er auf 2600 Pixel hochgezogen —
     * bei einer Werkstatt, die von ihren Bildern lebt, ist beides ärgerlich.
     * Mit der Staffelung sucht sich der Browser über `srcset` die passende
     * Größe selbst.
     *
     * Die Originaldatei bleibt unangetastet: Sie ist das Archiv, und wer sie
     * herunterlädt, soll das Original bekommen.
     */
    imageSizes: [
      {
        name: 'klein',
        width: 320,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 78 } },
      },
      {
        name: 'thumbnail',
        width: 480,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'card',
        width: 900,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'large',
        width: 1800,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'xl',
        width: 2600,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      label: 'Alternativtext',
      type: 'text',
      localized: true,
    },
  ],
}
