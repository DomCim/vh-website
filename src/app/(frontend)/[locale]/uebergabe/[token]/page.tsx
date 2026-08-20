import { notFound } from 'next/navigation'
import React from 'react'

import { Uebergabemappe } from '../../../../../components/shop/Uebergabemappe'
import { isLocale, t } from '../../../../../lib/i18n'

export const dynamic = 'force-dynamic'

/*
 * Nicht in den Suchindex, und auch nicht in die Adresszeile weitergereicht.
 *
 * Die Kennung steht im Pfad. Ohne `referrer: no-referrer` stünde sie in jeder
 * Anfrage, die diese Seite auslöst — und damit im Protokoll fremder Server.
 */
export const metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
}

/**
 * Die Übergabemappe für den Auftraggeber.
 *
 * Die Seite selbst holt **nichts** — weder Titel noch Dateiliste. Erst nach
 * dem Passwort gibt die Schnittstelle etwas heraus, und zwar an den Browser.
 * Andernfalls verriete schon die aufgerufene Seite, ob es die Kennung gibt und
 * wie die Mappe heißt; das ist genau das, was ein weitergeleiteter Link nicht
 * preisgeben soll.
 */
export default async function UebergabeSeite({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="tracking-nav text-ink rule-bronze mb-8 text-2xl font-semibold uppercase">
        {dict.handover.title}
      </h1>
      <Uebergabemappe token={token} labels={dict.handover} />
    </div>
  )
}
