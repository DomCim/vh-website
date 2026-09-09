import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import React from 'react'

import { Bild, type BildQuelle } from '../../../../components/Bild'

import { CategoryTile } from '../../../../components/CategoryTile'
import { Reveal, RevealItem, RevealStagger } from '../../../../components/motion/Reveal'
import { ProductCard } from '../../../../components/ProductCard'
import { adressenAllerSprachen, adressenFuer, findeNachAdresse } from '../../../../lib/adressen'
import { aktionFuerArtikel } from '../../../../lib/aktionspreis'
import {
  getChildCategories,
  getPreisaktionen,
  getProductsByCategory,
  mediaUrl,
  payloadClient,
} from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { absoluteUrl, alternatesFuer } from '../../../../lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; categorySlug: string }>
}): Promise<Metadata> {
  const { locale, categorySlug } = await params
  if (!isLocale(locale)) return {}
  const payload = await payloadClient()
  const fund = await findeNachAdresse(payload, 'categories', categorySlug, locale)
  if (!fund) return {}
  const category = fund.doc as unknown as { name?: string; description?: string; image?: unknown }
  const image = absoluteUrl(mediaUrl(category.image, 'large'))
  /*
   * Die Verweise auf die Sprachfassungen tragen deren eigene Adressen — sonst
   * zeigte der französische Verweis auf einen deutschen Pfad, den es dort
   * nicht gibt.
   */
  const alleSprachen = (await payload
    .findByID({ collection: 'categories', id: fund.doc.id as number, locale: 'all' as never, depth: 0, overrideAccess: true })
    .catch(() => null)) as Record<string, unknown> | null
  const pfade = alleSprachen
    ? Object.fromEntries(
        Object.entries(adressenAllerSprachen(alleSprachen)).map(([l, a]) => [l, `/${a}`]),
      )
    : null
  return {
    title: category.name,
    description: category.description || undefined,
    ...(pfade ? { alternates: alternatesFuer(locale, pfade as never) } : {}),
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

  const payload = await payloadClient()
  /*
   * Gerufen werden kann die Kategorie unter ihrer heutigen Adresse, unter dem
   * Slug oder unter einer, die sie einmal trug — `findeNachAdresse` klärt das
   * und sagt, welche die maßgebliche ist.
   */
  const fund = await findeNachAdresse(payload, 'categories', categorySlug, locale)
  if (!fund) notFound()
  if (fund.umleiten) permanentRedirect(`/${locale}/${fund.kanonisch}`)
  const category = fund.doc as unknown as {
    id: number
    name: string
    description?: string | null
    image?: unknown
  }
  const kategorieAdresse = fund.kanonisch

  const children = await getChildCategories(category.id, locale)

  /*
   * Nur die Artikel, die **in dieser** Kategorie liegen.
   *
   * Vorher standen auch die der Unterkategorien mit hier — auf „Outdoor" also
   * die drei Kacheln Möbel, Pflanzen und Feuer **und** darunter noch einmal
   * alle Stücke aus allen dreien. Dieselbe Ware zweimal auf einer Seite, und
   * die Kacheln darüber wirkten wie Zierde.
   *
   * Schlimmer als die Dopplung war die Adresse: Ein Sofa aus „Möbel" bekam auf
   * der Outdoor-Seite den Link `/de/outdoor/outdoor-sofa-os`, obwohl es unter
   * `/de/moebel/outdoor-sofa-os` zu Hause ist. Beide Adressen lieferten
   * dieselbe Seite aus und erklärten sich obendrein jeweils selbst für die
   * maßgebliche — für Google zwei Seiten mit gleichem Inhalt, die sich
   * gegenseitig die Bedeutung wegnehmen.
   *
   * Eine Kategorie zeigt jetzt ihre Kacheln und ihre eigenen Artikel. Wer
   * tiefer will, klickt eine Kachel an — dafür sind sie da.
   */
  const products = await getProductsByCategory([category.id], locale)
  // Die Adressen der Stücke in dieser Sprache — siehe `adressenFuer`
  const artikelAdressen = await adressenFuer(
    payload,
    'products',
    products.map((p) => p.id),
    locale,
  )

  /*
   * Die laufenden Aktionen einmal für die ganze Seite — daraus wird je Artikel
   * entschieden, ob ein Streichpreis danebensteht.
   */
  const aktionen = await getPreisaktionen(locale)

  const headerImage = category.image

  return (
    <div>
      {headerImage ? (
        <div className="bg-dark relative h-64 overflow-hidden sm:h-80">
          <Bild
              media={headerImage as BildQuelle}
              alt={category.name}
              bevorzugt="large"
              sizes="(min-width: 1024px) 66vw, 100vw"
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
            <h1 className="tracking-nav text-ink rule-bronze mb-4 text-2xl font-semibold uppercase">
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
                  categorySlug={kategorieAdresse}
                  locale={locale}
                  pfad={`/${locale}/${kategorieAdresse}/${artikelAdressen.get(String(p.id)) ?? p.slug}`}
                  labels={{
                    from: dict.product.from,
                    onRequest: dict.product.onRequest,
                    instead: dict.product.instead,
                  }}
                  aktion={aktionFuerArtikel(
                    { id: p.id, categoryId: typeof p.category === 'object' ? p.category?.id : p.category },
                    aktionen,
                  )}
                />
              </RevealItem>
            ))}
          </RevealStagger>
        )}
      </div>
    </div>
  )
}
