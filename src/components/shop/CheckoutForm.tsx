'use client'

import Link from 'next/link'
import React, { useState } from 'react'

import { formatPrice, type Locale } from '../../lib/i18n'
import { useCart } from './CartProvider'

type CheckoutDict = {
  deliveryMethod: string
  optionShipping: string
  optionPickup: string
  pickupNote: string
  paymentMethod: string
  optionPaypal: string
  paypalNote: string
  redirectNotePaypal: string
  paypalAddressNote: string
  differentAddress: string
  vatIncluded: string
  shipping: string
  contactData: string
  name: string
  email: string
  phone: string
  shippingAddress: string
  line1: string
  line2: string
  postalCode: string
  city: string
  country: string
  note: string
  payNow: string
  consentTerms: string
  consentWaiver: string
  consentMissing: string
  backToCart: string
  error: string
  errorNoPayment: string
}

type CartDict = {
  empty: string
  continueShopping: string
  subtotal: string
  total: string
}

/**
 * Setzt die Rechtsseiten als Links in den Zustimmungssatz ein.
 *
 * Der Satz steht als ganzer in der Übersetzung — mit Platzhaltern statt
 * zusammengestückelter Halbsätze, weil sich die Wortstellung je Sprache
 * unterscheidet.
 */
function mitLinks(satz: string, locale: Locale): React.ReactNode[] {
  const ziele: Record<string, string> = {
    agb: `/${locale}/kontakt/agb`,
    widerruf: `/${locale}/kontakt/widerruf`,
    datenschutz: `/${locale}/kontakt/datenschutzerklaerung`,
  }
  const beschriftung: Record<string, Record<Locale, string>> = {
    agb: { de: 'AGB', fr: 'CGV', en: 'terms & conditions' },
    widerruf: {
      de: 'Widerrufsbelehrung',
      fr: 'droit de rétractation',
      en: 'right of withdrawal',
    },
    datenschutz: {
      de: 'Datenschutzerklärung',
      fr: 'politique de confidentialité',
      en: 'privacy policy',
    },
  }

  return satz.split(/(\{agb\}|\{widerruf\}|\{datenschutz\})/).map((teil, i) => {
    const schluessel = teil.startsWith('{') ? teil.slice(1, -1) : null
    if (!schluessel || !ziele[schluessel]) return <React.Fragment key={i}>{teil}</React.Fragment>
    return (
      <Link key={i} href={ziele[schluessel]} className="text-ink underline" target="_blank">
        {beschriftung[schluessel][locale]}
      </Link>
    )
  })
}

export function CheckoutForm({
  locale,
  dict,
  cartDict,
  initialCode,
  paypalAvailable = false,
  vatRate = 20,
}: {
  locale: Locale
  dict: CheckoutDict
  cartDict: CartDict
  initialCode?: string
  paypalAvailable?: boolean
  vatRate?: number
}) {
  const { items, subtotal, clear } = useCart()
  const [submitting, setSubmitting] = useState(false)
  // 'allgemein' heißt „nochmal versuchen", 'keine-zahlung' heißt „ruf uns an"
  const [error, setError] = useState<null | 'allgemein' | 'keine-zahlung'>(null)
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping')
  const [differentAddress, setDifferentAddress] = useState(false)
  const [zustimmung, setZustimmung] = useState(false)
  const [verzicht, setVerzicht] = useState(false)
  const [fehlendeZustimmung, setFehlendeZustimmung] = useState(false)

  // Die Lieferadresse kommt aus dem PayPal-Konto, außer der Kunde will
  // ausdrücklich eine abweichende angeben
  const showAddressForm = deliveryMethod === 'shipping' && differentAddress

  // Nur wenn wir sicher wissen, dass ein Stück nach Vorgabe entsteht, wird der
  // Verzicht abgefragt — sonst spräche die Kasse jemandem ein Recht ab, das er hat.
  const einzelanfertigung = items.some((i) => i.madeToOrder === true)

  const shipping =
    deliveryMethod === 'pickup'
      ? 0
      : items.reduce((s, i) => s + (i.shippingCost ?? 0) * i.quantity, 0)

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-ink-soft mb-6">{cartDict.empty}</p>
        <Link
          href={`/${locale}`}
          className="bg-ink tracking-nav hover:bg-bronze inline-block px-8 py-3 text-xs font-semibold text-white uppercase transition-colors"
        >
          {cartDict.continueShopping}
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!zustimmung || (einzelanfertigung && !verzicht)) {
      setFehlendeZustimmung(true)
      return
    }
    setSubmitting(true)
    setError(null)
    setFehlendeZustimmung(false)
    const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          promoCode: initialCode,
          deliveryMethod,
          items: items.map((i) => ({
            productId: i.productId,
            variantTitle: i.variantTitle,
            color: i.color,
            quantity: i.quantity,
          })),
          customer: {
            name: data.name,
            email: data.email,
            phone: data.phone || undefined,
          },
          shippingAddress: {
            line1: data.line1,
            line2: data.line2 || undefined,
            postalCode: data.postalCode,
            city: data.city,
            country: data.country,
          },
          note: data.note || undefined,
          // Was bestätigt wurde, gehört in die Bestellung — im Streitfall zählt
          // nicht, was auf der Seite stand, sondern was belegbar ist.
          consent: { terms: true, waiver: einzelanfertigung ? verzicht : undefined },
        }),
      })
      const result = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !result.url) {
        // 503 heißt: Die Bezahlung ist gar nicht eingerichtet. Ein zweiter
        // Versuch scheitert genauso — das muss dranstehen.
        setError(res.status === 503 ? 'keine-zahlung' : 'allgemein')
        setSubmitting(false)
        return
      }

      // Warenkorb leeren und zu PayPal weiterleiten
      clear()
      window.location.href = result.url
    } catch {
      setError('allgemein')
      setSubmitting(false)
    }
  }

  const inputClass =
    'border-line focus:border-ink w-full border bg-white px-4 py-3 text-sm outline-none transition-colors'

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
            {dict.deliveryMethod}
          </h2>
          <div className="space-y-2">
            <label className="border-line has-checked:border-ink flex cursor-pointer items-center gap-3 border bg-white px-4 py-3 text-sm">
              <input
                type="radio"
                name="deliveryMethod"
                value="shipping"
                checked={deliveryMethod === 'shipping'}
                onChange={() => setDeliveryMethod('shipping')}
                className="accent-ink"
              />
              {dict.optionShipping}
            </label>
            <label className="border-line has-checked:border-ink flex cursor-pointer items-center gap-3 border bg-white px-4 py-3 text-sm">
              <input
                type="radio"
                name="deliveryMethod"
                value="pickup"
                checked={deliveryMethod === 'pickup'}
                onChange={() => setDeliveryMethod('pickup')}
                className="accent-ink"
              />
              {dict.optionPickup}
            </label>
            {deliveryMethod === 'pickup' && (
              <p className="text-ink-soft text-xs">{dict.pickupNote}</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
            {dict.paymentMethod}
          </h2>
          {paypalAvailable ? (
            <div className="border-line bg-paper-soft border px-4 py-3 text-sm">
              <p className="text-ink font-semibold">{dict.optionPaypal}</p>
              <p className="text-ink-soft mt-1 text-xs">{dict.paypalNote}</p>
            </div>
          ) : (
            /*
             * Ohne eingerichtete Zahlung führt der Bestellknopf ins Leere. Dann
             * lieber gleich hier sagen, dass es persönlich weitergeht — sonst
             * füllt jemand das ganze Formular aus und bekommt am Ende nur einen
             * Fehler.
             */
            <p className="border-accent bg-paper-soft text-ink border px-4 py-3 text-sm">
              {dict.errorNoPayment}
            </p>
          )}
        </div>

        <div>
          <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
            {dict.contactData}
          </h2>
          <div className="space-y-3">
            <input name="name" required placeholder={dict.name} className={inputClass} />
            <input name="email" type="email" required placeholder={dict.email} className={inputClass} />
            <input name="phone" type="tel" placeholder={dict.phone} className={inputClass} />
          </div>
        </div>

        {deliveryMethod === 'shipping' && (
          <div className="border-line bg-paper-soft border p-4 text-sm">
            <p className="text-ink-soft">{dict.paypalAddressNote}</p>
            <label className="text-ink mt-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={differentAddress}
                onChange={(e) => setDifferentAddress(e.target.checked)}
                className="accent-ink"
              />
              {dict.differentAddress}
            </label>
          </div>
        )}

        {showAddressForm && (
          <div>
            <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
              {dict.shippingAddress}
            </h2>
            <div className="space-y-3">
              <input name="line1" required placeholder={dict.line1} className={inputClass} />
              <input name="line2" placeholder={dict.line2} className={inputClass} />
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <input name="postalCode" required placeholder={dict.postalCode} className={inputClass} />
                <input name="city" required placeholder={dict.city} className={inputClass} />
              </div>
              <input
                name="country"
                required
                placeholder={dict.country}
                defaultValue={locale === 'fr' ? 'France' : 'Deutschland'}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <textarea name="note" rows={3} placeholder={dict.note} className={inputClass} />

        {error && (
          <p className="text-accent text-sm">
            {error === 'keine-zahlung' ? dict.errorNoPayment : dict.error}
          </p>
        )}

        <div className="border-line space-y-3 border-t pt-5">
          <label className="text-ink-soft flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              required
              checked={zustimmung}
              onChange={(e) => setZustimmung(e.target.checked)}
              className="accent-ink mt-0.5"
            />
            <span>{mitLinks(dict.consentTerms, locale)}</span>
          </label>

          {einzelanfertigung && (
            <label className="text-ink-soft flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                required
                checked={verzicht}
                onChange={(e) => setVerzicht(e.target.checked)}
                className="accent-ink mt-0.5"
              />
              <span>{dict.consentWaiver}</span>
            </label>
          )}

          {fehlendeZustimmung && <p className="text-accent text-sm">{dict.consentMissing}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={submitting || !paypalAvailable}
            className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-10 py-3.5 text-xs font-semibold text-white uppercase transition-colors disabled:opacity-50"
          >
            {dict.payNow}
          </button>
          <Link href={`/${locale}/warenkorb`} className="text-ink-soft hover:text-ink text-sm underline">
            {dict.backToCart}
          </Link>
        </div>
        <p className="text-ink-soft text-xs">{dict.redirectNotePaypal}</p>
      </form>

      <aside className="bg-paper-soft h-fit p-6">
        <ul className="space-y-3 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-ink-soft">
                {item.quantity}× {item.title}
                {item.variantTitle ? ` (${item.variantTitle})` : ''}
              </span>
              <span className="text-ink whitespace-nowrap">
                {formatPrice(item.unitPrice * item.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-line mt-4 space-y-1 border-t pt-3 text-sm">
          <div className="text-ink-soft flex justify-between">
            <span>{cartDict.subtotal}</span>
            <span>{formatPrice(subtotal, locale)}</span>
          </div>
          {shipping > 0 && (
            <div className="text-ink-soft flex justify-between">
              <span>{dict.shipping}</span>
              <span>{formatPrice(shipping, locale)}</span>
            </div>
          )}
          <div className="text-ink flex justify-between font-semibold">
            <span>{cartDict.total}</span>
            <span>{formatPrice(subtotal + shipping, locale)}</span>
          </div>
          <p className="text-ink-soft pt-1 text-xs">
            {dict.vatIncluded.replace('{rate}', String(vatRate))}
          </p>
        </div>
      </aside>
    </div>
  )
}
