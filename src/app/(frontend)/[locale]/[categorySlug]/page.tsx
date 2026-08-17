import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { CategoryTile } from '../../../../components/CategoryTile'
import { Reveal, RevealItem, RevealStagger } from '../../../../components/motion/Reveal'
import { ProductCard } from '../../../../components/ProductCard'
import {
  getCategoryBySlug,
  getChildCategories,
  getProductsByCategory,
  mediaAlt,
  mediaUrl,
} from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { absoluteUrl, alternatesFor } from '../../../../lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; categorySlug: string }>
}): Promise<Metadata> {
  const { locale, categorySlug } = await params
  if (!isLocale(locale)) return {}
  const category = await getCategoryBySlug(categorySlug, locale)
  if (!category) return {}
  const image = absoluteUrl(mediaUrl(category.image, 'large'))
  return {
    title: category.name,
    description: category.description || undefined,
    alternates: alternatesFor(locale, `/${categorySlug}`),
    openGraph: {
      title: category.name,
      description: category.description || undefined,
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; categorySlug: string }>
}) {
  const { locale, categorySlug } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const category = await getCategoryBySlug(categorySlug, locale)
  if (!category) notFound()

  const children = await getChildCategories(category.id, locale)
  const categoryIds = [category.id, ...children.map((c) => c.id)]
  const products = await getProductsByCategory(categoryIds, locale)

  const headerImage = category.image

  return (
    <div>
      {headerImage ? (
        <div className="bg-dark relative h-64 overflow-hidden sm:h-80">
          <img
            src={mediaUrl(headerImage, 'large')}
            alt={mediaAlt(headerImage, category.name)}
            className="h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <div className="mx-auto max-w-7xl">
              <h1 className="tracking-nav text-2xl font-semibold uppercase text-white sm:text-3xl">
                {category.name}
              </h1>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {!headerImage && (
          <Reveal>
            <h1 className="tracking-nav text-ink mb-4 text-2xl font-semibold uppercase">
              {category.name}
            </h1>
          </Reveal>
        )}
        {category.description && (
          <Reveal>
            <p className="text-ink-soft mb-10 max-w-3xl leading-relaxed">{category.description}</p>
          </Reveal>
        )}

        {children.length > 0 && (
          <RevealStagger className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((c) => (
              <RevealItem key={c.id}>
                <CategoryTile
                  href={`/${locale}/${c.slug}`}
                  name={c.name}
                  description={c.description}
                  image={c.image}
                />
              </RevealItem>
            ))}
          </RevealStagger>
        )}

        {products.length > 0 && (
          <RevealStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <RevealItem key={p.id}>
                <ProductCard
                  product={p}
                  categorySlug={categorySlug}
                  locale={locale}
                  labels={{ from: dict.product.from, onRequest: dict.product.onRequest }}
                />
              </RevealItem>
            ))}
          </RevealStagger>
        )}
      </div>
    </div>
  )
}
