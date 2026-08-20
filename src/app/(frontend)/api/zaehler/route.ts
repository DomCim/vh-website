import { NextResponse, type NextRequest } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { zaehladresse } from '../../../../lib/statistik'

export const dynamic = 'force-dynamic'

/**
 * Hier kommen die gezählten Aufrufe an und werden nach innen weitergereicht.
 *
 * Der Browser des Besuchers spricht nur mit dieser Website — die Statistik
 * selbst ist von außen nicht erreichbar. Diese Route ist das Tor dazwischen.
 *
 * **Die Herkunft muss mitgeschickt werden.** Sonst sieht Plausible als
 * Absender immer denselben: diesen Server. Aus tausend Besuchern würde ein
 * einziger, der sehr viel liest, und das Land wäre bei allen dasselbe.
 * Deshalb `X-Forwarded-For` und die Browserkennung von Hand weiterreichen.
 *
 * Aus diesen beiden Angaben und einem täglich wechselnden Salz bildet
 * Plausible seinen Fingerabdruck. Gespeichert wird er nicht — weder die IP
 * noch die Kennung landen in der Datenbank, und über den Tag hinaus lässt
 * sich niemand wiedererkennen. Genau deshalb braucht es kein Banner.
 */

/** Größer als das kann ein Zählereignis nicht sein — alles andere ist Unfug */
const MAX_BYTES = 8 * 1024

/**
 * Die Adresse des Besuchers, wie sie durch Proxy und Traefik hereinkommt.
 *
 * In `X-Forwarded-For` steht eine Kette; der erste Eintrag ist der Besucher,
 * dahinter stehen die Zwischenstationen. Wer den letzten nimmt, misst seinen
 * eigenen Proxy.
 */
function herkunft(req: NextRequest): string | null {
  const kette = req.headers.get('x-forwarded-for')
  if (kette) {
    const erster = kette.split(',')[0]?.trim()
    if (erster) return erster
  }
  return req.headers.get('x-real-ip')
}

export async function POST(req: NextRequest): Promise<Response> {
  const payload = await payloadClient()
  const adresse = await zaehladresse(payload)
  // Ohne eingerichtete Zählung wird stillschweigend nichts getan. Der Zähler
  // im Browser wartet auf keine Antwort und soll keine Fehler melden.
  if (!adresse) return new NextResponse(null, { status: 202 })

  const roh = await req.text()
  if (roh.length > MAX_BYTES) return new NextResponse(null, { status: 413 })

  const kopf: Record<string, string> = {
    'Content-Type': 'text/plain',
  }
  const ip = herkunft(req)
  if (ip) kopf['X-Forwarded-For'] = ip
  const browser = req.headers.get('user-agent')
  if (browser) kopf['User-Agent'] = browser

  try {
    const antwort = await fetch(`${adresse}/api/event`, {
      method: 'POST',
      headers: kopf,
      body: roh,
      cache: 'no-store',
    })
    if (!antwort.ok) {
      payload.logger.warn({ status: antwort.status }, 'Zählung wurde abgewiesen')
    }
  } catch (err) {
    payload.logger.warn({ err }, 'Zählung konnte nicht weitergereicht werden')
  }
  /*
   * Immer 202, auch wenn drinnen etwas schiefging.
   *
   * Ein verlorener Seitenaufruf in der Statistik ist ärgerlich; ein Fehler in
   * der Konsole des Kunden wäre schlimmer und säße auf jeder Seite. Wo es
   * klemmt, steht im Log — dort sucht man es auch.
   */
  return new NextResponse(null, { status: 202 })
}
