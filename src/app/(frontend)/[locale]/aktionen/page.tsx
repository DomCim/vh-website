import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Bild, type BildQuelle } from '../../../../components/Bild'

import { Reveal, RevealItem, RevealStagger } from '../../../../components/motion/Reveal'
import { ProductCard } from '../../../../components/ProductCard'
import { aktionFuerArtikel } from '../../../../lib/aktionspreis'
import {
  getActivePromotions,
  getPreisaktionen,
  getProductsForPromotion,
} from '../../../../lib/data'
import { formatDate, isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

/**
 * Was zu einer Aktion gehört — und wohin sie führt.
 *
 * Die Seite zeigte bisher nur das Plakat: Titel, Bild, „40 % auf alle
 * Outdoor-Möbel", gültig bis. Wer daraufklickte, blieb stehen, wo er stand.
 * Für den Betrieb war das die teuerste Stelle der Seite — man weckt ein
 * Interesse und lässt den Menschen dann selbst suchen, wo die reduzierte Ware
 * liegt.
 *
 * Jetzt steht unter jeder Aktion, was drinsteckt: dieselben Kacheln wie in der
 * Kategorie, mit Streichpreis. Und wenn sich die Aktion auf **eine** Kategorie
 * bezieht, führt das Plakat selbst dorthin — bei mehreren gibt es kein
 * eindeutiges Ziel, dann sind die Kacheln der Weg.
 */

/** Kategorie und Adresse eines Artikels — beides steckt in `category`, wenn mit Tiefe geladen wurde */
function kategorieVon(eintrag: unknown): { id?: number | string; slug?: string } {
  return eintrag && typeof eintrag === 'object'
    ? (eintrag as { id?: number | string; slug?: string })
    : {}
}

export default async function PromotionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const promotions = await getActivePromotions(locale)
  const preisaktionen = await getPreisaktionen(locale)

  const mitArtikeln = await Promise.all(
    promotions.map(async (p) => ({
      aktion: p,
      artikel: await getProductsForPromotion(p, locale),
    })),
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Reveal>
        <h1 className="tracking-nav text-ink rule-bronze mb-10 text-2xl font-semibold uppercase">
          {dict.promotions.title}
        </h1>
      </Reveal>

      {mitArtikeln.length === 0 ? (
        <p className="text-ink-soft">{dict.promotions.empty}</p>
      ) : (
        <div className="space-y-14">
          {mitArtikeln.map(({ aktion: p, artikel }) => {
            /*
             * Ein Ziel gibt es nur, wenn es eindeutig ist: genau eine
             * Kategorie. Bei zweien wäre jede Wahl falsch, und bei „alle
             * Produkte" gibt es keine Seite, die alles zeigt.
             */
            const kategorien = Array.isArray(p.categories) ? p.categories : []
            const einzelneKategorie =
              p.appliesTo === 'categories' && kategorien.length === 1
                ? kategorieVon(kategorien[0]).slug
                : undefined
            const ziel = einzelneKategorie ? `/${locale}/${einzelneKategorie}` : undefined

            const kopf = (
              <>
                {p.image ? (
                  <div className="bg-paper-soft aspect-[4/3] sm:aspect-auto">
                    <Bild
                      media={p.image as BildQuelle}
                      alt={p.title}
                      bevorzugt="card"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="bg-accent text-on-ink flex items-center justify-center p-8 text-4xl font-bold">
                    {p.discountType === 'percent' ? `−${p.discountValue}%` : `−${p.discountValue} €`}
                  </div>
                )}
                <div className="p-6">
                  <h2 className="tracking-nav text-ink text-lg font-semibold uppercase">
                    {p.title}
                  </h2>
                  {p.description && (
                    <p className="text-ink-soft mt-2 leading-relaxed">{p.description}</p>
                  )}
                  <div className="text-ink-soft mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <span className="bg-accent tracking-nav text-on-ink px-3 py-1 text-xs font-semibold uppercase">
                      {p.discountType === 'percent'
                        ? `−${p.discountValue} %`
                        : `−${p.discountValue} €`}
                    </span>
                    <span>
                      {dict.promotions.validUntil} {formatDate(p.endDate, locale)}
                    </span>
                    {p.code && (
                      <span>
                        {dict.promotions.code}:{' '}
                        <code className="bg-paper-soft border-line rounded border px-2 py-0.5 font-mono text-xs">
                          {p.code}
                        </code>
                      </span>
                    )}
                    {ziel && (
                      <span className="text-bronze tracking-nav text-xs font-semibold uppercase">
                        {dict.promotions.viewAll} →
                      </span>
                    )}
                  </div>
                </div>
              </>
            )

            const rahmen = 'border-line grid overflow-hidden border bg-paper sm:grid-cols-[280px_1fr]'

            return (
              <div key={p.id}>
                <RevealItem>
                  {ziel ? (
                    <Link href={ziel} className={`${rahmen} transition-shadow hover:shadow-lg`}>
                      {kopf}
                    </Link>
                  ) : (
                    <article className={rahmen}>{kopf}</article>
                  )}
                </RevealItem>

                {artikel.length > 0 && (
                  <div className="mt-8">
                    <h3 className="tracking-nav text-ink rule-bronze-sm mb-6 text-sm font-semibold uppercase">
                      {dict.promotions.included}
                    </h3>
                    <RevealStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {artikel.map((a) => (
                        <RevealItem key={a.id}>
                          <ProductCard
                            product={a}
                            categorySlug={kategorieVon(a.category).slug ?? ''}
                            locale={locale}
                            labels={{
                              from: dict.product.from,
                              onRequest: dict.product.onRequest,
                              instead: dict.product.instead,
                            }}
                            aktion={aktionFuerArtikel(
                              {
                                id: a.id,
                                categoryId:
                                  kategorieVon(a.category).id ??
                                  (typeof a.category === 'object' ? undefined : a.category),
                              },
                              preisaktionen,
                            )}
                          />
                        </RevealItem>
                      ))}
                    </RevealStagger>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
