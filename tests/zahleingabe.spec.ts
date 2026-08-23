import { expect, test } from '@playwright/test'

import { textAusZahl, zahlAusText } from '../src/lib/zahleingabe'

/**
 * Der Fehler, der das ausgelöst hat: Im Büro ließ sich in kein Zahlenfeld ein
 * Komma eintragen — nicht beim Wert je Einheit, nicht beim Einzelpreis, nicht
 * beim Steuersatz. Gemerkt hat es erst jemand, der 0,12 € für eine Schraube
 * brauchte, denn ein Betrag ohne Nachkommastellen sieht richtig aus.
 *
 * Die Prüfungen hier bilden deshalb das **Tippen** nach, Anschlag für
 * Anschlag, und nicht nur das fertige Ergebnis. Genau dazwischen lag der
 * Fehler: „0," war ein Zwischenstand, den das Feld nicht kannte.
 */

test('ein Komma überlebt den Anschlag danach', () => {
  // So tippt jemand 0,12 — nach jedem Zeichen muss es weitergehen können.
  expect(zahlAusText('0', 0)).toBe(0)
  expect(zahlAusText('0,', 0)).toBe(0)
  expect(zahlAusText('0,1', 0)).toBe(0.1)
  expect(zahlAusText('0,12', 0)).toBe(0.12)
})

test('ein Punkt tut es auch', () => {
  // Am Rechner tippt man eher den Punkt; beides muss gehen.
  expect(zahlAusText('0.12', 0)).toBe(0.12)
  expect(zahlAusText('1.5', 0)).toBe(1.5)
})

test('der deutsche Tausenderpunkt wird geschluckt, wenn ein Komma dabei ist', () => {
  expect(zahlAusText('1.000,50', 0)).toBe(1000.5)
  // Ohne Komma bleibt der Punkt ein Dezimalpunkt: Wer „1.5" tippt, meint
  // eineinhalb und nicht fünfzehnhundert.
  expect(zahlAusText('1.5', 0)).toBe(1.5)
})

/**
 * Beim Mindestbestand ist der Unterschied zwischen „nicht gesetzt" und „null"
 * der zwischen „keine Meldung" und „meld dich, sobald etwas fehlt". Bei einer
 * Menge im Angebot dagegen ist leer schlicht null Stück.
 */
test('was ein leeres Feld bedeutet, entscheidet das Feld', () => {
  expect(zahlAusText('', null)).toBeNull()
  expect(zahlAusText('', 0)).toBe(0)
  expect(zahlAusText('   ', null)).toBeNull()
})

test('Unsinn wirft nicht, sondern fällt auf den Leerwert zurück', () => {
  expect(zahlAusText('abc', null)).toBeNull()
  expect(zahlAusText('1,2,3', 0)).toBe(0)

  // Ein einzelnes Minus ist ein Zwischenstand beim Tippen von -5 …
  expect(zahlAusText('-', 0)).toBe(0)
  // … und danach muss die negative Zahl herauskommen: Abgänge sind negativ.
  expect(zahlAusText('-5', 0)).toBe(-5)
  expect(zahlAusText('-0,5', 0)).toBe(-0.5)
})

test('angezeigt wird mit Komma, so wie hier geschrieben wird', () => {
  expect(textAusZahl(0.12)).toBe('0,12')
  expect(textAusZahl(1000.5)).toBe('1000,5')
  expect(textAusZahl(7)).toBe('7')
  expect(textAusZahl(0)).toBe('0')
})

test('nicht gesetzt bleibt leer und wird nicht zu null', () => {
  // Stünde hier „0", sähe ein ungepflegter Mindestbestand aus wie ein
  // gepflegter — und das Büro meldete sich für jeden Posten.
  expect(textAusZahl(null)).toBe('')
  expect(textAusZahl(undefined)).toBe('')
  expect(textAusZahl(NaN)).toBe('')
})

/** Was hineingeht, kommt heraus — für die Werte, um die es wirklich geht. */
test('Anzeigen und Einlesen passen zusammen', () => {
  for (const wert of [0, 0.12, 1.5, 19, 20.5, 1000.5, -2, 949]) {
    expect(zahlAusText(textAusZahl(wert), null), `${wert}`).toBe(wert)
  }
})
