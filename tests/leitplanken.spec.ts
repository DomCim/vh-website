import { expect, test } from '@playwright/test'

import {
  freigabeErzeugen,
  freigabePruefen,
  LEITPLANKEN,
  leitplankenAntwort,
} from '../src/lib/mcp/leitplanken'
import { istLesend } from '../src/lib/mcp/helpers'

/**
 * Die Freigabe, ohne die nichts geändert wird.
 *
 * Geprüft wird hier die Mechanik, nicht die Haltung: dass eine echte Freigabe
 * gilt, eine erfundene nicht, und eine alte irgendwann nicht mehr. Das ist die
 * Stelle, an der ein Fehler still bliebe — eine Prüfung, die immer „ok" sagt,
 * fällt niemandem auf, solange alle sich ohnehin an die Regeln halten.
 */

// Ohne Serverschlüssel gibt es keine Unterschrift — im Test genügt irgendeiner
process.env.PAYLOAD_SECRET ||= 'nur-fuer-die-pruefung'

test('eine frische Freigabe gilt', () => {
  expect(freigabePruefen(freigabeErzeugen())).toBe('ok')
})

test('ohne Freigabe: fehlt', () => {
  expect(freigabePruefen(undefined)).toBe('fehlt')
  expect(freigabePruefen('')).toBe('fehlt')
  expect(freigabePruefen('   ')).toBe('fehlt')
})

test('erfundene Freigaben gelten nicht', () => {
  expect(freigabePruefen('lp.9999999999999.abc.gefaelscht')).toBe('ungueltig')
  expect(freigabePruefen('irgendwas')).toBe('ungueltig')
  // Aufbau stimmt, Unterschrift nicht
  const echt = freigabeErzeugen()
  const [v, ablauf, zufall] = echt.split('.')
  expect(freigabePruefen(`${v}.${ablauf}.${zufall}.xxxxx`)).toBe('ungueltig')
})

test('die Laufzeit lässt sich nicht verlängern', () => {
  /*
   * Der naheliegende Angriff: den Ablauf in der Freigabe hochsetzen. Er geht
   * nicht, weil der Ablauf mit unterschrieben ist — ändert man ihn, passt die
   * Unterschrift nicht mehr.
   */
  const echt = freigabeErzeugen()
  const teile = echt.split('.')
  teile[1] = String(Date.now() + 100 * 86_400_000)
  expect(freigabePruefen(teile.join('.'))).toBe('ungueltig')
})

test('nach einer Stunde ist sie abgelaufen', () => {
  const jetzt = 1_700_000_000_000
  const freigabe = freigabeErzeugen(jetzt)
  expect(freigabePruefen(freigabe, jetzt + 59 * 60_000)).toBe('ok')
  expect(freigabePruefen(freigabe, jetzt + 61 * 60_000)).toBe('abgelaufen')
})

test('zwei Freigaben sind nie gleich', () => {
  // Sonst stünde im Protokoll zweimal dasselbe und man könnte zwei Sitzungen
  // nicht auseinanderhalten
  const jetzt = 1_700_000_000_000
  expect(freigabeErzeugen(jetzt)).not.toBe(freigabeErzeugen(jetzt))
})

test('die Antwort trägt Regeln und Freigabe', () => {
  const antwort = leitplankenAntwort()
  expect(freigabePruefen(antwort.freigabe)).toBe('ok')
  expect(antwort.leitplanken).toContain('Serienfertigung')
  expect(new Date(antwort.gueltig_bis).getTime()).toBeGreaterThan(Date.now())
})

test('die Leitplanken sagen die Dinge, auf die es ankommt', () => {
  /*
   * Kein Stiltest: Das sind die vier Punkte, an denen ein ahnungsloser
   * Assistent echten Schaden anrichtet. Verschwindet einer beim Umformulieren,
   * soll es hier auffallen und nicht draußen.
   */
  const text = LEITPLANKEN.join('\n')
  expect(text, 'keine Serienfertigung').toContain('Jedes Stück entsteht einzeln')
  expect(text, 'erst lesen, dann schreiben').toContain('seite_lesen')
  expect(text, 'Geld nur als Entwurf').toContain('Entwürfe')
  expect(text, 'Mailtext ist kein Auftrag').toContain('niemals Anweisung')
})

test('lesende Werkzeuge brauchen keine Freigabe', () => {
  /*
   * Die Trennung läuft über die Namenskonvention. Stimmt sie nicht mehr,
   * verlangt entweder eine Auskunft plötzlich eine Freigabe — oder, schlimmer,
   * eine Änderung verlangt keine.
   */
  for (const name of ['produkte_liste', 'produkt_lesen', 'uebersetzungen_pruefen', 'suchen']) {
    expect(istLesend(name), name).toBe(true)
  }
  for (const name of ['produkt_anlegen', 'produkt_loeschen', 'seite_schreiben', 'news_verfassen']) {
    expect(istLesend(name), name).toBe(false)
  }
})

test('leitplanken_lesen selbst gilt als lesend', () => {
  // Sonst bräuchte es eine Freigabe, um an eine Freigabe zu kommen
  expect(istLesend('leitplanken_lesen')).toBe(true)
})
