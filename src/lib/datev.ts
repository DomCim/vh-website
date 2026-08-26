import type { Steuerbericht, Steuerzeile } from './steuerexport'

/**
 * Buchungsstapel im DATEV-Format (EXTF).
 *
 * Warum es das gibt: Der Steuerberater bekam bisher eine Tabelle, die ein
 * Mensch lesen kann — Datum, Partner, Kategorie, Beträge. Lesen kann sie
 * jeder, **einlesen** kann sie DATEV nicht, und dort landet sie am Ende. Also
 * tippt jemand in der Kanzlei ab, was hier längst sauber steht, und jede
 * Zeile ist eine Gelegenheit für einen Zahlendreher, den niemand mehr findet.
 *
 * Dieselben Daten in dieser Datei liest DATEV direkt ein. Es ist keine
 * zusätzliche Arbeit — es ist dieselbe Arbeit in einem Format, das die
 * Gegenseite versteht.
 *
 * **Die menschenlesbare Tabelle bleibt.** Nicht jede Kanzlei importiert, und
 * für einen Blick ins Jahr ist die CSV das bessere Blatt. Es gibt deshalb
 * zwei Knöpfe, nicht einen neuen statt des alten.
 *
 * ## Was am Format unverhandelbar ist
 *
 * Kopfzeile, Feldreihenfolge und Trennzeichen sind vorgegeben; wer davon
 * abweicht, bekommt beim Import eine Fehlermeldung und sonst nichts. Deshalb
 * steht hier nichts „nach Gefühl":
 *
 * - **Zwei Zeilen Kopf.** Die erste sagt, was für eine Datei das ist (Version,
 *   Kennung, Zeitraum, Berater, Mandant). Die zweite nennt die Spalten.
 * - **Semikolon trennt, Anführungszeichen umschließen Text.** Zahlen stehen
 *   ohne Anführungszeichen, mit Komma als Dezimaltrennzeichen.
 * - **Windows-1252, nicht UTF-8.** Das ist der Punkt, an dem es sonst
 *   scheitert: „Müller" wird bei falscher Kodierung zu „MÃ¼ller", und der
 *   Import bricht ab oder trägt Unsinn ein. Umgesetzt wird das beim
 *   Ausliefern (siehe `alsWindows1252`).
 * - **Beträge immer positiv, die Richtung steht daneben.** DATEV kennt kein
 *   Minus im Betrag: Ob Soll oder Haben gebucht wird, sagt das Feld
 *   „Soll/Haben-Kennzeichen". Eine Gutschrift ist deshalb kein negativer
 *   Betrag, sondern eine umgekehrte Richtung.
 * - **Das Datum hat kein Jahr.** Im Buchungsstapel steht `TTMM`; das Jahr
 *   kommt aus dem Kopf. Sieht falsch aus, ist aber so.
 */

/** Was der Kopf über den Mandanten wissen muss. */
export type DatevAngaben = {
  /** Beraternummer der Kanzlei — kommt aus den Einstellungen */
  berater: number
  /** Mandantennummer dieses Betriebs bei der Kanzlei */
  mandant: number
  /** Erster Monat des Wirtschaftsjahres, üblicherweise Januar */
  wjBeginn?: string
  /** Wie der Stapel in DATEV heißt */
  bezeichnung?: string
}

/**
 * Konten nach SKR03.
 *
 * **Diese Zuordnung gehört von der Kanzlei geprüft.** Sie ist ein
 * begründeter Vorschlag und keine Auskunft: Welches Konto richtig ist, hängt
 * am Kontenrahmen des Mandanten, und den kennt nur der Steuerberater. Steht
 * hier ein Konto falsch, landet die Buchung an der falschen Stelle — die
 * Zahlen stimmen, die Zuordnung nicht.
 *
 * Bewusst als Tabelle im Code und nicht als Feld je Kategorie: Elf Felder in
 * den Einstellungen, die niemand füllt, wären elf leere Konten. Eine
 * Änderung ist ein Einzeiler hier; wird sie öfter gebraucht, gehören die
 * Konten in die Einstellungen.
 */
const AUSGABEN_KONTO: Record<string, string> = {
  material: '3400', // Wareneingang / Rohstoffe
  werkzeug: '0490', // Geringwertige Wirtschaftsgüter / Werkzeuge
  fremdleistung: '3100', // Fremdleistungen
  fahrzeug: '4530', // Laufende Kfz-Betriebskosten
  miete: '4210', // Miete unbewegliche Wirtschaftsgüter
  versicherung: '4360', // Versicherungen
  buero: '4930', // Bürobedarf, Software, Telefon
  werbung: '4600', // Werbekosten
  reise: '4650', // Reisekosten und Bewirtung
  gebuehren: '4970', // Nebenkosten des Geldverkehrs
  sonstiges: '4900', // Sonstiger Betriebsbedarf
}

/** Wohin Einnahmen laufen. */
const ERLOES_KONTO = {
  /** Erlöse zum Regelsteuersatz */
  normal: '8400',
  /** Innergemeinschaftliche Lieferung, steuerfrei — siehe lib/facturx.ts */
  reverseCharge: '8125',
} as const

/** Das Gegenkonto: Bis zur Zahlung steht die Buchung auf einem Sammelkonto. */
const GEGENKONTO = {
  /** Forderungen aus Lieferungen und Leistungen */
  debitoren: '1400',
  /** Verbindlichkeiten aus Lieferungen und Leistungen */
  kreditoren: '1600',
} as const

/** Konto und Gegenkonto für eine Zeile. */
function konten(z: Steuerzeile): { konto: string; gegen: string } {
  if (z.art === 'einnahme') {
    return {
      konto: GEGENKONTO.debitoren,
      gegen: z.reverseCharge ? ERLOES_KONTO.reverseCharge : ERLOES_KONTO.normal,
    }
  }
  return {
    konto: AUSGABEN_KONTO[z.schluessel ?? ''] ?? AUSGABEN_KONTO.sonstiges!,
    gegen: GEGENKONTO.kreditoren,
  }
}

/** Betrag mit Komma und zwei Stellen, immer positiv. */
const betrag = (n: number) => Math.abs(n).toFixed(2).replace('.', ',')

/** `TTMM` — im Buchungsstapel steht das Jahr nur im Kopf. */
function tagMonat(iso: string): string {
  const [, m, t] = iso.split('-')
  return `${t ?? ''}${m ?? ''}`
}

/** Text für ein DATEV-Feld: in Anführungszeichen, innere verdoppelt. */
const text = (s: string, max = 60) => `"${(s ?? '').slice(0, max).replace(/"/g, '""')}"`

/**
 * Der Kopf, zwei Zeilen.
 *
 * Die Felder der ersten Zeile stehen in dieser Reihenfolge fest. Was hier
 * `""` ist, darf leer bleiben; was fehlt, lässt den Import scheitern.
 */
function kopf(bericht: Steuerbericht, a: DatevAngaben, erzeugt: string): string[] {
  const jahr = bericht.jahr
  const zeilen = bericht.zeilen.filter((z) => z.datum)
  const von = zeilen[0]?.datum?.replace(/-/g, '') ?? `${jahr}0101`
  const bis = zeilen[zeilen.length - 1]?.datum?.replace(/-/g, '') ?? `${jahr}1231`

  const eins = [
    '"EXTF"', // Kennung: Fremdprogramm
    '700', // Version des Formats
    '21', // Kategorie 21 = Buchungsstapel
    '"Buchungsstapel"',
    '13', // Formatversion
    erzeugt, // Zeitstempel der Erzeugung
    '', // importiert (bleibt leer)
    '""', // Herkunft
    '"Vincent Hellmann"', // exportiert von
    '""', // importiert von
    String(a.berater),
    String(a.mandant),
    a.wjBeginn ?? `${jahr}0101`,
    '4', // Länge der Sachkontonummern
    von,
    bis,
    text(a.bezeichnung ?? `Buchungen ${jahr}`),
    '""', // Diktatkürzel
    '1', // Buchungstyp: 1 = Finanzbuchführung
    '0', // Rechnungslegungszweck
    '0', // Festschreibung: 0 = nicht festgeschrieben
    '"EUR"',
  ]

  const zwei = [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Kurs',
    'Basis-Umsatz',
    'WKZ Basis-Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Belegfeld 2',
    'Skonto',
    'Buchungstext',
  ].map((s) => `"${s}"`)

  return [eins.join(';'), zwei.join(';')]
}

/**
 * Der Buchungsstapel als Text.
 *
 * Noch nicht als Datei: Die Kodierung nach Windows-1252 macht
 * `alsWindows1252`, denn erst beim Ausliefern steht fest, ob ein Byte-Puffer
 * oder ein String gebraucht wird.
 */
export function alsDatev(
  bericht: Steuerbericht,
  angaben: DatevAngaben,
  /** Zeitstempel `JJJJMMTTHHMMSSFFF` — von außen, damit die Datei prüfbar bleibt */
  erzeugt: string,
): string {
  const zeilen = bericht.zeilen
    .filter((z) => z.datum && z.brutto)
    .map((z) => {
      const { konto, gegen } = konten(z)

      /*
       * Soll oder Haben — und warum eine Gutschrift kein Minus ist.
       *
       * Eine Einnahme steht im Soll auf der Forderung, eine Ausgabe im Haben
       * auf der Verbindlichkeit. Dreht der Betrag ins Negative (Storno,
       * Gutschrift), dreht sich die Richtung, nicht das Vorzeichen: DATEV
       * kennt im Betragsfeld kein Minus.
       */
      const negativ = z.brutto < 0
      const richtung = z.art === 'einnahme' ? (negativ ? 'H' : 'S') : negativ ? 'S' : 'H'

      /*
       * Der Steuersatz steht nicht als Zahl dabei, sondern als BU-Schlüssel.
       *
       * Leer heißt „nimm den Automatikwert des Kontos", und das ist der
       * Normalfall: Das Erlöskonto 8400 bringt seine 19 % selbst mit. Nur wo
       * ausdrücklich **keine** Steuer anfällt, wird das gesagt — sonst
       * rechnet DATEV eine hinzu, die auf dem Papier nicht steht.
       */
      const buSchluessel = z.reverseCharge || z.steuersatz === 0 ? '0' : ''

      const zweck = [z.partner, z.bezeichnung].filter(Boolean).join(', ') || z.kategorie

      return [
        betrag(z.brutto),
        `"${richtung}"`,
        '"EUR"',
        '', // Kurs
        '', // Basis-Umsatz
        '""', // WKZ Basis-Umsatz
        konto,
        gegen,
        buSchluessel,
        tagMonat(z.datum),
        text(z.nummer, 36), // Belegfeld 1: Rechnungs- oder Belegnummer
        '""', // Belegfeld 2
        '', // Skonto
        text(zweck), // Buchungstext, 60 Zeichen
      ].join(';')
    })

  return [...kopf(bericht, angaben, erzeugt), ...zeilen].join('\r\n') + '\r\n'
}

/**
 * Nach Windows-1252, wie DATEV es erwartet.
 *
 * Der Punkt, an dem ein Import sonst scheitert: In UTF-8 wird „Müller" zu
 * „MÃ¼ller", und je nach Fassung bricht DATEV ab oder trägt den Unsinn ein.
 * Es gibt keinen Encoder dafür im Browser-Standard, also von Hand — für
 * Zeichen unter 256 ist das eine Tabelle, alles darüber wird zu `?`.
 *
 * Vorher werden die üblichen Sonderzeichen ersetzt, statt sie zu verlieren:
 * Ein Gedankenstrich im Buchungstext hat in Windows-1252 keine Entsprechung,
 * ein Bindestrich schon.
 */
export function alsWindows1252(inhalt: string): Buffer {
  const ersetzt = inhalt
    .replace(/[‐-―]/g, '-') // Gedankenstriche
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/…/g, '...')
    .replace(/€/g, '') // Euro-Zeichen liegt in Windows-1252 auf 0x80
    .replace(/ /g, ' ')

  const bytes = new Uint8Array(ersetzt.length)
  for (let i = 0; i < ersetzt.length; i++) {
    const c = ersetzt.charCodeAt(i)
    bytes[i] = c < 256 ? c : 0x3f // '?'
  }
  return Buffer.from(bytes)
}

/**
 * Der Dateiname, den DATEV erwartet.
 *
 * `EXTF_` voran, damit der Import die Datei als Buchungsstapel erkennt.
 */
export function datevDateiname(jahr: number, monat?: number): string {
  const zeitraum = monat ? `${jahr}-${String(monat).padStart(2, '0')}` : String(jahr)
  return `EXTF_Buchungsstapel_${zeitraum}.csv`
}
