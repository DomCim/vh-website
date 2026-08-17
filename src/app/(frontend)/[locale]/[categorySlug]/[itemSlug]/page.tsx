import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Reveal } from '../../../../../components/motion/Reveal'
import { RichText } from '../../../../../components/RichText'
import { ProductDetail } from '../../../../../components/shop/ProductDetail'
import {
  getCategoryBySlug,
  getProductBySlug,
  mediaAlt,
  mediaUrl,
} from '../../../../../lib/data'
import { isLocale, t } from '../../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; categorySlug: string; itemSlug: string }>
}) {
  const { locale, categorySlug, itemSlug } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const category = await getCategoryBySlug(categorySlug, locale)
  if (!category) notFound()

  const product = await getProductBySlug(itemSlug, locale)
  if (!product) notFound()

  const images = (product.images ?? []).map((img) => ({
    url: mediaUrl(img, 'large') || '',
    alt: mediaAlt(img, product.title),
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Reveal>
        <Link
          href={`/${locale}/${categorySlug}`}
          className="tracking-nav text-ink-soft hover:text-ink text-xs uppercase"
        >
          ← {dict.product.backToCategory}
        </Link>
      </Reveal>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductDetail
          locale={locale}
          product={{
            id: product.id,
            slug: product.slug,
            title: product.title,
            price: product.price ?? undefined,
            shippingCost: product.shippingCost ?? undefined,
            onRequestOnly: Boolean(product.onRequestOnly),
            available: product.available !== false,
            variants: (product.variants ?? []).map((v) => ({
              title: v.title,
              price: v.price,
            })),
            colorOptions: (product.colorOptions ?? []).map((c) => ({
              name: c.name,
              hex: c.hex ?? undefined,
            })),
            images,
            categorySlug,
          }}
          dict={{
            addToCart: dict.product.addToCart,
            added: dict.product.added,
            onRequest: dict.product.onRequest,
            requestNow: dict.product.requestNow,
            variant: dict.product.variant,
            color: dict.product.color,
            priceNote: dict.product.priceNote,
            shippingPerItem: dict.product.shippingPerItem,
            freeShipping: dict.product.freeShipping,
            pickupAvailable: dict.product.pickupAvailable,
            unavailable: dict.product.unavailable,
          }}
          shortDescription={product.shortDescription ?? undefined}
        />
      </div>

      {product.description ? (
        <Reveal className="mt-14 max-w-3xl">
          <RichText data={product.description} />
        </Reveal>
      ) : null}
    </div>
  )
}
