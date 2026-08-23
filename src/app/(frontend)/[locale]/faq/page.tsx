import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Fragen, gueltigeFragen } from '../../../../components/Fragen'
import { Reveal } from '../../../../components/motion/Reveal'
import { getSiteSettings } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { alternatesFor, jsonLd } from '../../../../lib/seo'

export const dynamic = 'force-dynamic'

/**
 * Die häufigen Fragen als eigene Seite.
 *
 * Vorher standen sie ausschließlich unter „Maßanfertigung" — dort waren sie
 * entstanden, dort blieben sie. Nur handelt kaum eine davon von einer
 * Maßanfertigung: Fertigungszeit, Farben, Cortenstahl, Versandkosten,
 * Abholung, Rückgabe. Wer eine solche Frage hatte, musste sie ausgerechnet
 * auf der Seite suchen, auf der er sie am wenigsten vermutet.
 *
 * Eine eigene Adresse ist dabei mehr als Bequemlichkeit: Sie steht in der
 * Sitemap, lässt sich verlinken und ist der Ort, an dem die Auszeichnung für
 * Suchmaschinen sitzt. Die Maßanfertigungsseite zeigt die Fragen weiterhin —
 * dort helfen sie beim Ausfüllen —, trägt die Auszeichnung aber nicht mehr:
 * Dieselben Fragen zweimal ausgezeichnet wären zwei Seiten, die um denselben
 * Treffer streiten.
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
    title: dict.faq.title,
    description: dict.faq.intro,
    alternates: alternatesFor(locale, '/faq'),
  }
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const settings = await getSiteSettings(locale)
  const fragen = gueltigeFragen(settings?.faq)

  /*
   * Auszeichnung und sichtbarer Text kommen aus derselben Quelle. Google
   * verlangt, dass eine ausgezeichnete Frage auf der Seite auch wirklich
   * steht; eine Auszeichnung ohne sichtbaren Inhalt ist keine Abkürzung,
   * sondern ein Grund, die Seite dauerhaft davon auszuschließen.
   */
  const faqJsonLd = fragen.length
    ? jsonLd({
        '@type': 'FAQPage',
        mainEntity: fragen.map((f) => ({
          '@type': 'Question',
          name: f.frage,
          acceptedAnswer: { '@type': 'Answer', text: f.antwort },
        })),
      })
    : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      )}

      <Reveal>
        <h1 className="tracking-nav text-ink rule-bronze text-2xl font-semibold uppercase">
          {dict.faq.title}
        </h1>
        <p className="text-ink-soft mt-4 leading-relaxed">{dict.faq.intro}</p>
      </Reveal>

      {fragen.length > 0 ? (
        <Reveal>
          <div className="mt-10">
            <Fragen fragen={fragen} />
          </div>
        </Reveal>
      ) : null}

      <Reveal>
        <div className="border-line mt-12 border-t pt-6">
          <Link
            href={`/${locale}/kontakt`}
            className="tracking-nav text-bronze text-xs font-semibold uppercase underline-offset-4 hover:underline"
          >
            {dict.faq.ask} →
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
