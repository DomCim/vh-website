/**
 * Werkstatt-Auslastung: Wie voll ist eine Woche schon?
 *
 * Bei Einzelfertigung hängt jede Terminzusage genau daran. Der Kalender zeigt,
 * was wann fällig ist — aber nicht, ob die Woche noch etwas verträgt. Gefragt
 * wird am Telefon aber nach dem Termin, und geantwortet wurde bisher aus dem
 * Bauch: „müsste gehen". Das geht ein paarmal gut.
 *
 * Gerechnet wird aus den Aufträgen. Die zugesagte Zeit steht am Auftrag
 * (`plannedMinutes`), die verfügbare in den Einstellungen. Bewusst grob: Eine
 * Woche ist voll oder sie ist es nicht, und ob eine Stunde am Dienstag oder am
 * Donnerstag liegt, entscheidet der Mensch in der Werkstatt.
 *
 * Ohne Payload-Import: Die Seite rechnet im Gerät, damit sie auch ohne Netz
 * dasteht — und der Test rechnet ohne Datenbank.
 */

export type AuslastungsAuftrag = {
  id: number | string
  jobNumber?: string | null
  title?: string | null
  status?: string | null
  startDate?: string | null
  dueDate?: string | null
  plannedMinutes?: number | null
}

export type WochenAnteil = {
  id: number | string
  nummer: string
  titel: string
  stunden: number
}

export type Woche = {
  /** `2026-38` — Jahr und Kalenderwoche, sortierbar */
  schluessel: string
  jahr: number
  woche: number
  /** Montag dieser Woche */
  von: Date
  /** Sonntag dieser Woche */
  bis: Date
  /** Zugesagte Fertigungsstunden */
  stunden: number
  /** Verfügbare Stunden */
  frei: number
  /** Anteil der Kapazität, 1 = voll */
  anteil: number
  auftraege: WochenAnteil[]
}

const TAG = 24 * 60 * 60 * 1000
const runden = (n: number) => Math.round(n * 10) / 10

/** Der Montag der Woche, in der dieser Tag liegt. */
export function montag(datum: Date): Date {
  const d = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate())
  // getDay(): 0 ist Sonntag. Bei uns fängt die Woche am Montag an.
  const versatz = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - versatz)
  return d
}

/**
 * Die Kalenderwoche nach ISO 8601 — die, die auf dem Kalender in der Werkstatt
 * steht.
 *
 * Die Regel dahinter: Die Woche gehört dem Jahr, in dem ihr Donnerstag liegt.
 * Deshalb kann der 31. Dezember in der KW 1 des Folgejahres liegen und der
 * 1. Januar in der KW 52 des vorigen. Wer stattdessen einfach durchzählt,
 * baut sich einmal im Jahr eine Woche, die es nicht gibt.
 */
export function kalenderwoche(datum: Date): { jahr: number; woche: number } {
  const donnerstag = montag(datum)
  donnerstag.setDate(donnerstag.getDate() + 3)
  const jahr = donnerstag.getFullYear()
  const ersterDonnerstag = montag(new Date(jahr, 0, 4))
  ersterDonnerstag.setDate(ersterDonnerstag.getDate() + 3)
  const woche = Math.round((donnerstag.getTime() - ersterDonnerstag.getTime()) / (7 * TAG)) + 1
  return { jahr, woche }
}

/** `2026-38` — sortierbar und als Schlüssel brauchbar. */
export function wochenSchluessel(datum: Date): string {
  const { jahr, woche } = kalenderwoche(datum)
  return `${jahr}-${String(woche).padStart(2, '0')}`
}

/** Zählt für die Auslastung: was noch zu fertigen ist. */
function zaehlt(auftrag: AuslastungsAuftrag): boolean {
  return (
    (auftrag.status === 'geplant' || auftrag.status === 'inFertigung') &&
    Boolean(auftrag.plannedMinutes) &&
    Boolean(auftrag.dueDate)
  )
}

/**
 * Auf welche Wochen sich ein Auftrag verteilt.
 *
 * Steht ein Startdatum da, wird die Zeit gleichmäßig über die Wochen bis zum
 * Termin verteilt — ein Stück, das sechs Wochen in der Werkstatt liegt, füllt
 * nicht die letzte Woche allein. Fehlt der Start, zählt alles in die Woche des
 * Termins: Das ist die Woche, in der es fertig sein muss, und damit die, die
 * es eng macht.
 *
 * Ein Termin, der schon vorbei ist, zählt in die laufende Woche. Er ist ja
 * nicht erledigt, nur überfällig — und die Arbeit steht weiter an.
 */
export function wochenAnteile(
  auftrag: AuslastungsAuftrag,
  ab: Date,
): { schluessel: string; stunden: number }[] {
  const stunden = (auftrag.plannedMinutes ?? 0) / 60
  if (!stunden || !auftrag.dueDate) return []

  const dieseWoche = montag(ab)
  const ende = montag(new Date(auftrag.dueDate))
  const zielWoche = ende < dieseWoche ? dieseWoche : ende

  const beginn = auftrag.startDate ? montag(new Date(auftrag.startDate)) : zielWoche
  const start = beginn < dieseWoche ? dieseWoche : beginn
  if (start > zielWoche) return [{ schluessel: wochenSchluessel(zielWoche), stunden }]

  const anzahl = Math.round((zielWoche.getTime() - start.getTime()) / (7 * TAG)) + 1
  const jeWoche = stunden / anzahl

  const anteile: { schluessel: string; stunden: number }[] = []
  for (let i = 0; i < anzahl; i++) {
    const woche = new Date(start)
    woche.setDate(woche.getDate() + i * 7)
    anteile.push({ schluessel: wochenSchluessel(woche), stunden: jeWoche })
  }
  return anteile
}

/**
 * Die nächsten Wochen mit ihrer Last.
 *
 * Immer alle Wochen des Zeitraums, auch die leeren: Eine Lücke in der Liste
 * wäre genau die Woche, in der noch Platz ist — und die soll man sehen.
 */
export function auslastung(
  auftraege: AuslastungsAuftrag[],
  { stundenProWoche = 30, wochen = 12, ab = new Date() } = {},
): Woche[] {
  const last = new Map<string, WochenAnteil[]>()

  for (const auftrag of auftraege.filter(zaehlt)) {
    for (const anteil of wochenAnteile(auftrag, ab)) {
      const liste = last.get(anteil.schluessel) ?? []
      liste.push({
        id: auftrag.id,
        nummer: auftrag.jobNumber ?? '',
        titel: auftrag.title ?? '',
        stunden: runden(anteil.stunden),
      })
      last.set(anteil.schluessel, liste)
    }
  }

  const ergebnis: Woche[] = []
  const start = montag(ab)
  for (let i = 0; i < wochen; i++) {
    const von = new Date(start)
    von.setDate(von.getDate() + i * 7)
    const bis = new Date(von)
    bis.setDate(bis.getDate() + 6)

    const schluessel = wochenSchluessel(von)
    const { jahr, woche } = kalenderwoche(von)
    const drin = last.get(schluessel) ?? []
    const stunden = runden(drin.reduce((s, a) => s + a.stunden, 0))

    ergebnis.push({
      schluessel,
      jahr,
      woche,
      von,
      bis,
      stunden,
      frei: runden(Math.max(stundenProWoche - stunden, 0)),
      anteil: stundenProWoche > 0 ? stunden / stundenProWoche : 0,
      auftraege: drin.sort((a, b) => b.stunden - a.stunden),
    })
  }
  return ergebnis
}

/**
 * Die erste Woche, in der noch mindestens so viele Stunden frei sind.
 *
 * Das ist die Antwort auf die Frage am Telefon: „Wann könnten Sie das
 * machen?" Kommt nichts zurück, ist der ganze überblickte Zeitraum voll — und
 * dann ist die ehrliche Antwort nicht ein Termin, sondern „im Moment nicht".
 */
export function ersteFreieWoche(wochen: Woche[], gebraucht: number): Woche | null {
  return wochen.find((w) => w.frei >= gebraucht) ?? null
}
