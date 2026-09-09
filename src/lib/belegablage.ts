import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Die Ablage für fertige Belege.
 *
 * **Ein Beleg ist ein Gegenstand, keine Ansicht.** Bis hierher entstand jedes
 * PDF beim Anschauen neu — aus dem Datensatz, dem heutigen Briefkopf und der
 * heutigen Vorlage. Eine Rechnung von vorletztem Jahr trug damit die Anschrift
 * von heute, die IBAN von heute und jede seither eingebaute
 * Layout-Verbesserung. Beim Kunden liegt aber ein anderes Blatt, und in der
 * eingebetteten Factur-X-XML — dem rechtlich maßgeblichen Teil — standen
 * ebenfalls die Angaben von heute.
 *
 * Deshalb wird jeder Beleg beim Festschreiben **einmal** gebaut und hier
 * abgelegt. Ausgeliefert wird ab dann diese Datei; erzeugt wird nur noch,
 * wenn keine da ist.
 *
 * **Warum unter `media/` und nicht in einem eigenen Volume.** Die nächtliche
 * Sicherung packt Datenbank und das Verzeichnis `media` in ein Archiv
 * (`lib/sicherung.ts`). Was hier liegt, ist damit gesichert, ohne dass jemand
 * daran denken muss — und ein Archiv, das nicht mitgesichert wird, ist keins.
 * Aus demselben Grund liegen die Werkstatt- und Mappendateien dort
 * (`lib/dateiAblage.ts`); dies ist dasselbe Volume, nur ein anderer Ordner.
 *
 * **Warum kein Payload-Upload dazu.** Zu einer Sammlung gehörte eine Adresse,
 * unter der Payload die Datei ausliefert, und damit eine Zugriffsregel, die
 * für Rechnungen fremder Leute richtig sein müsste. Diese Dateien reicht
 * ausschließlich der Server heraus, durch die Prüfungen, die es für den
 * Vorgang ohnehin schon gibt. Was keine Adresse hat, kann auch keine falsche
 * Antwort geben.
 */
export const BELEGE = path.join(process.cwd(), 'media', 'belege')

/**
 * Ein Dateiname, der niemanden überschreibt.
 *
 * Die Nummer steht vorn, damit im Ordner nachvollziehbar ist, was dort liegt;
 * der Zeitstempel dahinter trennt die Fassungen eines Angebots und die
 * Mahnstufen einer Rechnung voneinander.
 *
 * Der Zufall am Ende ist nicht Zierde: Zwei Ablagen in derselben Millisekunde
 * bekämen sonst denselben Namen, und weil hier absichtlich nichts überschrieben
 * wird (`wx`), wäre die zweite ein Fehler. Genau so ist die Prüfung darüber
 * beim ersten Lauf umgefallen — im Betrieb wäre es der Tag gewesen, an dem
 * zwei Belege gleichzeitig festgeschrieben werden.
 */
function name(kennung: string): string {
  const sauber = kennung.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'beleg'
  const zufall = Math.round(Math.random() * 1e6)
  return `${sauber.slice(0, 80)}-${Date.now()}-${zufall}.pdf`
}

/** Legt den fertigen Beleg ab und liefert den Namen, der an den Vorgang gehört. */
export async function belegAblegen(kennung: string, datei: Buffer): Promise<string> {
  await fs.mkdir(BELEGE, { recursive: true })
  const datename = name(kennung)
  await fs.writeFile(path.join(BELEGE, datename), datei, { flag: 'wx' })
  return datename
}

/**
 * Der abgelegte Beleg, falls es einen gibt.
 *
 * `path.basename` ist kein Schmuck: Der Name kommt aus der Datenbank, und
 * ein Wert mit `../` darin läse sonst eine beliebige Datei des Containers.
 * Fehlt die Datei, gibt es `null` statt eines Fehlers — dann baut der
 * Aufrufer neu, und der Beleg ist wenigstens da.
 */
export async function belegLesen(datename: string | null | undefined): Promise<Buffer | null> {
  const sauber = typeof datename === 'string' ? path.basename(datename.trim()) : ''
  if (!sauber || sauber === '.' || sauber === '..') return null
  return fs.readFile(path.join(BELEGE, sauber)).catch(() => null)
}
