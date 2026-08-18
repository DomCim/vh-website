import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Reveal } from '../../../../components/motion/Reveal'
import { payloadClient } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { ALLE_BEREICHE, suche, type SuchBereich, type Treffer } from '../../../../lib/search'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return { title: t(locale).search.title, robots: { index: false, follow: true } }
}

export default async function SucheSeite({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { locale } = await params
  const { q } = await searchParams
  if (!isLocale(locale)) notFound()
  const dict = t(locale)
  const begriff = (q ?? '').trim()

  let treffer: Treffer[] = []
  if (begriff.length >= 2) {
    treffer = await suche(await payloadClient(), begriff, locale)
  }

  const gruppen = ALLE_BEREICHE.map((bereich) => ({
    bereich,
    eintraege: treffer.filter((tr) => tr.bereich === bereich),
  })).filter((g) => g.eintraege.length > 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
      <Reveal>
        <h1 className="tracking-nav text-ink heading-rule text-2xl font-semibold uppercase">
          {dict.search.title}
        </h1>
      </Reveal>

      <form action={`/${locale}/suche`} className="mt-8 flex max-w-xl gap-3">
        <input
          type="search"
          name="q"
          defaultValue={begriff}
          placeholder={dict.search.placeholder}
          aria-label={dict.search.placeholder}
          className="border-line focus:border-ink w-full border bg-white px-4 py-3 text-sm outline-none transition-colors"
        />
        <button
          type="submit"
          className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-6 py-3 text-xs font-semibold whitespace-nowrap text-white uppercase transition-colors"
        >
          {dict.search.submit}
        </button>
      </form>

      {begriff.length < 2 ? (
        <p className="text-ink-soft mt-10">{dict.search.hint}</p>
      ) : gruppen.length === 0 ? (
        <p className="text-ink-soft mt-10">{dict.search.noResults}</p>
      ) : (
        <div className="mt-12 space-y-12">
          {gruppen.map(({ bereich, eintraege }) => (
            <section key={bereich}>
              <h2 className="tracking-nav text-ink-soft text-xs font-semibold uppercase">
                {dict.search.groups[bereich as SuchBereich]}
              </h2>
              <ul className="divide-line mt-3 divide-y border-t">
                {eintraege.map((tr, i) => (
                  <li key={`${tr.url}-${i}`} className="py-4">
                    <Link href={tr.url} className="group block">
                      <p className="group-hover:text-bronze font-semibold transition-colors">
                        {tr.titel}
                      </p>
                      {tr.text && (
                        <p className="text-ink-soft mt-1 line-clamp-2 text-sm">{tr.text}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
