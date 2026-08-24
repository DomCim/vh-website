import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

/**
 * Drei Meldungen aus dem Büro — und die Wachen dagegen.
 *
 * Gemeldet am 24.08.2026 vom iPhone aus der installierten App:
 *
 *  - **#38** Nach dem Zurückkehren aus dem Hintergrund fehlte die
 *    Navigationsleiste.
 *  - **#39** Die Rechtstexte hatten als einziger Punkt kein Zeichen.
 *  - **#41** Ein Auftrag lief in Fertigung, im Kalender stand nichts.
 *  - **#42** Der Senden-Knopf war bei offener Tastatur nicht erreichbar, das
 *    Schreibfenster blieb am Handy schmal, und das Anhängen eines Fotos
 *    klappte „mal, mal nicht".
 *
 * Alle drei sind vom selben Schlag: Etwas verschwindet, ohne es zu sagen.
 * Deshalb prüft das hier nicht die Reparatur, sondern die Bedingung, unter
 * der es wieder verschwinden könnte.
 */

const lies = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')

test('#39: jeder Punkt der Navigation hat ein Zeichen', () => {
  /*
   * Der eigentliche Fehler war nicht das fehlende Zeichen, sondern dass es
   * niemandem auffiel: Ein Punkt ohne Eintrag in der Karte rendert stumm
   * nichts. Ein neuer Bereich kommt so wieder ohne Zeichen heraus.
   */
  const nav = lies('src/components/office/BueroNavigation.tsx')
  const ziele = [...nav.matchAll(/\{ href: '([^']+)'/g)].map((m) => m[1])
  const karte = nav.slice(nav.indexOf('const PUNKT_ZEICHEN'), nav.indexOf('function PunktZeichen'))
  const zeichen = new Set([...karte.matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1]))

  // Die Übersicht trägt das Zeichen ihres Bereichs und steht nicht in der Karte
  const fehlend = [...new Set(ziele)].filter((z) => z !== '/office' && !zeichen.has(z))
  expect(fehlend, `Diese Punkte haben kein Zeichen: ${fehlend.join(', ')}`).toEqual([])
})

test('#38: die Leiste verschwindet nur, wenn wirklich jemand tippt', () => {
  /*
   * Die Leiste hängt an der Klasse `tastatur-offen`, und die wurde allein aus
   * einem Höhenunterschied geschlossen. Beim Aufwachen meldet iOS für einen
   * Moment die alte, kleine Höhe — das sah aus wie eine Tastatur, und weil
   * danach nichts mehr feuerte, blieb die Leiste weg.
   *
   * Zwei Bedingungen müssen deshalb erhalten bleiben: Es muss ein Feld im
   * Fokus stehen, und beim Zurückkommen muss neu gemessen werden.
   */
  const wache = lies('src/components/office/Tastaturwache.tsx')
  // Die Bedingung, die geschlossen wird, muss beides enthalten — Lücke UND Feld
  expect(wache).toMatch(/const offen = [^\n]*tipptGerade\(\)/)
  expect(wache).toContain("classList.toggle('tastatur-offen', offen)")
  // Ohne diese beiden bliebe ein falsch gemessener Stand für immer stehen
  expect(wache).toContain("addEventListener('visibilitychange'")
  expect(wache).toContain("addEventListener('pageshow'")
  // Im Hintergrund gemessene Höhen sagen nichts
  expect(wache).toContain('document.hidden')
})

test('#41: Aufträge ohne Termin fallen im Kalender nicht unter den Tisch', () => {
  /*
   * Der Kalender filtert auf `dueDate`. Ein Auftrag aus einer Shop-Bestellung
   * bekommt keinen — den setzt die Werkstatt. Er lief also und stand
   * nirgends. Erfunden wird kein Datum (es wandert als Zusage an die
   * Kundschaft); stattdessen stehen die Terminlosen unter dem Blatt.
   */
  const kalender = lies('src/app/(office)/office/kalender/Ansicht.tsx')
  expect(kalender).toContain('ohneTermin')
  expect(kalender).toContain('Ohne Termin')
  // Laufend heißt: dieselben Zustände wie im Blatt, nur ohne Datum
  expect(kalender).toMatch(/ohneTermin[\s\S]{0,400}!a\.dueDate/)
})

test('#41: ein Auftrag aus einer Bestellung bekommt weiterhin keinen erfundenen Termin', () => {
  /*
   * Die Gegenprobe zur Reparatur. Ein Termin am Auftrag wandert beim Wechsel
   * in die Fertigung als `expectedReady` in die Bestellung und damit in die
   * Mail an die Kundschaft (siehe `Jobs.ts`). Wer hier beim Anlegen ein Datum
   * schätzt, gibt eine Zusage ab, die niemand gegeben hat.
   */
  const hooks = lies('src/lib/orderHooks.ts')
  const anlegen = hooks.slice(hooks.indexOf("collection: 'jobs',"))
  const bisEnde = anlegen.slice(0, anlegen.indexOf('payload.logger.info'))
  expect(bisEnde).not.toContain('dueDate')
})

test('#42: die Hauptaktion bleibt bei offener Tastatur erreichbar', () => {
  /*
   * Vorher fiel die Fußleiste bei offener Tastatur aus dem Kleben zurück in
   * den Fluss. Das war als Ausweichen gedacht und hieß in Wahrheit: Der
   * einzige Knopf, der zählt, lag irgendwo weiter unten in der Seite.
   */
  const css = lies('src/styles/office.css')
  expect(css).not.toMatch(/html\.tastatur-offen \.buero-fussleiste \{[^}]*position:\s*static/)
  expect(css).toMatch(/html\.tastatur-offen \.buero-fussleiste \{[^}]*--tastatur-hoehe/)
  // Die Höhe misst die Wache — ohne sie stünde in der Rechnung nichts
  expect(lies('src/components/office/Tastaturwache.tsx')).toContain("'--tastatur-hoehe'")
})

test('#42: das Schreibfenster nimmt am Handy dieselbe Breite wie die Mail', () => {
  const css = lies('src/styles/office.css')
  // Beide teilen sich eine Regel — sonst laufen sie beim nächsten Umbau auseinander
  expect(css).toMatch(/\.buero-mail-offen,\s*\n\s*\.buero-mail-schreiben \{/)
  expect(lies('src/components/office/Postfach.tsx')).toContain('buero-mail-schreiben')
})

test('#40/#42: kein Dateifeld wird mehr aus dem Skript heraus angeklickt', () => {
  /*
   * Der Kern des Sprunghaften: `hidden` heißt `display: none`, und ein Feld,
   * das nicht gezeichnet wird, ist für WebKit kein Ziel einer Berührung. Der
   * Aufruf aus dem Skript zählt dort nur, solange er unmittelbar in der Geste
   * steckt — kommt ein Neuzeichnen dazwischen, verwirft iOS ihn stumm.
   *
   * Geprüft wird deshalb die Abwesenheit des Musters, nicht die Anwesenheit
   * des Ersatzes: Ein neues Formular soll gar nicht erst so gebaut werden.
   */
  const dateien = [
    'src/components/office/FehlermeldungFormular.tsx',
    'src/components/office/Vorgangsdateien.tsx',
    'src/components/shop/Uebergabemappe.tsx',
    'src/components/shop/Vorgangsunterlagen.tsx',
    'src/app/(office)/office/uebergabe/[id]/Ansicht.tsx',
  ]
  for (const d of dateien) {
    const quelle = lies(d)
    expect(quelle, `${d} klickt ein Dateifeld aus dem Skript an`).not.toMatch(
      /\.current\?\.click\(\)/,
    )
    expect(quelle, `${d} versteckt ein Dateifeld mit hidden`).not.toMatch(
      /type="file"[\s\S]{0,120}\bhidden\b/,
    )
  }
})
