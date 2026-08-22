import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { MassanfertigungForm } from '../../../../components/MassanfertigungForm'
import { Reveal } from '../../../../components/motion/Reveal'
import { getSiteSettings } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { alternatesFor, jsonLd } from '../../../../lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = t(locale)
  return {
    title: dict.custom.title,
    description: dict.custom.intro,
    alternates: alternatesFor(locale, '/massanfertigung'),
  }
}

export default async function MassanfertigungSeite({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)
  const settings = await getSiteSettings(locale)

  /*
   * Häufige Fragen — auf der Seite und im Suchergebnis.
   *
   * Beides aus derselben Quelle: Google zeigt die Fragen unter dem Treffer
   * aufklappbar an, verlangt dafür aber, dass sie auf der Seite auch wirklich
   * stehen. Eine Auszeichnung ohne sichtbaren Inhalt ist keine Abkürzung,
   * sondern ein Grund, die Seite dauerhaft davon auszuschließen.
   */
  const fragen = (settings?.faq ?? []).filter((f) => f.frage && f.antwort)
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
        <h1 className="tracking-nav text-ink heading-rule text-2xl font-semibold uppercase">
          {dict.custom.title}
        </h1>
        <p className="text-ink-soft mt-4 leading-relaxed">{dict.custom.intro}</p>
        {settings?.craft?.notice && (
          <p className="text-ink-soft border-line mt-4 border-l-2 pl-3 text-sm leading-relaxed">
            {settings.craft.notice}
          </p>
        )}
      </Reveal>

      <MassanfertigungForm
        locale={locale}
        labels={{
          name: dict.contact.name,
          email: dict.contact.email,
          phone: dict.contact.phone,
          message: dict.contact.message,
          width: dict.custom.width,
          depth: dict.custom.depth,
          height: dict.custom.height,
          color: dict.custom.color,
          purpose: dict.custom.purpose,
          desiredDate: dict.custom.desiredDate,
          upload: dict.custom.upload,
          send: dict.custom.send,
          success: dict.custom.success,
          error: dict.custom.error,
        }}
      />

      {fragen.length > 0 && (
        <Reveal>
          <section className="mt-16">
            <h2 className="tracking-nav text-ink heading-rule text-lg font-semibold uppercase">
              {dict.custom.faqTitle}
            </h2>
            <div className="mt-6 space-y-2">
              {fragen.map((f, i) => (
                /* Aufklappbar statt untereinander: Zehn Fragen am Stück liest
                   niemand, und die eine, die man hat, findet man so schneller.
                   `details` kann das ohne eine Zeile JavaScript. */
                <details key={i} className="border-line border-b pb-2">
                  <summary className="text-ink cursor-pointer py-2 text-sm font-semibold">
                    {f.frage}
                  </summary>
                  <p className="text-ink-soft pb-2 text-sm leading-relaxed whitespace-pre-line">
                    {f.antwort}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  )
}
