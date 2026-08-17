import type { Metadata } from 'next'
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
import { absoluteUrl, alternatesFor, BASE_URL, jsonLd } from '../../../../../lib/seo'

export const dynamic = 'force-dynamic'

type PageParams = Promise<{ locale: string; categorySlug: string; itemSlug: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, categorySlug, itemSlug } = await params
  if (!isLocale(locale)) return {}
  const product = await getProductBySlug(itemSlug, locale)
  if (!product) return {}
  const image = absoluteUrl(mediaUrl(product.images?.[0], 'large'))
  return {
    title: product.title,
    description: product.shortDescription || undefined,
    alternates: alternatesFor(locale, `/${categorySlug}/${itemSlug}`),
    openGraph: {
      title: product.title,
      description: product.shortDescription || undefined,
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function ProductPage({ params }: { params: PageParams }) {
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

  // schema.org-Produktdaten für Google Rich Results
  const prices = [
    ...(product.variants?.map((v) => v.price) ?? []),
    ...(typeof product.price === 'number' ? [product.price] : []),
  ]
  const minPrice = prices.length ? Math.min(...prices) : undefined
  const productJsonLd = jsonLd({
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription || undefined,
    image: images.map((i) => absoluteUrl(i.url)).filter(Boolean),
    url: `${BASE_URL}/${locale}/${categorySlug}/${itemSlug}`,
    brand: { '@type': 'Brand', name: 'Vincent Hellmann' },
    ...(minPrice !== undefined &&
      !product.onRequestOnly && {
        offers: {
          '@type': 'Offer',
          priceCurrency: 'EUR',
          price: minPrice,
          availability:
            product.available !== false
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          url: `${BASE_URL}/${locale}/${categorySlug}/${itemSlug}`,
        },
      }),
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
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
            inquiry: {
              name: dict.contact.name,
              email: dict.contact.email,
              phone: dict.contact.phone,
              message: dict.contact.message,
              send: dict.contact.send,
              success: dict.contact.success,
              error: dict.contact.error,
            },
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
