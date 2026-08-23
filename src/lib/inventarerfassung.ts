/**
 * Die zwei Regeln der schnellen Erfassung — ohne Formular prüfbar.
 *
 * Beide sind Einzeiler, und beide gehen still kaputt. Genau deshalb stehen sie
 * hier und nicht im Bauteil: Ein Fehler in ihnen fällt beim Klicken nicht auf,
 * sondern erst Wochen später im Lager.
 */

/**
 * Was von einem Posten zum nächsten stehen bleibt.
 *
 * Wer eine Kiste Kleinteile erfasst, hat für alle dieselbe Art, dieselbe
 * Einheit, dasselbe Regal und denselben Händler — und für jedes eine eigene
 * Bezeichnung, Menge und Artikelnummer. Das ist der Unterschied zwischen vier
 * getippten Feldern je Posten und zehn.
 */
export const UEBERNOMMEN = ['type', 'unit', 'location', 'supplier'] as const

/**
 * Das Formular für den nächsten Posten.
 *
 * **Der teure Fehler wäre hier ein Feld zu viel, nicht eins zu wenig.** Bliebe
 * die Bezeichnung stehen, entstünde beim nächsten Speichern derselbe Posten
 * ein zweites Mal; bliebe die Menge stehen, hätte das Lager Bestand, den
 * niemand gezählt hat. Deshalb wird nicht geleert, was stören könnte, sondern
 * ausdrücklich nur übernommen, was aufgezählt ist — ein Feld, das nächsten
 * Monat dazukommt, ist damit von selbst leer.
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
