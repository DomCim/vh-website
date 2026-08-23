import { expect, test } from '@playwright/test'

import { bewertungsDaten } from '../src/lib/googleBewertung'

/**
 * Was Google bekommt — und wann gar nichts passiert.
 *
 * Der teuerste Fehler wäre hier nicht ein fehlendes Datum, sondern ein
 * geladenes Google-Skript, das niemand bestellt hat: Diese Website setzt kein
 * Cookie und lädt nichts von fremden Servern, und genau deshalb steht auf ihr
 * kein Einwilligungsbanner. Fällt diese Zusicherung, muss jeder Besucher
 * künftig erst etwas wegklicken. Deshalb prüfen die ersten Fälle vor allem
 * eines: dass ohne Händler-Kennung nichts entsteht.
 */

const bestellung = {
  orderNumber: 'VH-2026-0042',
  customer: { email: 'kunde@example.test' },
  shippingAddress: { country: 'Deutschland' },
  createdAt: '2026-08-01T10:00:00.000Z',
}

const payloadMit = (googleReviews: Record<string, unknown> | undefined) =>
  ({
    findGlobal: async () => ({ googleReviews }),
  }) as unknown as Parameters<typeof bewertungsDaten>[0]

test('ohne Händler-Kennung entsteht nichts', async () => {
  expect(await bewertungsDaten(payloadMit(undefined), bestellung)).toBeNull()
  expect(await bewertungsDaten(payloadMit({ merchantId: '' }), bestellung)).toBeNull()
  expect(await bewertungsDaten(payloadMit({ merchantId: '   ' }), bestellung)).toBeNull()

  // Eine Kennung, die keine Zahl ist, ist keine — dann lieber nichts laden,
  // als Google mit einer Angabe zu behelligen, die es ablehnt.
  expect(await bewertungsDaten(payloadMit({ merchantId: 'abc' }), bestellung)).toBeNull()
})

test('ohne Bestellnummer oder E-Mail entsteht nichts', async () => {
  const payload = payloadMit({ merchantId: '123456' })

  expect(await bewertungsDaten(payload, null)).toBeNull()
  expect(await bewertungsDaten(payload, { ...bestellung, orderNumber: '' })).toBeNull()
  expect(await bewertungsDaten(payload, { ...bestellung, customer: { email: null } })).toBeNull()
})

test('die Angaben für Google stimmen', async () => {
  const daten = await bewertungsDaten(payloadMit({ merchantId: '123456' }), bestellung)

  expect(daten).not.toBeNull()
  expect(daten?.merchantId).toBe('123456')
  expect(daten?.orderId).toBe('VH-2026-0042')
  expect(daten?.email).toBe('kunde@example.test')
  expect(daten?.deliveryCountry).toBe('DE')

  // Bestellt am 1. August, 28 Tage Vorgabe → 29. August.
  expect(daten?.estimatedDeliveryDate).toBe('2026-08-29')
})

/**
 * Das Land steht im Bestellformular ausgeschrieben und je nach Sprache
 * anders. Google nimmt nur zwei Buchstaben — ein ausgeschriebenes
 * „Deutschland" lehnt es ab, und die Umfrage bliebe aus.
 */
test('das Lieferland wird auf zwei Buchstaben gebracht', async () => {
  const payload = payloadMit({ merchantId: '123456' })
  const land = async (wert: unknown) =>
    (
      await bewertungsDaten(payload, {
        ...bestellung,
        shippingAddress: { country: wert as string },
      })
    )?.deliveryCountry

  expect(await land('France')).toBe('FR')
  expect(await land('Allemagne')).toBe('DE')
  expect(await land('Austria')).toBe('AT')
  expect(await land('be')).toBe('BE')

  // Unbekanntes oder fehlendes Land: der Sitz des Betriebs. Ein falsches Land
  // kostet die Umfrage, kein Geld.
  expect(await land('Irgendwo')).toBe('FR')
  expect(await land(undefined)).toBe('FR')
})

test('die Lieferzeit aus den Einstellungen wird verwendet', async () => {
  const daten = await bewertungsDaten(
    payloadMit({ merchantId: '123456', lieferzeitTage: 60 }),
    bestellung,
  )
  expect(daten?.estimatedDeliveryDate).toBe('2026-09-30')
})
