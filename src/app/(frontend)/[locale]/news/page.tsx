import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Reveal, RevealItem, RevealStagger } from '../../../../components/motion/Reveal'
import { getNews, mediaAlt, mediaUrl } from '../../../../lib/data'
import { formatDate, isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const news = await getNews(locale, 50)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Reveal>
        <h1 className="tracking-nav text-ink mb-10 text-2xl font-semibold uppercase">
          {dict.news.title}
        </h1>
      </Reveal>

      {news.length === 0 ? (
        <p className="text-ink-soft">{dict.news.empty}</p>
      ) : (
        <RevealStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((n) => (
            <RevealItem key={n.id}>
              <Link
                href={`/${locale}/news/${n.slug}`}
                className="group border-line block h-full border bg-white transition-shadow hover:shadow-lg"
              >
                <div className="bg-paper-soft aspect-[16/10] overflow-hidden">
                  <img
                    src={mediaUrl(n.coverImage, 'card')}
                    alt={mediaAlt(n.coverImage, n.title)}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
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
