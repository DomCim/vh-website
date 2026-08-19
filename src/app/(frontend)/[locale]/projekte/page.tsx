import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Bild, type BildQuelle } from '../../../../components/Bild'

import { ImageReveal } from '../../../../components/motion/ImageReveal'
import { Reveal } from '../../../../components/motion/Reveal'
import { SplitTextReveal } from '../../../../components/motion/SplitTextReveal'
import { getProjects } from '../../../../lib/data'
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
  const dict = t(locale)
  return {
    title: dict.projects.title,
    description: dict.projects.intro,
    alternates: alternatesFor(locale, '/projekte'),
  }
}

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ bereich?: string }>
}) {
  const { locale } = await params
  const { bereich } = await searchParams
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const sector = bereich && ['kommunal', 'gewerbe', 'privat'].includes(bereich) ? bereich : undefined
  const projects = await getProjects(locale, sector)

  const tabs = [
    { key: undefined, label: dict.projects.all },
    { key: 'kommunal', label: dict.projects.sectors.kommunal },
    { key: 'gewerbe', label: dict.projects.sectors.gewerbe },
    { key: 'privat', label: dict.projects.sectors.privat },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <SplitTextReveal
        as="h1"
        text={dict.projects.title}
        className="tracking-nav text-ink rule-bronze mb-4 text-2xl font-semibold uppercase"
      />
      <Reveal>
        <p className="text-ink-soft mb-8 max-w-2xl">{dict.projects.intro}</p>
      </Reveal>

      <Reveal>
        <div className="mb-10 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={`/${locale}/projekte${tab.key ? `?bereich=${tab.key}` : ''}`}
              className={`tracking-nav border px-4 py-2 text-xs font-medium uppercase transition-colors ${
                sector === tab.key
                  ? 'border-ink bg-ink text-on-ink'
                  : 'border-line text-ink hover:border-ink'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </Reveal>

      {projects.length === 0 ? (
        <p className="text-ink-soft">{dict.projects.empty}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <Link
              key={p.id}
              href={`/${locale}/projekte/${p.slug}`}
              className="group border-line block border bg-paper transition-shadow hover:shadow-lg"
            >
              <ImageReveal delay={(i % 3) * 0.08} className="bg-paper-soft aspect-[4/3]">
                <Bild
                    media={p.images?.[0] as BildQuelle}
                    alt={p.title}
                    bevorzugt="card"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
              </ImageReveal>
              <div className="p-5">
                <p className="text-ink-soft text-xs uppercase">
                  {dict.projects.sectors[p.sector] ?? p.sector}
                  {p.year ? ` · ${p.year}` : ''}
                </p>
                <h2 className="tracking-nav text-ink mt-1 text-sm font-semibold uppercase">
                  {p.title}
                </h2>
                {p.summary && <p className="text-ink-soft mt-2 line-clamp-2 text-sm">{p.summary}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
