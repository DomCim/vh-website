import Link from 'next/link'
import React from 'react'

import { mediaAlt, mediaUrl } from '../lib/data'
import { formatPrice, type Locale } from '../lib/i18n'

type Product = {
  slug?: string | null
  title: string
  shortDescription?: string | null
  price?: number | null
  onRequestOnly?: boolean | null
  images?: unknown[] | null
  variants?: { price: number }[] | null
}

export function ProductCard({
  product,
  categorySlug,
  locale,
  labels,
}: {
  product: Product
  categorySlug: string
  locale: Locale
  labels: { from: string; onRequest: string }
}) {
  const image = product.images?.[0]
  const prices = [
    ...(product.variants?.map((v) => v.price) ?? []),
    ...(typeof product.price === 'number' ? [product.price] : []),
  ]
  const minPrice = prices.length ? Math.min(...prices) : undefined
  const hasVariants = (product.variants?.length ?? 0) > 0

  return (
    <Link
      href={`/${locale}/${categorySlug}/${product.slug}`}
      className="group border-line block border bg-white transition-shadow hover:shadow-lg"
    >
      <div className="bg-paper-soft aspect-[4/3] overflow-hidden">
        {image ? (
          <img
            src={mediaUrl(image, 'card')}
            alt={mediaAlt(image, product.title)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="p-5">
        <h3 className="tracking-nav text-ink text-sm font-semibold uppercase">{product.title}</h3>
        {product.shortDescription && (
          <p className="text-ink-soft mt-2 line-clamp-2 text-sm">{product.shortDescription}</p>
        )}
        <p className="text-ink mt-3 text-sm font-medium">
          {product.onRequestOnly || minPrice === undefined
            ? labels.onRequest
            : `${hasVariants ? `${labels.from} ` : ''}${formatPrice(minPrice, locale)}`}
        </p>
      </div>
    </Link>
  )
}
