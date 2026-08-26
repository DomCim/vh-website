/**
 * Die automatischen Mails als Vorlagen — mit Platzhaltern statt festem Text.
 *
 * Bisher stand jeder Satz im Code. Wer den Ton einer Bestellbestätigung ändern
 * wollte, brauchte einen Entwickler und ein Ausrollen; „Guten Tag" statt
 * „Hallo" war ein Commit. Das ist für Text, den der Betrieb schreibt, der
 * falsche Weg.
 *
 * Jetzt liegt jede Mail als Vorlage in den Einstellungen und wird im Büro
 * bearbeitet — mit demselben Schreibfeld, das auch das Postfach benutzt.
 * Solange keine Vorlage hinterlegt ist, gilt die Fassung aus dem Code: Ein
 * Betrieb, der nichts ändert, merkt von der Umstellung nichts.
 *
 * ## Platzhalter
 *
 * `{{bestellnummer}}` wird beim Verschicken ersetzt. Es gibt zwei Sorten, und
 * der Unterschied ist wichtig:
 *
 * - **Werte** — Nummer, Name, Betrag, Datum. Kurze Zeichenketten mitten im
 *   Satz.
 * - **Blöcke** — die Positionstabelle, der Adressblock, der Statuslink.
 *   Fertiges HTML, das als Ganzes eingesetzt wird. Sie stehen in einer
 *   eigenen Zeile und lassen sich nicht sinnvoll umformulieren, nur
 *   weglassen oder verschieben.
 *
 * ## Warum Platzhalter fehlen dürfen — und wo nicht
 *
 * Wer einen Platzhalter löscht, meint es meist so: Nicht jede Bestellung
 * braucht den Hinweis auf die Fertigung. Deshalb ist das erlaubt.
 *
 * Bei manchen wäre es aber ein stiller Schaden: Eine Versandmail ohne
 * Sendungsnummer, eine Rechnungsmail ohne Betrag. Diese sind als `pflicht`
 * gekennzeichnet — fehlen sie, verschickt der Server die **Vorlage nicht**,
 * sondern die Fassung aus dem Code und schreibt eine Warnung ins Protokoll.
 * Lieber eine Mail, die anders klingt als gewünscht, als eine, in der die
 * entscheidende Angabe fehlt.
 */

/** Welche Mails sich einstellen lassen. */
export const VORLAGEN_ARTEN = [
  'bestellbestaetigung',
  'inFertigung',
  'versandt',
  'bewertung',
  'rechnungskauf',
  'auftragInFertigung',
  'auftragFertig',
  'auftragGeliefert',
  'rechnung',
  'mahnung',
  'lieferschein',
  'angebot',
  'bestaetigung',
  'neueBestellung',
  'kontaktanfrage',
  'monatspaket',
] as const

export type VorlagenArt = (typeof VORLAGEN_ARTEN)[number]

export type Platzhalter = {
  name: string
  /** Was er einsetzt — steht im Büro neben dem Feld */
  erklaerung: string
  /** Fertiges HTML statt einer kurzen Angabe: gehört in eine eigene Zeile */
  block?: boolean
  /** Fehlt er, wird die Vorlage nicht benutzt — die Mail wäre unbrauchbar */
  pflicht?: boolean
}

export type VorlagenBeschreibung = {
  art: VorlagenArt
  titel: string
  /** Wann diese Mail hinausgeht — im Büro als Unterzeile */
  anlass: string
  /** Geht an die Kundschaft? Dann wiegt ein Fehler schwerer. */
  anKundschaft: boolean
  platzhalter: Platzhalter[]
}

/* Platzhalter, die in fast jeder Mail vorkommen. */
const KUNDE: Platzhalter = { name: 'kunde', erklaerung: 'Name der Kundschaft' }
const GRUSS: Platzhalter = {
  name: 'gruss',
  erklaerung: 'Grußformel und Absender, wie unter „Signatur" hinterlegt',
  block: true,
}

/**
 * Was es gibt, und was jede Vorlage kennt.
 *
 * Die Liste ist die Wahrheit für beide Seiten: Das Büro zeigt daraus die
 * Auswahl und die Platzhalter-Hilfe, der Server prüft daraus die Pflichtfelder.
 * Zwei getrennte Listen liefen auseinander, sobald eine Mail dazukäme.
 */
export const VORLAGEN: VorlagenBeschreibung[] = [
  {
    art: 'bestellbestaetigung',
    titel: 'Bestellbestätigung',
    anlass: 'Geht hinaus, sobald eine Bestellung bezahlt ist.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'bestellnummer', erklaerung: 'z.B. VH-2026-0042', pflicht: true },
      { name: 'fertigungshinweis', erklaerung: 'Hinweis zur Fertigung, falls am Artikel hinterlegt', block: true },
      { name: 'dateien', erklaerung: 'Download-Links bei digitaler Ware', block: true },
      { name: 'positionen', erklaerung: 'Die Bestellübersicht mit Beträgen', block: true, pflicht: true },
      { name: 'anschrift', erklaerung: 'Lieferadresse oder Abholhinweis', block: true },
      { name: 'statuslink', erklaerung: 'Link, unter dem die Kundschaft den Stand sieht', block: true },
      GRUSS,
    ],
  },
  {
    art: 'inFertigung',
    titel: 'Bestellung: in Fertigung',
    anlass: 'Wenn eine bezahlte Bestellung in die Werkstatt geht.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'bestellnummer', erklaerung: 'z.B. VH-2026-0042', pflicht: true },
      { name: 'fertigungshinweis', erklaerung: 'Hinweis zur Fertigung, falls hinterlegt', block: true },
      { name: 'statuslink', erklaerung: 'Link zum Stand der Bestellung', block: true },
      GRUSS,
    ],
  },
  {
    art: 'versandt',
    titel: 'Bestellung: versandt',
    anlass: 'Wenn die Sendungsnummer eingetragen wird.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'bestellnummer', erklaerung: 'z.B. VH-2026-0042', pflicht: true },
      {
        name: 'sendung',
        erklaerung: 'Sendungsnummer samt Link zur Verfolgung',
        block: true,
        pflicht: true,
      },
      { name: 'statuslink', erklaerung: 'Link zum Stand der Bestellung', block: true },
      GRUSS,
    ],
  },
  {
    art: 'bewertung',
    titel: 'Bitte um Bewertung',
    anlass: 'Einige Tage nach der Lieferung.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'bestellnummer', erklaerung: 'z.B. VH-2026-0042' },
      { name: 'knopf', erklaerung: 'Der Knopf, der zur Bewertung führt', block: true, pflicht: true },
      GRUSS,
    ],
  },
  {
    art: 'rechnungskauf',
    titel: 'Kauf auf Rechnung: Bestellung angenommen',
    anlass: 'Wenn im Laden auf Rechnung gekauft wurde.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'bestellnummer', erklaerung: 'z.B. VH-2026-0042', pflicht: true },
      { name: 'positionen', erklaerung: 'Die Bestellübersicht mit Beträgen', block: true, pflicht: true },
      { name: 'anschrift', erklaerung: 'Lieferadresse oder Abholhinweis', block: true },
      { name: 'statuslink', erklaerung: 'Link zum Stand der Bestellung', block: true },
      GRUSS,
    ],
  },
  {
    art: 'auftragInFertigung',
    titel: 'Auftrag: in Fertigung',
    anlass: 'Wenn ein Auftrag im Büro auf „in Fertigung" gestellt wird.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'auftragsnummer', erklaerung: 'z.B. AU-2026-0042', pflicht: true },
      { name: 'titel', erklaerung: 'Bezeichnung des Auftrags' },
      { name: 'fertigBis', erklaerung: 'Zugesagter Termin, falls eingetragen' },
      GRUSS,
    ],
  },
  {
    art: 'auftragFertig',
    titel: 'Auftrag: fertig',
    anlass: 'Wenn ein Auftrag auf „fertig" gestellt wird.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'auftragsnummer', erklaerung: 'z.B. AU-2026-0042', pflicht: true },
      { name: 'titel', erklaerung: 'Bezeichnung des Auftrags' },
      GRUSS,
    ],
  },
  {
    art: 'auftragGeliefert',
    titel: 'Auftrag: geliefert',
    anlass: 'Wenn ein Auftrag auf „geliefert" gestellt wird.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'auftragsnummer', erklaerung: 'z.B. AU-2026-0042', pflicht: true },
      { name: 'titel', erklaerung: 'Bezeichnung des Auftrags' },
      { name: 'sendung', erklaerung: 'Sendungsnummer, falls versandt wurde', block: true },
      GRUSS,
    ],
  },
  {
    art: 'rechnung',
    titel: 'Rechnung verschicken',
    anlass: 'Beim Verschicken einer Rechnung aus dem Büro.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'nummer', erklaerung: 'Rechnungsnummer', pflicht: true },
      { name: 'betrag', erklaerung: 'Gesamtbetrag brutto', pflicht: true },
      { name: 'faelligAm', erklaerung: 'Zahlungsziel, falls gesetzt' },
      GRUSS,
    ],
  },
  {
    art: 'mahnung',
    titel: 'Erinnerung und Mahnung',
    anlass: 'Bei allen drei Stufen — der Titel wechselt mit der Stufe.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'stufe', erklaerung: 'Zahlungserinnerung, Mahnung oder Letzte Mahnung', pflicht: true },
      { name: 'nummer', erklaerung: 'Rechnungsnummer', pflicht: true },
      { name: 'betrag', erklaerung: 'Offener Betrag', pflicht: true },
      { name: 'faelligWar', erklaerung: 'Wann die Rechnung fällig war' },
      { name: 'tage', erklaerung: 'Wie viele Tage überfällig' },
      GRUSS,
    ],
  },
  {
    art: 'lieferschein',
    titel: 'Lieferschein verschicken',
    anlass: 'Beim Verschicken eines Lieferscheins aus dem Auftrag.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'auftragsnummer', erklaerung: 'z.B. AU-2026-0042', pflicht: true },
      GRUSS,
    ],
  },
  {
    art: 'angebot',
    titel: 'Angebot verschicken',
    anlass: 'Beim Verschicken eines Angebots.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'nummer', erklaerung: 'Angebotsnummer', pflicht: true },
      { name: 'gueltigBis', erklaerung: 'Bis wann das Angebot gilt' },
      GRUSS,
    ],
  },
  {
    art: 'bestaetigung',
    titel: 'Auftragsbestätigung verschicken',
    anlass: 'Beim Verschicken einer Auftragsbestätigung.',
    anKundschaft: true,
    platzhalter: [
      KUNDE,
      { name: 'auftragsnummer', erklaerung: 'z.B. AU-2026-0042', pflicht: true },
      GRUSS,
    ],
  },
  {
    art: 'neueBestellung',
    titel: 'Intern: neue Bestellung',
    anlass: 'An die eigene Adresse, wenn eine Bestellung bezahlt ist.',
    anKundschaft: false,
    platzhalter: [
      { name: 'bestellnummer', erklaerung: 'z.B. VH-2026-0042', pflicht: true },
      { name: 'kunde', erklaerung: 'Name und Adresse der Kundschaft' },
      { name: 'positionen', erklaerung: 'Die Bestellübersicht', block: true },
      { name: 'anschrift', erklaerung: 'Lieferadresse oder Abholhinweis', block: true },
    ],
  },
  {
    art: 'kontaktanfrage',
    titel: 'Intern: Kontaktanfrage',
    anlass: 'An die eigene Adresse, wenn das Formular auf der Website benutzt wird.',
    anKundschaft: false,
    platzhalter: [
      { name: 'name', erklaerung: 'Name des Absenders', pflicht: true },
      { name: 'email', erklaerung: 'Adresse des Absenders', pflicht: true },
      { name: 'telefon', erklaerung: 'Telefonnummer, falls angegeben' },
      { name: 'nachricht', erklaerung: 'Der Text der Anfrage', block: true, pflicht: true },
    ],
  },
  {
    art: 'monatspaket',
    titel: 'Monatspaket an die Kanzlei',
    anlass: 'Auf Knopfdruck aus dem Steuer-Export.',
    anKundschaft: false,
    platzhalter: [
      { name: 'monat', erklaerung: 'z.B. August 2026', pflicht: true },
      { name: 'einnahmen', erklaerung: 'Summe der Einnahmen' },
      { name: 'ausgaben', erklaerung: 'Summe der Ausgaben' },
      { name: 'dateien', erklaerung: 'Wie viele Dateien im Paket sind' },
      { name: 'hinweise', erklaerung: 'Fehlende Scans, DATEV-Datei und Abhol-Link', block: true },
    ],
  },
]

/** Eine Vorlage nachschlagen. */
export const vorlageBeschreibung = (art: string): VorlagenBeschreibung | undefined =>
  VORLAGEN.find((v) => v.art === art)

/**
 * Platzhalter einsetzen.
 *
 * `{{name}}` wird ersetzt, `{{ name }}` mit Leerzeichen ebenso — beim Tippen
 * im Editor entstehen die schnell. Groß- und Kleinschreibung spielt keine
 * Rolle: Wer `{{Bestellnummer}}` schreibt, meint dasselbe.
 *
 * Was nicht in den Werten steht, wird zu einer leeren Zeichenkette. Ein
 * stehengelassenes `{{irgendwas}}` in der Mail wäre schlimmer als eine Lücke
 * — es sieht nach kaputter Software aus.
 */
export function einsetzen(vorlage: string, werte: Record<string, string>): string {
  const karte = new Map(Object.entries(werte).map(([k, v]) => [k.toLowerCase(), v]))
  return vorlage.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => {
    return karte.get(String(name).toLowerCase()) ?? ''
  })
}

/**
 * Fehlt ein Pflicht-Platzhalter?
 *
 * Gibt die Namen zurück, die fehlen. Ist die Liste nicht leer, benutzt der
 * Server die Fassung aus dem Code statt der Vorlage: Eine Versandmail ohne
 * Sendungsnummer oder eine Rechnungsmail ohne Betrag ist keine Mail, sondern
 * ein Rückruf.
 *
 * Geprüft wird nur, was **im Text steht** — nicht, ob der Wert gefüllt ist.
 * Eine Bestellung ohne Fertigungshinweis ist normal; ein Platzhalter, den
 * jemand gelöscht hat, ist es nicht.
 */
export function fehlendePflicht(art: string, vorlage: string): string[] {
  const beschreibung = vorlageBeschreibung(art)
  if (!beschreibung) return []
  const vorhanden = new Set(
    [...vorlage.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]!.toLowerCase()),
  )
  return beschreibung.platzhalter
    .filter((p) => p.pflicht && !vorhanden.has(p.name.toLowerCase()))
    .map((p) => p.name)
}

/**
 * Die Vorlage, die gilt — oder nichts.
 *
 * `nichts` heißt: Der Aufrufer nimmt seine eigene Fassung. Das ist der
 * Normalfall, solange niemand etwas hinterlegt hat, und der Rückfallweg, wenn
 * eine Vorlage unbrauchbar ist.
 *
 * Der Grund für die Warnung im Protokoll: Ein stiller Rückfall wäre nicht
 * erklärbar — jemand ändert eine Vorlage, die Mail sieht aus wie vorher, und
 * niemand weiß warum.
 */
export function gueltigeVorlage(
  art: string,
  vorlagen: { art?: string | null; aktiv?: boolean | null; inhalt?: string | null }[] | undefined,
  warnen?: (text: string) => void,
): string | null {
  const eintrag = (vorlagen ?? []).find((v) => v.art === art && v.aktiv !== false)
  const inhalt = eintrag?.inhalt?.trim()
  if (!inhalt) return null

  const fehlt = fehlendePflicht(art, inhalt)
  if (fehlt.length) {
    warnen?.(
      `Mail-Vorlage „${art}" wird nicht benutzt: Die Platzhalter ${fehlt
        .map((f) => `{{${f}}}`)
        .join(', ')} fehlen. Ohne sie wäre die Mail unvollständig — es geht die eingebaute Fassung hinaus.`,
    )
    return null
  }
  return inhalt
}
