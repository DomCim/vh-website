/*
 * Service Worker der Büro-App.
 *
 * Zuständig ausschließlich für Benachrichtigungen — es wird bewusst nichts
 * zwischengespeichert. Eine offline verfügbare, aber veraltete Bestellliste
 * wäre schlimmer als gar keine.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

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
