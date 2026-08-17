import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ImageReveal } from '../../../../../components/motion/ImageReveal'
import { Reveal } from '../../../../../components/motion/Reveal'
import { SplitTextReveal } from '../../../../../components/motion/SplitTextReveal'
import { RichText } from '../../../../../components/RichText'
import { getProjectBySlug, mediaAlt, mediaUrl } from '../../../../../lib/data'
import { isLocale, t } from '../../../../../lib/i18n'
import { absoluteUrl, alternatesFor } from '../../../../../lib/seo'

export const dynamic = 'force-dynamic'

type PageParams = Promise<{ locale: string; slug: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const project = await getProjectBySlug(slug, locale)
  if (!project) return {}
  const image = absoluteUrl(mediaUrl(project.images?.[0], 'large'))
  return {
    title: project.title,
    description: project.summary || undefined,
    alternates: alternatesFor(locale, `/projekte/${slug}`),
    openGraph: {
      title: project.title,
      description: project.summary || undefined,
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function ProjectDetailPage({ params }: { params: PageParams }) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const project = await getProjectBySlug(slug, locale)
  if (!project) notFound()

  const images = project.images ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Reveal>
        <Link
          href={`/${locale}/projekte`}
          className="tracking-nav text-ink-soft hover:text-ink text-xs uppercase"
        >
          ← {dict.projects.title}
        </Link>
      </Reveal>

      <div className="mt-6">
        <p className="text-ink-soft text-sm uppercase">
          {dict.projects.sectors[project.sector] ?? project.sector}
          {project.year ? ` · ${project.year}` : ''}
          {project.client ? ` · ${project.client}` : ''}
        </p>
        <SplitTextReveal
          as="h1"
          text={project.title}
          className="tracking-nav text-ink mt-2 mb-8 text-2xl font-semibold uppercase sm:text-3xl"
        />
      </div>

      {images[0] ? (
        <ImageReveal className="bg-paper-soft mb-6">
          <img
            src={mediaUrl(images[0], 'large')}
            alt={mediaAlt(images[0], project.title)}
            className="w-full object-cover"
          />
        </ImageReveal>
      ) : null}

      {project.summary && (
        <Reveal>
          <p className="text-ink mb-6 text-lg leading-relaxed font-medium">{project.summary}</p>
        </Reveal>
      )}

      {project.description ? (
        <Reveal>
          <RichText data={project.description} />
        </Reveal>
      ) : null}

      {images.length > 1 && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {images.slice(1).map((img, i) => (
            <ImageReveal key={i} delay={(i % 2) * 0.08} className="bg-paper-soft">
              <img
                src={mediaUrl(img, 'card')}
                alt={mediaAlt(img, project.title)}
                className="w-full object-cover"
                loading="lazy"
              />
            </ImageReveal>
          ))}
        </div>
      )}
    </div>
  )
}
