import type { Payload } from 'payload'

import type { BewertungDaten } from '../components/shop/GoogleBewertung'

/**
 * Was Google für die Bewertungsanfrage braucht — und woher es kommt.
 *
 * Google Kundenrezensionen verlangt fünf Angaben: die Händler-Kennung, die
 * Bestellnummer, die E-Mail-Adresse, das Lieferland und ein Datum, an dem
 * voraussichtlich geliefert wird. Erst danach fragt Google beim Kunden nach.
 *
 * **Das Lieferdatum ist hier eine Schätzung, und das ist kein Mangel.** In
 * dieser Werkstatt entsteht jedes Stück einzeln; die Fertigungszeit steht am
 * Artikel als Text („zwei bis vier Wochen") und nicht als Zahl. Google will
 * aber ein Datum. Deshalb steht die übliche Spanne als Tagezahl in den
 * Einstellungen — lieber großzügig gewählt: Wer nach der Lieferung gefragt
 * wird, antwortet freundlicher als jemand, der noch wartet.
 *
 * **Ohne Händler-Kennung passiert gar nichts.** Dann gibt diese Funktion
 * `null` zurück, die Seite zeigt keinen Hinweis, und im Browser wird kein
 * einziges Byte von Google geladen. Das ist die Abschaltung: ein leeres Feld
 * im Büro, kein Ausrollen.
 */

type Bestellung = {
  orderNumber?: string | null
  customer?: { email?: string | null } | null
  shippingAddress?: { country?: string | null } | null
  createdAt?: string | null
}

/** Zwei Buchstaben, groß — Google nimmt nichts anderes an */
function laenderkuerzel(wert: unknown): string {
  const roh = String(wert ?? '').trim()
  if (/^[A-Za-z]{2}$/.test(roh)) return roh.toUpperCase()

  /*
   * Im Bestellformular steht das Land ausgeschrieben, und je nach Sprache
   * anders. Die Handvoll Länder, in die geliefert wird, deshalb hier — der
   * Rest fällt auf Frankreich zurück, den Sitz des Betriebs. Ein falsches
   * Land kostet nur die Umfrage, kein Geld.
   */
  const bekannt: Record<string, string> = {
    deutschland: 'DE',
    allemagne: 'DE',
    germany: 'DE',
    frankreich: 'FR',
    france: 'FR',
    österreich: 'AT',
    oesterreich: 'AT',
    autriche: 'AT',
    austria: 'AT',
    schweiz: 'CH',
    suisse: 'CH',
    switzerland: 'CH',
    belgien: 'BE',
    belgique: 'BE',
    belgium: 'BE',
    luxemburg: 'LU',
    luxembourg: 'LU',
  }
  return bekannt[roh.toLowerCase()] ?? 'FR'
}

/** YYYY-MM-DD, so wie Google es erwartet */
function tagePlus(start: Date, tage: number): string {
  const ziel = new Date(start.getTime() + tage * 24 * 60 * 60 * 1000)
  return ziel.toISOString().slice(0, 10)
}

export async function bewertungsDaten(
  payload: Payload,
  bestellung: Bestellung | null | undefined,
): Promise<BewertungDaten | null> {
  const email = bestellung?.customer?.email?.trim()
  const orderId = bestellung?.orderNumber?.trim()
  if (!email || !orderId) return null

  const integrationen = (await payload
    .findGlobal({ slug: 'integrations', depth: 0, overrideAccess: true })
    .catch(() => null)) as { googleReviews?: { merchantId?: string | null; lieferzeitTage?: number | null } } | null

  const merchantId = integrationen?.googleReviews?.merchantId?.trim()
  if (!merchantId || !/^\d+$/.test(merchantId)) return null

  const tage = Number(integrationen?.googleReviews?.lieferzeitTage) || 28
  const bestelltAm = bestellung?.createdAt ? new Date(bestellung.createdAt) : new Date()

  return {
    merchantId,
    orderId,
    email,
    deliveryCountry: laenderkuerzel(bestellung?.shippingAddress?.country),
    estimatedDeliveryDate: tagePlus(
      Number.isNaN(bestelltAm.getTime()) ? new Date() : bestelltAm,
      tage,
    ),
  }
}
