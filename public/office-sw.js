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
 */

const CACHE = 'vh-buero-geruest'

/** Ohne das hier käme man nach dem Schließen der App nicht mehr hinein. */
const GERUEST = '/office'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(GERUEST))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
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
      caches.match(anfrage).then(
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
        return (
          (await cache.match(schluessel(anfrage.url))) ||
          (await cache.match(GERUEST)) ||
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
