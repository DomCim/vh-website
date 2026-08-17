import { notFound } from 'next/navigation'
import React from 'react'

import { Reveal } from '../../../../../components/motion/Reveal'
import { RichText } from '../../../../../components/RichText'
import { getNewsBySlug, mediaAlt, mediaUrl } from '../../../../../lib/data'
import { formatDate, isLocale } from '../../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const article = await getNewsBySlug(slug, locale)
  if (!article) notFound()

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Reveal>
        <p className="text-ink-soft text-sm">{formatDate(article.publishedDate, locale)}</p>
        <h1 className="tracking-nav text-ink mt-2 mb-8 text-2xl font-semibold uppercase sm:text-3xl">
          {article.title}
        </h1>
      </Reveal>

      {article.coverImage ? (
        <Reveal className="bg-paper-soft mb-8 overflow-hidden">
          <img
            src={mediaUrl(article.coverImage, 'large')}
            alt={mediaAlt(article.coverImage, article.title)}
            className="w-full object-cover"
          />
        </Reveal>
      ) : null}

      {article.excerpt && (
        <Reveal>
          <p className="text-ink mb-6 text-lg leading-relaxed font-medium">{article.excerpt}</p>
        </Reveal>
      )}

      <Reveal>
        <RichText data={article.content} />
      </Reveal>
    </article>
  )
}
