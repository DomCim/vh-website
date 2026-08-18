import { withPayload } from '@payloadcms/next/withPayload'

/**
 * Zusätzliche Herkünfte für die Sicherheitsrichtlinie (CSP).
 *
 * Die cookiefreie Besucherstatistik wird im Admin gepflegt, ihre Adresse steht
 * also erst zur Laufzeit fest — die Kopfzeilen entstehen aber beim Bauen.
 * Deshalb hier eine Umgebungsvariable: Wer eine Statistik hinterlegt, trägt
 * deren Herkunft zusätzlich in `CSP_EXTRA_SCRIPT` ein (z.B.
 * `https://plausible.io`). Ohne das blockt der Browser das Skript stillschweigend.
 */
const extraSkript = (process.env.CSP_EXTRA_SCRIPT || '').trim()

/**
 * Warum `'unsafe-inline'` für Skripte?
 *
 * Next legt seine Hydrations-Daten als Inline-Skript in die Seite, Payload
 * ebenso. Sauber wäre ein Nonce je Antwort — der zwingt aber jede Seite in
 * die dynamische Auslieferung und nimmt der Website damit ihren Cache.
 * Der Gewinn bliebe gering: Was dieses Regelwerk verhindern soll, ist ein
 * eingeschleustes Skript von einer fremden Adresse, und das tut es auch so.
 */
const gemeinsam = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "media-src 'self' https:",
  "manifest-src 'self'",
]

const website = [
  ...gemeinsam,
  `script-src 'self' 'unsafe-inline'${extraSkript ? ` ${extraSkript}` : ''}`,
  `connect-src 'self'${extraSkript ? ` ${extraSkript}` : ''}`,
].join('; ')

// Das Admin-Panel bringt eigene Werkzeuge mit (Editor, Vorschau) und braucht
// etwas mehr Luft. Es steht ohnehin hinter der Anmeldung.
const verwaltung = [
  ...gemeinsam,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
].join('; ')

const grundlegend = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Zwei Jahre HSTS inklusive Unterdomänen. TLS endet im Nginx Proxy Manager;
  // die Kopfzeile reicht von dort bis zum Browser durch.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Verrät nicht mehr, womit die Seite gebaut ist
  poweredByHeader: false,
  images: {
    // Bilder liegen im eigenen Medien-Volume; fremde Adressen braucht niemand.
    remotePatterns: [],
    formats: ['image/avif', 'image/webp'],
  },
  /**
   * Next übersetzt `instrumentation.ts` auch für die Edge-Laufzeit — selbst
   * wenn dort nichts davon läuft (der Takt steigt bei `NEXT_RUNTIME !==
   * 'nodejs'` sofort wieder aus). Übersetzt wird trotzdem, und dabei stolpert
   * der Bündler über Node-Bausteine wie `crypto`, die es in der Edge-Laufzeit
   * nicht gibt: In der Entwicklung antwortete daraufhin jede Seite mit 500.
   *
   * Für diesen einen Zweig genügt es, die Bausteine als „gibt es nicht" zu
   * melden — aufgerufen werden sie dort ohnehin nie.
   */
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        net: false,
        os: false,
        path: false,
        stream: false,
        tls: false,
        zlib: false,
        child_process: false,
      }
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/admin/:pfad*',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: verwaltung }],
      },
      {
        source: '/:pfad*',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: website }],
      },
    ]
  },
}

export default withPayload(nextConfig)
