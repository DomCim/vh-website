'use client'

import { useCallback, useSyncExternalStore } from 'react'

import type { Bereich } from '../bereiche'
import { abgleichen, oertlichEntfernen, oertlichMerken } from './bestand'
import {
  WARTESCHLANGE,
  datenbank,
  merkenLesen,
  merkenSchreiben,
  speicherVerfuegbar,
} from './speicher'

/**
 * Die Warteschlange: Schreiben, wenn kein Netz da ist.
 *
 * Lesen ohne Netz war der halbe Weg. Der Rest ist der, der im Alltag zählt:
 * Vincent steht in der Werkstatt, fotografiert einen Beleg, stoppt die Zeit,
 * zählt die Inventur — und das Netz ist weg. Bisher stand dann „Verbindung
 * fehlgeschlagen" und die Eingabe war verloren.
 *
 * Jetzt geht jede Änderung zwei Wege zugleich: sofort in den Bestand im Gerät,
 * damit sie augenblicklich dasteht, und in diese Schlange, die sie abschickt,
 * sobald wieder Netz da ist. Der Reihe nach — die Reihenfolge ist wichtig,
 * denn ein Beleg kann auf einen Lieferanten verweisen, den es beim Server noch
 * gar nicht gibt.
 *
 * Für genau diesen Fall bekommen neue Datensätze eine vorläufige Kennung
 * (`neu:…`). Sobald der Server seine richtige vergeben hat, werden alle noch
 * wartenden Einträge umgeschrieben.
 */

export type Wartend = {
  nummer?: number
  /** Wohin die Änderung geht, z.B. /api/office/partner */
  pfad: string
  bereich: Bereich
  koerper: Record<string, unknown>
  /**
   * Eine mitzuschickende Datei — das Foto eines Belegs etwa. Blobs lassen sich
   * in IndexedDB ablegen, damit übersteht auch ein Beleg aus der Werkstatt die
   * Zeit ohne Netz.
   */
  datei?: { name: string; blob: Blob }
  /** Gesetzt, wenn dieser Eintrag einen neuen Datensatz anlegt */
  vorlaeufigeId?: string
  versuche: number
  /** Dauerhaft abgelehnt — hier muss ein Mensch nachsehen */
  fehler?: string | null
  zeit: number
}

type Zustand = { wartend: number; fehlerhaft: number; laeuft: boolean }

/** Feste Fassung fürs Rendern auf dem Server — ein neues Objekt je Aufruf triebe React in eine Schleife. */
const RUHEND: Zustand = { wartend: 0, fehlerhaft: 0, laeuft: false }

let zustand: Zustand = RUHEND
const hoerer = new Set<() => void>()

function zustandSetzen(neu: Partial<Zustand>) {
  zustand = { ...zustand, ...neu }
  for (const h of hoerer) h()
}

const vorlaeufig = () => `neu:${Math.random().toString(36).slice(2, 10)}`

// ── Zugriff auf den Behälter ────────────────────────────────────────────────

async function alleWartend(): Promise<Wartend[]> {
  if (!speicherVerfuegbar()) return []
  const db = await datenbank()
  return new Promise((fertig) => {
    const anfrage = db
      .transaction(WARTESCHLANGE, 'readonly')
      .objectStore(WARTESCHLANGE)
      .getAll() as IDBRequest<Wartend[]>
    anfrage.onsuccess = () => fertig(anfrage.result)
    anfrage.onerror = () => fertig([])
  })
}

async function ablegen(eintrag: Wartend): Promise<void> {
  const db = await datenbank()
  const vorgang = db.transaction(WARTESCHLANGE, 'readwrite')
  vorgang.objectStore(WARTESCHLANGE).put(eintrag)
  await new Promise<void>((fertig) => {
    vorgang.oncomplete = () => fertig()
    vorgang.onerror = () => fertig()
  })
}

async function wegnehmen(nummer: number): Promise<void> {
  const db = await datenbank()
  const vorgang = db.transaction(WARTESCHLANGE, 'readwrite')
  vorgang.objectStore(WARTESCHLANGE).delete(nummer)
  await new Promise<void>((fertig) => {
    vorgang.oncomplete = () => fertig()
    vorgang.onerror = () => fertig()
  })
}

async function zaehlenUndMelden(): Promise<Wartend[]> {
  const alle = await alleWartend()
  zustandSetzen({
    wartend: alle.filter((e) => !e.fehler).length,
    fehlerhaft: alle.filter((e) => e.fehler).length,
  })
  return alle
}

// ── Vorläufige Kennungen ────────────────────────────────────────────────────

async function abbildungLesen(): Promise<Record<string, string | number>> {
  return (await merkenLesen<Record<string, string | number>>('abbildung')) ?? {}
}

/** Ersetzt vorläufige Kennungen überall im Körper — auch tief in Listen. */
function ersetzen(wert: unknown, abbildung: Record<string, string | number>): unknown {
  if (typeof wert === 'string' && wert.startsWith('neu:')) return abbildung[wert] ?? wert
  if (Array.isArray(wert)) return wert.map((w) => ersetzen(w, abbildung))
  if (wert && typeof wert === 'object') {
    const neu: Record<string, unknown> = {}
    for (const [schluessel, w] of Object.entries(wert as Record<string, unknown>)) {
      neu[schluessel] = ersetzen(w, abbildung)
    }
    return neu
  }
  return wert
}

// ── Abschicken ──────────────────────────────────────────────────────────────

/** Der Server hat die Änderung inhaltlich abgelehnt — das gehört ins Formular. */
export class AbsendeFehler extends Error {
  status: number
  daten: Record<string, unknown>

  constructor(status: number, daten: Record<string, unknown>) {
    super(`Abgelehnt (${status})`)
    this.name = 'AbsendeFehler'
    this.status = status
    this.daten = daten
  }
}

export type Ergebnis = {
  /** Unter dieser Kennung liegt der Datensatz jetzt im Gerät */
  id: string | number
  /** Ist die Änderung schon beim Server? */
  sofort: boolean
  /** Was der Server geantwortet hat — nur bei `sofort` */
  antwort?: Record<string, unknown>
}

/**
 * Nimmt eine Änderung entgegen.
 *
 * Solange Netz da ist und nichts wartet, geht sie geradewegs zum Server: Nur
 * so bleiben dessen Einwände erhalten („für Versendet wird eine Sendungsnummer
 * gebraucht") und die Nummern, die er vergibt. Erst wenn die Leitung fehlt,
 * kommt die Schlange ins Spiel.
 *
 * Wartet dagegen schon etwas, geht auch das Neue hinten hinein — sonst
 * überholte es, worauf es womöglich aufbaut.
 *
 * Im Bestand des Geräts steht die Änderung in jedem Fall sofort.
 */
export async function absenden(auftrag: {
  pfad: string
  bereich: Bereich
  koerper: Record<string, unknown>
  /** Eine mitzuschickende Datei — dann geht es als Formular statt als JSON raus */
  datei?: { name: string; blob: Blob }
  /** Wie der Datensatz im Bestand aussehen soll, bis der Server geantwortet hat */
  vorschau?: Record<string, unknown>
}): Promise<Ergebnis> {
  const vorhandeneId = auftrag.koerper.id as string | number | undefined
  const vorschau = { ...(auftrag.vorschau ?? auftrag.koerper) }

  const merken = (id: string | number) =>
    oertlichMerken(auftrag.bereich, { ...vorschau, id, updatedAt: new Date().toISOString() })

  const kannDirekt =
    (typeof navigator === 'undefined' || navigator.onLine) && zustand.wartend === 0

  if (kannDirekt) {
    let antwort: Response
    try {
      antwort = await verschicken(auftrag)
    } catch {
      // Leitung weg — dann eben über die Schlange
      return einreihen(auftrag, vorhandeneId, merken)
    }

    const daten = (await antwort.json().catch(() => ({}))) as Record<string, unknown>
    if (!antwort.ok) throw new AbsendeFehler(antwort.status, daten)

    const id = (daten.id as string | number) ?? vorhandeneId ?? ''
    if (id !== '') await merken(id)
    void abgleichen([auftrag.bereich])
    return { id, sofort: true, antwort: daten }
  }

  return einreihen(auftrag, vorhandeneId, merken)
}

/** Schickt einen Eintrag ab — als JSON, oder als Formular, wenn eine Datei dabei ist. */
function verschicken(eintrag: {
  pfad: string
  koerper: Record<string, unknown>
  datei?: { name: string; blob: Blob }
}): Promise<Response> {
  if (eintrag.datei) {
    const formular = new FormData()
    formular.append('datei', eintrag.datei.blob, eintrag.datei.name)
    for (const [schluessel, wert] of Object.entries(eintrag.koerper)) {
      if (wert != null) formular.append(schluessel, String(wert))
    }
    return fetch(eintrag.pfad, { method: 'POST', body: formular, credentials: 'include' })
  }

  return fetch(eintrag.pfad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(eintrag.koerper),
  })
}

async function einreihen(
  auftrag: {
    pfad: string
    bereich: Bereich
    koerper: Record<string, unknown>
    datei?: { name: string; blob: Blob }
  },
  vorhandeneId: string | number | undefined,
  merken: (id: string | number) => Promise<void>,
): Promise<Ergebnis> {
  const id = vorhandeneId ?? vorlaeufig()

  // Erst sichtbar machen, dann einreihen — in dieser Reihenfolge, damit die
  // Eingabe auch dann dasteht, wenn beim Ablegen etwas schiefgeht.
  await merken(id)

  if (!speicherVerfuegbar()) {
    // Ohne Speicher im Gerät lässt sich nichts aufheben; dann muss es wehtun
    throw new AbsendeFehler(0, { error: 'kein-speicher' })
  }

  await ablegen({
    pfad: auftrag.pfad,
    bereich: auftrag.bereich,
    koerper: { ...auftrag.koerper },
    datei: auftrag.datei,
    vorlaeufigeId: vorhandeneId ? undefined : String(id),
    versuche: 0,
    zeit: Date.now(),
  })
  await zaehlenUndMelden()
  void abarbeiten()

  return { id, sofort: false }
}

let laeuft = false
let naechsterVersuch: ReturnType<typeof setTimeout> | null = null

/** Abstand zwischen zwei Anläufen, solange noch etwas liegt. */
const NACHFASSEN_MS = 15_000

/**
 * Fasst von selbst nach, solange noch etwas liegt.
 *
 * Sich auf das `online`-Ereignis zu verlassen wäre zu wenig: Ein Handy am Rand
 * der Funkzelle gilt dem Browser oft durchgehend als „online", während die
 * Anfragen reihenweise scheitern — und umgekehrt meldet nicht jeder Browser
 * zuverlässig, wenn das Netz zurück ist. Also wird schlicht in ruhigem Takt
 * wieder versucht. Ein Anlauf kostet einen Blick in den Speicher und
 * höchstens eine Anfrage.
 */
function spaeterNochmal() {
  if (naechsterVersuch || !zustand.wartend) return
  naechsterVersuch = setTimeout(() => {
    naechsterVersuch = null
    void abarbeiten()
  }, NACHFASSEN_MS)
}

/**
 * Arbeitet die Schlange der Reihe nach ab.
 *
 * Bricht beim ersten Netzfehler ab: Was danach kommt, könnte auf dem
 * Abgebrochenen aufbauen. Ein dauerhaft abgelehnter Eintrag (der Server sagt
 * „so nicht") bleibt dagegen liegen und wird angezeigt — wegwerfen würde die
 * Arbeit vernichten, endlos wiederholen brächte nichts.
 */
export async function abarbeiten(): Promise<void> {
  if (!speicherVerfuegbar()) return
  // Läuft schon einer, oder ist gerade kein Netz da: später nochmal. Das
  // Nachfassen hier nicht zu vergessen ist wichtig — sonst bliebe die Schlange
  // liegen, bis jemand die App neu öffnet.
  if (laeuft || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    spaeterNochmal()
    return
  }

  laeuft = true
  zustandSetzen({ laeuft: true })
  try {
    // Nach dem Abmelden ist der Speicher zu; dann gibt es hier nichts zu tun
    const alle = (await alleWartend()).sort((a, b) => (a.nummer ?? 0) - (b.nummer ?? 0))
    let abbildung = await abbildungLesen()
    const beruehrt = new Set<Bereich>()

    for (const eintrag of alle) {
      if (eintrag.fehler) continue

      const koerper = ersetzen(eintrag.koerper, abbildung) as Record<string, unknown>

      let antwort: Response
      try {
        antwort = await verschicken({ pfad: eintrag.pfad, koerper, datei: eintrag.datei })
      } catch {
        // Netz weg — später weiter, die Reihenfolge bleibt gewahrt
        break
      }

      if (antwort.status === 401 || antwort.status === 403) {
        // Anmeldung abgelaufen: nicht als Fehler vermerken, sonst wäre die
        // Arbeit nach dem nächsten Anmelden fälschlich als kaputt markiert
        break
      }

      if (!antwort.ok) {
        eintrag.fehler = `Vom Server abgelehnt (${antwort.status})`
        eintrag.versuche += 1
        await ablegen(eintrag)
        continue
      }

      const ergebnis = (await antwort.json().catch(() => ({}))) as { id?: string | number }

      if (eintrag.vorlaeufigeId && ergebnis.id != null) {
        abbildung = { ...abbildung, [eintrag.vorlaeufigeId]: ergebnis.id }
        await merkenSchreiben('abbildung', abbildung)
        // Die vorläufige Fassung fliegt raus; die richtige holt der Abgleich
        await oertlichEntfernen(eintrag.bereich, eintrag.vorlaeufigeId)
      }

      beruehrt.add(eintrag.bereich)
      if (eintrag.nummer != null) await wegnehmen(eintrag.nummer)
    }

    await zaehlenUndMelden()
    if (beruehrt.size) await abgleichen([...beruehrt])
  } catch {
    // Etwa: der Speicher wurde beim Abmelden zugesperrt
  } finally {
    laeuft = false
    zustandSetzen({ laeuft: false })
    spaeterNochmal()
  }
}

/** Wirft einen dauerhaft abgelehnten Eintrag weg. */
export async function verwerfen(nummer: number): Promise<void> {
  await wegnehmen(nummer)
  await zaehlenUndMelden()
}

/** Nimmt einen abgelehnten Eintrag noch einmal in die Reihe. */
export async function nochmalVersuchen(nummer: number): Promise<void> {
  const alle = await alleWartend()
  const eintrag = alle.find((e) => e.nummer === nummer)
  if (!eintrag) return
  eintrag.fehler = null
  await ablegen(eintrag)
  await zaehlenUndMelden()
  void abarbeiten()
}

/** Was liegen geblieben ist — für die Anzeige im Büro. */
export async function haengengebliebene(): Promise<Wartend[]> {
  return (await alleWartend()).filter((e) => e.fehler)
}

/** Beim Start einmal nachzählen, damit die Anzeige stimmt. */
export async function warteschlangeLaden(): Promise<void> {
  await zaehlenUndMelden().catch(() => undefined)
  spaeterNochmal()
}

/** Für die Anzeige: wie viel liegt noch herum? */
export function useWarteschlange(): Zustand {
  const anmelden = useCallback((benachrichtigen: () => void) => {
    hoerer.add(benachrichtigen)
    return () => {
      hoerer.delete(benachrichtigen)
    }
  }, [])
  return useSyncExternalStore(
    anmelden,
    () => zustand,
    () => RUHEND,
  )
}
