import { expect, test } from '@playwright/test'

import { fehler, istLesend, mitLeitplanken, nurLesenderServer, ok, type McpServer } from '../src/lib/mcp/helpers'
import { urlPruefen } from '../src/lib/mcp/medien'
import { registerSeiten } from '../src/lib/mcp/seiten'

/**
 * Die Härtung des MCP-Servers — geprüft an der Mechanik, ohne laufenden Server.
 *
 * Drei Dinge, die still kaputtgehen könnten: die Sperre der Firmenstammdaten
 * in seite_schreiben, die Adressprüfung von bild_hochladen und das zentrale
 * Fangen von Ausnahmen im Proxy. Alle drei greifen, bevor eine Datenbank im
 * Spiel ist — deshalb reichen hier nachgebaute Server-Attrappen.
 */

process.env.PAYLOAD_SECRET ||= 'nur-fuer-die-pruefung'

type Handler = (eingabe: Record<string, unknown>, rest?: unknown) => Promise<unknown> | unknown

/** Eine Attrappe des MCP-Servers: merkt sich nur, was registriert wurde. */
function attrappe() {
  const werkzeuge = new Map<string, Handler>()
  const server = {
    registerTool: (name: string, _beschreibung: unknown, handler: Handler) => {
      werkzeuge.set(name, handler)
    },
  } as unknown as McpServer
  return { server, werkzeuge }
}

const text = (antwort: unknown) =>
  (antwort as { content: { text: string }[] }).content[0]?.text ?? ''

test('seite_schreiben lässt Bankverbindung und Stundensatz nicht anfassen', async () => {
  const { server, werkzeuge } = attrappe()
  registerSeiten(server)
  const schreiben = werkzeuge.get('seite_schreiben')!

  const antwort = await schreiben({
    seite: 'einstellungen',
    sprache: 'de',
    felder: { company: { paymentTerms: { iban: 'FR00 ANGREIFER' } } },
  })
  const t = text(antwort)
  expect(t).toContain('fehler')
  expect(t).toContain('nur im Büro')
  // Es darf gar nicht erst bis zur Datenbank kommen — sonst wäre der Test
  // ohne laufenden Server nicht bis hierher gekommen.
})

test('bild_hochladen erreicht keine internen Adressen', async () => {
  // Interne Dienstnamen und private Bereiche — alles, was der Container sieht
  for (const url of [
    'http://db:5432/x',
    'http://plausible:8000/api',
    'http://localhost/geheim',
    'http://127.0.0.1:3000/api',
    'http://10.0.0.1/x',
    'http://192.168.1.1/x',
    'http://172.16.0.1/x',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/x',
    'ftp://beispiel.de/datei',
    'file:///etc/passwd',
  ]) {
    expect(await urlPruefen(url), url).not.toBeNull()
  }
  // Eine öffentliche IP-Adresse geht durch (ohne DNS, damit der Test offline läuft)
  expect(await urlPruefen('https://93.184.216.34/foto.jpg')).toBeNull()
})

test('eine Ausnahme im Werkzeug wird zur Antwort statt zum Absturz', async () => {
  const { server, werkzeuge } = attrappe()
  const geschuetzt = mitLeitplanken(server)

  geschuetzt.registerTool(
    'kaputt_liste',
    { description: 'wirft absichtlich', inputSchema: {} },
    (async () => {
      throw new Error('Datenbank weg')
    }) as never,
  )

  const antwort = await werkzeuge.get('kaputt_liste')!({})
  const t = text(antwort)
  expect(t).toContain('fehler')
  expect(t).toContain('Datenbank weg')
})

test('ohne Freigabe wird nichts geändert — und der Nur-Lese-Server kennt Schreibendes gar nicht', async () => {
  const { server, werkzeuge } = attrappe()
  const geschuetzt = mitLeitplanken(server)

  let gelaufen = false
  geschuetzt.registerTool(
    'etwas_aendern',
    { description: 'schreibt', inputSchema: {} },
    (async () => {
      gelaufen = true
      return ok({ ok: true })
    }) as never,
  )

  const antwort = await werkzeuge.get('etwas_aendern')!({})
  expect(text(antwort)).toContain('leitplanken_lesen')
  expect(gelaufen).toBe(false)

  const nurLesen = attrappe()
  nurLesenderServer(nurLesen.server).registerTool(
    'etwas_aendern',
    { description: 'schreibt' },
    (async () => ok({})) as never,
  )
  expect(nurLesen.werkzeuge.has('etwas_aendern')).toBe(false)
})

test('die neuen Büro-Werkzeuge fallen auf die richtige Seite der Konvention', () => {
  // Lesend — müssen beim Nur-Lese-Schlüssel sichtbar bleiben
  expect(istLesend('wiedervorlagen_liste')).toBe(true)
  // Schreibend — brauchen die Freigabe
  for (const name of [
    'wiedervorlage_anlegen',
    'partner_aendern',
    'angebot_entwurf_anlegen',
    'rechnung_entwurf_anlegen',
  ]) {
    expect(istLesend(name), name).toBe(false)
  }
})

test('fehler() hält die Antwortform ein', () => {
  expect(text(fehler('kaputt'))).toContain('"fehler"')
})
