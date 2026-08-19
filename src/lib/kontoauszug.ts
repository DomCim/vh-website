/**
 * Kontoauszug lesen und Zahlungen den Rechnungen zuordnen.
 *
 * Der Kernsatz des ganzen Betriebs lautet „Gefertigt wird nach
 * Zahlungseingang". Ob das Geld da ist, wusste bisher nur das Online-Banking:
 * jemand schaut nach, merkt sich die Nummer, geht ins Büro, hakt die Rechnung
 * ab. Jeden Tag, für jede Rechnung. Beim Kauf auf Rechnung wird daraus eine
 * Dauerbelastung — und ein vergessener Blick heißt, dass ein bezahltes Stück
 * eine Woche länger auf seinen Werkstattplatz wartet.
 *
 * Diese Datei nimmt der Bank ihre Datei ab und schlägt vor, was zu welcher
 * Rechnung gehört. Bewusst **Vorschlag** und nicht Automatik: Der letzte Klick
 * bleibt beim Menschen. Eine falsch abgehakte Rechnung fällt erst auf, wenn
 * gemahnt wird — und dann beim Kunden.
 *
 * Zwei Formate, weil jede Bank ein anderes anbietet:
 *
 *  - **CSV** kann jede. Nur sieht sie bei jeder anders aus, deshalb werden die
 *    Spalten über ihre Überschriften gesucht statt über ihre Stelle.
 *  - **CAMT.053** ist genormt (ISO 20022) und das, was das Onlinebanking unter
 *    „Umsätze als XML" anbietet. Wo es sie gibt, ist sie der bessere Weg.
 *
 * Ohne Payload-Import: Die Zuordnung wird auch im Test ohne Datenbank geprüft.
 */

export type Bewegung = {
  /** Buchungstag, ISO-Datum (YYYY-MM-DD) */
  tag: string
  /** Betrag in Euro; positiv ist ein Eingang, negativ eine Abbuchung */
  betrag: number
  /** Wer überwiesen hat */
  gegenpartei: string
  /** Verwendungszweck — hier steht die Rechnungsnummer, wenn alles gut geht */
  zweck: string
  iban?: string
  waehrung?: string
}

export type OffeneRechnung = {
  id: number | string
  invoiceNumber?: string | null
  customerName?: string | null
  total?: number | null
}

export type Sicherheit = 'sicher' | 'wahrscheinlich' | 'moeglich'

export type Vorschlag = {
  rechnung: number | string
  nummer: string
  sicherheit: Sicherheit
  /** Warum das passen könnte — steht so im Büro neben dem Knopf */
  grund: string
}

const runden = (n: number) => Math.round(n * 100) / 100

/** Alles außer Buchstaben und Ziffern weg, groß geschrieben. */
const knochen = (wert: string): string => wert.toUpperCase().replace(/[^A-Z0-9]/g, '')

// ── Datei lesen ─────────────────────────────────────────────────────────────

/**
 * Eine Zahl, wie Banken sie schreiben.
 *
 * „1.234,56" und „1,234.56" meinen dasselbe, und welches von beidem kommt,
 * hängt an der Bank und an der Ländereinstellung dessen, der exportiert hat.
 * Die Regel, die beides trifft: Das **letzte** Trennzeichen ist das Komma,
 * alles davor sind Tausenderpunkte. Steht nur eines da und folgen ihm genau
 * drei Ziffern, ist es ein Tausenderpunkt — „1.234" sind tausendzweihundert­-
 * vierunddreißig Euro und nicht eins Komma zwei.
 */
export function betragLesen(roh: string): number | null {
  let text = (roh ?? '').trim().replace(/\s/g, '').replace(/[€$]|EUR/gi, '')
  if (!text) return null

  // Klammern und nachgestelltes Minus sind bei Tabellen üblich
  let minus = text.startsWith('-') || text.endsWith('-')
  if (/^\(.*\)$/.test(text)) {
    minus = true
    text = text.slice(1, -1)
  }
  text = text.replace(/[+-]/g, '')

  const letztesKomma = text.lastIndexOf(',')
  const letzterPunkt = text.lastIndexOf('.')
  const trenner = Math.max(letztesKomma, letzterPunkt)

  let zahl: number
  if (trenner < 0) {
    zahl = Number(text)
  } else {
    const nachkomma = text.length - trenner - 1
    if (nachkomma === 3 && letztesKomma !== letzterPunkt && Math.min(letztesKomma, letzterPunkt) < 0) {
      // Genau ein Trennzeichen und drei Ziffern dahinter: Tausender
      zahl = Number(text.replace(/[.,]/g, ''))
    } else {
      zahl = Number(`${text.slice(0, trenner).replace(/[.,]/g, '')}.${text.slice(trenner + 1)}`)
    }
  }

  if (!Number.isFinite(zahl)) return null
  return runden(minus ? -zahl : zahl)
}

/** Datum aus einer Bankdatei — deutsch, international oder mit zweistelligem Jahr. */
export function tagLesen(roh: string): string | null {
  const text = (roh ?? '').trim()
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const deutsch = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/.exec(text)
  if (deutsch) {
    const [, t, m, j] = deutsch
    // Zweistellige Jahre gehören ins laufende Jahrhundert; Kontoauszüge aus
    // dem letzten sind kein Fall, der hier vorkommt.
    const jahr = j.length === 2 ? `20${j}` : j.padStart(4, '0')
    return `${jahr}-${m.padStart(2, '0')}-${t.padStart(2, '0')}`
  }
  return null
}

/** Zerlegt eine CSV-Zeile und achtet dabei auf Anführungszeichen. */
function zeileZerlegen(zeile: string, trenner: string): string[] {
  const felder: string[] = []
  let feld = ''
  let inAnfuehrung = false

  for (let i = 0; i < zeile.length; i++) {
    const z = zeile[i]
    if (z === '"') {
      if (inAnfuehrung && zeile[i + 1] === '"') {
        feld += '"'
        i++
      } else {
        inAnfuehrung = !inAnfuehrung
      }
    } else if (z === trenner && !inAnfuehrung) {
      felder.push(feld)
      feld = ''
    } else {
      feld += z
    }
  }
  felder.push(feld)
  return felder.map((f) => f.trim().replace(/^"|"$/g, '').trim())
}

/** Welche Überschrift welche Spalte meint. Gesucht wird nach Teilstücken. */
const SPALTEN = {
  tag: ['buchungstag', 'buchungsdatum', 'valuta', 'wertstellung', 'datum', 'date'],
  betrag: ['betrag', 'umsatz', 'amount', 'soll/haben', 'wert'],
  zweck: ['verwendungszweck', 'vwz', 'referenz', 'remittance', 'beschreibung', 'description'],
  gegenpartei: [
    'auftraggeber',
    'zahlungspflichtiger',
    'beguenstigter',
    'begünstigter',
    'empfänger',
    'empfaenger',
    'name',
    'payer',
    'payee',
    'counterparty',
  ],
  iban: ['iban', 'kontonummer', 'account'],
  waehrung: ['währung', 'waehrung', 'currency'],
} as const

function spalteFinden(kopf: string[], schluessel: keyof typeof SPALTEN): number {
  const namen = SPALTEN[schluessel]
  for (const name of namen) {
    const treffer = kopf.findIndex((k) => k.toLowerCase().includes(name))
    if (treffer >= 0) return treffer
  }
  return -1
}

/**
 * CSV einer Bank lesen.
 *
 * Die Kopfzeile steht nicht immer oben: Sparkassen setzen gern zwei Zeilen
 * Kontobezeichnung davor. Deshalb wird die erste Zeile gesucht, die sowohl
 * eine Datums- als auch eine Betragsspalte trägt.
 */
export function csvLesen(inhalt: string): Bewegung[] {
  const zeilen = inhalt
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((z) => z.trim())
  if (!zeilen.length) return []

  // Welches Zeichen trennt? Das häufigste in der ersten langen Zeile gewinnt.
  const probe = zeilen.find((z) => z.length > 20) ?? zeilen[0]
  const trenner = [';', '\t', ','].sort(
    (a, b) => probe.split(b).length - probe.split(a).length,
  )[0]

  let kopfZeile = -1
  let kopf: string[] = []
  for (let i = 0; i < Math.min(zeilen.length, 15); i++) {
    const felder = zeileZerlegen(zeilen[i], trenner)
    if (spalteFinden(felder, 'tag') >= 0 && spalteFinden(felder, 'betrag') >= 0) {
      kopfZeile = i
      kopf = felder
      break
    }
  }
  if (kopfZeile < 0) return []

  const spalte = {
    tag: spalteFinden(kopf, 'tag'),
    betrag: spalteFinden(kopf, 'betrag'),
    zweck: spalteFinden(kopf, 'zweck'),
    gegenpartei: spalteFinden(kopf, 'gegenpartei'),
    iban: spalteFinden(kopf, 'iban'),
    waehrung: spalteFinden(kopf, 'waehrung'),
  }

  const bewegungen: Bewegung[] = []
  for (const zeile of zeilen.slice(kopfZeile + 1)) {
    const f = zeileZerlegen(zeile, trenner)
    const tag = tagLesen(f[spalte.tag] ?? '')
    const betrag = betragLesen(f[spalte.betrag] ?? '')
    // Ohne Tag oder Betrag ist es keine Buchung, sondern eine Summenzeile am Fuß
    if (!tag || betrag === null || betrag === 0) continue

    bewegungen.push({
      tag,
      betrag,
      gegenpartei: (f[spalte.gegenpartei] ?? '').trim(),
      zweck: (f[spalte.zweck] ?? '').trim(),
      iban: spalte.iban >= 0 ? (f[spalte.iban] ?? '').trim() || undefined : undefined,
      waehrung: spalte.waehrung >= 0 ? (f[spalte.waehrung] ?? '').trim() || undefined : undefined,
    })
  }
  return bewegungen
}

/** Den Inhalt eines XML-Elements holen — das erste Vorkommen, ohne Namensraum. */
function tag(quelle: string, name: string): string | null {
  const treffer = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(
    quelle,
  )
  return treffer ? treffer[1].trim() : null
}

/** Alle Vorkommen eines XML-Elements. */
function alleTags(quelle: string, name: string): string[] {
  const muster = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'g')
  const treffer: string[] = []
  let t: RegExpExecArray | null
  while ((t = muster.exec(quelle)) !== null) treffer.push(t[1])
  return treffer
}

/**
 * CAMT.053 lesen — der genormte Kontoauszug.
 *
 * Eine Buchung ist ein `Ntry`. Ob Eingang oder Abbuchung, sagt nicht das
 * Vorzeichen des Betrags (der ist immer positiv), sondern `CdtDbtInd`: CRDT
 * ist Geld herein, DBIT heraus. Wer das verwechselt, hält jede Miete für einen
 * Zahlungseingang.
 *
 * Der Verwendungszweck steht in `Ustrd` — je nach Bank mehrfach, dann gehört
 * er zusammengesetzt; die Rechnungsnummer steht sonst womöglich halb im einen
 * und halb im nächsten Stück.
 */
export function camtLesen(xml: string): Bewegung[] {
  const bewegungen: Bewegung[] = []

  for (const eintrag of alleTags(xml, 'Ntry')) {
    const betragRoh = /<(?:\w+:)?Amt\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Amt>/.exec(eintrag)
    const betrag = betragRoh ? Number(betragRoh[1].trim()) : NaN
    if (!Number.isFinite(betrag) || betrag === 0) continue

    const richtung = tag(eintrag, 'CdtDbtInd') ?? 'CRDT'
    const buchung = tag(eintrag, 'BookgDt') ?? tag(eintrag, 'ValDt') ?? ''
    const tagWert = tagLesen(tag(buchung, 'Dt') ?? tag(buchung, 'DtTm') ?? '')
    if (!tagWert) continue

    const zwecke = alleTags(eintrag, 'Ustrd').map((z) => z.trim())
    const parteien = tag(eintrag, 'RltdPties') ?? ''
    const seite = richtung === 'DBIT' ? 'Cdtr' : 'Dbtr'
    const gegenpartei = tag(tag(parteien, seite) ?? '', 'Nm') ?? ''
    const konten = tag(parteien, `${seite}Acct`) ?? ''
    const waehrung = /Ccy="([A-Z]{3})"/.exec(betragRoh?.[0] ?? '')?.[1]

    bewegungen.push({
      tag: tagWert,
      betrag: runden(richtung === 'DBIT' ? -betrag : betrag),
      gegenpartei: gegenpartei.trim(),
      zweck: zwecke.join(' ').trim(),
      iban: tag(konten, 'IBAN') ?? undefined,
      waehrung,
    })
  }

  return bewegungen
}

/** Liest, was da ist — CAMT, wenn es nach XML aussieht, sonst CSV. */
export function auszugLesen(inhalt: string): { bewegungen: Bewegung[]; art: 'camt' | 'csv' } {
  const anfang = inhalt.slice(0, 400)
  if (/<\?xml|<(?:\w+:)?Document\b|<(?:\w+:)?BkToCstmrStmt\b/.test(anfang)) {
    return { bewegungen: camtLesen(inhalt), art: 'camt' }
  }
  return { bewegungen: csvLesen(inhalt), art: 'csv' }
}

/**
 * Der Fingerabdruck einer Buchung.
 *
 * Kontoauszüge werden mit Überschneidung geholt — wer den Januar zweimal
 * herunterlädt, soll ihn nicht zweimal im Büro stehen haben. Eine Buchungs-ID
 * gibt es in CSV meist nicht, also wird sie aus dem gebildet, was eine Buchung
 * ausmacht: Tag, Betrag, Gegenpartei, Zweck. Zwei echte Buchungen, die sich in
 * allem vieren gleichen, sind auch für die Bank dieselbe.
 */
export function fingerabdruck(b: Bewegung): string {
  return [b.tag, b.betrag.toFixed(2), knochen(b.gegenpartei).slice(0, 40), knochen(b.zweck).slice(0, 60)].join(
    '|',
  )
}

// ── Zuordnen ────────────────────────────────────────────────────────────────

/** Steckt die Rechnungsnummer im Verwendungszweck? */
function nummerImZweck(zweck: string, nummer: string): boolean {
  const heu = knochen(zweck)
  const nadel = knochen(nummer)
  return nadel.length >= 6 && heu.includes(nadel)
}

/** Taucht der Kundenname im Verwendungszweck oder beim Absender auf? */
function nameTrifft(bewegung: Bewegung, name: string): boolean {
  const gesucht = name
    .split(/\s+/)
    .map((teil) => knochen(teil))
    .filter((teil) => teil.length >= 4)
  if (!gesucht.length) return false
  const heu = knochen(`${bewegung.gegenpartei} ${bewegung.zweck}`)
  return gesucht.every((teil) => heu.includes(teil))
}

/**
 * Welche Rechnung zu dieser Zahlung passt.
 *
 * Drei Stufen, und sie stehen absichtlich in dieser Reihenfolge:
 *
 *  1. **Die Nummer im Verwendungszweck.** Das ist der sichere Fall — genau
 *     dafür schreibt der GiroCode sie hinein.
 *  2. **Betrag und Name.** Wer den Zweck überschreibt (viele tun das), ist
 *     immer noch derselbe Mensch mit demselben Betrag.
 *  3. **Nur der Betrag**, und auch nur, wenn es genau eine offene Rechnung
 *     über diesen Betrag gibt. Bei zweien wäre jede Wahl geraten.
 *
 * Abbuchungen bekommen nie einen Vorschlag: Eine Ausgangsrechnung wird
 * bezahlt, nicht abgebucht. Was hier hereinkäme, wäre eine Rückerstattung —
 * und die gehört angesehen, nicht abgehakt.
 */
export function zuordnungsVorschlag(
  bewegung: Bewegung,
  rechnungen: OffeneRechnung[],
): Vorschlag | null {
  if (bewegung.betrag <= 0) return null

  const kandidaten = rechnungen.filter((r) => r.invoiceNumber)

  const ueberNummer = kandidaten.find((r) => nummerImZweck(bewegung.zweck, r.invoiceNumber!))
  if (ueberNummer) {
    const passt = Math.abs(runden(ueberNummer.total ?? 0) - bewegung.betrag) < 0.01
    return {
      rechnung: ueberNummer.id,
      nummer: ueberNummer.invoiceNumber!,
      // Auch bei abweichendem Betrag zuordnen: Teilzahlungen kommen vor, und
      // die Nummer im Zweck ist eine Ansage. Der Hinweis sagt es dazu.
      sicherheit: passt ? 'sicher' : 'wahrscheinlich',
      grund: passt
        ? 'Rechnungsnummer steht im Verwendungszweck, Betrag stimmt'
        : `Rechnungsnummer steht im Verwendungszweck — der Betrag weicht ab (Rechnung ${runden(
            ueberNummer.total ?? 0,
          ).toFixed(2)} €)`,
    }
  }

  const betragsgleich = kandidaten.filter(
    (r) => Math.abs(runden(r.total ?? 0) - bewegung.betrag) < 0.01,
  )

  const ueberName = betragsgleich.find((r) => r.customerName && nameTrifft(bewegung, r.customerName))
  if (ueberName) {
    return {
      rechnung: ueberName.id,
      nummer: ueberName.invoiceNumber!,
      sicherheit: 'wahrscheinlich',
      grund: 'Betrag und Name stimmen — die Rechnungsnummer fehlt im Verwendungszweck',
    }
  }

  if (betragsgleich.length === 1) {
    return {
      rechnung: betragsgleich[0].id,
      nummer: betragsgleich[0].invoiceNumber!,
      sicherheit: 'moeglich',
      grund: 'Einzige offene Rechnung über genau diesen Betrag',
    }
  }

  return null
}
