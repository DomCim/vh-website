import type { Payload } from 'payload'

import { payloadClient } from './data'
import { type Recht, hatRecht, rechteVon } from './rechte'

/**
 * Eine Wache für alle Büro-Schnittstellen.
 *
 * Vorher stand in jedem der rund dreißig Endpunkte dieselbe Zeile:
 *
 *     if (!user || user.role !== 'inhaber') return 403
 *
 * Das war nicht falsch, aber es war dreißigmal dieselbe Entscheidung an
 * dreißig Orten. Wer daran etwas ändern wollte — und mit den Rollen wollten
 * wir —, musste dreißig Stellen finden und durfte keine übersehen; die eine
 * vergessene wäre ein offenes Tor gewesen, das niemandem auffällt.
 *
 * Jetzt sagt jeder Endpunkt, welches **Recht** er verlangt, und die Antwort
 * darauf steht an einer Stelle.
 *
 * Die Rolle wird dabei nachgeladen: `payload.auth` liefert am Benutzer nur
 * deren Kennung, und aus einer Kennung lässt sich kein Recht ablesen.
 */
export type Wachdienst =
  | { erlaubt: true; benutzer: { id: number | string; email: string }; payload: Payload }
  | { erlaubt: false; antwort: Response }

/** Die Rolle am Benutzer auflösen — aus der Kennung wird ein Datensatz. */
async function mitRolle(payload: Payload, user: unknown) {
  const b = user as { rolle?: unknown }
  if (!b?.rolle || typeof b.rolle === 'object') return user

  try {
    const rolle = await payload.findByID({
      collection: 'roles',
      id: b.rolle as number | string,
      overrideAccess: true,
    })
    return { ...(user as object), rolle }
  } catch {
    // Rolle gelöscht oder unlesbar: Dann zählt nur noch, was sonst am Konto
    // steht — im Zweifel nichts, und das ist die richtige Richtung.
    return user
  }
}

export async function wache(req: Request, recht: Recht): Promise<Wachdienst> {
  const payload = await payloadClient()
  const { user: roh } = await payload.auth({ headers: req.headers })
  const user = roh ? await mitRolle(payload, roh) : null

  if (!user) {
    return {
      erlaubt: false,
      antwort: Response.json({ error: 'nicht-angemeldet' }, { status: 401 }),
    }
  }

  if (!hatRecht(user, recht)) {
    /*
     * 403 und nicht 404: Wer angemeldet ist, soll erfahren, dass es die Sache
     * gibt und ihm nur das Recht fehlt. Ein verstecktes „gibt es nicht" führt
     * dazu, dass jemand eine halbe Stunde einen Fehler sucht, den es nicht
     * gibt — und beim Kollegen nachfragt statt beim Chef.
     */
    return {
      erlaubt: false,
      antwort: Response.json({ error: 'nicht-erlaubt', fehlt: recht }, { status: 403 }),
    }
  }

  const b = user as { id: number | string; email: string }
  return { erlaubt: true, benutzer: { id: b.id, email: b.email }, payload }
}

/**
 * Dieselbe Frage, aber ohne die Antwort schon zu formulieren.
 *
 * Die Endpunkte antworten unterschiedlich — mal JSON, mal eine nackte
 * Antwort, mal geben sie `null` an einen eigenen Helfer zurück. Das ist
 * gewachsen und in Ordnung; sie sollen ihre Form behalten. Geändert werden
 * musste nur die Frage, die sie stellen: nicht mehr „ist das der Inhaber?",
 * sondern „darf der das?".
 */
export async function darf(payload: Payload, user: unknown, recht: Recht): Promise<boolean> {
  if (!user) return false
  return hatRecht(await mitRolle(payload, user), recht)
}

/**
 * Alles, was dieser Mensch darf — für die Oberfläche.
 *
 * Dieselbe Auflösung wie bei `darf`, nur einmal für den ganzen Katalog. Die
 * Navigation richtet sich danach; ein Schutz ist es nicht, der sitzt an den
 * Schnittstellen.
 */
export async function rechteFuer(payload: Payload, user: unknown): Promise<Recht[]> {
  if (!user) return []
  return rechteVon(await mitRolle(payload, user))
}
