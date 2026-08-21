/**
 * Eine Bestandsbuchung mit Verlaufszeile — für alle, die Bestand anfassen.
 *
 * Der Verlauf am Posten beantwortet die Frage „warum sind aus 50 plötzlich
 * 48 geworden?". Er taugt aber nur, solange **jede** Änderung dort landet.
 * Genau das war kaputt: Korrektur, Auftrag und Wareneingang schrieben brav —
 * der Inventurabschluss und das Bearbeiten-Formular setzten den Bestand
 * wortlos. Wer nachrechnete, fand Löcher an genau den Stellen, an denen am
 * meisten korrigiert wird.
 *
 * Deshalb baut jetzt eine Stelle die Daten für so eine Buchung. Wer Bestand
 * ändert, ruft sie — und wer sie nicht ruft, fällt im Review auf.
 */

type Verlaufszeile = {
  day?: string | null
  delta?: number | null
  rest?: number | null
  reason?: string | null
  who?: string | null
  id?: string | null
}

type PostenMitVerlauf = {
  quantity?: number | null
  movements?: Verlaufszeile[] | null
}

/**
 * Die Felder für ein `update` auf den Posten: neuer Bestand plus
 * angehängte Verlaufszeile. Ein Zugang nimmt außerdem die Markierung
 * „unterwegs" zurück — die Lieferung ist ja da.
 *
 * Der Bestand darf rechnerisch unter null rutschen und bleibt so stehen:
 * Ein gedeckelter Bestand sähe ordentlich aus und verschwiege genau die
 * Information, um die es geht.
 */
export function bewegung(
  posten: PostenMitVerlauf,
  delta: number,
  grund?: string | null,
  wer?: string | null,
  tag?: string | null,
): { quantity: number; movements: Verlaufszeile[]; reorderedAt?: null } {
  const rest = Math.round(((posten.quantity ?? 0) + delta) * 1000) / 1000
  return {
    quantity: rest,
    ...(delta > 0 ? { reorderedAt: null } : {}),
    movements: [
      ...(posten.movements ?? []),
      {
        day: tag || new Date().toISOString(),
        delta,
        rest,
        reason: grund?.trim() || undefined,
        who: wer || undefined,
      },
    ],
  }
}
