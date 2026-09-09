import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { CategoryTile } from '../../../../components/CategoryTile'
import { Reveal, RevealItem, RevealStagger } from '../../../../components/motion/Reveal'
import { ProductCard } from '../../../../components/ProductCard'
import { aktionFuerArtikel } from '../../../../lib/aktionspreis'
import { getAllProducts, getMainCategories, getPreisaktionen } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { alternatesFor, breadcrumbJsonLd } from '../../../../lib/seo'

export const dynamic = 'force-dynamic'

/**
 * Die Kollektion — alles, was es gibt, auf einem Blatt.
 *
 * **Warum es diese Seite überhaupt geben muss.** Der Brotkrumen jeder
 * Artikelseite fängt mit „Kollektion" an und zeigte auf `/kollektion` — eine
 * Adresse, die es nicht gab. Google liest diesen Weg aus und stellt ihn unter
 * den Treffer; die erste Station führte dabei ins Leere. Dasselbe galt für
 * den Merchant-Feed, der `/kollektion/<artikel>` als Rückfallpfad benutzt,
 * wenn ein Stück keiner Kategorie zugeordnet ist.
 *
 * **Und warum sie nützlich ist, nicht nur nötig.** Wer „Vincent Hellmann"
 * sucht und nicht weiß, ob er Möbel, Feuer oder Objekte will, braucht eine
 * Seite, die alles zeigt. Zugleich ist sie der Knotenpunkt der internen
 * Verlinkung: Von hier führt genau ein Weg zu jedem Stück, und Suchdienste
 * finden über sie das ganze Sortiment, ohne sich durch die Rubriken zu
 * hangeln.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = t(locale)
  return {
    title: dict.nav.collection,
    description: dict.collection.intro,
    alternates: alternatesFor(locale, '/kollektion'),
    openGraph: { title: dict.nav.collection, description: dict.collection.intro },
  }
}

export default async function KollektionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const [kategorien, artikel, aktionen] = await Promise.all([
    getMainCategories(locale),
    getAllProducts(locale),
    getPreisaktionen(locale),
  ])

  const brotkrumen = breadcrumbJsonLd(locale, [
    { name: dict.nav.collection, pfad: '/kollektion' },
  ])

  /*
   * Der Link je Stück führt in seine eigene Kategorie.
   *
   * Ein Artikel hat genau eine maßgebliche Adresse — die unter seiner
   * Kategorie. Stünde hier `/kollektion/<artikel>`, gäbe es dieselbe Seite
   * ein zweites Mal, und beide nähmen sich gegenseitig die Bedeutung.
   */
  const kategorieSlug = (p: { category?: unknown }) =>
    (typeof p.category === 'object' ? (p.category as { slug?: string })?.slug : undefined) ??
    'kollektion'

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: brotkrumen }} />

      <Reveal>
        <h1 className="tracking-nav text-ink rule-bronze mb-4 text-2xl font-semibold uppercase">
          {dict.nav.collection}
        </h1>
      </Reveal>
      <Reveal>
        <p className="text-ink-soft mb-10 max-w-3xl leading-relaxed">{dict.collection.intro}</p>
      </Reveal>

      {kategorien.length > 0 && (
        <RevealStagger className="mb-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {kategorien.map((c) => (
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

      {artikel.length > 0 && (
        <>
          <Reveal>
            <h2 className="tracking-nav text-ink rule-bronze mb-6 text-xl font-semibold uppercase">
              {dict.collection.allItems}
            </h2>
          </Reveal>
          <RevealStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {artikel.map((p) => (
              <RevealItem key={p.id}>
                <ProductCard
                  product={p}
                  categorySlug={kategorieSlug(p)}
                  locale={locale}
                  labels={{
                    from: dict.product.from,
                    onRequest: dict.product.onRequest,
                    instead: dict.product.instead,
                  }}
                  aktion={aktionFuerArtikel(
                    {
                      id: p.id,
                      categoryId: typeof p.category === 'object' ? p.category?.id : p.category,
                    },
                    aktionen,
                  )}
                />
              </RevealItem>
            ))}
          </RevealStagger>
        </>
      )}
    </div>
  )
}
