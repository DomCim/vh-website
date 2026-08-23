/**
 * Neuerungen — was sich getan hat, für den Betrieb geschrieben.
 *
 * Hier stehen nur der Zuschnitt und ein paar reine Rechnungen. Die Einträge
 * selbst liegen in `src/neuerungen.ts` (die Datei, die bei jeder Änderung
 * einen Absatz mehr bekommt), in der Datenbank steht die Sammlung
 * `changelog`, und ins Gerät kommen sie über den Abgleich wie jeder andere
 * Bereich.
 *
 * **Warum der Umweg über die Datenbank.** Vorher las die Büro-Seite die Datei
 * `CHANGELOG.md` und setzte sie mit einem kleinen Markdown-Umsetzer zusammen.
 * Der kannte Überschriften, Listen und Fettung — und sonst nichts: Kursives
 * stand mit Sternchen da, Pfade mit Backticks, verschachtelte Punkte fielen
 * auf eine Ebene zusammen. Vor allem aber wusste niemand, was neu ist: Eine
 * Datei hat kein Gedächtnis dafür, wer sie schon gelesen hat. Genau das ist
 * jetzt der Punkt — der Banner im Büro und `users.neuerungGesehen`.
 *
 * Bewusst ohne React und ohne Payload: Diese Datei wird im Browser geladen
 * und lässt sich ohne Server prüfen (siehe tests/neuerungen.spec.ts).
 */

/** Ein Punkt in einem Eintrag; `unter` sind Erläuterungen eine Ebene tiefer. */
export type Neuerungspunkt = {
  /**
   * Darf `**fett**` und Backticks um Pfade enthalten — mehr Auszeichnung gibt
   * es nicht, und mehr setzt die Anzeige auch nicht um.
   */
  text: string
  unter?: { text: string }[]
}

/**
 * Ein Eintrag, so wie er in der Datenbank steht und ins Gerät kommt.
 *
 * `nummer` ist fortlaufend und **stabil**: Daran hängt, was jemand schon
 * gesehen hat (`users.neuerungGesehen`). Eine Nummer wird nie neu vergeben
 * und ein veröffentlichter Eintrag nie nachträglich erweitert — sonst bekäme
 * niemand mit, dass etwas dazugekommen ist. Neues bekommt die nächste Nummer.
 */
export type Neuerung = {
  nummer: number
  /**
   * Wann der Eintrag ausgerollt wurde.
   *
   * In der Quelldatei bleibt das Feld bei neuen Einträgen leer; gesetzt wird
   * es beim ersten Einspielen — also an dem Tag, an dem die Fassung wirklich
   * läuft. Das ist der Tag, der den Betrieb interessiert, und er lässt sich
   * beim Schreiben gar nicht wissen: Zwischen „fertig" und „ausgerollt"
   * liegt hier das Wort von Vincent.
   */
  datum?: string | null
  titel: string
  punkte?: Neuerungspunkt[]
}

/** Neueste zuerst — danach steht die Seite, und danach zählt der Banner. */
export function nachNummer<T extends { nummer?: number | null }>(eintraege: T[]): T[] {
  return [...eintraege].sort((a, b) => (b.nummer ?? 0) - (a.nummer ?? 0))
}

/**
 * Was jemand noch nicht gesehen hat.
 *
 * Verglichen wird gegen die höchste Nummer, die beim Lesen dastand — nicht
 * gegen einen Zeitpunkt. Ein Eintrag, der später dazukommt, hat eine höhere
 * Nummer und ist damit von selbst wieder neu.
 */
export function ungesehen<T extends { nummer?: number | null }>(
  eintraege: T[],
  gesehen: number | null | undefined,
): T[] {
  const marke = gesehen ?? 0
  return nachNummer(eintraege).filter((e) => (e.nummer ?? 0) > marke)
}

/** Die höchste vergebene Nummer — sie wird beim Lesen als Marke gemerkt. */
export function hoechsteNummer<T extends { nummer?: number | null }>(eintraege: T[]): number {
  return eintraege.reduce((max, e) => Math.max(max, e.nummer ?? 0), 0)
}

/**
 * Ein Stück Text, wie es dargestellt wird.
 *
 * Die Einträge tragen zwei Auszeichnungen und keine mehr: `**fett**` für das,
 * worum es geht, und Backticks um Pfade und Dateinamen. Alles andere ist
 * Text. Genau hier lag der alte Fehler — der Umsetzer kannte nur Fettung, und
 * jedes Kursiv, jeder Backtick stand als Zeichen mitten im Satz.
 */
export type Textteil = { art: 'text' | 'fett' | 'pfad'; inhalt: string }

const AUSZEICHNUNG = /\*\*(.+?)\*\*|`([^`]+)`/g

export function zerlegen(text: string): Textteil[] {
  const teile: Textteil[] = []
  let zuletzt = 0
  for (const treffer of text.matchAll(AUSZEICHNUNG)) {
    const stelle = treffer.index ?? 0
    if (stelle > zuletzt) teile.push({ art: 'text', inhalt: text.slice(zuletzt, stelle) })
    teile.push(
      treffer[1] !== undefined
        ? { art: 'fett', inhalt: treffer[1] }
        : { art: 'pfad', inhalt: treffer[2] },
    )
    zuletzt = stelle + treffer[0].length
  }
  if (zuletzt < text.length) teile.push({ art: 'text', inhalt: text.slice(zuletzt) })
  return teile
}

/**
 * Die Fettung am Anfang eines Punktes ist seine Überschrift.
 *
 * So sind die Einträge geschrieben: erst in einem Satz, worum es geht, dann
 * der Rest. Als Überschrift gesetzt lässt sich die Liste überfliegen, ohne
 * jeden Absatz zu lesen — vorher war beides derselbe graue Fließtext.
 */
export function kopfUndRest(text: string): { kopf: string | null; rest: string } {
  const treffer = /^\*\*(.+?)\*\*\s*/.exec(text)
  if (!treffer) return { kopf: null, rest: text }
  return { kopf: treffer[1], rest: text.slice(treffer[0].length) }
}
