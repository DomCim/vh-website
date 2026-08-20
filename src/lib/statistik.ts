import type { Payload } from 'payload'

import { getIntegrations } from './settings'

/**
 * Die Besucherzählung — wer war da, und was hat er sich angesehen.
 *
 * Gezählt wird mit selbst betriebenem Plausible. Zwei Entscheidungen stecken
 * darin, und beide haben einen Grund:
 *
 * **Es läuft auf dem eigenen Server.** Damit verlässt kein Besuch das Haus.
 * Das ist nicht nur Haltung: Wer Besucherdaten an einen Dienst außerhalb der
 * EU gibt, braucht dafür eine Rechtsgrundlage, und die holt man sich beim
 * Besucher — mit einem Banner, das jeder wegklickt.
 *
 * **Es gibt keine Cookies und keine Kennung.** Plausible merkt sich niemanden.
 * Ob zwei Aufrufe vom selben Menschen kommen, entscheidet ein Fingerabdruck
 * aus IP, Browserkennung und einem Salz, das täglich wechselt — danach ist der
 * Zusammenhang weg. Ohne Cookie und ohne Wiedererkennung über den Tag hinaus
 * braucht es keine Einwilligung, und damit auch kein Banner.
 *
 * Der Zugang zur Auswertung ist hier zu Hause; das Zählen selbst läuft über
 * die eigenen Routen (siehe `app/(frontend)/js/zaehler.js` und
 * `app/(frontend)/api/zaehler`).
 */

/** Woher die Zahlen kommen und womit man sie holen darf */
export type Statistikzugang = {
  /** Adresse von Plausible im internen Netz, z.B. http://plausible:8000 */
  adresse: string
  /** Der Name der Website in Plausible, z.B. vincent-hellmann.com */
  seite: string
  /** Schlüssel für die Stats-API */
  schluessel: string
}

/**
 * Alles oder nichts — wie beim Signieren: Mit halber Angabe entstünden
 * Anfragen, die reihenweise mit 401 zurückkommen, und in der Auswertung
 * stünde „keine Daten" statt „falsch eingerichtet".
 */
export function zugangAus(
  adresse: string | undefined,
  seite: string | undefined,
  schluessel: string | undefined,
): Statistikzugang | undefined {
  if (!adresse?.trim() || !seite?.trim() || !schluessel?.trim()) return undefined
  return {
    // Ohne abschließenden Schrägstrich, sonst entstehen Adressen mit //
    adresse: adresse.trim().replace(/\/+$/, ''),
    seite: seite.trim(),
    schluessel: schluessel.trim(),
  }
}

/** Der Zugang aus dem Admin, ersatzweise aus der Umgebung */
export async function statistikzugang(payload: Payload): Promise<Statistikzugang | undefined> {
  const { plausible } = await getIntegrations(payload)
  return zugangAus(plausible.url, plausible.seite, plausible.apiKey)
}

/** So lange gilt die einmal gelesene Adresse, bevor neu nachgesehen wird */
const ADRESSE_FRISCHE_MS = 5 * 60_000

let gemerkteAdresse: { zeit: number; wert?: string } | null = null

/**
 * Wohin die gezählten Aufrufe weitergereicht werden.
 *
 * Zum Zählen genügt die Adresse — der Schlüssel wird nur zum Lesen gebraucht.
 * Und sie wird gemerkt: Diese Frage kommt bei **jedem** Seitenaufruf eines
 * Besuchers, und eine Datenbankabfrage je Aufruf ist genau die Art Aufwand,
 * die eine Statistik nicht kosten darf.
 */
export async function zaehladresse(payload: Payload): Promise<string | undefined> {
  if (gemerkteAdresse && Date.now() - gemerkteAdresse.zeit < ADRESSE_FRISCHE_MS) {
    return gemerkteAdresse.wert
  }
  let wert: string | undefined
  try {
    const { plausible } = await getIntegrations(payload)
    wert = plausible.url?.trim().replace(/\/+$/, '') || undefined
  } catch {
    // Datenbank gerade nicht da → nur die Umgebung, und sonst eben nicht zählen
    wert = process.env.PLAUSIBLE_URL?.trim().replace(/\/+$/, '') || undefined
  }
  gemerkteAdresse = { zeit: Date.now(), wert }
  return wert
}

/*
 * Zeiträume.
 *
 * Plausible kennt Kürzel wie „30d". Hier stehen trotzdem zwei ausgeschriebene
 * Daten in der Anfrage: Das Kürzel bedeutet je nach Fassung mal „die letzten
 * 30 Tage", mal „die letzten 30 Tage ohne heute". Zwei Daten bedeuten immer
 * dasselbe, und der Verlauf darunter passt dann auch dazu.
 */
export const ZEITRAEUME = {
  '7t': { label: '7 Tage', tage: 7 },
  '30t': { label: '30 Tage', tage: 30 },
  '90t': { label: '90 Tage', tage: 90 },
  '365t': { label: 'Ein Jahr', tage: 365 },
} as const

export type Zeitraum = keyof typeof ZEITRAEUME

/*
 * `wert in ZEITRAEUME` wäre hier falsch: `in` sucht auch in der Prototypkette,
 * und damit gilt ausgerechnet `?zeitraum=constructor` als gültiger Zeitraum.
 * Danach steht in `tage` eine Funktion statt einer Zahl, und die Seite rechnet
 * mit NaN-Daten. `Object.hasOwn` fragt nur den Eintrag selbst.
 */
export function istZeitraum(wert: unknown): wert is Zeitraum {
  return typeof wert === 'string' && Object.hasOwn(ZEITRAEUME, wert)
}

/**
 * Ein Tag als `2026-08-20` — in der Zeitzone der Werkstatt, nicht in der des
 * Servers. Der Container läuft nach UTC; um kurz nach Mitternacht wäre „heute"
 * sonst noch gestern, und der Verlauf hörte einen Tag zu früh auf.
 */
export function tagesstempel(zeit: Date, zone = 'Europe/Paris'): string {
  // „sv-SE" schreibt Daten als JJJJ-MM-TT — genau das Format, das die
  // Schnittstelle erwartet, ohne es von Hand zusammenzusetzen
  return new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(zeit)
}

/** Von wann bis wann — beide Tage zählen mit */
export function spanne(zeitraum: Zeitraum, heute: Date): [string, string] {
  const tage = ZEITRAEUME[zeitraum].tage
  const beginn = new Date(heute.getTime() - (tage - 1) * 24 * 60 * 60 * 1000)
  return [tagesstempel(beginn), tagesstempel(heute)]
}

type Abfrage = {
  metrics: string[]
  dimensions?: string[]
  order_by?: [string, 'asc' | 'desc'][]
  pagination?: { limit: number; offset?: number }
  include?: Record<string, boolean>
}

type Antwort = {
  results: { dimensions: string[]; metrics: (number | null)[] }[]
  meta?: { time_labels?: string[] }
}

/** Wie lange eine Antwort wiederverwendet wird, bevor neu gefragt wird */
const FRISCHE_MS = 60_000

const zwischenspeicher = new Map<string, { zeit: number; daten: Antwort }>()

/**
 * Eine Frage an die Stats-API.
 *
 * Die Antworten werden eine Minute lang aufgehoben. Nicht aus Sparsamkeit,
 * sondern weil die Seite mehrere Fragen auf einmal stellt und Plausible
 * standardmäßig 600 Anfragen je Stunde durchlässt — ohne das wäre die
 * Auswertung nach ein paar Dutzend Aufrufen für eine Stunde tot.
 */
export async function fragen(
  zugang: Statistikzugang,
  spanneVonBis: [string, string],
  abfrage: Abfrage,
): Promise<Antwort> {
  const koerper = {
    site_id: zugang.seite,
    date_range: spanneVonBis,
    ...abfrage,
  }
  const schluessel = JSON.stringify(koerper)
  const bekannt = zwischenspeicher.get(schluessel)
  if (bekannt && Date.now() - bekannt.zeit < FRISCHE_MS) return bekannt.daten

  const antwort = await fetch(`${zugang.adresse}/api/v2/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${zugang.schluessel}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(koerper),
    cache: 'no-store',
  })

  if (!antwort.ok) {
    const text = await antwort.text().catch(() => '')
    throw new Error(`Statistik antwortet mit ${antwort.status}: ${text.slice(0, 300)}`)
  }

  const daten = (await antwort.json()) as Antwort
  zwischenspeicher.set(schluessel, { zeit: Date.now(), daten })
  /*
   * Der Speicher wächst sonst mit jeder Kombination aus Zeitraum und Frage
   * weiter. Viele sind es nie — aber „nie" ist keine Zusicherung, und ein
   * Prozess, der Monate läuft, verzeiht so etwas nicht.
   */
  if (zwischenspeicher.size > 100) {
    for (const [k, v] of zwischenspeicher) {
      if (Date.now() - v.zeit > FRISCHE_MS) zwischenspeicher.delete(k)
    }
  }
  return daten
}

export type Kennzahlen = {
  besucher: number
  aufrufe: number
  /** Anteil der Besuche mit nur einer Seite, in Prozent */
  absprung: number
  /** Durchschnittliche Verweildauer in Sekunden */
  dauer: number
}

export type Reihe = { name: string; besucher: number }

export type Auswertung = {
  zeitraum: Zeitraum
  von: string
  bis: string
  kennzahlen: Kennzahlen
  verlauf: { tag: string; besucher: number }[]
  seiten: Reihe[]
  quellen: Reihe[]
  laender: Reihe[]
  geraete: Reihe[]
}

const zahl = (wert: number | null | undefined): number =>
  typeof wert === 'number' && Number.isFinite(wert) ? wert : 0

/** Eine Liste „Name → Besucher", wie sie unter jeder Überschrift steht */
function reihen(antwort: Antwort, ersatz: string): Reihe[] {
  return antwort.results.map((z) => ({
    name: z.dimensions[0]?.trim() || ersatz,
    besucher: zahl(z.metrics[0]),
  }))
}

/**
 * Alles, was die Auswertung im Büro zeigt — in einem Rutsch.
 *
 * Die fünf Fragen laufen nebeneinander. Nacheinander dauerte der Seitenaufbau
 * fünfmal so lange, und keine der Fragen braucht das Ergebnis einer anderen.
 */
export async function auswertung(
  zugang: Statistikzugang,
  zeitraum: Zeitraum,
  heute: Date,
): Promise<Auswertung> {
  const bereich = spanne(zeitraum, heute)

  const [gesamt, verlauf, seiten, quellen, laender, geraete] = await Promise.all([
    fragen(zugang, bereich, {
      metrics: ['visitors', 'pageviews', 'bounce_rate', 'visit_duration'],
    }),
    fragen(zugang, bereich, {
      metrics: ['visitors'],
      dimensions: ['time:day'],
      // Ohne Zeitmarken fehlen Tage ohne Besuch ganz, und der Verlauf
      // rückt zusammen, statt eine Lücke zu zeigen
      include: { time_labels: true },
      pagination: { limit: 400 },
    }),
    fragen(zugang, bereich, {
      metrics: ['visitors'],
      dimensions: ['event:page'],
      order_by: [['visitors', 'desc']],
      pagination: { limit: 10 },
    }),
    fragen(zugang, bereich, {
      metrics: ['visitors'],
      dimensions: ['visit:source'],
      order_by: [['visitors', 'desc']],
      pagination: { limit: 10 },
    }),
    fragen(zugang, bereich, {
      metrics: ['visitors'],
      dimensions: ['visit:country_name'],
      order_by: [['visitors', 'desc']],
      pagination: { limit: 10 },
    }),
    fragen(zugang, bereich, {
      metrics: ['visitors'],
      dimensions: ['visit:device'],
      order_by: [['visitors', 'desc']],
      pagination: { limit: 5 },
    }),
  ])

  const werte = gesamt.results[0]?.metrics ?? []

  return {
    zeitraum,
    von: bereich[0],
    bis: bereich[1],
    kennzahlen: {
      besucher: zahl(werte[0]),
      aufrufe: zahl(werte[1]),
      absprung: zahl(werte[2]),
      dauer: zahl(werte[3]),
    },
    verlauf: verlaufAus(verlauf),
    seiten: reihen(seiten, '/'),
    quellen: reihen(quellen, 'Direkt'),
    laender: reihen(laender, 'Unbekannt'),
    geraete: reihen(geraete, 'Unbekannt'),
  }
}

/**
 * Der Verlauf, Tag für Tag und ohne Lücken.
 *
 * Plausible liefert nur Tage, an denen etwas passiert ist, und die Zeitmarken
 * daneben. Zusammengesetzt ergibt das eine durchgehende Reihe — sonst stünden
 * drei Balken nebeneinander, die in Wahrheit zwei Wochen auseinanderliegen.
 */
function verlaufAus(antwort: Antwort): { tag: string; besucher: number }[] {
  const gemessen = new Map(
    antwort.results.map((z) => [z.dimensions[0], zahl(z.metrics[0])] as const),
  )
  const marken = antwort.meta?.time_labels
  if (marken?.length) return marken.map((tag) => ({ tag, besucher: gemessen.get(tag) ?? 0 }))
  return antwort.results.map((z) => ({ tag: z.dimensions[0], besucher: zahl(z.metrics[0]) }))
}

/** Aus 754 Sekunden wird „12:34 Min." — Sekunden allein liest niemand */
export function dauerText(sekunden: number): string {
  const ganz = Math.round(sekunden)
  if (ganz < 60) return `${ganz} Sek.`
  const min = Math.floor(ganz / 60)
  const rest = ganz % 60
  return `${min}:${String(rest).padStart(2, '0')} Min.`
}
