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

export type Rolle = 'alles' | 'web' | 'buero'

export function rolle(): Rolle {
  const wert = (process.env.ROLLE ?? '').trim().toLowerCase()
  if (wert === 'web' || wert === 'buero') return wert
  // Ohne Angabe macht ein Prozess alles — so laufen Entwicklung und Prüfung
  return 'alles'
}

/**
 * Wer hält die Live-Verbindungen und hört auf Meldungen aus der Datenbank?
 *
 * Der Web-Container meldet Änderungen zwar (eine bezahlte Bestellung entsteht
 * schließlich dort), aber offene Drähte hält nur das Büro.
 */
export const hoertZu = (): boolean => rolle() !== 'web'

/**
 * Wer erledigt, was es genau einmal geben darf?
 *
 * Datenbank-Migrationen, nächtliche Sicherung, Erinnerungen, Postfach-Blick.
 * Liefe das in beiden Containern, gäbe es jede Sicherung doppelt und jede
 * Erinnerung zweimal aufs Handy.
 */
export const machtTakt = (): boolean => rolle() !== 'buero'
