import { createServer } from 'http'
import { createHmac, timingSafeEqual } from 'crypto'

import next from 'next'
import { WebSocketServer } from 'ws'

/**
 * Eigener Server für Next — nötig wegen der Live-Verbindung.
 *
 * Next kann keine WebSockets: Route-Handler beantworten eine Anfrage und sind
 * fertig, sie halten keine Leitung offen. Deshalb liegt hier ein schlichter
 * Node-Server darum, der beides bedient — alle gewohnten Seiten über Next und
 * daneben `/ws/buero` für die offenen Verbindungen. Ein Prozess, ein Port,
 * ein Container; am Betrieb ändert sich damit nichts.
 *
 * Die Sammelstelle für Änderungen entsteht hier und liegt auf `globalThis`,
 * bevor Next startet — die Anwendung meldet ihre Änderungen dorthin (siehe
 * src/lib/live.ts).
 */

const port = Number(process.env.PORT || 3000)
const entwicklung = process.env.NODE_ENV !== 'production'
const PFAD = '/ws/buero'

// ── Sammelstelle ────────────────────────────────────────────────────────────

/** Alle offenen Verbindungen. Bei einem Handwerksbetrieb sind das eine Handvoll. */
const verbindungen = new Set()

globalThis.__vhLive = {
  melde(ereignis) {
    const text = JSON.stringify(ereignis)
    for (const draht of verbindungen) {
      // readyState 1 = offen
      if (draht.readyState === 1) {
        try {
          draht.send(text)
        } catch {
          // Eine tote Verbindung hält die anderen nicht auf
        }
      }
    }
  },
}

// ── Eintrittskarte prüfen ───────────────────────────────────────────────────

/**
 * Dieselbe Prüfung wie in src/lib/live.ts, hier noch einmal in schlichtem JS:
 * Dieser Server läuft, bevor Next übersetzt ist, und kann nichts aus src
 * importieren.
 */
function kartePruefen(karte) {
  if (!karte) return null
  const geheim = process.env.PAYLOAD_SECRET
  if (!geheim) return null

  const [teil, signatur] = String(karte).split('.')
  if (!teil || !signatur) return null

  let nutzlast
  try {
    nutzlast = Buffer.from(teil, 'base64url').toString()
  } catch {
    return null
  }

  const erwartet = createHmac('sha256', geheim).update(nutzlast).digest('hex')
  if (erwartet.length !== signatur.length) return null
  if (!timingSafeEqual(Buffer.from(erwartet), Buffer.from(signatur))) return null

  const [benutzerId, ablauf] = nutzlast.split('|')
  if (!benutzerId || Number(ablauf) < Date.now()) return null
  return benutzerId
}

// ── Server ──────────────────────────────────────────────────────────────────

const app = next({ dev: entwicklung })
const bedienen = app.getRequestHandler()

await app.prepare()

const server = createServer((anfrage, antwort) => {
  bedienen(anfrage, antwort)
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (anfrage, socket, kopf) => {
  let adresse
  try {
    adresse = new URL(anfrage.url, `http://${anfrage.headers.host}`)
  } catch {
    socket.destroy()
    return
  }

  // Alles andere (z.B. Nexts eigener Entwicklungs-Kanal) geht Next an
  if (adresse.pathname !== PFAD) return

  const benutzerId = kartePruefen(adresse.searchParams.get('karte'))
  if (!benutzerId) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(anfrage, socket, kopf, (draht) => {
    draht.benutzerId = benutzerId
    draht.lebt = true
    verbindungen.add(draht)

    draht.on('pong', () => {
      draht.lebt = true
    })
    draht.on('close', () => verbindungen.delete(draht))
    draht.on('error', () => verbindungen.delete(draht))

    draht.send(JSON.stringify({ bereich: 'verbunden', zeit: Date.now() }))
  })
})

/**
 * Herzschlag alle 30 Sekunden: Ein Handy, das in der Tasche verschwindet,
 * meldet sich nicht ab — ohne diese Prüfung sammelten sich tote Verbindungen.
 */
const herzschlag = setInterval(() => {
  for (const draht of verbindungen) {
    if (!draht.lebt) {
      draht.terminate()
      verbindungen.delete(draht)
      continue
    }
    draht.lebt = false
    try {
      draht.ping()
    } catch {
      verbindungen.delete(draht)
    }
  }
}, 30_000)
herzschlag.unref?.()

server.listen(port, () => {
  console.log(
    `Bereit auf http://localhost:${port} — Live-Verbindung unter ${PFAD}${
      entwicklung ? ' (Entwicklung)' : ''
    }`,
  )
})
