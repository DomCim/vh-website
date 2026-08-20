import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '../../../../../components/RichText'
import { Besucherzaehlung } from '../../../../../components/shop/Besucherzaehlung'
import { getLegal, getSiteSettings } from '../../../../../lib/data'
import { isLocale, t } from '../../../../../lib/i18n'

export const dynamic = 'force-dynamic'

const PAGES = {
  impressum: 'impressum',
  datenschutzerklaerung: 'datenschutz',
  agb: 'agb',
  widerruf: 'widerruf',
  'versand-zahlung': 'versandZahlung',
} as const

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; page: string }>
}) {
  const { locale, page } = await params
  if (!isLocale(locale)) notFound()

  const field = PAGES[page as keyof typeof PAGES]
  if (!field) notFound()

  const dict = t(locale)
  const [legal, settings] = await Promise.all([getLegal(locale), getSiteSettings(locale)])
  const content = legal?.[field]

  const titles: Record<typeof field, string> = {
    impressum: dict.footer.impressum,
    datenschutz: dict.footer.datenschutz,
    agb: dict.footer.agb,
    widerruf: dict.footer.widerruf,
    versandZahlung: dict.footer.versandZahlung,
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="tracking-nav text-ink mb-8 text-2xl font-semibold uppercase">
        {titles[field]}
      </h1>
      {content ? <RichText data={content} /> : <p className="text-ink-soft">—</p>}

      {/*
        Der Abschnitt zur Besucherzählung entsteht aus der Einstellung, nicht
        aus dem Textfeld: Wird gezählt, steht er da — wird nicht gezählt,
        steht er nicht da. Ein von Hand gepflegter Absatz wäre irgendwann das
        eine, während die Website längst das andere tut.
      */}
      {field === 'datenschutz' && settings?.analytics?.eigeneZaehlung ? (
        <Besucherzaehlung locale={locale} />
      ) : null}

      {/* Das Muster-Widerrufsformular gehört unter die Belehrung, nicht auf eine
          eigene Seite, die niemand findet. */}
      {field === 'widerruf' && legal?.widerrufsformular ? (
        <div className="border-line mt-10 border-t pt-8">
          <RichText data={legal.widerrufsformular} />
        </div>
      ) : null}
    </div>
  )
}
