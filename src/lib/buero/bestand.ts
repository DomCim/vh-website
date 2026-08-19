'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

import { ALLE_BEREICHE, type Bereich } from '../bereiche'
import {
  allesVergessen,
  alleLesen,
  speicherFreigeben,
  entfernen,
  leeren,
  merkenLesen,
  merkenSchreiben,
  schreiben,
  speicherVerfuegbar,
} from './speicher'

/**
 * Der Bestand des Büros — im Arbeitsspeicher, gestützt auf das Gerät.
 *
 * Warum überhaupt: Die Büro-Seiten holten ihre Zahlen bisher bei jedem Aufruf
 * frisch vom Server. Das ist schnell, solange Netz da ist, und wertlos, sobald
 * keines mehr da ist — in der Werkstatt also regelmäßig. Jetzt liegt der
 * Bestand im Gerät, die Seiten rechnen daraus, und der Server schickt nur noch
 * das Neue nach.
 *
 * Der Aufbau in drei Schichten:
 *
 *   1. speicher.ts — IndexedDB, der dauerhafte Teil. Überlebt alles.
 *   2. diese Datei — dieselben Daten im Arbeitsspeicher, damit eine Seite
 *      ohne Warten rendern kann, dazu der Abgleich mit dem Server.
 *   3. Die Seiten selbst, über `useBestand`.
 *
 * Angestoßen wird der Abgleich beim Start, bei jeder Live-Meldung und immer
 * dann, wenn das Netz wiederkommt (siehe components/office/BestandAnbieter).
 */

export type Datensatz = Record<string, unknown> & { id: number | string }

/**
 * Was die Seiten außer den Datensätzen brauchen — kommt beim Abgleich mit und
 * liegt ebenfalls im Gerät, damit es auch ohne Netz da ist.
 */
export type Rahmen = {
  benutzer: { email: string; name: string }
  kiVerfuegbar: boolean
  stundensatz: number
  wunschaufschlag: number
  firma: { siret: string; vatId: string; iban: string }
  /** Ab wie vielen Tagen offener Anzahlung nach dem Werkstattplatz gefragt wird */
  platzFreigebenNachTagen: number
  /** Was der angemeldete Mensch darf — die Navigation richtet sich danach */
  rechte: string[]
}

const RAHMEN_LEER: Rahmen = {
  benutzer: { email: '', name: '' },
  kiVerfuegbar: false,
  stundensatz: 65,
  wunschaufschlag: 40,
  firma: { siret: '', vatId: '', iban: '' },
  platzFreigebenNachTagen: 21,
  rechte: [],
}
let rahmen: Rahmen = RAHMEN_LEER
const rahmenHoerer = new Set<() => void>()

/** Eine gemeinsame leere Liste — sonst rendert React bei jedem Durchlauf neu. */
const LEER: Datensatz[] = []

const bestand = new Map<Bereich, Datensatz[]>()
const staende = new Map<Bereich, string | null>()
const geladen = new Set<Bereich>()
const hoerer = new Map<Bereich, Set<() => void>>()

export type AbgleichZustand = {
  /** Läuft gerade ein Abgleich? */
  laeuft: boolean
  /** Wann zuletzt erfolgreich abgeglichen wurde */
  stand: number | null
  /**
   * Kam die letzte Anfrage durch?
   *
   * Bewusst nicht `navigator.onLine`: Ein Handy am Rand der Funkzelle gilt dem
   * Browser durchgehend als „online", während jede Anfrage ins Leere läuft —
   * und umgekehrt meldet nicht jeder Browser zuverlässig, wenn das Netz zurück
   * ist. Was zählt, ist, ob eine Anfrage ankommt.
   */
  erreichbar: boolean
  /** Der letzte Fehlschlag, falls einer ansteht */
  fehler: string | null
  /** Wurde der Bestand aus dem Gerät schon geladen? */
  bereit: boolean
}

let zustand: AbgleichZustand = {
  laeuft: false,
  stand: null,
  erreichbar: true,
  fehler: null,
  bereit: false,
}
const zustandsHoerer = new Set<() => void>()

function zustandSetzen(aenderung: Partial<AbgleichZustand>) {
  zustand = { ...zustand, ...aenderung }
  for (const h of zustandsHoerer) h()
}

function melden(bereich: Bereich) {
  for (const h of hoerer.get(bereich) ?? []) h()
}

// ── Laden aus dem Gerät ─────────────────────────────────────────────────────

let ladeVorgang: Promise<void> | null = null

/** Holt den gespeicherten Bestand ins Gedächtnis. Läuft genau einmal. */
export function bestandLaden(): Promise<void> {
  if (ladeVorgang) return ladeVorgang
  if (!speicherVerfuegbar()) {
    zustandSetzen({ bereit: true })
    return Promise.resolve()
  }

  ladeVorgang = (async () => {
    await Promise.all(
      ALLE_BEREICHE.map(async (bereich) => {
        try {
          const [datensaetze, stand] = await Promise.all([
            alleLesen<Datensatz>(bereich),
            merkenLesen<string>(`stand:${bereich}`),
          ])
          bestand.set(bereich, datensaetze)
          staende.set(bereich, stand ?? null)
          geladen.add(bereich)
          melden(bereich)
        } catch {
          // Ein unlesbarer Bereich darf die anderen nicht aufhalten
          bestand.set(bereich, [])
          geladen.add(bereich)
        }
      }),
    )
    try {
      const gemerkt = await merkenLesen<Rahmen>('rahmen')
      if (gemerkt) {
        rahmen = gemerkt
        for (const h of rahmenHoerer) h()
      }
    } catch {
      // Ohne Rahmen läuft das Büro auch, nur vorsichtiger
    }
    zustandSetzen({ bereit: true })
  })()

  return ladeVorgang
}

// ── Abgleich mit dem Server ─────────────────────────────────────────────────

type BereichsAntwort = {
  geaendert: Datensatz[]
  geloescht: string[]
  stand: string
  mehr: boolean
}

async function anwenden(bereich: Bereich, teil: BereichsAntwort, vonVorn: boolean) {
  const vorher = vonVorn ? [] : (bestand.get(bereich) ?? [])
  const nachher = new Map(vorher.map((d) => [String(d.id), d]))

  for (const datensatz of teil.geaendert) nachher.set(String(datensatz.id), datensatz)
  for (const kennung of teil.geloescht) nachher.delete(String(kennung))

  bestand.set(bereich, [...nachher.values()])
  staende.set(bereich, teil.stand)

  if (speicherVerfuegbar()) {
    try {
      if (vonVorn) await leeren(bereich)
      await schreiben(bereich, teil.geaendert)
      if (teil.geloescht.length) await entfernen(bereich, teil.geloescht)
      await merkenSchreiben(`stand:${bereich}`, teil.stand)
    } catch {
      // Im Gedächtnis stimmt der Bestand; beim nächsten Start wird eben neu geholt
    }
  }

  if (teil.geaendert.length || teil.geloescht.length || vonVorn) melden(bereich)
}

let abgleichVorgang: Promise<void> | null = null
let nochmal = false

/**
 * Holt beim Server, was seit dem letzten Stand passiert ist.
 *
 * Läuft schon einer, wird nicht ein zweiter gestartet — es wird gemerkt, dass
 * gleich noch einmal nachzufragen ist. Sonst löste eine Bestellung mit fünf
 * Änderungen fünf Abgleiche zugleich aus.
 */
export function abgleichen(nurBereiche?: Bereich[]): Promise<void> {
  if (abgleichVorgang) {
    nochmal = true
    return abgleichVorgang
  }

  abgleichVorgang = (async () => {
    zustandSetzen({ laeuft: true })
    try {
      await bestandLaden()
      let offen: Bereich[] = nurBereiche?.length ? nurBereiche : ALLE_BEREICHE

      // Höchstens ein paar Runden: Bei einer Erstbefüllung kommen die Pakete
      // nacheinander, aber es soll auch bei einem Fehler nicht endlos drehen.
      for (let runde = 0; runde < 25 && offen.length; runde += 1) {
        const staendeFuerFrage: Record<string, string | null> = {}
        for (const bereich of offen) staendeFuerFrage[bereich] = staende.get(bereich) ?? null

        let antwort: Response
        try {
          antwort = await fetch('/api/office/abgleich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ staende: staendeFuerFrage, bereiche: offen }),
          })
        } catch {
          // Nicht durchgekommen — das ist kein Fehler, das ist kein Netz
          zustandSetzen({ erreichbar: false, fehler: null })
          return
        }
        zustandSetzen({ erreichbar: true })
        // Nicht angemeldet ist kein Fehler, den man anzeigen müsste — auf der
        // Anmeldeseite läuft dieselbe Hülle, und dort gibt es nichts zu holen.
        if (antwort.status === 401 || antwort.status === 403) {
          zustandSetzen({ fehler: null })
          return
        }
        if (!antwort.ok) throw new Error(`Abgleich abgelehnt (${antwort.status})`)

        const ergebnis = (await antwort.json()) as {
          bereiche: Record<string, BereichsAntwort>
          voll: string[]
          rahmen?: Rahmen
        }

        if (ergebnis.rahmen) {
          rahmen = ergebnis.rahmen
          for (const h of rahmenHoerer) h()
          if (speicherVerfuegbar()) {
            await merkenSchreiben('rahmen', ergebnis.rahmen).catch(() => undefined)
          }
        }
        const vollstaendig = new Set(ergebnis.voll ?? [])

        const weiter: Bereich[] = []
        for (const bereich of offen) {
          const teil = ergebnis.bereiche?.[bereich]
          if (!teil) continue
          await anwenden(bereich, teil, vollstaendig.has(bereich))
          if (teil.mehr) weiter.push(bereich)
        }
        offen = weiter
      }

      zustandSetzen({ stand: Date.now(), fehler: null })
    } catch (err) {
      zustandSetzen({ fehler: err instanceof Error ? err.message : 'Abgleich fehlgeschlagen' })
    } finally {
      zustandSetzen({ laeuft: false })
      abgleichVorgang = null
    }
  })()

  const laufender = abgleichVorgang
  return laufender.then(() => {
    if (nochmal) {
      nochmal = false
      return abgleichen(nurBereiche)
    }
  })
}

/** Kam die letzte Anfrage durch? Für Entscheidungen außerhalb von React. */
export function istErreichbar(): boolean {
  return zustand.erreichbar
}

/**
 * Meldung des Browsers, dass das Netz weg ist.
 *
 * Nur in dieser Richtung wird ihm geglaubt: „offline" stimmt fast immer,
 * „online" oft nicht. Dass es wieder geht, zeigt sich daran, dass eine
 * Anfrage ankommt.
 */
export function netzWegMelden() {
  zustandSetzen({ erreichbar: false })
}

/**
 * Beim Anmelden: Speicher wieder aufschließen und von vorn laden.
 *
 * Nötig, weil das Abmelden ihn absichtlich zusperrt und die Seite dabei nicht
 * neu geladen wird — ohne diesen Handgriff bliebe der Bestand nach einem
 * erneuten Anmelden leer.
 */
export function bestandFreigeben(): void {
  speicherFreigeben()
  ladeVorgang = null
  geladen.clear()
}

/** Beim Abmelden: nichts von den Geschäftsdaten bleibt im Gerät zurück. */
export async function bestandVergessen(): Promise<void> {
  for (const bereich of ALLE_BEREICHE) {
    bestand.set(bereich, [])
    staende.set(bereich, null)
    melden(bereich)
  }
  ladeVorgang = null
  geladen.clear()
  zustandSetzen({ stand: null, bereit: false })
  await allesVergessen()

  // Auch das Gerüst im Service Worker: Ein Gerät, an dem sich jemand
  // abgemeldet hat, soll keine Büro-Seiten mehr aufmachen können.
  try {
    navigator.serviceWorker?.controller?.postMessage('aufraeumen')
  } catch {
    // Ohne Worker gibt es nichts wegzuräumen
  }
}

// ── Örtliche Änderungen ─────────────────────────────────────────────────────

/**
 * Legt einen Datensatz sofort in den Bestand — bevor der Server ihn kennt.
 *
 * Das ist die Hälfte, die eine Eingabe ohne Netz brauchbar macht: Wer in der
 * Werkstatt einen Beleg erfasst, sieht ihn augenblicklich in der Liste. Die
 * andere Hälfte ist die Warteschlange, die ihn später abschickt.
 */
export async function oertlichMerken(bereich: Bereich, datensatz: Datensatz): Promise<void> {
  const vorher = bestand.get(bereich) ?? []
  const nachher = new Map(vorher.map((d) => [String(d.id), d]))
  const alt = nachher.get(String(datensatz.id))
  nachher.set(String(datensatz.id), { ...alt, ...datensatz })
  bestand.set(bereich, [...nachher.values()])
  melden(bereich)

  if (speicherVerfuegbar()) {
    await schreiben(bereich, [{ ...alt, ...datensatz }]).catch(() => undefined)
  }
}

/** Nimmt einen Datensatz wieder heraus — etwa eine vorläufige Kennung. */
export async function oertlichEntfernen(
  bereich: Bereich,
  id: string | number,
): Promise<void> {
  const vorher = bestand.get(bereich) ?? []
  bestand.set(
    bereich,
    vorher.filter((d) => String(d.id) !== String(id)),
  )
  melden(bereich)
  if (speicherVerfuegbar()) await entfernen(bereich, [id]).catch(() => undefined)
}

// ── Zugriff aus den Seiten ──────────────────────────────────────────────────

function abonnieren(bereich: Bereich) {
  return (benachrichtigen: () => void) => {
    let menge = hoerer.get(bereich)
    if (!menge) {
      menge = new Set()
      hoerer.set(bereich, menge)
    }
    menge.add(benachrichtigen)
    return () => {
      menge.delete(benachrichtigen)
    }
  }
}

/**
 * Die Datensätze eines Bereichs, so wie sie gerade im Gerät stehen.
 *
 * Beim ersten Aufruf ist die Liste leer und füllt sich, sobald der Bestand
 * geladen ist — die Seite rendert also sofort und wächst nach, statt auf ein
 * Ladezeichen zu warten.
 */
export function useBestand<T = Datensatz>(bereich: Bereich): T[] {
  const anmelden = useMemo(() => abonnieren(bereich), [bereich])
  const lesen = useCallback(() => bestand.get(bereich) ?? LEER, [bereich])
  return useSyncExternalStore(anmelden, lesen, () => LEER) as T[]
}

/** Ein einzelner Datensatz. */
export function useDatensatz<T = Datensatz>(
  bereich: Bereich,
  id: string | number | undefined,
): T | undefined {
  const alle = useBestand<Datensatz>(bereich)
  return useMemo(
    () => (id === undefined ? undefined : alle.find((d) => String(d.id) === String(id))),
    [alle, id],
  ) as T | undefined
}

/** Der Rahmen: Einstellungen, die eine Seite zum Rendern braucht. */
export function useRahmen(): Rahmen {
  const anmelden = useCallback((benachrichtigen: () => void) => {
    rahmenHoerer.add(benachrichtigen)
    return () => {
      rahmenHoerer.delete(benachrichtigen)
    }
  }, [])
  return useSyncExternalStore(
    anmelden,
    () => rahmen,
    () => RAHMEN_LEER,
  )
}

/** Zustand des Abgleichs — für die Hinweisleiste über den Seiten. */
export function useAbgleich(): AbgleichZustand {
  const anmelden = useCallback((benachrichtigen: () => void) => {
    zustandsHoerer.add(benachrichtigen)
    return () => {
      zustandsHoerer.delete(benachrichtigen)
    }
  }, [])
  const ruhend: AbgleichZustand = useMemo(
    () => ({ laeuft: false, stand: null, erreichbar: true, fehler: null, bereit: false }),
    [],
  )
  return useSyncExternalStore(
    anmelden,
    () => zustand,
    () => ruhend,
  )
}
