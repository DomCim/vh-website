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
/*
 * Entwicklung nur, wenn es ausdrücklich dasteht.
 *
 * Andersherum wäre es gefährlich: `next start` hat den Produktionsmodus selbst
 * gesetzt, ein blankes `node server.mjs` tut das nicht. Mit der umgekehrten
 * Annahme lief in der Pipeline ein Entwicklungsserver gegen einen fertigen
 * Build — langsam, mit Übersetzung bei jeder Anfrage, und die ersten Aufrufe
 * liefen in die Zeitüberschreitung. Auf einem Server ohne gesetzte Variable
 * wäre dasselbe passiert, nur hätte es dort niemand gemerkt.
 */
const entwicklung = process.env.NODE_ENV === 'development'
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
  /*
   * Das `.catch` ist nicht Zierde: `bedienen` liefert ein Versprechen, und
   * Node beendet sich bei einer unbehandelten Ablehnung. Nexts eigener Server
   * fängt das ab — dieser hier muss es selbst tun, sonst reißt eine einzige
   * missratene Anfrage den ganzen Betrieb mit.
   */
  bedienen(anfrage, antwort).catch((err) => {
    console.error('Anfrage fehlgeschlagen:', err)
    if (!antwort.headersSent) antwort.writeHead(500)
    antwort.end()
  })
})

const wss = new WebSocketServer({ noServer: true })

// Ein Fehler ohne Zuhörer beendet in Node den Prozess — auch hier
wss.on('error', (err) => console.error('WebSocket-Server:', err.message))

/**
 * Nimmt eine neue Verbindung an — nachdem die Eintrittskarte gestimmt hat.
 */
function verbindungAnnehmen(anfrage, socket, kopf, benutzerId) {
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
}

/**
 * Warum das Ereignis abgefangen und nicht einfach behorcht wird:
 *
 * Next hängt sich in der Entwicklung selbst an `upgrade`, um seinen
 * Nachlade-Kanal zu bedienen — und wirft dabei jede Verbindung weg, die es
 * nicht kennt. Ein zweiter Zuhörer daneben hilft nicht: Node ruft beide auf,
 * unsere Verbindung stand also, war eine Wimper später aber wieder zu
 * (Schließcode 1006), ohne dass eine Seite einen Fehler gesehen hätte.
 *
 * Deshalb wird das Ereignis für genau unseren Pfad abgefangen, bevor es
 * überhaupt verteilt wird. Alles andere geht unverändert an Next.
 */
const verteilen = server.emit.bind(server)
server.emit = (name, ...rest) => {
  if (name !== 'upgrade') return verteilen(name, ...rest)

  const [anfrage, socket, kopf] = rest
  let adresse
  try {
    adresse = new URL(anfrage.url, `http://${anfrage.headers.host}`)
  } catch {
    return verteilen(name, ...rest)
  }
  if (adresse.pathname !== PFAD) return verteilen(name, ...rest)

  const benutzerId = kartePruefen(adresse.searchParams.get('karte'))
  if (!benutzerId) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return true
  }

  /*
   * Zuhörer vor dem Handschlag: Fällt die Leitung mitten im Aufbau aus — ein
   * Handy, das in den Fahrstuhl fährt —, meldet der rohe Socket einen Fehler.
   * Ohne Zuhörer wäre das das Ende des Prozesses.
   */
  socket.on('error', () => socket.destroy())

  verbindungAnnehmen(anfrage, socket, kopf, benutzerId)
  return true
}

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

/*
 * Letzte Rettungsleine.
 *
 * Ein Webserver darf nicht sterben, weil eine Anfrage oder ein Socket sich
 * danebenbenimmt. Ohne diese beiden Zeilen beendet Node den Prozess bei jedem
 * unbehandelten Fehler — und dann ist nicht eine Seite kaputt, sondern alles,
 * bis jemand den Container neu startet.
 */
process.on('uncaughtException', (err) => {
  console.error('Unbehandelter Fehler:', err)
})
process.on('unhandledRejection', (grund) => {
  console.error('Unbehandelte Ablehnung:', grund)
})

server.listen(port, () => {
  console.log(
    `Bereit auf http://localhost:${port} — Live-Verbindung unter ${PFAD}${
      entwicklung ? ' (Entwicklung)' : ''
    }`,
  )
})
