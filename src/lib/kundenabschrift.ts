import type { Payload, PayloadRequest } from 'payload'

/**
 * Die Angaben des Kunden, wie sie auf die Rechnung gehören.
 *
 * **Warum es das gibt.** Eine Rechnung, die aus einem Auftrag entsteht, trug
 * bislang nur den Namen des Kunden. Anschrift, SIRET und USt-IdNr blieben
 * leer — die füllte nur das Rechnungsformular, wenn dort jemand von Hand
 * einen Geschäftspartner auswählte. Wer den Knopf am Auftrag benutzte, bekam
 * eine Rechnung ohne die Steuernummer des Empfängers.
 *
 * Das ist kein Schönheitsfehler: Bei einem Geschäftskunden im EU-Ausland
 * entscheidet die USt-IdNr darüber, ob die Rechnung überhaupt richtig ist,
 * und in der elektronischen Rechnung ist der SIRET Pflicht, sobald der
 * Empfänger ein Unternehmen ist. Eine gestellte Rechnung lässt sich nicht mehr
 * ändern — sie muss storniert und neu geschrieben werden. Genau das ist
 * einmal passiert.
 *
 * **Abgeschrieben, nicht verknüpft.** Wie beim Absender gilt: Was auf einem
 * Beleg steht, gehört zu dem Tag, an dem er entstand. Zieht der Kunde um oder
 * ändert seine Nummer, darf die alte Rechnung sich nicht mitbewegen.
 *
 * **Nur was fehlt.** Gefüllt wird ausschließlich, was leer ist. Wer im
 * Rechnungsformular etwas anderes eingetragen hat, behält es — eine
 * Abschrift, die getippte Angaben überschreibt, wäre schlimmer als keine.
 */

export type Kundenangaben = {
  customerName?: string
  customerAddress?: string
  customerSiret?: string
  customerVatId?: string
}

type Kontakt = {
  name?: string | null
  line1?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  siret?: string | null
  vatId?: string | null
}

/**
 * Die Anschrift, wie sie ins Adressfeld gehört — ohne den Namen, der steht
 * auf den Papieren als eigene Zeile darüber. Nur was da ist, zeilenweise.
 *
 * Dieselbe Zusammenstellung benutzt das Büro beim Auswählen eines Partners
 * im Rechnungs- und Angebotsformular; deshalb steht sie hier und nicht dort.
 */
export function anschriftAus(k: Kontakt): string {
  const ort = [k.postalCode, k.city].filter(Boolean).join(' ')
  return [k.line1, ort, k.country].filter(Boolean).join('\n')
}

const gefuellt = (wert: unknown): boolean => typeof wert === 'string' && wert.trim().length > 0

/**
 * Die Angaben eines Geschäftspartners für eine Rechnung — nur die fehlenden.
 *
 * `bisher` ist, was auf der Rechnung schon steht. Zurück kommt ausschließlich,
 * was ergänzt werden soll; ist nichts zu ergänzen, ist das Ergebnis leer.
 */
export async function kundenAbschrift(
  payload: Payload,
  kontaktId: unknown,
  bisher: Kundenangaben = {},
  req?: PayloadRequest,
): Promise<Kundenangaben> {
  const id = typeof kontaktId === 'object' && kontaktId !== null
    ? (kontaktId as { id?: number }).id
    : kontaktId
  if (typeof id !== 'number' && typeof id !== 'string') return {}

  const kontakt = (await payload
    .findByID({ collection: 'contacts', id: id as number, depth: 0, overrideAccess: true, req })
    .catch(() => null)) as Kontakt | null
  if (!kontakt) return {}

  const ergaenzung: Kundenangaben = {}
  if (!gefuellt(bisher.customerName) && gefuellt(kontakt.name)) {
    ergaenzung.customerName = kontakt.name as string
  }
  if (!gefuellt(bisher.customerAddress)) {
    const anschrift = anschriftAus(kontakt)
    if (anschrift) ergaenzung.customerAddress = anschrift
  }
  if (!gefuellt(bisher.customerSiret) && gefuellt(kontakt.siret)) {
    ergaenzung.customerSiret = kontakt.siret as string
  }
  if (!gefuellt(bisher.customerVatId) && gefuellt(kontakt.vatId)) {
    ergaenzung.customerVatId = kontakt.vatId as string
  }
  return ergaenzung
}
