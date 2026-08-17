import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { ImageReveal } from '../../../../components/motion/ImageReveal'
import { Parallax } from '../../../../components/motion/Parallax'
import { Reveal } from '../../../../components/motion/Reveal'
import { SplitTextReveal } from '../../../../components/motion/SplitTextReveal'
import { getAbout, mediaAlt, mediaUrl } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'
import { alternatesFor } from '../../../../lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const about = await getAbout(locale)
  const dict = t(locale)
  return {
    title: about?.title || dict.about.title,
    description: about?.intro || undefined,
    alternates: alternatesFor(locale, '/ueber-uns'),
  }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const about = await getAbout(locale)
  const timeline = about?.timeline ?? []
  const gallery = about?.gallery ?? []

  return (
    <div>
      {about?.heroImage ? (
        <div className="bg-dark relative h-72 overflow-hidden sm:h-96">
          <img
            src={mediaUrl(about.heroImage, 'large')}
            alt={mediaAlt(about.heroImage, about?.title || '')}
            className="h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <SplitTextReveal
          as="h1"
          text={about?.title || dict.about.title}
          className="tracking-nav text-ink mb-6 text-2xl font-semibold uppercase sm:text-3xl"
        />
        {about?.intro && (
          <Reveal>
            <p className="text-ink-soft max-w-3xl text-lg leading-relaxed">{about.intro}</p>
          </Reveal>
        )}

        {timeline.length > 0 && (
          <ol className="border-line mt-14 space-y-12 border-l pl-8">
            {timeline.map((station, i) => (
              <li key={i} className="relative">
                <span className="bg-bronze absolute top-2 -left-[37px] h-2.5 w-2.5 rounded-full" />
                <Reveal delay={0.05}>
                  <p className="text-bronze text-sm font-semibold tracking-widest uppercase">
                    {station.year}
                  </p>
                  <h2 className="tracking-nav text-ink mt-1 text-lg font-semibold uppercase">
                    {station.title}
                  </h2>
                  {station.text && (
                    <p className="text-ink-soft mt-2 leading-relaxed">{station.text}</p>
                  )}
                  {station.image ? (
                    <ImageReveal className="bg-paper-soft mt-4 max-w-md">
                      <img
                        src={mediaUrl(station.image, 'card')}
                        alt={mediaAlt(station.image, station.title)}
                        className="w-full object-cover"
                        loading="lazy"
                      />
                    </ImageReveal>
                  ) : null}
                </Reveal>
              </li>
            ))}
          </ol>
        )}
      </div>

      {gallery.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {gallery.map((img, i) => (
              <ImageReveal key={i} delay={(i % 4) * 0.06} className="bg-paper-soft aspect-square">
                <Parallax amount={14} className="h-full w-full">
                  <img
                    src={mediaUrl(img, 'card')}
                    alt={mediaAlt(img)}
                    className="h-full w-full scale-110 object-cover"
                    loading="lazy"
                  />
                </Parallax>
              </ImageReveal>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
