/**
 * Was nachbestellt werden muss — und bei wem.
 *
 * Der Mindestbestand stand bisher am Posten und wurde auch angezeigt. Was
 * fehlte, war der Schritt danach: Wer unter den Mindestbestand rutscht, muss
 * bestellt werden, und dafür saß man wieder vor dem Lieferantenkatalog. Diese
 * Datei macht daraus eine Liste je Lieferant, die sich in einem Zug
 * verschicken lässt.
 *
 * Zwei Dinge, die sie bewusst nicht tut:
 *
 * **Sie bestellt nicht von selbst.** Ob die Rolle Draht jetzt kommt oder erst
 * nach dem nächsten Auftrag, entscheidet der Mensch — und manchmal ist die
 * Antwort „gar nicht, das Stück läuft aus".
 *
 * **Sie rechnet keine Verbräuche hoch.** Eine Bedarfsprognose aus vergangenen
 * Aufträgen wäre bei ein paar Stück im Jahr eine Zahl mit erfundener
 * Genauigkeit. Es bleibt beim Mindestbestand, den ein Mensch gesetzt hat.
 *
 * Ohne Payload-Import: rechnet im Gerät und im Test ohne Datenbank.
 */

export type Lagerposten = {
  id: number | string
  name?: string | null
  unit?: string | null
  quantity?: number | null
  minQuantity?: number | null
  orderQuantity?: number | null
  supplierRef?: string | null
  reorderedAt?: string | null
  /** Lieferant — Kennung oder aufgelöster Datensatz */
  supplier?: unknown
}

export type Bestellzeile = {
  id: number | string
  name: string
  einheit: string
  bestand: number
  mindest: number
  /** Wie viel fehlt bis zum Mindestbestand */
  fehlt: number
  /** Wie viel bestellt werden soll */
  menge: number
  artikelnummer?: string | null
  /** Steht schon eine Bestellung aus? Dann nicht noch einmal. */
  bestelltAm?: string | null
}

export type Lieferantenblock = {
  /** Kennung des Geschäftspartners, `null` für „kein Lieferant hinterlegt" */
  lieferant: number | string | null
  name: string
  email?: string | null
  zeilen: Bestellzeile[]
}

const runden = (n: number) => Math.round(n * 1000) / 1000

/** Die Kennung des Lieferanten, ob aufgelöst oder nicht. */
export function lieferantenId(wert: unknown): number | string | null {
  if (wert == null) return null
  if (typeof wert === 'object') {
    const id = (wert as { id?: number | string }).id
    return id ?? null
  }
  return wert as number | string
}

/** Liegt der Posten unter seinem Mindestbestand? */
export function istKnapp(posten: Lagerposten): boolean {
  return typeof posten.minQuantity === 'number' && (posten.quantity ?? 0) < posten.minQuantity
}

/**
 * Wie viel bestellt werden soll.
 *
 * Steht am Posten eine Nachbestellmenge, gilt die — sie passt zum Gebinde des
 * Lieferanten, und eine krumme Zahl daneben zu bestellen ergibt keinen Sinn.
 * Sonst wird bis auf das Doppelte des Mindestbestands aufgefüllt: Genau bis
 * zum Mindestbestand aufzufüllen hieße, beim nächsten Verbrauch sofort wieder
 * knapp zu sein.
 */
export function bestellmenge(posten: Lagerposten): number {
  if (posten.orderQuantity && posten.orderQuantity > 0) return posten.orderQuantity
  const mindest = posten.minQuantity ?? 0
  return runden(Math.max(mindest * 2 - (posten.quantity ?? 0), mindest))
}

function zeile(posten: Lagerposten): Bestellzeile {
  const mindest = posten.minQuantity ?? 0
  const bestand = posten.quantity ?? 0
  return {
    id: posten.id,
    name: posten.name ?? 'Posten',
    einheit: posten.unit ?? '',
    bestand,
    mindest,
    fehlt: runden(Math.max(mindest - bestand, 0)),
    menge: bestellmenge(posten),
    artikelnummer: posten.supplierRef ?? null,
    bestelltAm: posten.reorderedAt ?? null,
  }
}

export type Lieferantenname = { id: number | string; name?: string | null; email?: string | null }

/**
 * Alles Knappe, nach Lieferant sortiert.
 *
 * Posten ohne Lieferant fallen nicht heraus, sondern bekommen einen eigenen
 * Block: Sie sind der Grund, warum man später vor einem leeren Regal steht und
 * nicht weiß, wo das Zeug herkam.
 */
export function nachLieferanten(
  posten: Lagerposten[],
  lieferanten: Lieferantenname[] = [],
): Lieferantenblock[] {
  const bloecke = new Map<string, Lieferantenblock>()

  for (const p of posten.filter(istKnapp)) {
    const id = lieferantenId(p.supplier)
    const schluessel = id === null ? '' : String(id)
    const partner = lieferanten.find((l) => String(l.id) === schluessel)
    const block = bloecke.get(schluessel) ?? {
      lieferant: id,
      name: partner?.name ?? (id === null ? 'Ohne Lieferant' : `Lieferant ${schluessel}`),
      email: partner?.email ?? null,
      zeilen: [],
    }
    block.zeilen.push(zeile(p))
    bloecke.set(schluessel, block)
  }

  return [...bloecke.values()]
    /*
     * Innerhalb eines Lieferanten alphabetisch, nicht nach Fehlmenge: „Es
     * fehlen 12" bei Draht in Metern und „es fehlen 4" bei Farbe in Litern
     * sind keine vergleichbaren Zahlen. Eine Liste, die man am Regal entlang
     * abliest, ist alphabetisch am schnellsten.
     */
    .map((b) => ({ ...b, zeilen: b.zeilen.sort((a, z) => a.name.localeCompare(z.name, 'de')) }))
    // „Ohne Lieferant" ans Ende: erst das, was sich erledigen lässt
    .sort((a, b) => {
      if (a.lieferant === null) return 1
      if (b.lieferant === null) return -1
      return a.name.localeCompare(b.name, 'de')
    })
}

/**
 * Der Text der Anfrage.
 *
 * Bewusst eine Anfrage und keine Bestellung: Preise und Verfügbarkeit stehen
 * nicht fest, und eine „Bestellung" mit falschem Preis ist eine Reklamation in
 * spe. Der Lieferant antwortet mit Preis und Termin, und dann wird bestellt.
 */
export function anfrageText(
  zeilen: Bestellzeile[],
  absender: { name?: string | null } = {},
): string {
  const posten = zeilen
    .map(
      (z) =>
        `· ${z.menge} ${z.einheit} ${z.name}${z.artikelnummer ? ` (Art.-Nr. ${z.artikelnummer})` : ''}`,
    )
    .join('\n')

  return (
    'Guten Tag,\n\n' +
    'bitte um ein Angebot mit Liefertermin für:\n\n' +
    `${posten}\n\n` +
    'Vielen Dank und freundliche Grüße\n' +
    (absender.name || 'Vincent Hellmann')
  )
}
