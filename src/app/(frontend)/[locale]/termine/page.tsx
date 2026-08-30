import { notFound } from 'next/navigation'
import React from 'react'
import type { Metadata } from 'next'

import { Reveal, RevealItem, RevealStagger } from '../../../../components/motion/Reveal'
import { SplitTextReveal } from '../../../../components/motion/SplitTextReveal'
import { TerminKarte } from '../../../../components/Termine'
import { payloadClient } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { oeffentlicheTermine } from '../../../../lib/kalender/oeffentlich'
import { alternatesFor } from '../../../../lib/seo'

export const dynamic = 'force-dynamic'

/*
 * Eigene Kennzeichnung — sonst erbt die Seite die des Layouts und erklärt
 * sich selbst zur Startseite. Siehe den ausführlichen Vermerk in
 * `news/page.tsx`; derselbe Fehler, dieselbe Folge.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = t(locale)
  return {
    title: dict.events.title,
    description: dict.events.intro,
    alternates: alternatesFor(locale, '/termine'),
  }
}

/**
 * Wo Vincent als Nächstes zu finden ist.
 *
 * Die Termine stehen im Kalender des Büros und tragen `#öffentlich` in ihrer
 * Notiz — mehr braucht es nicht, und das geht auch vom Telefon aus (siehe
 * `lib/kalender/merkmale.ts`). Damit kann er von einer Messe aus eintragen,
 * wo er nächste Woche steht, ohne sich an einen Rechner zu setzen.
 */
export default async function TerminePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const payload = await payloadClient()
  const termine = await oeffentlicheTermine(payload, locale)

  /*
   * Ohne kommende Termine gibt es diese Seite nicht.
   *
   * Eine Seite, die „Zurzeit stehen keine Termine an" sagt, ist kein
   * Angebot — sie sieht aus, als wäre hier etwas eingeschlafen, und
   * ausgerechnet das steht dann monatelang im Netz. Der Menüpunkt
   * verschwindet aus demselben Grund mit (siehe `[locale]/layout.tsx`);
   * beides gehört zusammen, sonst führte ein Weg ins Leere.
   *
   * Steht wieder etwas an, ist die Seite von selbst wieder da — es gibt
   * nichts anzuschalten und damit auch nichts zu vergessen.
   */
  if (termine.length === 0) notFound()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <SplitTextReveal
        as="h1"
        text={dict.events.title}
        className="tracking-nav text-ink rule-bronze mb-6 text-2xl font-semibold uppercase"
      />

      <Reveal>
        <p className="text-ink-soft mb-10 max-w-2xl">{dict.events.intro}</p>
      </Reveal>

      <RevealStagger className="grid gap-4">
        {termine.map((termin) => (
          <RevealItem key={termin.id}>
            <TerminKarte termin={termin} sprache={locale} />
          </RevealItem>
        ))}
      </RevealStagger>
    </div>
  )
}
