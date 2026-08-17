import Link from 'next/link'
import React from 'react'

import type { Locale } from '../lib/i18n'

type Promotion = {
  id: number | string
  title: string
  description?: string | null
  code?: string | null
}

export function PromoBanner({
  promotions,
  locale,
}: {
  promotions: Promotion[]
  locale: Locale
}) {
  if (promotions.length === 0) return null
  const promo = promotions[0]

  return (
    <Link href={`/${locale}/aktionen`} className="bg-accent block text-white transition-opacity hover:opacity-95">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-3 text-center text-sm sm:px-6">
        <span className="tracking-nav font-semibold uppercase">{promo.title}</span>
        {promo.description && <span className="text-white/90">{promo.description}</span>}
        {promo.code && (
          <span className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs">{promo.code}</span>
        )}
        <span aria-hidden>→</span>
      </div>
    </Link>
  )
}
