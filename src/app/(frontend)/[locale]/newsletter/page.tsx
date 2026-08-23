import { notFound } from 'next/navigation'
import React from 'react'

import { NewsletterAnmeldung } from '../../../../components/NewsletterAnmeldung'
import { payloadClient } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { newsletterAbmelden, newsletterBestaetigen } from '../../../../lib/newsletter'

export const dynamic = 'force-dynamic'

/*
 * Gehört nicht in den Index — und braucht deshalb eine eigene Angabe.
 *
 * Die Seite bedient vor allem die Links aus den Mails — Bestätigen und
 * Abmelden, jeweils mit einem Schlüssel im Adressfeld. Als Suchtreffer
 * hätte sie keinen Wert, und ein Abmeldelink im Index erst recht nicht.
 *
 * `follow: true`, damit den Verweisen von hier trotzdem gefolgt wird: Der
 * Warenkorb verlinkt zurück in den Laden, und diese Wege sollen nicht
 * abreißen. Ohne eigene Angabe erbte die Seite die des Layouts und erklärte
 * sich zur Startseite (`rel=canonical` auf `/de`) — drei Sprachen, dieselbe
 * dünne Seite, und Google entscheidet selbst, was davon zählt.
 */
export const metadata = { robots: { index: false, follow: true } }

/**
 * Newsletter-Seite: Anmeldung, Bestätigung und Abmeldung an einer Stelle.
 *
 * Die Links aus den Mails landen hier mit einem Schlüssel im Adressfeld —
 * ohne Zwischenseite, ohne Formular, ohne weiteren Klick. Wer sich abmelden
 * will, soll nicht erst suchen müssen.
 */
export default async function NewsletterSeite({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ bestaetigen?: string; abmelden?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const { bestaetigen, abmelden } = await searchParams
  const dict = t(locale)

  let meldung: { titel: string; text: string } | null = null

  if (bestaetigen || abmelden) {
    const payload = await payloadClient()
    if (bestaetigen) {
      const ok = await newsletterBestaetigen(payload, bestaetigen)
      meldung = ok
        ? { titel: dict.newsletter.confirmedTitle, text: dict.newsletter.confirmedText }
        : { titel: dict.newsletter.unknownTitle, text: dict.newsletter.unknownText }
    } else if (abmelden) {
      const ok = await newsletterAbmelden(payload, abmelden)
      meldung = ok
        ? { titel: dict.newsletter.goodbyeTitle, text: dict.newsletter.goodbyeText }
        : { titel: dict.newsletter.unknownTitle, text: dict.newsletter.unknownText }
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="tracking-nav text-ink mb-6 text-2xl font-semibold uppercase">
        {meldung?.titel ?? dict.newsletter.title}
      </h1>
      <p className="text-ink-soft mb-8">{meldung?.text ?? dict.newsletter.intro}</p>
      {!meldung && <NewsletterAnmeldung locale={locale} dict={dict.newsletter} />}
    </div>
  )
}
