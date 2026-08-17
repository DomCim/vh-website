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
  optionCard: string
  optionPaypal: string
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
  redirectNote: string
  backToCart: string
  error: string
}

type CartDict = {
  empty: string
  continueShopping: string
  subtotal: string
  total: string
}

export function CheckoutForm({
  locale,
  dict,
  cartDict,
  initialCode,
  paypalAvailable = false,
}: {
  locale: Locale
  dict: CheckoutDict
  cartDict: CartDict
  initialCode?: string
  paypalAvailable?: boolean
}) {
  const { items, subtotal, clear } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping')
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe')

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
          className="bg-ink tracking-nav hover:bg-dark-soft inline-block px-8 py-3 text-xs font-semibold text-white uppercase transition-colors"
        >
          {cartDict.continueShopping}
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(false)
    const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          promoCode: initialCode,
          deliveryMethod,
          paymentMethod,
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
        }),
      })
      const result = (await res.json()) as { url?: string }
      if (!res.ok || !result.url) throw new Error('checkout failed')

      // Warenkorb leeren und zu Stripe weiterleiten
      clear()
      window.location.href = result.url
    } catch {
      setError(true)
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

        {paypalAvailable && (
          <div>
            <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
              {dict.paymentMethod}
            </h2>
            <div className="space-y-2">
              <label className="border-line has-checked:border-ink flex cursor-pointer items-center gap-3 border bg-white px-4 py-3 text-sm">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="stripe"
                  checked={paymentMethod === 'stripe'}
                  onChange={() => setPaymentMethod('stripe')}
                  className="accent-ink"
                />
                {dict.optionCard}
              </label>
              <label className="border-line has-checked:border-ink flex cursor-pointer items-center gap-3 border bg-white px-4 py-3 text-sm">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="paypal"
                  checked={paymentMethod === 'paypal'}
                  onChange={() => setPaymentMethod('paypal')}
                  className="accent-ink"
                />
                {dict.optionPaypal}
              </label>
            </div>
          </div>
        )}

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

        {error && <p className="text-accent text-sm">{dict.error}</p>}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="bg-ink tracking-nav hover:bg-dark-soft cursor-pointer px-10 py-3.5 text-xs font-semibold text-white uppercase transition-colors disabled:opacity-50"
          >
            {dict.payNow}
          </button>
          <Link href={`/${locale}/warenkorb`} className="text-ink-soft hover:text-ink text-sm underline">
            {dict.backToCart}
          </Link>
        </div>
        <p className="text-ink-soft text-xs">{dict.redirectNote}</p>
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
        </div>
      </aside>
    </div>
  )
}
