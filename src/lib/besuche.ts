import type { Payload } from 'payload'

import { getIntegrations } from './settings'

/**
 * Einzelne Besuche — woher jemand kam und was er sich angesehen hat.
 *
 * **Warum das nicht aus der Statistik-Schnittstelle kommt.** Plausible ist
 * bewusst so gebaut, dass es niemanden wiedererkennt; seine Auswertung kennt
 * deshalb nur Summen: „zwölf kamen von Google", „`/outdoor` wurde dreißigmal
 * gesehen". Der Satz „dieser eine kam von Google und sah dann drei Seiten"
 * lässt sich daraus nicht zurückrechnen — die Zahlen sind schon addiert.
 *
 * In seiner eigenen Datenbank steht er trotzdem: ClickHouse führt je Ereignis
 * eine Zeile mit einer Sitzungskennung. Genau die lesen wir hier, und zwar
 * nur lesend und nur von innen.
 *
 * **Was das kostet, und warum es trotzdem so gemacht ist.** Wir hängen damit
 * an Plausibles Innereien, und die sind kein Versprechen: Ein Update kann
 * Spalten umbenennen oder wegnehmen. Die Alternative wäre gewesen, jeden
 * Besuch selbst mitzuschreiben — dann läge dieselbe Information bei uns, und
 * wir hätten eine zweite Sammlung personenbezogener Daten zu verantworten.
 * Entscheidung Dominik (08/2026): lieber an fremdem Schema hängen als eigene
 * Daten anlegen, die es woanders schon gibt.
 *
 * Gegen den Bruch beim nächsten Update hilft, dass die Abfrage **erst
 * nachsieht, welche Spalten es gibt** (`spaltenVon`) und sich dann daraus
 * zusammensetzt. Fehlt etwas Entbehrliches — Land, Browser —, bleibt die
 * Spalte eben leer; fehlt etwas Tragendes, sagt die Seite das im Klartext,
 * statt mit einem SQL-Fehler dazustehen.
 *
 * **Am Besucher ändert sich nichts.** Kein Cookie, keine Kennung im Gerät,
 * kein Banner: Es wird nichts zusätzlich erhoben, sondern nur anders gelesen,
 * was Plausible ohnehin schon hat. Die Sitzungskennung ist Plausibles eigene
 * und stirbt mit dessen Aufbewahrungsfrist.
 */

/** Woher gelesen wird — ClickHouse spricht HTTP, das genügt hier */
export type Besuchszugang = {
  /** z.B. http://plausible_events_db:8123 */
  adresse: string
  datenbank: string
  benutzer: string
  passwort?: string
  /** Die Website, deren Besuche gemeint sind — Plausible führt mehrere */
  seite?: string
}

/**
 * Adresse genügt, der Rest hat Vorgaben.
 *
 * Anders als beim Lesen der Zahlen ist hier **nicht** alles Pflicht: Die
 * Fassung im Stack läuft mit `CLICKHOUSE_SKIP_USER_SETUP`, also mit dem
 * Benutzer `default` und ohne Passwort. Ein Pflichtfeld dafür wäre eine
 * Hürde, hinter der nichts steht.
 */
export function besuchszugangAus(
  adresse: string | undefined,
  datenbank: string | undefined,
  benutzer: string | undefined,
  passwort: string | undefined,
  seite: string | undefined,
): Besuchszugang | undefined {
  if (!adresse?.trim()) return undefined
  return {
    adresse: adresse.trim().replace(/\/+$/, ''),
    datenbank: datenbank?.trim() || 'plausible_events_db',
    benutzer: benutzer?.trim() || 'default',
    passwort: passwort?.trim() || undefined,
    seite: seite?.trim() || undefined,
  }
}

export async function besuchszugang(payload: Payload): Promise<Besuchszugang | undefined> {
  const { plausible } = await getIntegrations(payload)
  return besuchszugangAus(
    plausible.chUrl,
    plausible.chDatenbank,
    plausible.chBenutzer,
    plausible.chPasswort,
    plausible.seite,
  )
}

/**
 * Enger Zeitrahmen, wie bei jeder Anbindung nach außen.
 *
 * ClickHouse antwortet auf diese Abfragen in Millisekunden. Dauert es länger,
 * steht dort etwas quer — dann soll die Büro-Seite das sagen und nicht ewig
 * laden.
 */
const FRIST_MS = 10_000

/** Eine Abfrage, immer lesend, immer mit Parametern statt zusammengeklebt. */
export async function clickhouse<T>(
  zugang: Besuchszugang,
  sql: string,
  parameter: Record<string, string | number> = {},
): Promise<T[]> {
  const adresse = new URL(zugang.adresse)
  adresse.searchParams.set('database', zugang.datenbank)
  adresse.searchParams.set('default_format', 'JSON')
  /*
   * Nur lesen dürfen, und zwar von der Datenbank selbst durchgesetzt.
   *
   * Ein Tippfehler in einer Abfrage soll nicht die Statistik verändern
   * können. `readonly=1` verbietet jede Änderung — auch dann, wenn dieser
   * Zugang mit dem Vollzugriffs-Benutzer `default` läuft, wie ihn der Stack
   * mitbringt.
   */
  adresse.searchParams.set('readonly', '1')
  for (const [name, wert] of Object.entries(parameter)) {
    adresse.searchParams.set(`param_${name}`, String(wert))
  }

  const kopf: Record<string, string> = { 'X-ClickHouse-User': zugang.benutzer }
  if (zugang.passwort) kopf['X-ClickHouse-Key'] = zugang.passwort

  const antwort = await fetch(adresse, {
    method: 'POST',
    headers: kopf,
    body: sql,
    cache: 'no-store',
    signal: AbortSignal.timeout(FRIST_MS),
  })
  if (!antwort.ok) {
    const text = await antwort.text().catch(() => '')
    throw new Error(`Die Statistik-Datenbank antwortet mit ${antwort.status}: ${text.slice(0, 300)}`)
  }
  const daten = (await antwort.json()) as { data?: T[] }
  return daten.data ?? []
}

/** Welche Spalten die Ereignistabelle heute führt — die Abfrage richtet sich danach. */
export async function spaltenVon(zugang: Besuchszugang, tabelle = 'events_v2'): Promise<Set<string>> {
  const zeilen = await clickhouse<{ name: string }>(zugang, `DESCRIBE TABLE ${tabelle}`)
  return new Set(zeilen.map((z) => z.name))
}

/** Ohne diese drei gibt es keinen Besuchsweg — dann ist die Tabelle eine andere geworden. */
export const NOETIG = ['session_id', 'timestamp', 'pathname'] as const

/** Schön zu haben: fehlt eine davon, bleibt in der Anzeige eine Zeile leer. */
export const NETT = [
  'name',
  'hostname',
  'referrer_source',
  'referrer',
  'country_code',
  'browser',
  'operating_system',
  'screen_size',
  'utm_source',
] as const

export type Rohzeile = {
  session_id: string
  zeit: number
  name?: string
  pathname?: string
  referrer_source?: string
  referrer?: string
  utm_source?: string
  country_code?: string
  browser?: string
  operating_system?: string
  screen_size?: string
}

/**
 * Die Abfrage, aus den Spalten gebaut, die es wirklich gibt.
 *
 * Gruppiert wird **nicht** in SQL, sondern danach in `besucheAus`. Das ist
 * Absicht: So bleibt die Abfrage eine gewöhnliche Auswahl, die sich in jeder
 * ClickHouse-Fassung gleich verhält, und das Zusammensetzen der Wege lässt
 * sich ohne Datenbank prüfen (siehe tests/besuche.spec.ts).
 */
export function besuchsAbfrage(
  spalten: Set<string>,
  mitSeite: boolean,
): { sql: string; fehlend: string[] } {
  const fehlend = NOETIG.filter((s) => !spalten.has(s))
  if (fehlend.length) return { sql: '', fehlend }

  const felder = ['session_id', 'toUnixTimestamp(timestamp) AS zeit', 'pathname']
  for (const s of NETT) {
    if (s !== 'hostname' && spalten.has(s)) felder.push(s)
  }

  // Nach der Adresse filtern statt nach der Kennung: Die Nummer der Seite
  // steht in Plausibles anderer Datenbank, die Adresse steht hier daneben.
  const wo = ['timestamp >= {seit:DateTime}']
  if (mitSeite && spalten.has('hostname')) wo.push('hostname = {seite:String}')

  return {
    sql: `SELECT ${felder.join(', ')}
FROM events_v2
WHERE ${wo.join(' AND ')}
ORDER BY timestamp DESC
LIMIT {zeilen:UInt32}`,
    fehlend: [],
  }
}

// ── Aus Ereignissen werden Besuche ──────────────────────────────────────────

export type Schritt = { pfad: string; zeit: number; art?: string }

export type Besuch = {
  /** Plausibles Sitzungskennung, gekürzt — sie steht für „derselbe Besuch" */
  kennung: string
  beginn: number
  ende: number
  /** Sekunden zwischen erstem und letztem Aufruf */
  dauer: number
  herkunft: string
  land?: string
  geraet?: string
  browser?: string
  schritte: Schritt[]
}

/** „google" schlägt „https://www.google.com/…", und beides schlägt „Direkt". */
export function herkunftText(zeile: Rohzeile): string {
  const quelle = zeile.utm_source?.trim() || zeile.referrer_source?.trim()
  if (quelle) return quelle
  const verweis = zeile.referrer?.trim()
  if (verweis) {
    try {
      return new URL(verweis.startsWith('http') ? verweis : `https://${verweis}`).hostname.replace(
        /^www\./,
        '',
      )
    } catch {
      return verweis
    }
  }
  return 'Direkt'
}

const GERAETE: Record<string, string> = {
  Desktop: 'Rechner',
  Laptop: 'Laptop',
  Tablet: 'Tablet',
  Mobile: 'Handy',
}

export function geraeteText(groesse?: string): string | undefined {
  if (!groesse) return undefined
  return GERAETE[groesse] ?? groesse
}

let laender: Intl.DisplayNames | null = null

/** Aus „DE" wird „Deutschland" — das Kürzel liest im Büro niemand. */
export function landText(kuerzel?: string): string | undefined {
  const wert = kuerzel?.trim()
  if (!wert || wert === 'ZZ') return undefined
  try {
    laender ??= new Intl.DisplayNames(['de'], { type: 'region' })
    return laender.of(wert) ?? wert
  } catch {
    return wert
  }
}

/**
 * Die Zeilen zu Besuchen zusammenlegen.
 *
 * Gelesen wird absteigend (das Neueste zuerst, damit die Zeilengrenze vorne
 * abschneidet und nicht hinten); innerhalb eines Besuchs muss der Weg aber
 * vorwärts stehen — man will sehen, wo jemand angekommen ist und wohin er
 * dann ging. Deshalb wird je Besuch aufsteigend sortiert.
 *
 * Herkunft, Land und Gerät stehen an jedem Ereignis; maßgeblich ist das
 * **erste**: Wer über Google kommt und sich dann durch drei Seiten klickt,
 * trägt ab dem zweiten Aufruf die eigene Adresse als Verweis.
 */
export function besucheAus(zeilen: Rohzeile[], grenze = 50): Besuch[] {
  const nach = new Map<string, Rohzeile[]>()
  for (const zeile of zeilen) {
    if (!zeile.session_id) continue
    const liste = nach.get(zeile.session_id)
    if (liste) liste.push(zeile)
    else nach.set(zeile.session_id, [zeile])
  }

  const besuche: Besuch[] = []
  for (const [kennung, roh] of nach) {
    const sortiert = [...roh].sort((a, b) => a.zeit - b.zeit)
    const erste = sortiert[0]
    if (!erste) continue
    const letzte = sortiert[sortiert.length - 1]!
    besuche.push({
      // Die volle Kennung sagt niemandem etwas und ist lang; vier Zeichen
      // genügen, um zwei Besuche auf der Seite auseinanderzuhalten.
      kennung: String(kennung).replace(/\D/g, '').slice(-4).padStart(4, '0'),
      beginn: erste.zeit,
      ende: letzte.zeit,
      dauer: letzte.zeit - erste.zeit,
      herkunft: herkunftText(erste),
      land: landText(sortiert.find((z) => z.country_code)?.country_code),
      geraet: geraeteText(sortiert.find((z) => z.screen_size)?.screen_size),
      browser: sortiert.find((z) => z.browser)?.browser || undefined,
      schritte: sortiert.map((z) => ({
        pfad: z.pathname || '/',
        zeit: z.zeit,
        art: z.name && z.name !== 'pageview' ? z.name : undefined,
      })),
    })
  }

  return besuche.sort((a, b) => b.ende - a.ende).slice(0, grenze)
}

/**
 * Wie viele Ereignisse überhaupt gelesen werden.
 *
 * Die Grenze sitzt an den Zeilen und nicht an den Besuchen — welche Zeile zu
 * welchem Besuch gehört, weiß man ja erst danach. Ein Besuch am unteren Rand
 * kann dadurch abgeschnitten sein; die Seite sagt das dazu, statt einen
 * halben Weg als ganzen auszugeben.
 */
export const ZEILEN_GRENZE = 3000

export type Besuchsliste = {
  besuche: Besuch[]
  /** Wie viele Ereignisse gelesen wurden — an der Grenze ist der Rand erreicht */
  zeilen: number
  angeschnitten: boolean
}

export async function besucheLesen(
  zugang: Besuchszugang,
  seit: Date,
  grenze = 50,
): Promise<Besuchsliste> {
  const spalten = await spaltenVon(zugang)
  const { sql, fehlend } = besuchsAbfrage(spalten, Boolean(zugang.seite))
  if (fehlend.length) {
    throw new Error(
      `Die Ereignistabelle führt ${fehlend.join(', ')} nicht (mehr). ` +
        'Vermutlich hat ein Plausible-Update das Schema geändert.',
    )
  }

  const zeilen = await clickhouse<Rohzeile>(zugang, sql, {
    // ClickHouse erwartet DateTime als „JJJJ-MM-TT hh:mm:ss" in UTC
    seit: seit.toISOString().slice(0, 19).replace('T', ' '),
    ...(zugang.seite && spalten.has('hostname') ? { seite: zugang.seite } : {}),
    zeilen: ZEILEN_GRENZE,
  })

  return {
    besuche: besucheAus(zeilen, grenze),
    zeilen: zeilen.length,
    angeschnitten: zeilen.length >= ZEILEN_GRENZE,
  }
}
