/**
 * Zahlen eintippen — und warum das eine eigene Datei braucht.
 *
 * **Der Fehler, der das ausgelöst hat.** Im Büro ließ sich in kein einziges
 * Zahlenfeld ein Komma eintragen. Nicht beim Wert je Einheit, nicht beim
 * Einzelpreis im Angebot, nicht beim Steuersatz auf der Rechnung. Der Grund
 * war überall derselbe: Das Feld hielt eine **Zahl** im Zustand, nicht den
 * getippten Text. Wer „0," tippte, erzeugte damit `Number('0,')` — also `NaN`,
 * abgefangen zu `0` —, und im Feld stand augenblicklich wieder „0". Das Komma
 * war weg, bevor die zweite Ziffer kam.
 *
 * Auch die Stellen, die brav `,` durch `.` ersetzten, halfen nicht: `Number('0.')`
 * ist `0`, und die `0` verdrängte den getippten Punkt genauso.
 *
 * Aufgefallen ist es nie, weil ein Betrag ohne Nachkommastellen richtig
 * aussieht. Vier Wochen lang konnte niemand einen Preis mit Cent eintragen —
 * gemerkt hat es erst jemand, der 0,12 € für eine Schraube brauchte.
 *
 * **Die Lehre für das nächste Feld:** Zwischen Tastatur und Zahl gehört ein
 * Zwischenschritt. Während getippt wird, gilt der Text; die Zahl entsteht
 * daraus, und erst wenn das Feld die Aufmerksamkeit verliert, wird wieder die
 * Zahl angezeigt. Ein Feld, das den Zustand des Tippens nicht kennt, kann kein
 * Komma vertragen.
 */

/** Eine Zahl so, wie sie hier im Haus geschrieben wird: mit Komma. */
export function textAusZahl(wert: number | null | undefined): string {
  if (wert === null || wert === undefined || Number.isNaN(wert)) return ''
  return String(wert).replace('.', ',')
}

/**
 * Aus dem getippten Text eine Zahl.
 *
 * `beiLeer` sagt, was ein leeres Feld bedeutet, und das ist keine Kleinigkeit:
 * Beim Mindestbestand ist der Unterschied zwischen `null` und `0` der zwischen
 * „keine Meldung" und „meld dich, sobald etwas fehlt". Bei einer Menge im
 * Angebot dagegen ist leer schlicht null Stück.
 *
 * Ein deutscher Tausenderpunkt wird geschluckt, wenn ein Komma dabei ist
 * („1.000,50"). Ohne Komma bleibt der Punkt ein Dezimalpunkt — wer „1.5"
 * tippt, meint eineinhalb und nicht fünfzehnhundert.
 */
export function zahlAusText(text: string, beiLeer: number | null = null): number | null {
  const roh = text.replace(/\s/g, '')
  if (roh === '') return beiLeer

  const normal = roh.includes(',') ? roh.replace(/\./g, '').replace(',', '.') : roh
  const zahl = Number(normal)
  return Number.isFinite(zahl) ? zahl : beiLeer
}
