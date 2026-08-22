/*
 * Dieselbe Aktion, am Preis statt an der Summe.
 *
 * **Warum das hier steht.** Der Rabatt wurde bisher erst im Warenkorb sichtbar,
 * als Abzug auf die Zwischensumme. Draußen stand am Sofa unverändert 1.990 €,
 * während das Band darüber 40 % versprach — wer nicht auf gut Glück etwas in
 * den Korb legte, erfuhr vom Rabatt nichts. Eine Aktion, die man nicht sieht,
 * ist keine.
 *
 * **Warum nur Prozente.** Ein fester Betrag gilt dem ganzen Warenkorb, nicht
 * dem einzelnen Stück: 50 € Nachlass sind einmal 50 €, auch bei drei Stück.
 * Am Artikel angeschrieben würde daraus dreimal 50 € — versprochen wäre mehr,
 * als der Korb je abzieht. Feste Beträge bleiben deshalb, wo sie hingehören.
 *
 * **Warum ohne Gutscheincode.** Ein Rabatt mit Code gilt erst nach Eingabe.
 * Ihn vorab an den Preis zu schreiben, hieße etwas zu versprechen, das noch
 * niemand eingelöst hat.
 *
 * **Wo die Anzeige an ihre Grenze kommt.** Der Warenkorb wendet genau *eine*
 * Aktion an — die mit dem höchsten Rabatt über alle Positionen. Am Artikel
 * steht dagegen, was für dieses eine Stück gilt. Solange eine einzige Aktion
 * läuft, ist das dasselbe. Liefen zwei (etwa 40 % auf Möbel und 10 % auf
 * alles), könnte in einem gemischten Korb die zweite gewinnen, weil sie in
 * Summe mehr bringt — der Korb wäre dann insgesamt günstiger, das einzelne
 * Möbelstück aber weniger rabattiert als angeschrieben. Solange es hier eine
 * Aktion zur Zeit gibt, ist das gegenstandslos; wer je zwei gleichzeitig
 * fahren will, muss den Rabatt zuerst je Position rechnen lassen.
 */

/** Was am Preis steht, wenn eine Aktion läuft */
export type Preisaktion = {
  id: number | string
  titel: string
  prozent: number
  /** Letzter Tag der Aktion, ISO — für den Feed und den Hinweis am Preis */
  giltBis: string
}

/** Woran sich entscheidet, ob eine Aktion für einen Artikel gilt */
export type Artikelkennung = {
  id: number | string
  categoryId?: number | string | null
}

/**
 * Eine Aktion, so weit sie für die Anzeige gebraucht wird.
 *
 * Bewusst nicht der Datenbanksatz: Diese Datei rechnet und wird deshalb auch
 * aus Bauteilen im Browser heraus benutzt. Käme der volle Satz herein, käme
 * Payload mit — in ein Bündel, das im Browser landet.
 */
export type Aktionsregel = {
  id: number | string
  title: string
  discountValue: number
  endDate: string
  appliesTo: 'all' | 'categories' | 'products'
  categories?: ({ id: number | string } | number | string)[] | null
  products?: ({ id: number | string } | number | string)[] | null
}

function bezugsIds(rels?: ({ id: number | string } | number | string)[] | null): string[] {
  return (rels ?? []).map((r) => String(typeof r === 'object' ? r.id : r))
}

/**
 * Welche Aktion gilt für diesen Artikel — und mit wie viel Prozent?
 *
 * Die Zugehörigkeit wird genauso bestimmt wie im Warenkorb (siehe
 * `applicableAmount`): über die Kategorie, die am Artikel steht. Eine Aktion
 * auf „Outdoor" greift also **nicht** für ein Sofa, das in der Unterkategorie
 * „Möbel" liegt — weder hier noch an der Kasse. Das ist keine Feinheit der
 * Anzeige, sondern die Regel des Hauses; wer alle Outdoor-Stücke meint, wählt
 * die Unterkategorien mit aus.
 */
export function aktionFuerArtikel(
  artikel: Artikelkennung,
  aktionen: Aktionsregel[],
): Preisaktion | null {
  let beste: Preisaktion | null = null

  for (const doc of aktionen) {
    const passt =
      doc.appliesTo === 'all'
        ? true
        : doc.appliesTo === 'categories'
          ? artikel.categoryId != null && bezugsIds(doc.categories).includes(String(artikel.categoryId))
          : bezugsIds(doc.products).includes(String(artikel.id))

    if (!passt) continue
    if (!beste || doc.discountValue > beste.prozent) {
      beste = {
        id: doc.id,
        titel: doc.title,
        prozent: doc.discountValue,
        giltBis: doc.endDate,
      }
    }
  }

  return beste
}

/**
 * Der Preis nach Abzug.
 *
 * Gerundet wie im Warenkorb: erst der Rabatt auf den Cent, dann die Differenz.
 * Andersherum — den Endpreis direkt zu runden — käme bei krummen Prozentsätzen
 * ein Cent anders heraus als an der Kasse, und ein Cent Unterschied zwischen
 * Schaufenster und Rechnung ist genau die Sorte Kleinigkeit, die Vertrauen
 * kostet.
 */
export function mitRabatt(preis: number, prozent: number): number {
  const rabatt = Math.round(((preis * prozent) / 100) * 100) / 100
  return Math.round((preis - rabatt) * 100) / 100
}

/**
 * Darf für dieses Stück ein Streichpreis danebenstehen?
 *
 * Zwei Fälle sagen nein, und beide aus demselben Grund: Ohne Preis gibt es
 * keine Ersparnis. Ein Band „−40 %" über einem Stück auf Anfrage verspricht
 * eine Zahl, die niemand nennen kann — und beim Anfragen kommt dann der volle
 * Preis, was schlimmer ist als gar kein Band.
 *
 * Steht hier, damit Kachel und Artikelseite sich nicht getrennt entscheiden.
 */
export function preisaktionAnzeigen(
  artikel: { onRequestOnly?: boolean | null; preis?: number | null },
  aktion: Preisaktion | null | undefined,
): boolean {
  if (!aktion) return false
  if (artikel.onRequestOnly) return false
  return typeof artikel.preis === 'number'
}
