import { NextResponse } from 'next/server'

import {
  ALLE_BEREICHE,
  BEREICHE,
  type Bereich,
  GRABSTEIN_TAGE,
  istBereich,
} from '../../../../../lib/bereiche'
import { payloadClient } from '../../../../../lib/data'
import { firmenAngaben, getIntegrations } from '../../../../../lib/settings'

export const dynamic = 'force-dynamic'

/**
 * Der Abgleich zwischen Server und Gerät.
 *
 * Das Büro führt seinen Bestand im Gerät mit, damit es auch ohne Netz
 * arbeitsfähig bleibt. Diese Stelle beantwortet die eine Frage, die dafür
 * nötig ist: „Was hat sich in jedem Bereich seit meinem letzten Stand getan?"
 *
 * Geantwortet wird je Bereich mit drei Dingen — was sich geändert hat, was
 * gelöscht wurde (siehe collections/Deletions.ts) und dem neuen Stand. Ist
 * mehr da, als in eine Antwort passt, sagt `mehr: true`, und das Gerät fragt
 * mit dem neuen Stand gleich noch einmal. So bleibt jede einzelne Antwort
 * klein genug für eine wacklige Leitung in der Werkstatt.
 *
 * Wer länger weg war als die Grabsteine aufbewahrt werden, bekommt
 * `voll: true` — dann wirft das Gerät seinen Bestand weg und holt ihn neu.
 * Das ist billiger, als Grabsteine für immer aufzuheben.
 */

/** Datensätze je Bereich und Antwort. Reicht für einen Betrieb dieser Größe. */
const PAKET = 200

type BereichsAntwort = {
  geaendert: Record<string, unknown>[]
  geloescht: string[]
  stand: string
  mehr: boolean
}

/**
 * Der Rahmen: was die Büro-Seiten außer den Datensätzen noch brauchen.
 *
 * Kommt bei jedem Abgleich mit, damit auch das im Gerät liegt — sonst wüsste
 * eine Seite ohne Netz etwa nicht, ob der KI-Zugang eingerichtet ist, und
 * bliebe bei einem ausgegrauten Knopf stehen, ohne zu sagen warum.
 */
async function rahmen(payload: Awaited<ReturnType<typeof payloadClient>>) {
  const rahmen = {
    kiVerfuegbar: false,
    stundensatz: 65,
    firma: { siret: '', vatId: '', iban: '' },
  }
  try {
    const integrationen = await getIntegrations(payload)
    rahmen.kiVerfuegbar = Boolean(integrationen.anthropic.apiKey)
  } catch {
    // Ohne KI läuft das Büro auch
  }
  try {
    const einstellungen = (await payload.findGlobal({ slug: 'site-settings', depth: 0 })) as {
      craft?: { hourlyRate?: number | null } | null
    }
    rahmen.stundensatz = einstellungen?.craft?.hourlyRate ?? 65
    const angaben = firmenAngaben(einstellungen)
    rahmen.firma = {
      siret: angaben.siret ?? '',
      vatId: angaben.vatId ?? '',
      iban: angaben.iban ?? '',
    }
  } catch {
    // Voreinstellung genügt
  }
  return rahmen
}

export async function POST(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  let staende: Record<string, string | null> = {}
  let nurBereiche: Bereich[] = ALLE_BEREICHE
  try {
    const koerper = (await req.json()) as {
      staende?: Record<string, string | null>
      bereiche?: string[]
    }
    staende = koerper.staende ?? {}
    if (Array.isArray(koerper.bereiche)) {
      nurBereiche = koerper.bereiche.filter(istBereich)
    }
  } catch {
    // Ohne Angaben wird alles von vorn geholt
  }

  const jetzt = new Date().toISOString()
  const grabsteinGrenze = new Date(Date.now() - GRABSTEIN_TAGE * 24 * 3600 * 1000)

  const antwort: Record<string, BereichsAntwort> = {}
  const vollstaendig: string[] = []

  for (const bereich of nurBereiche) {
    const sammlung = BEREICHE[bereich]
    const seitRoh = staende[bereich]
    const seit = seitRoh ? new Date(seitRoh) : null

    // Zu lange her: Grabsteine könnten fehlen, also lieber alles neu
    const zuAlt = Boolean(seit && seit < grabsteinGrenze)
    const wirklichSeit = zuAlt ? null : seit
    if (zuAlt) vollstaendig.push(bereich)

    const { docs, totalDocs } = await payload.find({
      collection: sammlung,
      where: wirklichSeit
        ? { updatedAt: { greater_than: wirklichSeit.toISOString() } }
        : undefined,
      // Nach Änderungszeitpunkt, damit der neue Stand eindeutig am Ende steht
      sort: 'updatedAt',
      limit: PAKET,
      depth: 0,
      overrideAccess: true,
    })

    let geloescht: string[] = []
    if (wirklichSeit) {
      const { docs: graeber } = await payload.find({
        collection: 'deletions',
        where: {
          and: [
            { bereich: { equals: bereich } },
            { createdAt: { greater_than: wirklichSeit.toISOString() } },
          ],
        },
        sort: 'createdAt',
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      geloescht = graeber.map((g) => String(g.datensatz))
    }

    const mehr = totalDocs > docs.length
    // Bei einem vollen Paket zählt der letzte gelieferte Datensatz als neuer
    // Stand — sonst überspränge die nächste Frage alles, was nicht mitkam.
    const letzter = docs[docs.length - 1] as { updatedAt?: string } | undefined
    const stand = mehr && letzter?.updatedAt ? letzter.updatedAt : jetzt

    antwort[bereich] = {
      geaendert: docs as unknown as Record<string, unknown>[],
      geloescht,
      stand,
      mehr,
    }
  }

  return NextResponse.json({
    zeit: jetzt,
    bereiche: antwort,
    // Diese Bereiche bitte vorher leeren — der bisherige Bestand ist zu alt
    voll: vollstaendig,
    rahmen: await rahmen(payload),
  })
}
