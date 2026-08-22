import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Bild, type BildQuelle } from '../../../../../components/Bild'

import { Reveal } from '../../../../../components/motion/Reveal'
import { RichText } from '../../../../../components/RichText'
import { getNewsBySlug, mediaUrl } from '../../../../../lib/data'
import { formatDate, isLocale, t } from '../../../../../lib/i18n'
import { absoluteUrl, alternatesFor, BASE_URL, breadcrumbJsonLd, jsonLd } from '../../../../../lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const article = await getNewsBySlug(slug, locale)
  if (!article) return {}
  const image = absoluteUrl(mediaUrl(article.coverImage, 'large'))
  return {
    title: article.title,
    description: article.excerpt || undefined,
    alternates: alternatesFor(locale, `/news/${slug}`),
    openGraph: {
      title: article.title,
      description: article.excerpt || undefined,
      type: 'article',
      publishedTime: article.publishedDate,
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const article = await getNewsBySlug(slug, locale)
  if (!article) notFound()

  const articleJsonLd = jsonLd({
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt || undefined,
    datePublished: article.publishedDate,
    image: absoluteUrl(mediaUrl(article.coverImage, 'large')),
    url: `${BASE_URL}/${locale}/news/${slug}`,
    author: { '@type': 'Organization', name: 'Vincent Hellmann' },
  })

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />
      {/* Der Weg im Suchergebnis: vincent-hellmann.com › News › Titel */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd(locale, [
            { name: t(locale).nav.news, pfad: '/news' },
            { name: article.title, pfad: `/news/${slug}` },
          ]),
        }}
      />
      <Reveal>
        <p className="text-ink-soft text-sm">{formatDate(article.publishedDate, locale)}</p>
        <h1 className="tracking-nav text-ink mt-2 mb-8 text-2xl font-semibold uppercase sm:text-3xl">
          {article.title}
        </h1>
      </Reveal>

      {article.coverImage ? (
        <Reveal className="bg-paper-soft mb-8 overflow-hidden">
          <Bild
              media={article.coverImage as BildQuelle}
              alt={article.title}
              bevorzugt="large"
              sizes="(min-width: 1024px) 66vw, 100vw"
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
