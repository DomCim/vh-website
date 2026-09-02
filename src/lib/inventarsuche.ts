/**
 * Die Suche über dem Inventar — ohne Seite prüfbar.
 *
 * Bei zwanzig Posten reicht Scrollen. Bei dreihundert Schraubensorten, Blechen
 * und Werkzeugen sucht niemand mehr mit dem Daumen, sondern tippt „M8 Regal C"
 * und erwartet genau die Zeilen, auf die beides zutrifft.
 */

/** Was von einem Posten durchsucht wird. */
export type Suchbar = {
  name?: string | null
  type?: string | null
  unit?: string | null
  location?: string | null
  supplierRef?: string | null
  notes?: string | null
  quantity?: number | null
  minQuantity?: number | null
}

const glatt = (v: string | null | undefined) => (v ?? '').toLocaleLowerCase('de')

/** Die Wörter einer Eingabe — Groß/Klein und überzählige Leerzeichen zählen nicht. */
export function suchwoerter(eingabe: string | null | undefined): string[] {
  return glatt(eingabe).split(/\s+/).filter(Boolean)
}

/**
 * Trifft die Suche diesen Posten?
 *
 * **Jedes Wort muss irgendwo vorkommen, egal wo.** „M8 Regal" findet die
 * Schraube M8 in Regal C, „Regal C Schraube" genauso. Die Alternative — nur
 * die Bezeichnung durchsuchen — wäre das, was man im Kopf zuerst hat, und
 * genau das, was am Lager nicht reicht: Gesucht wird nach dem Ort („was liegt
 * in Regal C?"), nach dem Händler („was kommt von Würth?") oder nach der
 * Artikelnummer vom Lieferschein, und alle drei stehen nicht im Namen.
 *
 * Die Art wird unter ihrem angezeigten Wort gefunden („Werkzeug"), nicht
 * unter dem Schlüssel — den kennt niemand, der die Seite benutzt. Und wer
 * „knapp" tippt, bekommt, was unter dem Mindestbestand liegt: Das Wort steht
 * so als Marker in der Liste, also soll es auch so gesucht werden können.
 */
export function postenTrifft(
  posten: Suchbar,
  woerter: readonly string[],
  zusatz: { art?: string | null; lieferant?: string | null } = {},
): boolean {
  if (woerter.length === 0) return true

  const knapp = typeof posten.minQuantity === 'number' && (posten.quantity ?? 0) < posten.minQuantity
  const heuhaufen = glatt(
    [
      posten.name,
      zusatz.art ?? posten.type,
      posten.unit,
      posten.location,
      posten.supplierRef,
      posten.notes,
      zusatz.lieferant,
      knapp ? 'knapp' : '',
    ]
      .filter(Boolean)
      .join(' '),
  )

  return woerter.every((w) => heuhaufen.includes(w))
}
