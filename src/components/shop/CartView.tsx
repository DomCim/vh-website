'use client'

import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { formatPrice, type Locale } from '../../lib/i18n'
import { cartItemKey, useCart } from './CartProvider'

type CartDict = {
  empty: string
  continueShopping: string
  subtotal: string
  discount: string
  shipping: string
  total: string
  checkout: string
  remove: string
  quantity: string
  promoCode: string
  applyCode: string
  promoApplied: string
  promoInvalid: string
  shippingLabel: string
  priceNote: string
}

export type PromoPreview = {
  valid: boolean
  title?: string
  discount?: number
}

export function CartView({ locale, dict }: { locale: Locale; dict: CartDict }) {
  const { items, removeItem, setQuantity, subtotal } = useCart()
  const [code, setCode] = useState('')
  const [promo, setPromo] = useState<PromoPreview | null>(null)
  const [checking, setChecking] = useState(false)

  // Automatische Aktionen (ohne Code) + eingegebener Code werden
  // server-seitig geprüft; hier nur die Vorschau für die Anzeige.
  useEffect(() => {
    if (items.length === 0) {
      setPromo(null)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/promotion-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            code: code || undefined,
            items: items.map((i) => ({
              productId: i.productId,
              variantTitle: i.variantTitle,
              quantity: i.quantity,
            })),
          }),
        })
        if (res.ok) {
          const data = (await res.json()) as PromoPreview
          setPromo(data)
        }
      } catch {
        // Vorschau ist optional
      } finally {
        setChecking(false)
      }
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [items, code])

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-ink-soft mb-6">{dict.empty}</p>
        <Link
          href={`/${locale}`}
          className="bg-ink tracking-nav hover:bg-dark-soft inline-block px-8 py-3 text-xs font-semibold text-white uppercase transition-colors"
        >
          {dict.continueShopping}
        </Link>
      </div>
    )
  }

  const discount = promo?.valid ? (promo.discount ?? 0) : 0
  const shipping = items.reduce((s, i) => s + (i.shippingCost ?? 0) * i.quantity, 0)
  const total = Math.max(0, subtotal - discount) + shipping

  return (
    <div>
      <ul className="divide-line border-line divide-y border-y">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const key = cartItemKey(item)
            return (
              <motion.li
                key={key}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-4 py-5"
              >
                {item.image && (
                  <Link
                    href={`/${locale}/${item.categorySlug}/${item.slug}`}
                    className="bg-paper-soft block h-24 w-28 shrink-0 overflow-hidden"
                  >
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                  </Link>
                )}
                <div className="flex flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <Link
                      href={`/${locale}/${item.categorySlug}/${item.slug}`}
                      className="tracking-nav text-ink text-sm font-semibold uppercase hover:underline"
                    >
                      {item.title}
                    </Link>
                    {(item.variantTitle || item.color) && (
                      <p className="text-ink-soft mt-1 text-xs">
                        {[item.variantTitle, item.color].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {(item.shippingCost ?? 0) > 0 && (
                      <p className="text-ink-soft mt-1 text-xs">
                        + {formatPrice(item.shippingCost!, locale)} {dict.shippingLabel} / Stk.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(key)}
                      className="text-ink-soft hover:text-accent mt-2 cursor-pointer text-xs underline underline-offset-2"
                    >
                      {dict.remove}
                    </button>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="border-line flex items-center border">
                      <button
                        type="button"
                        aria-label="−"
                        onClick={() => setQuantity(key, item.quantity - 1)}
                        className="hover:bg-paper-soft h-9 w-9 cursor-pointer"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="+"
                        onClick={() => setQuantity(key, item.quantity + 1)}
                        className="hover:bg-paper-soft h-9 w-9 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-ink w-24 text-right text-sm font-semibold">
                      {formatPrice(item.unitPrice * item.quantity, locale)}
                    </p>
                  </div>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div className="flex h-11 max-w-xs flex-1 items-stretch">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setChecking(true)
            }}
            placeholder={dict.promoCode}
            className="border-line focus:border-ink w-full border px-3 text-sm uppercase outline-none"
          />
        </div>

        <div className="w-full max-w-xs space-y-2 text-sm sm:text-right">
          <div className="text-ink-soft flex justify-between sm:justify-end sm:gap-8">
            <span>{dict.subtotal}</span>
            <span>{formatPrice(subtotal, locale)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-700 sm:justify-end sm:gap-8">
              <span>
                {dict.discount}
                {promo?.title ? ` (${promo.title})` : ''}
              </span>
              <span>−{formatPrice(discount, locale)}</span>
            </div>
          )}
          {code && !checking && promo && !promo.valid && (
            <p className="text-accent text-xs">{dict.promoInvalid}</p>
          )}
          {shipping > 0 && (
            <div className="text-ink-soft flex justify-between sm:justify-end sm:gap-8">
              <span>{dict.shipping}</span>
              <span>{formatPrice(shipping, locale)}</span>
            </div>
          )}
          <div className="text-ink border-line flex justify-between border-t pt-2 text-base font-semibold sm:justify-end sm:gap-8">
            <span>{dict.total}</span>
            <span>{formatPrice(total, locale)}</span>
          </div>
          <p className="text-ink-soft text-xs">{dict.priceNote}</p>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Link
          href={`/${locale}/kasse${code ? `?code=${encodeURIComponent(code)}` : ''}`}
          className="bg-ink tracking-nav hover:bg-dark-soft inline-block px-10 py-3.5 text-xs font-semibold text-white uppercase transition-colors"
        >
          {dict.checkout} →
        </Link>
      </div>
    </div>
  )
}
