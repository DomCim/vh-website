'use client'

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState } from 'react'

export type HeroSlide = {
  image?: string
  video?: string
  alt?: string
  title?: string | null
  subtitle?: string | null
  link?: string | null
  tint?: {
    top: { color: string; dark: boolean }
    bottom: { color: string; dark: boolean }
  } | null
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const count = slides.length
  const reduceMotion = useReducedMotion()

  // Scroll-Parallax: Der Hero bleibt beim Scrollen leicht zurück und blendet sanft aus
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0])

  // Solange der Hero im Bild ist, übernimmt der Header den Farbton des
  // aktiven Slides (CSS-Variable + data-Attribut, siehe globals.css)
  const [heroInView, setHeroInView] = useState(true)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setHeroInView(v < 0.5))

  useEffect(() => {
    const root = document.documentElement
    // Header: Farbe des oberen Bildrands — nur solange der Hero im Bild ist
    const tint = heroInView ? slides[index]?.tint?.top : null
    if (tint) {
      root.style.setProperty('--hero-tint', tint.color)
      root.dataset.heroTint = tint.dark ? 'dark' : 'light'
    } else {
      root.style.removeProperty('--hero-tint')
      delete root.dataset.heroTint
    }
    // Ausstrahlung unter dem Hero (.hero-fade): Farbe des unteren Bildrands,
    // bleibt beim Scrollen stehen — sie gehört zum Seitenhintergrund
    const pageTint = slides[index]?.tint?.bottom
    root.style.setProperty('--hero-tint-page', pageTint ? pageTint.color : 'transparent')
    return () => {
      root.style.removeProperty('--hero-tint')
      delete root.dataset.heroTint
      root.style.removeProperty('--hero-tint-page')
    }
  }, [index, heroInView, slides])

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count])
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count])

  useEffect(() => {
    if (count < 2) return
    const timer = window.setInterval(next, 6000)
    return () => window.clearInterval(timer)
  }, [count, next])

  if (count === 0) return null

  return (
    <section
      ref={ref}
      className="bg-dark relative h-[60vh] min-h-[420px] w-full overflow-hidden md:h-[75vh]"
    >
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={reduceMotion ? undefined : { y: bgY, opacity: fade }}
      >
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {slide.video ? (
            // Video-Slide: läuft stumm in Schleife, Bild dient als Poster
            <video
              src={slide.video}
              poster={slide.image}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          ) : slide.image ? (
            // Langsamer Ken-Burns-Zoom auf dem aktiven Slide
            <motion.img
              src={slide.image}
              alt={slide.alt || slide.title || ''}
              className="h-full w-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
              animate={reduceMotion ? undefined : { scale: i === index ? 1.08 : 1 }}
              transition={{ duration: 7, ease: 'linear' }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {(slide.title || slide.subtitle) && (
            <div className="absolute inset-x-0 bottom-0 p-6 pb-14 text-white sm:p-10 sm:pb-16">
              <motion.div
                className="mx-auto max-w-7xl"
                initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                animate={
                  reduceMotion ? undefined : { opacity: i === index ? 1 : 0, y: i === index ? 0 : 24 }
                }
                transition={{ duration: 0.7, delay: 0.15 }}
              >
                {slide.title && (
                  <h2 className="tracking-nav text-2xl font-semibold uppercase drop-shadow sm:text-4xl">
                    {slide.link ? <Link href={slide.link}>{slide.title}</Link> : slide.title}
                  </h2>
                )}
                {slide.subtitle && (
                  <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">{slide.subtitle}</p>
                )}
              </motion.div>
            </div>
          )}
        </div>
      ))}
      </motion.div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Vorheriges Bild"
            className="absolute top-1/2 left-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Nächstes Bild"
            className="absolute top-1/2 right-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50"
          >
            ›
          </button>
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Bild ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === index ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
