/**
 * Eine Änderung schreibt nur, was auch geschickt wurde.
 *
 * Die Büro-Schnittstellen bauen aus dem Körper der Anfrage einen
 * **vollständigen** Datensatz und schreiben ihn. Beim Anlegen ist das richtig:
 * Was fehlt, bekommt seine Voreinstellung. Beim Ändern ist es eine Falle —
 * denn dort heißt „nicht geschickt" nicht „leer", sondern „unverändert".
 *
 * Wer von einer Leiste aus nur `{ id, status: 'bezahlt' }` schickte, traf
 * damit auch `items: []` und löschte sämtliche Rechnungspositionen. Ebenso
 * hätte `{ id, items }` den Status einer gestellten Rechnung auf „Entwurf"
 * zurückgesetzt, weil `b.status || 'entwurf'` die fehlende Angabe durch die
 * Voreinstellung ersetzt.
 *
 * Bisher half dagegen nur, für jeden schmalen Weg eine eigene Aktion
 * anzulegen (siehe `aktion: 'termin'` am Auftrag). Das trägt, solange jemand
 * daran denkt. Hier steht stattdessen die Regel selbst: Beim Ändern bleibt
 * weg, wonach niemand gefragt hat.
 *
 * `undefined` zählt dabei als „nicht geschickt", `null` und `''` dagegen als
 * Angabe — sie sind der Weg, ein Feld absichtlich zu leeren.
 */

/** Stand dieser Schlüssel im Körper der Anfrage? */
export function gesendet(koerper: Record<string, unknown>, schluessel: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(koerper, schluessel) && koerper[schluessel] !== undefined
  )
}

/**
 * Aus dem vollständigen Datensatz das herausziehen, wonach gefragt wurde.
 *
 * `zuordnung` ist für die Felder da, die aus anderen Angaben entstehen: Das
 * Zahldatum einer Rechnung hängt am Status, der Zahlplan eines Auftrags an
 * zwei Prozentzahlen. Genannt wird dort der Schlüssel im Körper — kommt einer
 * davon vor, wird das Feld geschrieben.
 */
export function nurGesendete<T extends Record<string, unknown>>(
  koerper: Record<string, unknown>,
  daten: T,
  zuordnung: Partial<Record<keyof T & string, string | string[]>> = {},
): Partial<T> {
  const ergebnis: Partial<T> = {}
  for (const schluessel of Object.keys(daten) as (keyof T & string)[]) {
    const quellen = zuordnung[schluessel] ?? schluessel
    const liste = Array.isArray(quellen) ? quellen : [quellen]
    if (liste.some((q) => gesendet(koerper, q))) ergebnis[schluessel] = daten[schluessel]
  }
  return ergebnis
}
