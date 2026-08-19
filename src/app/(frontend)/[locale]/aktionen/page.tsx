import { notFound } from 'next/navigation'
import React from 'react'

import { Bild, type BildQuelle } from '../../../../components/Bild'

import { Reveal, RevealItem, RevealStagger } from '../../../../components/motion/Reveal'
import { getActivePromotions } from '../../../../lib/data'
import { formatDate, isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function PromotionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const promotions = await getActivePromotions(locale)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Reveal>
        <h1 className="tracking-nav text-ink rule-bronze mb-10 text-2xl font-semibold uppercase">
          {dict.promotions.title}
        </h1>
      </Reveal>

      {promotions.length === 0 ? (
        <p className="text-ink-soft">{dict.promotions.empty}</p>
      ) : (
        <RevealStagger className="space-y-8">
          {promotions.map((p) => (
            <RevealItem key={p.id}>
              <article className="border-line grid overflow-hidden border bg-paper sm:grid-cols-[280px_1fr]">
                {p.image ? (
                  <div className="bg-paper-soft aspect-[4/3] sm:aspect-auto">
                    <Bild
                        media={p.image as BildQuelle}
                        alt={p.title}
                        bevorzugt="card"
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="h-full w-full object-cover"
                      />
                  </div>
                ) : (
                  <div className="bg-accent flex items-center justify-center p-8 text-4xl font-bold text-on-ink">
                    {p.discountType === 'percent' ? `−${p.discountValue}%` : `−${p.discountValue} €`}
                  </div>
                )}
                <div className="p-6">
                  <h2 className="tracking-nav text-ink text-lg font-semibold uppercase">{p.title}</h2>
                  {p.description && (
                    <p className="text-ink-soft mt-2 leading-relaxed">{p.description}</p>
                  )}
                  <div className="text-ink-soft mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <span className="bg-accent tracking-nav px-3 py-1 text-xs font-semibold text-on-ink uppercase">
                      {p.discountType === 'percent'
                        ? `−${p.discountValue} %`
                        : `−${p.discountValue} €`}
                    </span>
                    <span>
                      {dict.promotions.validUntil} {formatDate(p.endDate, locale)}
                    </span>
                    {p.code && (
                      <span>
                        {dict.promotions.code}:{' '}
                        <code className="bg-paper-soft border-line rounded border px-2 py-0.5 font-mono text-xs">
                          {p.code}
                        </code>
                      </span>
                    )}
                  </div>
                </div>
              </article>
            </RevealItem>
          ))}
        </RevealStagger>
      )}
    </div>
  )
}
