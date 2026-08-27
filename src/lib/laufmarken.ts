import { createHmac, timingSafeEqual } from 'crypto'

import type { Arbeitsschritt } from './arbeitsplan'

/**
 * Laufmarken — wer beim Scannen was sieht.
 *
 * Der QR-Code auf der Marke trägt nur die Adresse `/m/<code>`. Was dahinter
 * sichtbar wird, entscheidet diese Datei: Das Büro sieht alles (und bucht),
 * der Dienstleister sieht **seinen** Schritt, alle anderen sehen einen Satz.
 *
 * Zwei Bausteine, beide bewusst rein und ohne Datenbank:
 *
 * **Die Sitzung** ist ein HMAC-Cookie nach dem Muster der Übergabemappe —
 * keine Sitzungstabelle, das Cookie trägt Kennung und Ablauf und ist mit dem
 * Geheimnis der Anwendung unterschrieben. Anders als dort ist es an den
 * **Betrieb** gebunden, nicht an eine Marke: Der Verzinker weist sich einmal
 * je Gerät aus und scannt danach jede Marke, an der er einen Schritt hat.
 * Dreißig Tage, weil der PIN dauerhaft ist und sich das Cookie bei jeder
 * Anmeldung erneuert.
 *
 * **Die Sicht** wird Feld für Feld **aufgebaut**, nie aus dem Auftrag
 * gefiltert: Ein Feld, das später an den Auftrag kommt, ist damit von selbst
 * nicht draußen. Was der Betrieb nie sieht: Preise und Kosten in jeder Form,
 * Kundendaten, Notizen (auch nicht die Schritt-Notiz — „rein intern" ist die
 * Zusage in lib/arbeitsplan.ts), Zeiterfassung, die Auftragsnummer, der
 * Auftragstitel (kann den Kundennamen tragen), andere Schritte und andere
 * Betriebe.
 */

/** Wie lange die Anmeldung eines Betriebs am Gerät hält. */
export const MARKEN_SITZUNG_TAGE = 30

export const MARKEN_COOKIE = 'vh-marke'

function geheimnis(): string {
  return process.env.PAYLOAD_SECRET || 'unsicher-nur-fuer-entwicklung'
}

function signieren(nutzlast: string): string {
  return createHmac('sha256', geheimnis()).update(nutzlast).digest('hex')
}

/** Das Cookie nach bestandener PIN-Prüfung — gebunden an den Betrieb. */
export function markenSitzung(kontaktId: number): {
  name: string
  wert: string
  maxAge: number
} {
  const ablauf = Date.now() + MARKEN_SITZUNG_TAGE * 86400_000
  const nutzlast = `${kontaktId}|${ablauf}`
  return {
    name: MARKEN_COOKIE,
    wert: `${Buffer.from(nutzlast).toString('base64url')}.${signieren(nutzlast)}`,
    maxAge: MARKEN_SITZUNG_TAGE * 86400,
  }
}

/** Welcher Betrieb hier angemeldet ist — `null`, wenn keiner. */
export function markenSitzungLesen(cookieWert: string | undefined): number | null {
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
  const [kontakt, ablauf] = nutzlast.split('|')
  if (!kontakt || !ablauf || Number(ablauf) < Date.now()) return null
  const id = Number(kontakt)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Die Kennung aus einem Verweis — Zahl oder geladenes Objekt. */
export function kontaktKennung(wert: unknown): number | null {
  if (typeof wert === 'number') return wert
  if (typeof wert === 'object' && wert !== null) {
    const id = (wert as { id?: number }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/** Was der angemeldete Betrieb von diesem Auftrag zu sehen bekommt. */
export type DienstleisterSicht = {
  schritt: {
    was: string
    angekommenAm: string | null
    fertigGemeldetAm: string | null
  }
  /** Der Wunschtermin des Auftrags — nur das Datum */
  wunschtermin: string | null
  positionen: {
    beschreibung: string
    menge: number
    farbe: string | null
    /** Kennung des Artikels — das Bild löst die Route auf, nicht diese Funktion */
    artikel: number | null
  }[]
}

type AuftragFuerSicht = {
  dueDate?: string | null
  arbeitsplan?: Arbeitsschritt[] | null
  positions?:
    | {
        description?: string | null
        quantity?: number | null
        farbe?: string | null
        product?: unknown
      }[]
    | null
}

/**
 * Die Sicht des Betriebs — oder `null`, wenn er hier nichts zu suchen hat.
 *
 * `null` heißt: kein Fremd-Schritt dieses Auftrags zeigt auf diesen Betrieb.
 * Ein angemeldeter Verzinker, der eine fremde Marke scannt, erfährt damit
 * exakt so viel wie ein Unbekannter — nämlich nichts.
 *
 * Zeigen mehrere Schritte auf denselben Betrieb, gilt der erste unerledigte:
 * Das ist der, für den das Teil gerade bei ihm liegt oder hinkommt.
 */
export function sichtFuerDienstleister(
  auftrag: AuftragFuerSicht,
  kontaktId: number,
): DienstleisterSicht | null {
  const schritte = auftrag.arbeitsplan ?? []
  const eigene = schritte.filter(
    (s) => s.art === 'fremd' && kontaktKennung(s.dienstleister) === kontaktId,
  )
  if (!eigene.length) return null
  const schritt = eigene.find((s) => (s.stand ?? 'offen') !== 'erledigt') ?? eigene[eigene.length - 1]

  return {
    schritt: {
      was: String(schritt.was ?? ''),
      angekommenAm: schritt.angekommenAm ?? null,
      fertigGemeldetAm: schritt.fertigGemeldetAm ?? null,
    },
    wunschtermin: auftrag.dueDate ? String(auftrag.dueDate).slice(0, 10) : null,
    positionen: (auftrag.positions ?? []).map((p) => ({
      beschreibung: String(p.description ?? ''),
      menge: Number(p.quantity) || 1,
      farbe: p.farbe ?? null,
      artikel:
        typeof p.product === 'object' && p.product !== null
          ? ((p.product as { id?: number }).id ?? null)
          : typeof p.product === 'number'
            ? p.product
            : null,
    })),
  }
}

/**
 * Der Schritt, den dieser Betrieb bestätigen darf — als Index in der Liste.
 *
 * Dieselbe Wahl wie in der Sicht, als eigene Funktion, weil das Schreiben sie
 * braucht: Bestätigt wird am Index, und Sicht und Schreiben müssen zwingend
 * denselben Schritt meinen — sonst bestätigt der Betrieb, was er nicht sieht.
 */
export function eigenerSchrittIndex(
  auftrag: Pick<AuftragFuerSicht, 'arbeitsplan'>,
  kontaktId: number,
): number {
  const schritte = auftrag.arbeitsplan ?? []
  const eigene = schritte
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.art === 'fremd' && kontaktKennung(s.dienstleister) === kontaktId)
  if (!eigene.length) return -1
  const offen = eigene.find(({ s }) => (s.stand ?? 'offen') !== 'erledigt')
  return (offen ?? eigene[eigene.length - 1]).i
}
