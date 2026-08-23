import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Fragen, gueltigeFragen } from '../../../../components/Fragen'
import { MassanfertigungForm } from '../../../../components/MassanfertigungForm'
import { Reveal } from '../../../../components/motion/Reveal'
import { getSiteSettings } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { alternatesFor } from '../../../../lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = t(locale)
  return {
    title: dict.custom.title,
    description: dict.custom.intro,
    alternates: alternatesFor(locale, '/massanfertigung'),
  }
}

export default async function MassanfertigungSeite({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)
  const settings = await getSiteSettings(locale)

  /*
   * Die häufigen Fragen stehen hier weiterhin — wer gerade das Formular
   * ausfüllt, fragt sich genau jetzt, wie lange die Fertigung dauert.
   *
   * Die **Auszeichnung** für Suchmaschinen sitzt allerdings nicht mehr hier,
   * sondern auf der eigenen Seite `/faq`. Dieselben Fragen zweimal
   * ausgezeichnet wären zwei Seiten, die um denselben Treffer streiten —
   * und die Fragen handeln zum größten Teil gar nicht von Maßanfertigung.
   */
  const fragen = gueltigeFragen(settings?.faq)

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <Reveal>
        <h1 className="tracking-nav text-ink heading-rule text-2xl font-semibold uppercase">
          {dict.custom.title}
        </h1>
        <p className="text-ink-soft mt-4 leading-relaxed">{dict.custom.intro}</p>
        {settings?.craft?.notice && (
          <p className="text-ink-soft border-line mt-4 border-l-2 pl-3 text-sm leading-relaxed">
            {settings.craft.notice}
          </p>
        )}
      </Reveal>

      <MassanfertigungForm
        locale={locale}
        labels={{
          name: dict.contact.name,
          email: dict.contact.email,
          phone: dict.contact.phone,
          message: dict.contact.message,
          width: dict.custom.width,
          depth: dict.custom.depth,
          height: dict.custom.height,
          color: dict.custom.color,
          purpose: dict.custom.purpose,
          desiredDate: dict.custom.desiredDate,
          upload: dict.custom.upload,
          send: dict.custom.send,
          success: dict.custom.success,
          error: dict.custom.error,
        }}
      />

      {fragen.length > 0 && (
        <Reveal>
          <section className="mt-16">
            <h2 className="tracking-nav text-ink heading-rule text-lg font-semibold uppercase">
              {dict.custom.faqTitle}
            </h2>
            <div className="mt-6">
              <Fragen fragen={fragen} />
            </div>
            <Link
              href={`/${locale}/faq`}
              className="tracking-nav text-bronze mt-6 inline-block text-xs font-semibold uppercase underline-offset-4 hover:underline"
            >
              {dict.faq.all} →
            </Link>
          </section>
        </Reveal>
      )}
    </div>
  )
}
