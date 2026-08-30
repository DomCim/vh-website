/**
 * iCalendar (RFC 5545) — schreiben und lesen, von Hand.
 *
 * Bewusst ohne fremdes Paket. Was hier gebraucht wird, ist ein kleiner
 * Ausschnitt des Formats: einzelne Termine, keine Wiederholungen, keine
 * Zeitzonenbibliothek. Ein Paket dafür brächte ein Vielfaches an Code mit,
 * das niemand liest, und wäre bei jedem Sicherheitsupdate wieder Arbeit.
 *
 * Zwei Eigenheiten des Formats, an denen man sich sonst die Zähne ausbeißt:
 *
 *   1. **Zeilen brechen bei 75 Zeichen um**, und die Fortsetzung beginnt mit
 *      einem Leerzeichen. Wer das ignoriert, dessen Datei lädt Apple Kalender
 *      wortlos nicht — ohne Fehlermeldung, sie bleibt einfach leer.
 *   2. **Zeilenenden sind CRLF.** Auch das ist keine Geschmacksfrage: Mit
 *      bloßem Zeilenumbruch allein lehnen manche Leser die Datei ab.
 *
 * Alles hier rechnet in UTC (`Z`-Zeiten). Das erspart die VTIMEZONE-Blöcke,
 * die sonst mit ins Dokument müssten, und ist für Termine mit fester Uhrzeit
 * genau richtig. Ganztägige Termine sind der Sonderfall: Sie stehen als
 * reines Datum ohne Zeit, sonst verrutschen sie am Telefon um Stunden.
 */

export type Termin = {
  uid: string
  titel: string
  beginn: Date
  ende?: Date | null
  ganztaegig?: boolean
  notiz?: string | null
  ort?: string | null
  /** Wann zuletzt geändert — das Telefon erkennt daran, was neu ist. */
  geaendert?: Date | null
  /** Ziel-Adresse, falls der Termin im Büro einen Platz hat. */
  url?: string | null
}

/** Zeitstempel in UTC, wie iCalendar ihn will: 20260830T140000Z */
export function alsZeitpunkt(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/** Reines Datum für ganztägige Termine: 20260830 */
export function alsDatum(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

/**
 * Sonderzeichen entschärfen. Semikolon, Komma und Backslash trennen im
 * Format Felder — ein Kundenname wie „Müller, Sohn & Co" zerlegte den Termin
 * sonst mitten im Titel.
 */
function text(wert: string): string {
  return wert
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Zeile auf 75 Zeichen umbrechen — siehe Kopf dieser Datei. */
function falten(zeile: string): string {
  if (zeile.length <= 75) return zeile
  const teile: string[] = [zeile.slice(0, 75)]
  let rest = zeile.slice(75)
  while (rest.length > 74) {
    teile.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest) teile.push(` ${rest}`)
  return teile.join('\r\n')
}

/** Ein einzelner Termin als VEVENT. */
export function alsEreignis(t: Termin): string[] {
  const zeilen = [
    'BEGIN:VEVENT',
    `UID:${t.uid}`,
    `DTSTAMP:${alsZeitpunkt(t.geaendert ?? new Date())}`,
  ]

  if (t.ganztaegig) {
    zeilen.push(`DTSTART;VALUE=DATE:${alsDatum(t.beginn)}`)
    /*
     * Das Ende ist bei ganztägigen Terminen ausschließend: Ein Termin nur am
     * 30. endet im Format am 31. Ohne den zusätzlichen Tag zeigt das iPhone
     * einen Termin von null Länge — also gar keinen.
     */
    const ende = new Date(t.ende ?? t.beginn)
    ende.setUTCDate(ende.getUTCDate() + 1)
    zeilen.push(`DTEND;VALUE=DATE:${alsDatum(ende)}`)
  } else {
    zeilen.push(`DTSTART:${alsZeitpunkt(t.beginn)}`)
    // Ohne Ende eine Stunde annehmen — ein Termin ohne Dauer ist am Telefon
    // schwer zu treffen und rutscht in der Tagesansicht unter den Rand.
    const ende = t.ende ? new Date(t.ende) : new Date(t.beginn.getTime() + 60 * 60 * 1000)
    zeilen.push(`DTEND:${alsZeitpunkt(ende)}`)
  }

  zeilen.push(`SUMMARY:${text(t.titel)}`)
  if (t.notiz) zeilen.push(`DESCRIPTION:${text(t.notiz)}`)
  if (t.ort) zeilen.push(`LOCATION:${text(t.ort)}`)
  if (t.url) zeilen.push(`URL:${t.url}`)
  if (t.geaendert) zeilen.push(`LAST-MODIFIED:${alsZeitpunkt(t.geaendert)}`)
  zeilen.push('END:VEVENT')
  return zeilen
}

/**
 * Ein ganzer Kalender.
 *
 * `X-WR-CALNAME` ist keine Norm, aber jedes Apple- und Google-Gerät zeigt den
 * Namen daraus an. Ohne ihn heißt das Abonnement am iPhone nach der URL —
 * also nach einer Zeichenkette mit dem Zugangswort darin.
 *
 * `X-PUBLISHED-TTL` und `REFRESH-INTERVAL` sagen dem Telefon, wie oft es
 * nachsehen soll. Sie sind eine Bitte, kein Befehl: iOS hält sich lose daran
 * und fragt oft seltener. Genau das ist der Grund, warum ein Abonnement
 * allein nicht reicht, sobald Termine auch vom Telefon kommen sollen.
 */
export function alsKalender(name: string, termine: Termin[]): string {
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vincent Hellmann//Buero//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`,
    'X-PUBLISHED-TTL:PT30M',
    'REFRESH-INTERVAL;VALUE=DURATION:PT30M',
    ...termine.flatMap(alsEreignis),
    'END:VCALENDAR',
  ]
  return `${zeilen.map(falten).join('\r\n')}\r\n`
}

/** Eine neue Kennung für einen Termin, der im Büro entsteht. */
export function neueKennung(): string {
  return `${crypto.randomUUID()}@vincent-hellmann.fr`
}

/* ------------------------------------------------------------------ *
 * Lesen — für das, was vom Telefon zurückkommt
 * ------------------------------------------------------------------ */

/** Umgekehrt zum Falten: fortgesetzte Zeilen wieder zusammenziehen. */
function entfalten(roh: string): string[] {
  const zeilen: string[] = []
  for (const zeile of roh.split(/\r?\n/)) {
    if (/^[ \t]/.test(zeile) && zeilen.length > 0) {
      zeilen[zeilen.length - 1] += zeile.slice(1)
    } else {
      zeilen.push(zeile)
    }
  }
  return zeilen
}

function entschaerft(wert: string): string {
  return wert
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/**
 * Einen Zeitpunkt aus dem Format lesen.
 *
 * Drei Schreibweisen kommen vor: mit `Z` (UTC), ohne (Ortszeit des Geräts)
 * und als reines Datum. Ortszeit ohne Zeitzonenangabe wird als UTC gelesen —
 * das iPhone schickt bei CalDAV praktisch immer `Z` oder eine benannte Zone,
 * und die Alternative wäre, eine ganze Zeitzonendatenbank mitzuführen.
 */
function zeitpunktLesen(wert: string): { zeit: Date; nurDatum: boolean } | null {
  const rein = wert.trim()
  if (/^\d{8}$/.test(rein)) {
    const j = Number(rein.slice(0, 4))
    const m = Number(rein.slice(4, 6))
    const t = Number(rein.slice(6, 8))
    return { zeit: new Date(Date.UTC(j, m - 1, t)), nurDatum: true }
  }
  const treffer = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(rein)
  if (!treffer) return null
  const [, j, m, t, st, mi, se] = treffer
  return {
    zeit: new Date(
      Date.UTC(Number(j), Number(m) - 1, Number(t), Number(st), Number(mi), Number(se)),
    ),
    nurDatum: false,
  }
}

/**
 * Die Termine aus einem iCalendar-Dokument holen.
 *
 * Genügsam mit Absicht: Was nicht verstanden wird, wird übergangen statt
 * abgelehnt. Ein Telefon, das ein Feld mitschickt, das hier niemand kennt,
 * soll seinen Termin trotzdem speichern können.
 */
export function ereignisseLesen(roh: string): Termin[] {
  const termine: Termin[] = []
  let offen: (Partial<Termin> & { ganztaegig?: boolean }) | null = null

  for (const zeile of entfalten(roh)) {
    if (zeile.startsWith('BEGIN:VEVENT')) {
      offen = {}
      continue
    }
    if (zeile.startsWith('END:VEVENT')) {
      if (offen?.uid && offen.titel !== undefined && offen.beginn) {
        termine.push(offen as Termin)
      }
      offen = null
      continue
    }
    if (!offen) continue

    const teiler = zeile.indexOf(':')
    if (teiler < 0) continue
    const kopf = zeile.slice(0, teiler)
    const wert = zeile.slice(teiler + 1)
    const feld = kopf.split(';')[0].toUpperCase()

    switch (feld) {
      case 'UID':
        offen.uid = wert.trim()
        break
      case 'SUMMARY':
        offen.titel = entschaerft(wert)
        break
      case 'DESCRIPTION':
        offen.notiz = entschaerft(wert)
        break
      case 'LOCATION':
        offen.ort = entschaerft(wert)
        break
      case 'DTSTART': {
        const g = zeitpunktLesen(wert)
        if (g) {
          offen.beginn = g.zeit
          if (g.nurDatum) offen.ganztaegig = true
        }
        break
      }
      case 'DTEND': {
        const g = zeitpunktLesen(wert)
        if (g) {
          /*
           * Beim ganztägigen Termin den ausschließenden Tag wieder abziehen —
           * das Gegenstück zum Aufschlag beim Schreiben. Ohne das wüchse ein
           * Termin bei jedem Hin und Her um einen Tag.
           */
          if (g.nurDatum) {
            const e = new Date(g.zeit)
            e.setUTCDate(e.getUTCDate() - 1)
            offen.ende = e
          } else {
            offen.ende = g.zeit
          }
        }
        break
      }
      default:
        break
    }
  }

  return termine
}
