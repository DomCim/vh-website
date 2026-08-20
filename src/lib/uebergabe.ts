import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

/**
 * Übergabemappen — der Weg, auf dem Kundendaten hereinkommen.
 *
 * Bei Lohnfertigung kommen die Unterlagen **vor** der Entscheidung: Zeichnung,
 * Stückzahl, Werkstoff — und erst danach sagt man zu oder ab. Per Mail geht
 * das schlecht: Anhänge sind begrenzt, eine Revision überschreibt nichts,
 * und am Ende liegen drei Fassungen in drei Postfächern.
 *
 * Also ein Ordner mit einem Link. Vincent legt die Mappe an, schickt Link und
 * Passwort, der Auftraggeber lädt hoch und sieht dabei, was schon da ist.
 *
 * Drei Entscheidungen, die hier festliegen:
 *
 * **Der Link allein genügt nicht.** Er wandert durch Postfächer, wird
 * weitergeleitet und steht danach in irgendeinem Verlauf. Zum Öffnen gehört
 * ein Passwort, und zwar eines, das man am Telefon durchgeben kann.
 *
 * **Sieben Tage.** Danach ist Schluss — nicht aus Strenge, sondern weil ein
 * Link, der ewig gilt, irgendwann ein offener Ordner im Netz ist. Wer länger
 * braucht, bekommt einen neuen; die Mappe bleibt dieselbe.
 *
 * **Mehrere Links auf dieselbe Mappe.** Der zweite Link nimmt dem ersten
 * nichts weg. Wer nachliefern will, fragt nach einem neuen — und findet
 * seinen Ordner samt allem, was schon drin liegt.
 */

/** Wie lange ein Link gilt. Sieben Tage, siehe oben. */
export const GUELTIG_TAGE = 7

/**
 * Das Passwort, das man durchsagen kann.
 *
 * Ohne I, l, O, 0 und 1: Am Telefon sind das die Zeichen, bei denen
 * nachgefragt wird. Acht Stellen aus 32 Zeichen sind rund 10^12
 * Möglichkeiten — zusammen mit der Sperre nach zehn Fehlversuchen genug für
 * einen Ordner, der eine Woche offen steht.
 */
const ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function passwortErzeugen(laenge = 8): string {
  const roh = randomBytes(laenge)
  return Array.from(roh, (b) => ZEICHEN[b % ZEICHEN.length]).join('')
}

/** Die Kennung in der Adresse — lang genug, dass Raten aussichtslos ist. */
export function tokenErzeugen(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Passwort verwahren, nicht aufheben.
 *
 * `scrypt` statt eines schlichten Hashes: Ein Passwort aus acht Zeichen wäre
 * mit SHA-256 in überschaubarer Zeit durchprobiert. Salz und Ergebnis stehen
 * zusammen in einem Feld, damit die Prüfung ohne Nebentabelle auskommt.
 */
export function passwortVerwahren(passwort: string): string {
  const salz = randomBytes(16)
  const abdruck = scryptSync(passwort.trim().toUpperCase(), salz, 32)
  return `scrypt$${salz.toString('base64url')}$${abdruck.toString('base64url')}`
}

export function passwortStimmt(passwort: string, verwahrt?: string | null): boolean {
  if (!verwahrt) return false
  const [art, salz, abdruck] = verwahrt.split('$')
  if (art !== 'scrypt' || !salz || !abdruck) return false
  try {
    const erwartet = Buffer.from(abdruck, 'base64url')
    const geprueft = scryptSync(passwort.trim().toUpperCase(), Buffer.from(salz, 'base64url'), erwartet.length)
    return timingSafeEqual(erwartet, geprueft)
  } catch {
    return false
  }
}

export type Zugang = {
  token?: string | null
  passwort?: string | null
  gueltigBis?: string | null
  zurueckgezogen?: boolean | null
}

/**
 * Gilt dieser Zugang jetzt noch?
 *
 * Abgelaufen und zurückgezogen sind zwei verschiedene Dinge: Das eine passiert
 * von selbst, das andere ist eine Entscheidung. Nach außen sieht beides gleich
 * aus — wer keinen Zugang mehr hat, soll nicht erfahren, warum.
 */
export function zugangGueltig(zugang: Zugang | null | undefined, jetzt = Date.now()): boolean {
  if (!zugang?.token || zugang.zurueckgezogen) return false
  if (!zugang.gueltigBis) return false
  return new Date(zugang.gueltigBis).getTime() > jetzt
}

/** Das Ende der Gültigkeit, ausgehend von jetzt. */
export function gueltigBis(tage = GUELTIG_TAGE, ab = Date.now()): string {
  return new Date(ab + tage * 24 * 60 * 60 * 1000).toISOString()
}

/** Ein Ordnername, der als Name in einer Liste taugt. */
export function ordnerName(wert: unknown): string {
  return String(wert ?? '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

/* ── Sitzung am Übergabelink ─────────────────────────────────────────────
 *
 * Nach dem Passwort bekommt der Auftraggeber ein signiertes Cookie, das nur
 * für **diese** Mappe gilt. Keine Sitzungstabelle: Das Cookie trägt Kennung
 * und Ablauf und ist mit dem Geheimnis der Anwendung unterschrieben.
 *
 * Die Sitzung läuft nie länger als der Zugang selbst — sonst hätte ein Link,
 * der abgelaufen ist, über das Cookie weiter Bestand.
 */

const SITZUNG = 'vh-uebergabe'

function geheimnis(): string {
  return process.env.PAYLOAD_SECRET || 'unsicher-nur-fuer-entwicklung'
}

function signieren(nutzlast: string): string {
  return createHmac('sha256', geheimnis()).update(nutzlast).digest('hex')
}

export const UEBERGABE_COOKIE = SITZUNG

export function mappenSitzung(
  token: string,
  bisIso: string,
): { name: string; wert: string; maxAge: number } {
  const ablauf = Math.min(new Date(bisIso).getTime(), Date.now() + GUELTIG_TAGE * 86400_000)
  const nutzlast = `${token}|${ablauf}`
  return {
    name: SITZUNG,
    wert: `${Buffer.from(nutzlast).toString('base64url')}.${signieren(nutzlast)}`,
    maxAge: Math.max(0, Math.floor((ablauf - Date.now()) / 1000)),
  }
}

/** Für welche Mappe ist der Besucher angemeldet? `null`, wenn für keine. */
export function mappenSitzungLesen(cookieWert: string | undefined): string | null {
  if (!cookieWert) return null
  const [teil, signatur] = cookieWert.split('.')
  if (!teil || !signatur) return null
  let nutzlast: string
  try {
    nutzlast = Buffer.from(teil, 'base64url').toString()
  } catch {
    return null
  }
  const erwartet = signieren(nutzlast)
  if (
    erwartet.length !== signatur.length ||
    !timingSafeEqual(Buffer.from(erwartet), Buffer.from(signatur))
  ) {
    return null
  }
  const [token, ablauf] = nutzlast.split('|')
  if (!token || !ablauf || Number(ablauf) < Date.now()) return null
  return token
}

/* ── Was hereinkommen darf ─────────────────────────────────────────────────
 *
 * Steht in `dateigrenzen.ts`, weil die Upload-Ansicht im Browser dieselben
 * Grenzen kennen muss. Hier weitergereicht, damit auf der Serverseite eine
 * einzige Adresse genügt.
 */
export {
  dateiName,
  endungErlaubt,
  endungVon,
  ERLAUBTE_ENDUNGEN,
  MAX_BYTES,
  MAX_DATEIEN,
} from './dateigrenzen'

/* ── Wem gehört welche Datei ─────────────────────────────────────────────── */

export type Mappendatei = {
  herkunft?: string | null
  freigabe?: boolean | null
}

/**
 * Sieht der Auftraggeber diese Datei?
 *
 * Zwei Wege führen hin, und beide sind nachvollziehbar:
 *
 * **Er hat sie selbst hochgeladen** (`herkunft: 'kunde'`). Was von ihm kommt,
 * bleibt für ihn sichtbar — sonst lädt er hoch und sieht danach ein leeres
 * Fach und lädt sicherheitshalber noch einmal.
 *
 * **Vincent hat sie freigegeben** (`freigabe`). Die Mappe ist keine
 * Einbahnstraße: Zurück gehen Fertigungszeichnung, Prüfprotokoll,
 * Messschrieb, das unterschriebene Angebot. Alles andere, was im Haus an der
 * Mappe hängt — Kalkulationsblätter, Notizen, Vorlagen — bleibt drinnen, und
 * zwar solange, bis jemand ausdrücklich auf „freigeben" drückt.
 */
export function fuerKunden(datei: Mappendatei | null | undefined): boolean {
  if (!datei) return false
  return datei.herkunft === 'kunde' || datei.freigabe === true
}

/**
 * Die Bezeichnung der Mappe, wenn keine eingetippt wurde.
 *
 * Die Mappe hängt an einem Geschäftspartner oder an einer Anfrage — daraus
 * ergibt sich der Name von selbst. Ein Feld, das man ausfüllen muss, bevor
 * man loslegen darf, wird sonst mit „Test" gefüllt.
 */
export function mappenTitel(bezug: {
  kontakt?: string | null
  anfrage?: string | number | null
  betreff?: string | null
}): string {
  const teile = [
    bezug.kontakt?.trim() || null,
    bezug.anfrage ? `Anfrage ${bezug.anfrage}` : null,
    bezug.betreff?.trim() || null,
  ].filter(Boolean)
  return teile.length > 0 ? teile.join(' · ').slice(0, 120) : 'Übergabemappe'
}
