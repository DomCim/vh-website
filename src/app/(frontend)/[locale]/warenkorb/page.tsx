import { notFound } from 'next/navigation'
import React from 'react'

import { CartView } from '../../../../components/shop/CartView'
import { isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

/*
 * Gehört nicht in den Index — und braucht deshalb eine eigene Angabe.
 *
 * Ein Warenkorb ist für jeden Besucher ein anderer und meistens leer;
 * gefunden werden soll die Ware, nicht das Behältnis.
 *
 * `follow: true`, damit den Verweisen von hier trotzdem gefolgt wird: Der
 * Warenkorb verlinkt zurück in den Laden, und diese Wege sollen nicht
 * abreißen. Ohne eigene Angabe erbte die Seite die des Layouts und erklärte
 * sich zur Startseite (`rel=canonical` auf `/de`) — drei Sprachen, dieselbe
 * dünne Seite, und Google entscheidet selbst, was davon zählt.
 */
export const metadata = { robots: { index: false, follow: true } }

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="tracking-nav text-ink mb-8 text-2xl font-semibold uppercase">
        {dict.cart.title}
      </h1>
      <CartView locale={locale} dict={dict.cart} />
    </div>
  )
}
