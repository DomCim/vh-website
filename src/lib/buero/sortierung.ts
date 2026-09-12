/**
 * Listen im Büro sortieren — neueste zuerst, und bei Gleichstand entschieden.
 *
 * **Woher das kommt.** Die Rechnungsliste sortierte nach `issueDate`. Das ist
 * ein reines Datum ohne Uhrzeit, also sind alle Rechnungen eines Tages
 * gleich — und bei Gleichstand behält `Array.sort` die Reihenfolge, in der
 * die Sätze gerade im Gerät liegen. Die kommt vom Abgleich und ist damit
 * Zufall. Auf dem Bildschirm stand am 11.09.2026: 0008, 0009, 0010, dann
 * 0007, 0006, 0005. Innerhalb eines Tages einmal aufsteigend, einmal
 * absteigend, ohne dass sich etwas geändert hätte.
 *
 * **Die Regel dahinter.** Ein Feld, das nur den Tag kennt, kann innerhalb
 * eines Tages nichts ordnen. Es braucht einen zweiten Schlüssel — die
 * Nummer, den Anlegezeitpunkt, irgendetwas Eindeutiges. Aufträge, Angebote,
 * Bestellungen und Anfragen sind nicht betroffen: Die sortieren nach
 * `createdAt` und tragen damit eine Uhrzeit, die den Gleichstand von selbst
 * auflöst.
 *
 * **Bei Rechnungen entscheidet die Nummer, nicht das Datum** (Vorschlag von
 * Dominik, und der bessere). Sie wird beim Festschreiben vergeben und zählt
 * lückenlos hoch — sie *ist* die Reihenfolge, in der gestellt wurde. Das
 * Rechnungsdatum lässt sich dagegen von Hand setzen; sortierte man danach,
 * verschöbe eine nachträgliche Korrektur die Liste. Bei Belegen geht das
 * nicht: Deren Nummer stammt vom Lieferanten und zählt gar nichts hoch.
 */

/**
 * Absteigend nach mehreren Schlüsseln: Der erste entscheidet, der zweite nur
 * bei Gleichstand, und so fort.
 *
 * Verglichen wird als Text mit `numeric: true` — damit steht „RE-2026-0010"
 * über „RE-2026-0009" und nicht darunter, wie es ein reiner Textvergleich
 * täte.
 */
export function neuesteZuerst<T>(...schluessel: ((x: T) => string)[]) {
  return (a: T, b: T): number => {
    for (const wert of schluessel) {
      const vergleich = wert(b).localeCompare(wert(a), 'de', { numeric: true })
      if (vergleich !== 0) return vergleich
    }
    return 0
  }
}

/**
 * Ein Schlüssel, der Unfertiges nach oben holt.
 *
 * Absteigend sortiert steht `'1'` über `'0'`. Gedacht für Entwürfe: Das eine
 * Blatt, das noch Arbeit ist, gehört über die, die schon gestellt sind — und
 * es hat ohnehin keine Nummer, nach der man es einsortieren könnte.
 */
export const zuerstWenn = (bedingung: boolean) => (bedingung ? '1' : '0')
