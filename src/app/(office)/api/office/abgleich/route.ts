import { NextResponse } from 'next/server'

import {
  ALLE_BEREICHE,
  BEREICHE,
  type Bereich,
  bereichErlaubt,
  GRABSTEIN_TAGE,
  istBereich,
  neuerStand,
} from '../../../../../lib/bereiche'
import { payloadClient } from '../../../../../lib/data'
import { repoZerlegen } from '../../../../../lib/fehlermeldung'
import { firmenAngaben, getIntegrations } from '../../../../../lib/settings'
import { darf, rechteFuer } from '../../../../../lib/wache'

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
async function rahmen(
  payload: Awaited<ReturnType<typeof payloadClient>>,
  benutzer: { email?: string; username?: string; name?: string; neuerungGesehen?: number | null },
  rechte: string[],
) {
  const rahmen = {
    // Ohne E-Mail zeigt die Oberfläche den Benutzernamen — irgendetwas muss
    // dastehen, sonst begrüßt die Einstellungsseite ein leeres „Angemeldet als".
    benutzer: { email: benutzer.email || benutzer.username || '', name: benutzer.name ?? '' },
    kiVerfuegbar: false,
    /*
     * Ob ein Fehler von hier aus gemeldet werden kann. Der Knopf hängt daran —
     * ohne hinterlegtes Zugangswort führte er ins Leere, und ein Knopf, der
     * beim Antippen „nicht eingerichtet" sagt, ist schlimmer als keiner.
     */
    meldenMoeglich: false,
    stundensatz: 65,
    wunschaufschlag: 40,
    // Wie voll eine Woche ist, rechnet die Seite im Gerät — dafür muss die
    // Kapazität mit hinein
    wochenstunden: 30,
    firma: { siret: '', vatId: '', iban: '' },
    platzFreigebenNachTagen: 21,
    // Ob die Anmeldung bei der Plattform erledigt ist — die Übersicht
    // erinnert daran, solange sie es nicht ist
    erechnungStand: 'offen',
    /*
     * Die Rechte kommen mit ins Gerät, damit die Navigation auch ohne Netz
     * weiß, was sie zeigen darf. Sie sind kein Schutz — der sitzt an den
     * Schnittstellen —, sondern eine Frage der Ordnung: Ein Punkt, der beim
     * Antippen „nicht erlaubt" sagt, ist ein Versprechen, das keines war.
     */
    rechte,
    /*
     * Bis wohin die Neuerungen gelesen sind — daran hängt der Banner.
     *
     * Aus dem angemeldeten Konto und nicht aus einer eigenen Abfrage: Payload
     * gibt den Datensatz bei der Anmeldung ohnehin heraus, und der Abgleich
     * läuft oft genug, dass eine Abfrage mehr je Aufruf sich lohnen müsste.
     */
    neuerungGesehen: Number(benutzer.neuerungGesehen ?? 0),
  }
  try {
    const integrationen = await getIntegrations(payload)
    rahmen.kiVerfuegbar = Boolean(integrationen.anthropic.apiKey)
    rahmen.meldenMoeglich = Boolean(
      integrationen.github.token && repoZerlegen(integrationen.github.repository),
    )
    // Die Frage nach dem Werkstattplatz stellt das Gerät selbst — also muss
    // die Frist mit ins Gerät, sonst steht sie ohne Netz auf der Voreinstellung
    const ziele = (await payload.findGlobal({ slug: 'integrations', depth: 0 })) as {
      zahlungsziele?: { platzFreigebenNachTagen?: number | null } | null
      erechnung?: { stand?: string | null } | null
    }
    rahmen.platzFreigebenNachTagen = ziele?.zahlungsziele?.platzFreigebenNachTagen ?? 21
    rahmen.erechnungStand = ziele?.erechnung?.stand ?? 'offen'
  } catch {
    // Ohne KI läuft das Büro auch
  }
  try {
    const einstellungen = (await payload.findGlobal({ slug: 'site-settings', depth: 0 })) as {
      craft?: {
        hourlyRate?: number | null
        targetMargin?: number | null
        weeklyHours?: number | null
      } | null
    }
    rahmen.stundensatz = einstellungen?.craft?.hourlyRate ?? 65
    rahmen.wunschaufschlag = einstellungen?.craft?.targetMargin ?? 40
    rahmen.wochenstunden = einstellungen?.craft?.weeklyHours ?? 30
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
  if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
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

  const rechte = (await rechteFuer(payload, user)) as string[]

  for (const bereich of nurBereiche) {
    /*
     * Bereiche, für die das Recht fehlt, werden nicht weggelassen, sondern
     * leer und mit `voll` beantwortet: So wirft das Gerät auch den Bestand
     * weg, den es aus Zeiten mit mehr Rechten noch hält. Ein weggelassener
     * Bereich bliebe dort einfach liegen — entzogen wäre dann nur der
     * Nachschub, nicht das Wissen.
     */
    if (!bereichErlaubt(bereich, rechte)) {
      vollstaendig.push(bereich)
      antwort[bereich] = { geaendert: [], geloescht: [], stand: jetzt, mehr: false }
      continue
    }
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
    /*
     * Der neue Stand liegt bewusst eine Minute zurück (siehe `neuerStand`).
     *
     * Hier stand vorher schlicht `jetzt` — und damit ein Zeitpunkt, der jünger
     * sein konnte als eine Zeile, die im selben Augenblick noch in einer
     * offenen Transaktion steckte. Diese Zeile kam dann nie wieder mit.
     *
     * Bei einem vollen Paket zählt weiter der letzte gelieferte Datensatz —
     * sonst überspränge die nächste Frage alles, was nicht mitkam.
     */
    const letzter = docs[docs.length - 1] as { updatedAt?: string } | undefined
    const stand = neuerStand(jetzt, letzter?.updatedAt, mehr)

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
    rahmen: await rahmen(
      payload,
      user as { email?: string; username?: string; name?: string; neuerungGesehen?: number | null },
      rechte,
    ),
  })
}
