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

/**
 * Das Büro hält eine Live-Verbindung offen. `'self'` deckt nach der Norm auch
 * `ws:`/`wss:` derselben Herkunft ab — nur haben das nicht alle Browser immer
 * so gesehen, und das Büro läuft als App auf dem Handy. Ein blockierter
 * Verbindungsaufbau wäre dort still: Die Seite bliebe stehen, ohne Fehler.
 * Deshalb steht es hier ausdrücklich.
 */
const buero = [
  ...gemeinsam,
  `script-src 'self' 'unsafe-inline'${extraSkript ? ` ${extraSkript}` : ''}`,
  "connect-src 'self' ws: wss:",
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
   * Next übersetzt `instrumentation.ts` auch für die Edge-Laufzeit — obwohl
   * der Takt dort sofort wieder aussteigt (`NEXT_RUNTIME !== 'nodejs'`).
   * Übersetzt wird trotzdem, und dabei zöge er Payload, den Mailversand und
   * den Benachrichtigungsversand in ein Bündel, in dem es keine
   * Node-Bausteine wie `crypto` oder `http` gibt: In der Entwicklung
   * antwortete daraufhin jede Seite mit 500.
   *
   * Einzelne Bausteine nachzureichen wäre ein Spiel ohne Ende — jede neue
   * Abhängigkeit bringt den nächsten mit. Stattdessen wird für diesen einen
   * Zweig das Takt-Modul selbst durch eine leere Hülle ersetzt. Damit
   * verschwindet der ganze Rattenschwanz aus dem Edge-Bündel.
   */
  webpack: (config, { nextRuntime, webpack }) => {
    if (nextRuntime === 'edge') {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^\.\/takt$/, (mittel) => {
          mittel.request = './taktLeer'
        }),
      )
    }
    return config
  },
  /**
   * Reihenfolge ist hier entscheidend: Passen mehrere Regeln auf einen Pfad,
   * setzt Next sie der Reihe nach — die spätere überschreibt die frühere.
   * Deshalb steht der Auffangpfad oben und die Ausnahmen darunter. (Vorher
   * war es andersherum, damit lag die gelockerte Richtlinie fürs Admin-Panel
   * wirkungslos unter der allgemeinen.)
   */
  async headers() {
    return [
      {
        source: '/:pfad*',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: website }],
      },
      {
        source: '/admin/:pfad*',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: verwaltung }],
      },
      {
        source: '/office',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: buero }],
      },
      {
        source: '/office/:pfad*',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: buero }],
      },
    ]
  },
}

export default withPayload(nextConfig)
