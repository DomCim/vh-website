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
/**
 * In der Entwicklung übersetzt Next die Module mit `eval` — das ist Teil
 * seiner Quellkarten und lässt sich nicht abstellen. Ohne diese Ausnahme
 * blockt der Browser dort die gesamte Anwendung: Die Seite steht da, aber
 * kein Knopf tut etwas, und in der Konsole steht nur „Refused to evaluate".
 * Im gebauten Stand kommt kein `eval` mehr vor, dort bleibt es also weg.
 */
/**
 * Was nicht in eine Suchmaschine gehört — als Kopfzeile, nicht nur als Meta-Tag.
 *
 * **Warum zusätzlich.** Ein `<meta name="robots">` steht im HTML und wird nur
 * gelesen, wenn jemand HTML auswertet. Eine PDF-Antwort, ein Bild, eine
 * JSON-Auskunft haben keines. Die Kopfzeile gilt unabhängig vom Inhaltstyp
 * und ist damit die zweite, tragende Absicherung.
 *
 * **Warum das nicht in die robots.txt gehört.** Ein `Disallow` verbietet das
 * Abrufen — und dann liest Google auch das `noindex` nie. Eine Adresse, die
 * es anderswo aufschnappt (ein weitergeleiteter Übergabelink), könnte danach
 * als nackte URL im Ergebnis stehen. Erlaubt abrufen **plus** noindex ist der
 * sichere Weg; genau deshalb steht `/uebergabe/` bewusst nicht in der
 * robots.txt.
 */
const nichtInDenIndex = { key: 'X-Robots-Tag', value: 'noindex, nofollow' }

const entwicklungsSkript = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"

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
  `script-src 'self' 'unsafe-inline'${entwicklungsSkript}${extraSkript ? ` ${extraSkript}` : ''}`,
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
  `script-src 'self' 'unsafe-inline'${entwicklungsSkript}${extraSkript ? ` ${extraSkript}` : ''}`,
  "connect-src 'self' ws: wss:",
].join('; ')

/**
 * Die Bestätigungsseiten nach einer Bestellung — und nur die.
 *
 * Dort steht die Frage, ob Google später nach einer Bewertung fragen darf.
 * Sagt der Kunde ja, wird `apis.google.com` nachgeladen und blendet Googles
 * Einladung in einem Rahmen ein. Ohne diese Ausnahme blockt der Browser das
 * stillschweigend: Der Knopf tut dann scheinbar nichts, und in der Konsole
 * steht eine Zeile, die niemand liest.
 *
 * Bewusst nur auf `…/bestellung/…` und nicht auf der ganzen Website: Was
 * überall erlaubt ist, wird irgendwann überall benutzt. Hier ist die Stelle,
 * an der jemand ausdrücklich zugestimmt hat — sonst nirgends.
 */
const bestellabschluss = [
  ...gemeinsam,
  `script-src 'self' 'unsafe-inline' https://apis.google.com${entwicklungsSkript}${extraSkript ? ` ${extraSkript}` : ''}`,
  `connect-src 'self' https://apis.google.com${extraSkript ? ` ${extraSkript}` : ''}`,
  'frame-src https://apis.google.com https://www.google.com',
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
  /**
   * PDFKit bleibt außerhalb des Next-Bundles.
   *
   * Gebündelt sucht es seine eingebauten Schriftmaße (Helvetica.afm) relativ
   * zum Bundle-Verzeichnis und findet sie nicht — jede PDF-Route antwortete
   * dann mit einem stillen Fehler, obwohl dieselbe Funktion in Skripten
   * einwandfrei lief. Aufgefallen ist das erst, als das Kundenportal seine
   * erste Rechnung ausliefern sollte. Als externes Paket lädt PDFKit aus
   * node_modules, wo die Dateien liegen; das Abbild kopiert node_modules mit.
   */
  serverExternalPackages: ['pdfkit'],
  /**
   * Im Büro-Abbild liegen die Skripte und Stile unter `/office/_next/…`.
   *
   * Seit Website und Büro getrennt gebaut werden, hat jedes seine eigenen
   * Dateien mit eigenen Prüfsummen im Namen. Beide boten sie aber unter
   * derselben Adresse an — `/_next/static/…` —, und die schickt Traefik zur
   * Website, weil in der Büro-Regel nur `/office`, `/api/office` und
   * `/ws/buero` stehen. Das Büro verlangte damit seine eigenen Dateien beim
   * falschen Container, bekam 404 auf jede einzelne und stand nackt da:
   * Überschriften, blaue Links, keine Stile.
   *
   * Mit dem Vorsatz liegen sie unter einem Pfad, der ohnehin ans Büro geht.
   * Next liefert sie dort auch aus — nachgemessen, es braucht kein
   * Abschneiden in Traefik.
   *
   * Nur im getrennten Bau: Läuft alles in einem Prozess (Entwicklung,
   * Prüfung), gibt es nichts zu unterscheiden.
   */
  assetPrefix: process.env.ROLLE === 'buero' ? '/office' : undefined,
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
        // Nur die Bestätigungsseiten: /de/bestellung/danke und /de/bestellung/<schlüssel>
        source: '/:sprache/bestellung/:pfad*',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: bestellabschluss }],
      },
      {
        source: '/admin/:pfad*',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: verwaltung }],
      },
      /**
       * Bilder dürfen ein Jahr im Browser bleiben.
       *
       * **Was vorher geschah.** Payload liefert die Mediendateien ohne jede
       * Angabe zur Zwischenspeicherung aus — kein `Cache-Control`, kein
       * `ETag`, kein `Last-Modified`. Der Browser kann dann nicht einmal
       * nachfragen, ob sich etwas geändert hat; er lädt jedes Bild bei jedem
       * Seitenaufruf vollständig neu. Auf der Startseite sind das über ein
       * Megabyte, bei jedem einzelnen Besuch derselben Person.
       *
       * Lange fiel das nicht auf, weil der Nginx Proxy Manager mit
       * „Cache Assets" seine eigene Angabe darüberlegte. Die war allerdings
       * schlechter als nötig (alles lief zur selben Uhrzeit ab) und traf auch
       * die Dateien von Next, die es von Haus aus richtig machen. Seit die
       * Einstellung aus ist, stimmen die Next-Dateien — und die Bilder stehen
       * ohne Angabe da.
       *
       * **Warum ein Jahr und „unveränderlich".** Eine Mediendatei wird nie
       * überschrieben: Payload hängt bei einem belegten Namen eine Nummer an
       * (aus `Brasero_1.png` wird `Brasero_1-1.png`). Eine Adresse zeigt also
       * für immer auf dasselbe Bild, und der Browser darf sie behalten, ohne
       * je nachzufragen. Wer ein Bild austauscht, bekommt ohnehin eine neue
       * Adresse — die Seiten holen sie sich aus der Datenbank.
       *
       * Gilt nur für `/api/media/file/…`, also die Dateien selbst. Die
       * Datenabfragen unter `/api/media` bleiben unangetastet; die dürfen
       * nicht zwischengespeichert werden.
       */
      {
        source: '/api/media/file/:pfad*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/office',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: buero }],
      },
      {
        source: '/office/:pfad*',
        headers: [...grundlegend, { key: 'Content-Security-Policy', value: buero }],
      },

      /*
       * ── Nichts davon gehört in eine Suchmaschine ────────────────────────
       *
       * Alle vier tragen bereits ein Meta-Tag; die Kopfzeile deckt zusätzlich
       * alles ab, was kein HTML ist. `/bestellung/danke` hatte als einzige
       * Seite in dieser Reihe gar nichts — dort steht nach dem Kauf die
       * Bestellnummer.
       */
      { source: '/office', headers: [nichtInDenIndex] },
      { source: '/office/:pfad*', headers: [nichtInDenIndex] },
      { source: '/admin/:pfad*', headers: [nichtInDenIndex] },
      { source: '/:sprache/uebergabe/:pfad*', headers: [nichtInDenIndex] },
      { source: '/:sprache/konto/:pfad*', headers: [nichtInDenIndex] },
      { source: '/:sprache/konto', headers: [nichtInDenIndex] },
      { source: '/:sprache/bestellung/:pfad*', headers: [nichtInDenIndex] },

      /*
       * Die Schnittstellen — **außer den Mediendateien**.
       *
       * `/api/media/` steht ausdrücklich in der robots.txt als erlaubt: Dort
       * liegen die Produktbilder, und die sollen in der Bildersuche stehen.
       * Ein pauschaler Kopf über `/api/` nähme sie aus dem Index, ohne dass
       * es jemandem auffiele — deshalb die Ausnahme im Pfadmuster.
       */
      { source: '/api/:pfad((?!media).*)', headers: [nichtInDenIndex] },
    ]
  },
}

/**
 * Payloads Beigabe für die Farbwahl gilt nur noch fürs Admin-Panel.
 *
 * **Was Payload tut.** `withPayload` hängt an **jeden** Pfad drei Kopfzeilen:
 * `Accept-CH`, `Vary` und `Critical-CH`, alle drei mit
 * `Sec-CH-Prefers-Color-Scheme`. Damit erfährt der Server schon vor dem
 * Ausliefern, ob der Besucher hell oder dunkel eingestellt hat — das
 * Admin-Panel baut sich dann gleich richtig herum auf, statt einmal
 * umzuspringen.
 *
 * **Was es kostet.** `Critical-CH` heißt für den Browser: „Diese Angabe
 * brauche ich, bevor du weitermachst." Beim allerersten Aufruf hat er sie
 * noch nicht mitgeschickt — also wirft er die begonnene Verbindung weg und
 * fängt von vorn an. Gemessen mit Lighthouse waren das **rund 0,6 Sekunden**,
 * geführt als Weiterleitung der Startseite auf sich selbst.
 *
 * Das trifft ausgerechnet den ersten Besuch, und bei einer Website, die
 * Menschen über die Suche finden, ist der erste Besuch meistens der einzige.
 * Im Admin-Panel, in dem täglich dieselben zwei Menschen arbeiten, ist
 * derselbe Aufwand gut angelegt — dort bleibt die Regel deshalb.
 *
 * Angefasst wird nur die eine Regel, die Payload selbst anlegt (erkennbar an
 * `Critical-CH`); alles andere aus dem Baukasten bleibt unberührt. Sollte
 * Payload das eines Tages anders lösen, greift die Umschreibung ins Leere und
 * schadet nichts — die Regel wird dann schlicht nicht mehr gefunden.
 */
const mitPayload = withPayload(nextConfig)

const nurFuersAdmin = (regeln) =>
  regeln.map((regel) =>
    regel.source === '/:path*' && regel.headers?.some((kopf) => kopf.key === 'Critical-CH')
      ? { ...regel, source: '/admin/:path*' }
      : regel,
  )

const konfiguration = {
  ...mitPayload,
  headers: async () => nurFuersAdmin((await mitPayload.headers?.()) ?? []),
}

export default konfiguration
