import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { FixedToolbarFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import { en } from '@payloadcms/translations/languages/en'
import { fr } from '@payloadcms/translations/languages/fr'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { News } from './collections/News'
import { Orders } from './collections/Orders'
import { Products } from './collections/Products'
import { Projects } from './collections/Projects'
import { Promotions } from './collections/Promotions'
import { Testimonials } from './collections/Testimonials'
import { Users } from './collections/Users'
import { About } from './globals/About'
import { Homepage } from './globals/Homepage'
import { Integrations } from './globals/Integrations'
import { Legal } from './globals/Legal'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '– Vincent Hellmann',
    },
  },
  collections: [Products, Categories, News, Projects, Testimonials, Promotions, Orders, Media, Users],
  globals: [Homepage, About, SiteSettings, Legal, Integrations],
  // Feste Toolbar: alle Formatierungen immer sichtbar — deutlich besser am Handy
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [...defaultFeatures, FixedToolbarFeature()],
  }),
  localization: {
    locales: [
      { label: 'Deutsch', code: 'de' },
      { label: 'Français', code: 'fr' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'de',
    fallback: true,
  },
  i18n: {
    supportedLanguages: { de, en, fr },
    fallbackLanguage: 'de',
  },
  graphQL: {
    disable: true,
  },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    // In Produktion laufen Migrationen über `payload migrate` (siehe Docker-Entrypoint)
    push: process.env.NODE_ENV !== 'production',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.EMAIL_FROM || 'info@example.com',
        defaultFromName: process.env.EMAIL_FROM_NAME || 'Vincent Hellmann',
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT || 587) === 465,
          auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
        },
      })
    : undefined,
  sharp,
  upload: {
    limits: {
      fileSize: 20_000_000, // 20 MB
    },
  },
})
