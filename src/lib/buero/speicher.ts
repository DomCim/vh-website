import { ALLE_BEREICHE, type Bereich } from '../bereiche'

/**
 * Der Bestand des Büros im Gerät.
 *
 * IndexedDB ist der dauerhafte Teil: Was hier liegt, überlebt das Schließen
 * der App, einen Neustart des Handys und vor allem den Weg in die Werkstatt,
 * wo das Netz aufhört. Gelesen wird im Betrieb nicht von hier, sondern aus
 * dem Arbeitsspeicher (siehe bestand.ts) — diese Datei füllt ihn beim Start
 * und schreibt jede Änderung mit.
 *
 * Absichtlich ohne fremde Bibliothek: Gebraucht werden fünf Handgriffe, und
 * die kosten weniger Zeilen, als eine Abhängigkeit an Erklärung braucht.
 */

const NAME = 'vh-buero'

/** Merkzettel: Abgleichsstände, zuletzt angemeldeter Benutzer und dergleichen. */
export const MERKZETTEL = 'merkzettel'

/** Noch nicht abgeschickte Änderungen. */
export const WARTESCHLANGE = 'warteschlange'

const BEHAELTER = [...ALLE_BEREICHE, MERKZETTEL, WARTESCHLANGE]

let offen: Promise<IDBDatabase> | null = null

/**
 * Nach dem Abmelden bleibt der Speicher zu.
 *
 * Ohne diese Sperre könnte ein Abgleich, der beim Abmelden gerade unterwegs
 * war, die Datenbank eine Wimper später wieder öffnen — und dann scheitert das
 * Löschen, weil eine Verbindung offen ist. Zurück blieben Umsätze und Belege
 * auf einem Gerät, an dem sich jemand abgemeldet hat. Aufgemacht wird erst
 * wieder beim Anmelden (siehe `speicherFreigeben`).
 */
let gesperrt = false

export function speicherVerfuegbar(): boolean {
  return typeof indexedDB !== 'undefined'
}

function alsVersprechen<T>(anfrage: IDBRequest<T>): Promise<T> {
  return new Promise((fertig, fehler) => {
    anfrage.onsuccess = () => fertig(anfrage.result)
    anfrage.onerror = () => fehler(anfrage.error)
  })
}

/**
 * Öffnet die Datenbank und legt fehlende Behälter an.
 *
 * Die Fassung wird nicht von Hand hochgezählt: Kommt ein Bereich dazu, fehlt
 * beim Öffnen sein Behälter, und dann wird einmal mit der nächsten Fassung
 * neu geöffnet. So bleibt eine neue Zeile in bereiche.ts wirklich eine Zeile.
 */
export async function datenbank(): Promise<IDBDatabase> {
  if (gesperrt) throw new Error('Speicher ist nach dem Abmelden zu')
  if (!speicherVerfuegbar()) throw new Error('Kein Speicher im Gerät')
  if (offen) return offen

  offen = (async () => {
    let db = await alsVersprechen(indexedDB.open(NAME))
    const fehlt = BEHAELTER.filter((b) => !db.objectStoreNames.contains(b))

    if (fehlt.length) {
      const fassung = db.version + 1
      db.close()
      const anfrage = indexedDB.open(NAME, fassung)
      anfrage.onupgradeneeded = () => {
        const neu = anfrage.result
        for (const behaelter of BEHAELTER) {
          if (neu.objectStoreNames.contains(behaelter)) continue
          if (behaelter === WARTESCHLANGE) {
            neu.createObjectStore(behaelter, { keyPath: 'nummer', autoIncrement: true })
          } else if (behaelter === MERKZETTEL) {
            neu.createObjectStore(behaelter)
          } else {
            neu.createObjectStore(behaelter, { keyPath: 'id' })
          }
        }
      }
      db = await alsVersprechen(anfrage)
    }

    // Räumt eine andere Lasche die Datenbank hoch, muss diese hier weichen
    db.onversionchange = () => {
      db.close()
      offen = null
    }
    return db
  })()

  try {
    return await offen
  } catch (err) {
    offen = null
    throw err
  }
}

function geschaeft(db: IDBDatabase, behaelter: string, art: IDBTransactionMode) {
  return db.transaction(behaelter, art).objectStore(behaelter)
}

/** Alle Datensätze eines Bereichs. */
export async function alleLesen<T = Record<string, unknown>>(bereich: Bereich): Promise<T[]> {
  const db = await datenbank()
  return alsVersprechen(geschaeft(db, bereich, 'readonly').getAll() as IDBRequest<T[]>)
}

/** Legt Datensätze ab — vorhandene werden überschrieben. */
export async function schreiben(
  bereich: Bereich,
  datensaetze: Record<string, unknown>[],
): Promise<void> {
  if (!datensaetze.length) return
  const db = await datenbank()
  const vorgang = db.transaction(bereich, 'readwrite')
  const behaelter = vorgang.objectStore(bereich)
  for (const datensatz of datensaetze) behaelter.put(datensatz)
  await new Promise<void>((fertig, fehler) => {
    vorgang.oncomplete = () => fertig()
    vorgang.onerror = () => fehler(vorgang.error)
  })
}

/** Entfernt Datensätze anhand ihrer Kennung. */
export async function entfernen(bereich: Bereich, kennungen: (string | number)[]): Promise<void> {
  if (!kennungen.length) return
  const db = await datenbank()
  const vorgang = db.transaction(bereich, 'readwrite')
  const behaelter = vorgang.objectStore(bereich)
  for (const kennung of kennungen) {
    behaelter.delete(kennung)
    // Kennungen kommen als Text vom Server, liegen aber als Zahl im Behälter
    const alsZahl = Number(kennung)
    if (!Number.isNaN(alsZahl) && String(alsZahl) === String(kennung)) {
      behaelter.delete(alsZahl)
    }
  }
  await new Promise<void>((fertig, fehler) => {
    vorgang.oncomplete = () => fertig()
    vorgang.onerror = () => fehler(vorgang.error)
  })
}

/** Leert einen Bereich — nötig, wenn der Stand zu alt für Grabsteine ist. */
export async function leeren(bereich: Bereich): Promise<void> {
  const db = await datenbank()
  const vorgang = db.transaction(bereich, 'readwrite')
  vorgang.objectStore(bereich).clear()
  await new Promise<void>((fertig, fehler) => {
    vorgang.oncomplete = () => fertig()
    vorgang.onerror = () => fehler(vorgang.error)
  })
}

export async function merkenLesen<T = unknown>(schluessel: string): Promise<T | undefined> {
  const db = await datenbank()
  return alsVersprechen(
    geschaeft(db, MERKZETTEL, 'readonly').get(schluessel) as IDBRequest<T | undefined>,
  )
}

export async function merkenSchreiben(schluessel: string, wert: unknown): Promise<void> {
  const db = await datenbank()
  const vorgang = db.transaction(MERKZETTEL, 'readwrite')
  vorgang.objectStore(MERKZETTEL).put(wert, schluessel)
  await new Promise<void>((fertig, fehler) => {
    vorgang.oncomplete = () => fertig()
    vorgang.onerror = () => fehler(vorgang.error)
  })
}

/**
 * Wirft alles weg.
 *
 * Beim Abmelden zwingend: Sonst lägen Umsätze, Belege und Kundendaten
 * weiterhin im Gerät, obwohl niemand mehr angemeldet ist.
 */
export async function allesVergessen(): Promise<void> {
  if (!speicherVerfuegbar()) return
  // Erst zusperren, dann leeren — sonst macht ein laufender Abgleich wieder auf
  gesperrt = true
  try {
    // Die bestehende Verbindung schließen, ohne über `datenbank()` zu gehen:
    // die ist jetzt zu, und ohne Schließen bliebe das Löschen blockiert.
    const db = await offen
    db?.close()
  } catch {
    // Auch eine nie geöffnete Datenbank darf gelöscht werden
  }
  offen = null
  await new Promise<void>((fertig) => {
    const anfrage = indexedDB.deleteDatabase(NAME)
    anfrage.onsuccess = () => fertig()
    anfrage.onerror = () => fertig()
    // Hält eine andere Lasche die Datenbank fest, warten wir nicht ewig
    anfrage.onblocked = () => fertig()
  })
}

/** Beim Anmelden wieder aufschließen. */
export function speicherFreigeben(): void {
  gesperrt = false
}
