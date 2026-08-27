import { notFound } from 'next/navigation'
import React from 'react'

import { MarkenAnsicht } from '../../../../../components/shop/MarkenAnsicht'
import { isLocale, t } from '../../../../../lib/i18n'

export const dynamic = 'force-dynamic'

/*
 * Nicht in den Suchindex, und der Code nicht in die Adresszeile fremder
 * Server: Ohne `referrer: no-referrer` stünde er in jeder Anfrage, die diese
 * Seite auslöst — dasselbe Prinzip wie bei der Übergabemappe.
 */
export const metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
}

/**
 * Die Laufmarke — was der QR-Code an der Magnettafel öffnet.
 *
 * Die Seite selbst holt **nichts**: Weder Auftrag noch Schritt stehen im
 * ausgelieferten HTML. Erst die Client-Komponente fragt die Schnittstelle,
 * und die entscheidet nach Anmeldung, was sichtbar wird. Andernfalls verriete
 * schon die Seitenauslieferung, ob es den Code gibt und woran er hängt —
 * genau das, was ein abfotografierter Code nicht preisgeben soll.
 */
export default async function MarkenSeite({
  params,
}: {
  params: Promise<{ locale: string; code: string }>
}) {
  const { locale, code } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="tracking-nav text-ink rule-bronze mb-8 text-2xl font-semibold uppercase">
        {dict.marke.title}
      </h1>
      <MarkenAnsicht code={code} locale={locale} labels={dict.marke} />
    </div>
  )
}
