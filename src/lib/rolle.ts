/**
 * Welche Rolle dieser Container spielt.
 *
 * Website und Büro laufen aus demselben Abbild, aber in getrennten
 * Containern. Der Grund ist nüchtern: Bisher teilten sie sich einen Prozess,
 * und ein Fehler im Büro riss den Shop mit. Getrennt kann das Büro abstürzen,
 * neu starten oder ausgerollt werden, ohne dass ein Kunde etwas merkt.
 *
 * Was sich dadurch **nicht** ändert: dieselbe Adresse, dieselbe Anmeldung,
 * dieselben Passkeys, dieselbe Datenbank, derselbe Code. Wer wohin geleitet
 * wird, entscheidet Traefik — die Anwendung selbst kann in jeder Rolle alles
 * beantworten. Die Rolle steuert nur, wer die Arbeiten übernimmt, die es
 * genau einmal geben darf.
 */

export type Rolle = 'alles' | 'web' | 'buero' | 'takt'

export function rolle(): Rolle {
  const wert = (process.env.ROLLE ?? '').trim().toLowerCase()
  if (wert === 'web' || wert === 'buero' || wert === 'takt') return wert
  // Ohne Angabe macht ein Prozess alles — so laufen Entwicklung und Prüfung
  return 'alles'
}

/**
 * Wer hält die Live-Verbindungen und hört auf Meldungen aus der Datenbank?
 *
 * Der Web-Container meldet Änderungen zwar (eine bezahlte Bestellung entsteht
 * schließlich dort), aber offene Drähte hält nur das Büro.
 */
export const hoertZu = (): boolean => rolle() === 'buero' || rolle() === 'alles'

/**
 * Wer bringt die Datenbank beim Start auf Stand?
 *
 * Migrationen, Startdaten und die Neuerungen — einmalige Arbeit beim
 * Hochfahren, nicht wiederkehrend. Sie bleibt beim Web-Container, und zwar
 * mit Absicht: Wer Verkehr bedient, soll nicht gegen eine Datenbank
 * antworten, die ein anderer gerade umbaut.
 */
export const machtStart = (): boolean => rolle() === 'web' || rolle() === 'alles'

/**
 * Wer erledigt, was **wiederkehrend** genau einmal laufen darf?
 *
 * Nächtliche Sicherung, Erinnerungen, Postfach-Blick. Liefe das in zwei
 * Containern, gäbe es jede Sicherung doppelt und jede Erinnerung zweimal aufs
 * Handy.
 *
 * **Warum das nicht mehr der Web-Container tut.** Der Postfach-Blick holt
 * Mails und wertet Rechnungs-PDFs aus — rechenintensive Arbeit, und Node ist
 * einprozessig. Blockierte sie die Schleife, antwortete der Prozess gar nicht
 * mehr: nicht langsam, sondern gar nicht. Am 11.09.2026 nachgemessen —
 * zwölf Aussetzer in acht Stunden, während das FWG-Portal auf demselben Wirt
 * und mit demselben Wächter durchgehend erreichbar blieb. Die Arbeit, die
 * blockiert, saß im Prozess, der antworten muss.
 *
 * **`ZEITPLAN=aus` ist die Brücke.** Ohne sie täte der Web-Container es
 * weiter — sonst stünde der Takt genau so lange still, wie zwischen dem neuen
 * Abbild und dem neuen Stapel liegt. Ein Takt, der still steht, fällt nicht
 * auf: keine Sicherung, keine Erinnerung, keine Meldung über neue Post.
 */
export const machtZeitplan = (): boolean => {
  if ((process.env.ZEITPLAN ?? '').trim().toLowerCase() === 'aus') return false
  return rolle() === 'takt' || rolle() === 'web' || rolle() === 'alles'
}
