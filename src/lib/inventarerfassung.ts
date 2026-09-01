/**
 * Die Regeln der schnellen Erfassung — ohne Formular prüfbar.
 *
 * Alle sind Einzeiler, und alle gehen still kaputt. Genau deshalb stehen sie
 * hier und nicht im Bauteil: Ein Fehler in ihnen fällt beim Klicken nicht auf,
 * sondern erst Wochen später im Lager.
 */

/**
 * Was von einem Posten zum nächsten stehen bleibt.
 *
 * Wer eine Kiste Kleinteile erfasst, hat für alle dieselbe Art, dieselbe
 * Einheit, dasselbe Regal und denselben Händler — und meist auch denselben
 * Mindestbestand und dieselbe Nachbestellmenge, weil Schrauben derselben
 * Sorte gleich knapp werden. Eigen je Posten bleiben Menge und Artikelnummer.
 *
 * **Auch die Bezeichnung bleibt stehen** — seit 09/2026, Entscheidung
 * Dominik. Vorher wurde sie geleert, damit ein zweiter Druck auf den Knopf
 * nicht denselben Posten zweimal anlegt. Aber wer will, dass seine Posten
 * gleich aussehen („Sechskantschraube M8 × 40", „… M8 × 50"), tippt sonst
 * zwanzigmal denselben Anfang. Also bleibt sie stehen, markiert, und die
 * Sperre gegen den Doppelgänger sitzt woanders: in `doppelgaenger` unten,
 * die das Formular beim Tippen und beim Speichern fragt, und noch einmal im
 * Server, der einen zweiten Posten gleichen Namens ablehnt.
 */
export const UEBERNOMMEN = [
  'name',
  'type',
  'unit',
  'location',
  'supplier',
  'minQuantity',
  'orderQuantity',
] as const

/**
 * Das Formular für den nächsten Posten.
 *
 * **Der teure Fehler wäre hier ein Feld zu viel, nicht eins zu wenig.** Bliebe
 * die Menge stehen, hätte das Lager Bestand, den niemand gezählt hat. Deshalb
 * wird nicht geleert, was stören könnte, sondern ausdrücklich nur übernommen,
 * was aufgezählt ist — ein Feld, das nächsten Monat dazukommt, ist damit von
 * selbst leer.
 *
 * Die Menge steht ausdrücklich auf null und nicht auf „nicht gesetzt": Ein
 * neuer Posten ohne Angabe hat keinen Bestand, und das soll auch so im Feld
 * stehen.
 */
export function naechsterPosten<T extends Record<string, unknown>>(bisher: T): Partial<T> {
  const weiter: Record<string, unknown> = { quantity: 0 }
  for (const feld of UEBERNOMMEN) {
    if (bisher[feld] !== undefined) weiter[feld] = bisher[feld]
  }
  return weiter as Partial<T>
}

/**
 * Zwei Bezeichnungen, die denselben Posten meinen.
 *
 * Groß und klein, führende, folgende und doppelte Leerzeichen zählen nicht:
 * „schraube m8" und „Schraube  M8 " sind derselbe Posten, und genau so
 * entstehen Doppelgänger — nicht durch Absicht, sondern durch ein Leerzeichen
 * zu viel am Handy. Mehr Klugheit gibt es absichtlich nicht: Wer „M8 x 40"
 * und „M8 × 40" unterscheiden will, soll das dürfen.
 */
export function gleicheBezeichnung(a: string | null | undefined, b: string | null | undefined) {
  const glatt = (v: string | null | undefined) =>
    (v ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de')
  const x = glatt(a)
  return x !== '' && x === glatt(b)
}

/**
 * Der Posten, den es unter dieser Bezeichnung schon gibt — oder nichts.
 *
 * Gefragt wird der Bestand im Gerät und nicht der Server, und zwar aus zwei
 * Gründen: Die Prüfung soll bei jedem Tastendruck laufen, und sie soll auch
 * ohne Netz gehen. Der Bestand kennt dabei auch, was in dieser Runde gerade
 * erst angelegt wurde und noch unter einer vorläufigen Kennung wartet —
 * gerade der Posten, den man mit stehengebliebener Bezeichnung am ehesten
 * ein zweites Mal speichert.
 *
 * Der eigene Posten zählt nicht: Wer einen vorhandenen bearbeitet, trägt
 * seinen Namen natürlich schon.
 */
export function doppelgaenger<T extends { id: number | string; name?: string | null }>(
  bezeichnung: string | null | undefined,
  vorhandene: readonly T[],
  eigeneId?: number | string,
): T | undefined {
  return vorhandene.find(
    (p) =>
      (eigeneId === undefined || String(p.id) !== String(eigeneId)) &&
      gleicheBezeichnung(bezeichnung, p.name),
  )
}

/**
 * Die Kennung aus der Lieferantenauswahl, wie sie ins Formular gehört.
 *
 * **Warum das nicht einfach `Number()` ist.** Ohne Netz vergibt die
 * Warteschlange vorläufige Kennungen (`neu:…`) und schreibt sie um, sobald der
 * Server seine eigene vergeben hat — genau dafür gibt es sie: Ein Posten kann
 * auf einen Lieferanten verweisen, den es beim Server noch gar nicht gibt.
 * Liefe hier `Number()` darüber, würde daraus `NaN`, und der Lieferant wäre
 * beim Abschicken weg. Aufgefallen wäre das niemandem, denn im Formular stünde
 * bis zum nächsten Laden weiter der richtige Name.
 */
export function lieferantKennung(rohwert: string): number | string | '' {
  if (rohwert === '') return ''
  if (rohwert.startsWith('neu:')) return rohwert
  return Number(rohwert)
}
