/**
 * Was zu erledigen ist — je Ziel in der Navigation.
 *
 * **Warum das hier steht und nicht in der Übersicht.** Die Übersicht rechnete
 * diese Zahlen schon: neue Anfragen, fällige Belege, überfällige Rechnungen,
 * knappes Inventar, fällige Wiedervorlagen. Sie standen aber nur dort — man
 * musste sie also aufsuchen, um zu erfahren, dass es etwas aufzusuchen gibt.
 * Jetzt tragen die Zähler an der Navigation dieselben Zahlen, und damit müssen
 * es dieselben Regeln sein: Eine Zahl, die an zwei Stellen zweimal gerechnet
 * wird, geht früher oder später auseinander, und dann glaubt man keiner mehr.
 *
 * **Bewusst ohne React und ohne Payload.** Diese Datei wird im Browser
 * geladen, und sie lässt sich ohne Server prüfen (siehe
 * tests/zuerledigen.spec.ts).
 *
 * **Was hier nicht steht:** ungelesene Post. Die liegt auf dem Mailserver und
 * nicht im Bestand des Geräts — sie käme nur über den Rahmen, und das ist eine
 * eigene Frage.
 */

import { istOffenerPosten } from './zahlungsstand'

/** Der Tag, ab dem ein Beleg als „bald fällig" gilt. */
const BELEG_VORLAUF_TAGE = 3

export type ZuErledigenBestand = {
  anfragen?: { status?: string | null }[]
  rechnungen?: { status?: string | null; dueDate?: string | null; stornoVon?: unknown }[]
  belege?: { paid?: boolean | null; dueDate?: string | null }[]
  inventar?: { quantity?: number | null; minQuantity?: number | null }[]
  wiedervorlagen?: { done?: boolean | null; dueDate?: string | null }[]
}

/** Eine neue Anfrage hat noch niemand angefasst. */
export const istNeueAnfrage = (a: { status?: string | null }) => a.status === 'neu'

/**
 * Ein Entwurf ist Arbeit, keine Rechnung.
 *
 * Er entsteht von selbst — beim Auftrag, beim Meilenstein, beim Fertigmelden —
 * und bleibt liegen, bis ihn jemand prüft und verschickt. Genau dieser Fall
 * war der Anlass für die Zähler: Ein vorbereiteter Entwurf, von dem nur eine
 * weggewischte Meldung erzählte.
 */
export const istEntwurf = (r: { status?: string | null }) => r.status === 'entwurf'

/** Gestellt, Frist vorbei, kein Geld da. Storno-Gegenrechnungen warten auf nichts. */
export const istUeberfaellig = (
  r: { status?: string | null; dueDate?: string | null; stornoVon?: unknown },
  jetzt: number,
) =>
  istOffenerPosten(r) && Boolean(r.dueDate) && new Date(r.dueDate as string).getTime() < jetzt

/** Unbezahlt und in den nächsten Tagen fällig — oder längst gewesen. */
export const istZuZahlen = (b: { paid?: boolean | null; dueDate?: string | null }, jetzt: number) =>
  !b.paid &&
  Boolean(b.dueDate) &&
  new Date(b.dueDate as string).getTime() < jetzt + BELEG_VORLAUF_TAGE * 86_400_000

/** Unter dem Mindestbestand — ohne Mindestbestand gibt es nichts zu unterschreiten. */
export const istKnapp = (p: { quantity?: number | null; minQuantity?: number | null }) =>
  typeof p.minQuantity === 'number' && (p.quantity ?? 0) < p.minQuantity

/** Offen und der Tag ist da. Verglichen wird auf den Tag, nicht auf die Minute. */
export const istFaellig = (w: { done?: boolean | null; dueDate?: string | null }, jetzt: number) =>
  !w.done && (w.dueDate ?? '').slice(0, 10) <= new Date(jetzt).toISOString().slice(0, 10)

/**
 * Die Zahlen je Navigationsziel. Was null wäre, fehlt — ein Zähler mit 0 ist
 * kein Zähler, sondern ein Fleck.
 */
export function zuErledigen(
  daten: ZuErledigenBestand,
  jetzt: number = Date.now(),
): Record<string, number> {
  const zahlen: Record<string, number> = {}
  const setzen = (href: string, anzahl: number) => {
    if (anzahl > 0) zahlen[href] = anzahl
  }

  setzen('/office/anfragen', (daten.anfragen ?? []).filter(istNeueAnfrage).length)
  setzen(
    '/office/rechnungen',
    (daten.rechnungen ?? []).filter((r) => istEntwurf(r) || istUeberfaellig(r, jetzt)).length,
  )
  setzen('/office/belege', (daten.belege ?? []).filter((b) => istZuZahlen(b, jetzt)).length)
  setzen('/office/nachbestellen', (daten.inventar ?? []).filter(istKnapp).length)
  setzen(
    '/office/wiedervorlagen',
    (daten.wiedervorlagen ?? []).filter((w) => istFaellig(w, jetzt)).length,
  )

  return zahlen
}
