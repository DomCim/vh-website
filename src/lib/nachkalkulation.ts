/**
 * Nachkalkulation: der Blick zurück über abgeschlossene Aufträge.
 *
 * Am Artikel steht die Vorkalkulation, am Auftrag stehen Zeit und Material —
 * beides war da, nur nie nebeneinander. Die Frage, die dadurch unbeantwortet
 * blieb, ist die wichtigste im Handwerk: **Deckt der Preis den Aufwand?** Und
 * die Frage dahinter: Welches Stück frisst regelmäßig mehr Stunden, als bei
 * seiner Kalkulation angenommen wurde?
 *
 * Eine einzelne Abweichung sagt nichts — der eine Auftrag war eben schwierig.
 * Drei Aufträge desselben Artikels, jedes Mal ein Drittel über der Schätzung,
 * sagen etwas: Der Preis stimmt nicht, oder die Schätzung.
 *
 * Was hier bewusst **nicht** passiert: Es wird nichts korrigiert und nichts
 * automatisch angepasst. Ein Preis, der sich von selbst ändert, weil eine
 * Auswertung das für richtig hielt, ist der Weg in Preise, die niemand
 * erklären kann.
 *
 * Ohne Payload-Import: Die Seite rechnet aus dem Bestand im Gerät.
 */

export type Zeiteintrag = { minutes?: number | null; day?: string | null }

export type KalkAuftrag = {
  id: number | string
  jobNumber?: string | null
  title?: string | null
  status?: string | null
  dueDate?: string | null
  plannedMinutes?: number | null
  timeEntries?: Zeiteintrag[] | null
  material?: { item?: unknown; quantity?: number | null }[] | null
  positions?: { description?: string | null; quantity?: number | null; price?: number | null }[] | null
}

export type Lagerposten = { id: number | string; name?: string | null; unitValue?: number | null }

export type Bilanz = {
  id: number | string
  nummer: string
  titel: string
  /** Fertig am — für die Sortierung und die Jahresauswahl */
  tag: string | null
  /** Was der Auftrag einbringt (netto, aus den Positionen) */
  wert: number
  zeitGeplant: number
  zeitIst: number
  /** Ist minus geplant, in Stunden — positiv heißt: länger gebraucht */
  zeitAbweichung: number
  lohnkosten: number
  materialkosten: number
  einsatz: number
  /** Wert minus Einsatz */
  deckung: number
  /** Deckung im Verhältnis zum Wert; null, wenn der Auftrag nichts einbringt */
  marge: number | null
}

export type ArtikelZeile = {
  name: string
  auftraege: number
  stueck: number
  zeitGeplant: number
  zeitIst: number
  zeitAbweichung: number
  wert: number
  deckung: number
}

const runden = (n: number) => Math.round(n * 100) / 100
const stunden = (minuten: number) => Math.round((minuten / 60) * 10) / 10

/** Abgeschlossen heißt: Es gibt nichts mehr dazuzurechnen. */
export function istAbgeschlossen(auftrag: KalkAuftrag): boolean {
  return auftrag.status === 'fertig' || auftrag.status === 'geliefert'
}

/** Die tatsächlich erfassten Minuten. */
export function istMinuten(auftrag: KalkAuftrag): number {
  return (auftrag.timeEntries ?? []).reduce((s, e) => s + (Number(e.minutes) || 0), 0)
}

/** Was die Positionen zusammen einbringen. */
export function auftragswert(auftrag: KalkAuftrag): number {
  return runden(
    (auftrag.positions ?? []).reduce(
      (s, p) => s + (Number(p.quantity) || 0) * (Number(p.price) || 0),
      0,
    ),
  )
}

/** Was das eingesetzte Material gekostet hat. */
export function materialkosten(auftrag: KalkAuftrag, lager: Lagerposten[]): number {
  return runden(
    (auftrag.material ?? []).reduce((summe, zeile) => {
      const roh = typeof zeile.item === 'object' ? (zeile.item as { id?: number })?.id : zeile.item
      const posten = lager.find((p) => String(p.id) === String(roh))
      return summe + (Number(zeile.quantity) || 0) * (Number(posten?.unitValue) || 0)
    }, 0),
  )
}

/**
 * Die Bilanz eines Auftrags.
 *
 * Der Stundensatz ist der aus den Einstellungen: Werkstattstunde inklusive
 * Maschinen, Strom und Raum — nicht der eigene Lohn. Was übrig bleibt, ist
 * deshalb kein Gewinn, sondern das, was den Betrieb und den Menschen darin
 * trägt.
 */
export function bilanz(auftrag: KalkAuftrag, stundensatz: number, lager: Lagerposten[]): Bilanz {
  const geplant = Number(auftrag.plannedMinutes) || 0
  const ist = istMinuten(auftrag)
  const wert = auftragswert(auftrag)
  const lohn = runden((ist / 60) * stundensatz)
  const material = materialkosten(auftrag, lager)
  const einsatz = runden(lohn + material)

  return {
    id: auftrag.id,
    nummer: auftrag.jobNumber ?? '',
    titel: auftrag.title ?? '',
    tag: auftrag.dueDate ?? null,
    wert,
    zeitGeplant: stunden(geplant),
    zeitIst: stunden(ist),
    zeitAbweichung: stunden(ist - geplant),
    lohnkosten: lohn,
    materialkosten: material,
    einsatz,
    deckung: runden(wert - einsatz),
    marge: wert > 0 ? Math.round(((wert - einsatz) / wert) * 100) : null,
  }
}

/**
 * Der Artikelname aus einer Auftragsposition.
 *
 * Positionen aus dem Shop heißen „Pflanzkübel Corten · 80 × 40 cm · anthrazit".
 * Für die Frage „welcher Artikel frisst Stunden?" zählt das erste Stück; die
 * Variante ist eine Ausführung desselben Stücks, und getrennt gezählt käme
 * jede Größe auf ein oder zwei Aufträge — zu wenig, um etwas zu sehen.
 */
export function artikelName(beschreibung: string | null | undefined): string {
  return String(beschreibung ?? '')
    .split('·')[0]
    .trim()
}

/**
 * Aufträge nach Artikeln zusammengefasst.
 *
 * Die Zeit eines Auftrags verteilt sich dabei nach dem Wertanteil seiner
 * Positionen. Bei einem Auftrag über ein Stück — der Regelfall hier — ist das
 * exakt; bei mehreren ist es eine Annahme, und eine bessere gibt es nicht:
 * Die Uhr in der Werkstatt läuft auf den Auftrag, nicht auf die Position.
 */
export function nachArtikeln(bilanzen: { bilanz: Bilanz; auftrag: KalkAuftrag }[]): ArtikelZeile[] {
  const gesammelt = new Map<string, ArtikelZeile>()

  for (const { bilanz: b, auftrag } of bilanzen) {
    const positionen = (auftrag.positions ?? []).filter((p) => p.description?.trim())
    if (!positionen.length) continue

    const werte = positionen.map((p) => (Number(p.quantity) || 0) * (Number(p.price) || 0))
    const gesamt = werte.reduce((s, w) => s + w, 0)

    positionen.forEach((p, i) => {
      // Ohne Preise verteilt sich die Zeit zu gleichen Teilen — sonst fiele
      // ein Auftrag ohne Preisangaben ganz aus der Auswertung
      const anteil = gesamt > 0 ? werte[i] / gesamt : 1 / positionen.length
      const name = artikelName(p.description)
      const zeile = gesammelt.get(name) ?? {
        name,
        auftraege: 0,
        stueck: 0,
        zeitGeplant: 0,
        zeitIst: 0,
        zeitAbweichung: 0,
        wert: 0,
        deckung: 0,
      }
      zeile.auftraege += 1
      zeile.stueck += Number(p.quantity) || 0
      zeile.zeitGeplant = runden(zeile.zeitGeplant + b.zeitGeplant * anteil)
      zeile.zeitIst = runden(zeile.zeitIst + b.zeitIst * anteil)
      zeile.zeitAbweichung = runden(zeile.zeitIst - zeile.zeitGeplant)
      zeile.wert = runden(zeile.wert + b.wert * anteil)
      zeile.deckung = runden(zeile.deckung + b.deckung * anteil)
      gesammelt.set(name, zeile)
    })
  }

  // Die größte Abweichung nach oben zuerst — das ist die Zeile, die etwas kostet
  return [...gesammelt.values()].sort((a, b) => b.zeitAbweichung - a.zeitAbweichung)
}

export type Auswertung = {
  auftraege: Bilanz[]
  artikel: ArtikelZeile[]
  summe: {
    anzahl: number
    wert: number
    einsatz: number
    deckung: number
    zeitGeplant: number
    zeitIst: number
    /** Aufträge, für die niemand Zeit erfasst hat — ohne sie ist alles geschönt */
    ohneZeit: number
    /** Aufträge ohne Schätzung — sie zählen beim Vergleich geplant/ist nicht mit */
    ohneSchaetzung: number
  }
}

/**
 * Die ganze Auswertung.
 *
 * `jahr` filtert über den Fertigstellungstermin. Ein Auftrag ohne Termin
 * zählt zu keinem Jahr — er würde sonst in jedem auftauchen.
 */
export function nachkalkulation(
  auftraege: KalkAuftrag[],
  {
    stundensatz = 65,
    lager = [] as Lagerposten[],
    jahr = null as number | null,
  } = {},
): Auswertung {
  const gewaehlt = auftraege.filter((a) => {
    if (!istAbgeschlossen(a)) return false
    if (jahr === null) return true
    return (a.dueDate ?? '').startsWith(String(jahr))
  })

  const paare = gewaehlt.map((auftrag) => ({ auftrag, bilanz: bilanz(auftrag, stundensatz, lager) }))
  const bilanzen = paare.map((p) => p.bilanz)

  // Nur Aufträge mit Schätzung *und* erfasster Zeit taugen zum Vergleich;
  // alles andere verglich eine Zahl mit einer Null.
  const vergleichbar = paare.filter((p) => p.bilanz.zeitGeplant > 0 && p.bilanz.zeitIst > 0)

  return {
    auftraege: bilanzen.sort((a, b) => (b.tag ?? '').localeCompare(a.tag ?? '')),
    artikel: nachArtikeln(vergleichbar),
    summe: {
      anzahl: bilanzen.length,
      wert: runden(bilanzen.reduce((s, b) => s + b.wert, 0)),
      einsatz: runden(bilanzen.reduce((s, b) => s + b.einsatz, 0)),
      deckung: runden(bilanzen.reduce((s, b) => s + b.deckung, 0)),
      zeitGeplant: runden(vergleichbar.reduce((s, p) => s + p.bilanz.zeitGeplant, 0)),
      zeitIst: runden(vergleichbar.reduce((s, p) => s + p.bilanz.zeitIst, 0)),
      ohneZeit: bilanzen.filter((b) => b.zeitIst === 0).length,
      ohneSchaetzung: bilanzen.filter((b) => b.zeitGeplant === 0).length,
    },
  }
}
