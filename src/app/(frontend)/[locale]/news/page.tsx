import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Bild, type BildQuelle } from '../../../../components/Bild'

import { Reveal, RevealItem, RevealStagger } from '../../../../components/motion/Reveal'
import { SplitTextReveal } from '../../../../components/motion/SplitTextReveal'
import { payloadClient } from '../../../../lib/data'
import { formatDate, isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ rubrik?: string }>
}) {
  const { locale } = await params
  const { rubrik } = await searchParams
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const type = rubrik === 'news' || rubrik === 'ratgeber' ? rubrik : undefined
  const payload = await payloadClient()
  const { docs: news } = await payload.find({
    collection: 'news',
    where: {
      and: [
        { _status: { equals: 'published' } },
        ...(type ? [{ type: { equals: type } }] : []),
      ],
    },
    sort: '-publishedDate',
    locale,
    limit: 50,
    depth: 1,
  })

  const tabs = [
    { key: undefined, label: dict.news.tabAll },
    { key: 'news', label: dict.news.tabNews },
    { key: 'ratgeber', label: dict.news.tabGuides },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <SplitTextReveal
        as="h1"
        text={dict.news.title}
        className="tracking-nav text-ink rule-bronze mb-6 text-2xl font-semibold uppercase"
      />

      <Reveal>
        <div className="mb-10 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={`/${locale}/news${tab.key ? `?rubrik=${tab.key}` : ''}`}
              className={`tracking-nav border px-4 py-2 text-xs font-medium uppercase transition-colors ${
                type === tab.key
                  ? 'border-ink bg-ink text-on-ink'
                  : 'border-line text-ink hover:border-ink'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </Reveal>

      {news.length === 0 ? (
        <p className="text-ink-soft">{dict.news.empty}</p>
      ) : (
        <RevealStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((n) => (
            <RevealItem key={n.id}>
              <Link
                href={`/${locale}/news/${n.slug}`}
                className="group border-line block h-full border bg-paper transition-shadow hover:shadow-lg"
              >
                <div className="bg-paper-soft relative aspect-[16/10] overflow-hidden">
                  <Bild
                      media={n.coverImage as BildQuelle}
                      alt={n.title}
                      bevorzugt="card"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  {n.type === 'ratgeber' && (
                    <span className="bg-bronze tracking-nav absolute top-3 left-3 px-2 py-1 text-[10px] font-semibold text-on-ink uppercase">
                      {dict.news.guideBadge}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-ink-soft text-xs">{formatDate(n.publishedDate, locale)}</p>
                  <h2 className="tracking-nav text-ink mt-1 text-sm font-semibold uppercase">
                    {n.title}
                  </h2>
                  {n.excerpt && <p className="text-ink-soft mt-2 line-clamp-3 text-sm">{n.excerpt}</p>}
                  <p className="tracking-nav text-ink mt-4 text-xs font-medium uppercase underline-offset-4 group-hover:underline">
                    {dict.news.readMore} →
                  </p>
                </div>
              </Link>
            </RevealItem>
          ))}
        </RevealStagger>
      )}
    </div>
  )
}
