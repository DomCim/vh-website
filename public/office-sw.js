/*
 * Service Worker der Büro-App.
 *
 * Zwei Aufgaben: Benachrichtigungen zustellen und dafür sorgen, dass sich das
 * Büro überhaupt öffnen lässt, wenn kein Netz da ist.
 *
 * Zum Zwischenspeichern: Früher stand hier, es werde bewusst nichts
 * gespeichert — eine veraltete Bestellliste sei schlimmer als gar keine. Das
 * stimmt nur, solange man verschweigt, dass sie alt ist. Inzwischen liegen die
 * Geschäftsdaten ohnehin im Gerät (siehe lib/buero/), und eine Leiste über den
 * Seiten sagt, von wann der Stand ist. Was hier fehlte, war nur das Gerüst:
 * ohne HTML, CSS und Skripte im Zwischenspeicher zeigt der Browser ohne Netz
 * seine eigene Fehlerseite, und die schönsten Daten im Gerät nützen nichts.
 *
 * Gespeichert wird deshalb genau das Gerüst — keine Daten. Seiten holt der
 * Worker zuerst aus dem Netz und fällt erst dann auf den Zwischenspeicher
 * zurück; so bringt jeder Aufruf am Netz auch gleich den neuen Stand mit.
 *
 * Ein angenehmer Nebeneffekt: Next lädt verlinkte Seiten vorab, und die
 * landen hier mit. Oft sind dadurch auch Ansichten offline da, die man noch
 * nie geöffnet hat.
 */

const CACHE = 'vh-buero-geruest'

/** Ohne das hier käme man nach dem Schließen der App nicht mehr hinein. */
const GERUEST = '/office'

/**
 * Auskunftsseite für Ansichten, die noch nie offen waren.
 *
 * Ersatzweise die übergeordnete Liste auszuliefern war ein Fehlgriff: Sie
 * erschien unter der Adresse der Detailseite, und wer einen Beleg aufrief,
 * bekam die Belegliste zu sehen — ohne Hinweis, dass es nicht sein Beleg ist.
 * Eine schlichte Auskunft ist ehrlicher als die falsche Seite.
 */
const AUSKUNFT = '/office-nicht-geladen.html'

/**
 * Die Hüllen, die beim Installieren abgelegt werden.
 *
 * Warum nicht darauf warten, dass jemand die Seiten aufruft: Innerhalb der App
 * wird seitenintern navigiert — ein Klick auf eine Zeile holt kein Dokument,
 * also landet auch keines im Zwischenspeicher. Wer sich durchs Büro klickt,
 * hätte am Ende fast nichts abgelegt und stünde ohne Netz vor leeren Händen.
 *
 * Das `_` steht für jede Kennung: Alle Detailseiten eines Bereichs teilen sich
 * eine Hülle, ihren Inhalt holen sie aus dem Bestand im Gerät. Eine erfundene
 * Kennung liefert also genau das Gerüst, das später jeder Beleg braucht.
 */
const BEREICHE = [
  'anfragen',
  'angebote',
  'artikel',
  'auftraege',
  'belege',
  'bestellungen',
  'inventar',
  'inventur',
  'partner',
  'rechnungen',
]

const MIT_NEU = ['angebote', 'auftraege', 'belege', 'inventar', 'inventur', 'partner', 'rechnungen']

// Der Wareneingang steht in beiden Listen: als Übersicht, als Einzelseite und
// mit seinem Formular — in der Werkstatt wird er gebucht, und dort ist das
// Netz am dünnsten.
const WARENEINGANG = ['/office/wareneingang', '/office/wareneingang/_', '/office/wareneingang/neu']

const VORRAT = [
  GERUEST,
  AUSKUNFT,
  '/office/kalender',
  '/office/auslastung',
  '/office/nachbestellen',
  '/office/nachkalkulation',
  '/office/wiedervorlagen',
  '/office/einstellungen',
  ...BEREICHE.map((b) => `/office/${b}`),
  ...BEREICHE.map((b) => `/office/${b}/_`),
  ...MIT_NEU.map((b) => `/office/${b}/neu`),
  ...WARENEINGANG,
]

/**
 * Legt eine Seite ab — samt dem, was sie zum Leben braucht.
 *
 * `cache.add` holt nur das Dokument. Ohne seine Skripte und Stile steht die
 * Seite ohne Netz zwar da, bleibt aber leer: Das Gerüst ist da, die Anwendung
 * dahinter nicht. Die Adressen tragen eine Prüfsumme im Namen, die niemand
 * vorher kennt — also werden sie aus dem HTML gelesen.
 */
/**
 * Beim Nachschlagen zählt die Adresse, sonst nichts.
 *
 * Die Antworten des Servers tragen `Vary: Sec-CH-Prefers-Color-Scheme,
 * Accept-Encoding`. Ohne diesen Zusatz vergleicht der Browser beim
 * Nachschlagen auch die genannten Kopfzeilen — und die stimmen nie überein:
 * Abgelegt wurde die Datei von hier, angefragt wird sie von der Seite, und
 * die schickt andere Kopfzeilen mit. Die Folge war ein Zwischenspeicher, der
 * gut gefüllt aussah und trotzdem auf jede Frage „habe ich nicht" antwortete;
 * ohne Netz lud dann kein einziges Skript, und die Seiten, die ihren Inhalt
 * erst im Browser aufbauen, blieben leer.
 *
 * Die Adressen tragen ihre Prüfsumme im Namen — zwei Antworten unter
 * derselben Adresse können sich gar nicht unterscheiden.
 */
const EGAL_WORAN = { ignoreVary: true }

async function ablegen(cache, pfad) {
  const antwort = await fetch(pfad, { credentials: 'same-origin' })
  if (!antwort.ok) return

  const text = await antwort.clone().text()
  await cache.put(schluessel(new URL(pfad, self.location.origin).toString()), antwort)

  /*
   * Zwei Schreibweisen, und beide werden gebraucht.
   *
   * Im HTML stehen Skripte und Stile mit vollem Pfad. In Nexts Ladedaten
   * stehen nachgeladene Teile dagegen relativ (`static/chunks/…`) — und
   * genau die gehören zu den Seiten, die ihren Inhalt erst nachladen. Wurden
   * sie übersehen, stand die Seite ohne Netz zwar da, blieb aber leer.
   *
   * Klammern gehören mit in den Pfad. Next legt die Teile einer Seite unter
   * ihrem Ordner im Quelltext ab, und der heißt hier `(office)` — die Klammer
   * ist Teil des Namens, nicht das Ende der Adresse. Wer sie als Ende liest,
   * merkt sich `…/chunks/app/` statt der Datei; abgelegt wird dann nichts,
   * und die Seite bleibt ohne Netz leer. (Genau daran hingen zuletzt Belege,
   * Rechnungen und Kalender: Sie bringen nichts Fertiges mit, sondern bauen
   * sich erst im Browser auf — ohne ihr Skript steht dort nichts.)
   */
  // Getrennt gebaut liegen die Büro-Dateien unter `/office/_next/…`, sonst
  // unter `/_next/…`. Die Seite sagt es selbst.
  const vorsatz = text.includes('/office/_next/static/') ? '/office' : ''

  const zubehoer = new Set([
    ...[...text.matchAll(/["'](\/(?:office\/)?_next\/static\/[^"'\s\\]+)/g)].map((t) => t[1]),
    /*
     * Die relative Schreibweise verrät ihren Vorsatz nicht.
     *
     * In Nexts Ladedaten stehen nachgeladene Teile als `static/chunks/…`, ohne
     * führenden Pfad — den setzt der Browser zur Laufzeit davor. Welcher es
     * ist, hängt davon ab, ob das Büro getrennt gebaut wurde; die Seite selbst
     * verrät es aber in ihren übrigen Adressen.
     *
     * Kurzzeitig wurden hier beide Schreibweisen geholt und die falsche
     * scheitern gelassen. Das verdoppelte die Anfragen beim Einbau, und auf
     * einem langsamen Gerät war der Worker dann noch nicht bereit, wenn ihn
     * jemand brauchte.
     */
    ...[...text.matchAll(/["'](static\/(?:chunks|css|media)\/[^"'\s\\]+)/g)].map(
      (t) => `${vorsatz}/_next/${t[1]}`,
    ),
    // Schriften und Bilder aus `url(…)` in eingebetteten Stilen; hier ist die
    // schließende Klammer tatsächlich das Ende
    ...[...text.matchAll(/url\(\s*["']?(\/(?:office\/)?_next\/static\/[^"')\s\\]+)/g)].map(
      (t) => t[1],
    ),
  ])
  await Promise.allSettled(
    [...zubehoer].map(async (adresse) => {
      if (await cache.match(adresse, EGAL_WORAN)) return
      return cache.add(adresse)
    }),
  )
}

self.addEventListener('install', (event) => {
  /*
   * Beim Installieren nur das Nötigste, und zwar schnell.
   *
   * Der Vorrat wird erst nach dem Aktivieren gefüllt. Vorher stand er hier —
   * mit dem Ergebnis, dass der Worker rund dreißig Seiten samt Zubehör holte,
   * bevor er überhaupt zu arbeiten begann. In dieser Zeit bediente er nichts,
   * und wer das Netz früh verlor, stand vor der Fehlerseite des Browsers.
   */
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled([GERUEST, AUSKUNFT].map((pfad) => ablegen(cache, pfad))))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

/**
 * Füllt den Vorrat, nachdem der Worker bereits arbeitet.
 *
 * Bewusst ohne `waitUntil`: Das Büro soll sofort bedient werden, der Vorrat
 * darf sich in den nächsten Sekunden ansammeln. Was schon dasteht, wird nicht
 * noch einmal geholt.
 */
async function vorratWaermen() {
  try {
    const cache = await caches.open(CACHE)
    for (const pfad of VORRAT) {
      if (await cache.match(schluessel(new URL(pfad, self.location.origin).toString()), EGAL_WORAN))
        continue
      await ablegen(cache, pfad).catch(() => undefined)
    }
  } catch {
    // Ohne Vorrat läuft das Büro am Netz weiter — nur eben nicht ohne
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )

  // Der Vorrat läuft nebenher — er darf die Aktivierung nicht aufhalten
  vorratWaermen()
})

/**
 * Der Schlüssel, unter dem eine Seite abgelegt wird.
 *
 * Kennungen werden dabei ersetzt: `/office/belege/17` und `/office/belege/94`
 * sind dieselbe Seite — sie holt sich ihren Beleg ohnehin aus dem Bestand im
 * Gerät. Ein einziger Eintrag genügt also für alle Belege, und wer einen
 * geöffnet hat, kann offline jeden öffnen.
 *
 * Die Abfrage in der Adresse (`?filter=offen`) fällt aus demselben Grund weg.
 */
function schluessel(adresse) {
  const url = new URL(adresse)
  const pfad = url.pathname
    .split('/')
    .map((teil) => (/^\d+$/.test(teil) ? '_' : teil))
    .join('/')
  return new URL(pfad, self.location.origin).toString()
}

const istGeruest = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  // Im getrennten Bau liegen die Büro-Dateien unter eigenem Vorsatz
  url.pathname.startsWith('/office/_next/static/') ||
  url.pathname.startsWith('/fonts/') ||
  url.pathname.endsWith('.webmanifest') ||
  /\/(office|admin)-icon-\d+\.png$/.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const anfrage = event.request
  if (anfrage.method !== 'GET') return

  const url = new URL(anfrage.url)
  if (url.origin !== self.location.origin) return

  // Daten gehen nie in den Zwischenspeicher: Sie liegen im Gerät (IndexedDB),
  // und eine zwischengespeicherte Antwort auf `/api/office/abgleich` würde den
  // Abgleich stillschweigend um seinen Sinn bringen.
  if (url.pathname.startsWith('/api/')) return

  /*
   * Nexts eigene Nachlade-Anfragen (`?_rsc=…`) bewusst nicht bedienen: Scheitern
   * sie, lädt der Browser die Seite ganz neu — und die kommt dann aus dem
   * Zwischenspeicher. Eine halb passende Antwort wäre schlimmer als keine.
   */
  if (url.searchParams.has('_rsc')) return

  if (istGeruest(url)) {
    // Diese Dateien tragen eine Prüfsumme im Namen; was einmal da ist, stimmt.
    event.respondWith(
      caches.match(anfrage, EGAL_WORAN).then(
        (gefunden) =>
          gefunden ||
          fetch(anfrage).then((antwort) => {
            if (antwort.ok) {
              const kopie = antwort.clone()
              caches.open(CACHE).then((cache) => cache.put(anfrage, kopie))
            }
            return antwort
          }),
      ),
    )
    return
  }

  const istSeite =
    anfrage.mode === 'navigate' || (anfrage.headers.get('accept') || '').includes('text/html')
  if (!istSeite || !url.pathname.startsWith('/office')) return

  event.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone()
          caches.open(CACHE).then((cache) => cache.put(schluessel(anfrage.url), kopie))
        }
        return antwort
      })
      .catch(async () => {
        const cache = await caches.open(CACHE)

        /*
         * Nur die Seite selbst — oder eine ehrliche Auskunft.
         *
         * Kennungen sind im Schlüssel bereits ersetzt: Wer einen Beleg
         * geöffnet hat, kann offline jeden öffnen, weil sich alle dieselbe
         * Hülle teilen. Was noch nie offen war, gibt es aber nicht, und dann
         * ist die Auskunft besser als eine fremde Seite unter dieser Adresse.
         */
        return (
          (await cache.match(schluessel(anfrage.url), EGAL_WORAN)) ||
          (await cache.match(AUSKUNFT, EGAL_WORAN)) ||
          new Response('Ohne Netz und ohne gespeicherte Fassung dieser Seite.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        )
      }),
  )
})

/**
 * Beim Abmelden räumt das Büro den Bestand aus dem Gerät. Das Gerüst kommt
 * hier mit weg — es enthält zwar keine Geschäftsdaten, aber ein Gerät, an dem
 * sich jemand abgemeldet hat, soll auch keine Büro-Seiten mehr aufmachen.
 */
self.addEventListener('message', (event) => {
  if (event.data === 'aufraeumen') {
    event.waitUntil(caches.delete(CACHE))
  }
})

self.addEventListener('push', (event) => {
  let daten = { titel: 'Vincent Hellmann Büro', text: '', url: '/office' }
  try {
    if (event.data) daten = { ...daten, ...event.data.json() }
  } catch {
    if (event.data) daten.text = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(daten.titel, {
      body: daten.text,
      icon: '/office-icon-192.png',
      badge: '/office-icon-192.png',
      tag: daten.tag || undefined,
      data: { url: daten.url || '/office' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const ziel = (event.notification.data && event.notification.data.url) || '/office'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      // Ein schon offenes Büro-Fenster nach vorne holen, statt ein zweites zu öffnen
      for (const f of fenster) {
        if (f.url.includes('/office') && 'focus' in f) {
          f.navigate(ziel)
          return f.focus()
        }
      }
      return self.clients.openWindow(ziel)
    }),
  )
})
