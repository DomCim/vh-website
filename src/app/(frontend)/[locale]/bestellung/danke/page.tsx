import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Reveal } from '../../../../../components/motion/Reveal'
import { isLocale, t } from '../../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function ThankYouPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <Reveal>
        <div className="bg-ink mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full text-2xl text-white">
          ✓
        </div>
        <h1 className="tracking-nav text-ink text-2xl font-semibold uppercase">
          {dict.thanks.title}
        </h1>
        <p className="text-ink-soft mt-4 leading-relaxed">{dict.thanks.text}</p>
        <Link
          href={`/${locale}`}
          className="bg-ink tracking-nav hover:bg-dark-soft mt-8 inline-block px-8 py-3 text-xs font-semibold text-white uppercase transition-colors"
        >
          {dict.thanks.backHome}
        </Link>
      </Reveal>
    </div>
  )
}
