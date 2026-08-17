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

// Anzeigedauer pro Slide und Dauer der Kamerablende — Fortschrittsbalken,
// Autoplay und Header-Farbwechsel (globals.css) sind darauf abgestimmt
const DISPLAY_MS = 6000
const FADE_S = 1.4
const EASE = [0.4, 0, 0.2, 1] as const

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  // Zählt manuelle Eingriffe mit — setzt Autoplay und Fortschrittsbalken neu auf
  const [resetKey, setResetKey] = useState(0)
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

  // Manuelle Navigation setzt den Autoplay-Takt neu auf, damit nicht direkt
  // nach einem Klick schon der nächste automatische Wechsel folgt
  const goTo = useCallback((i: number) => {
    setIndex(i)
    setResetKey((k) => k + 1)
  }, [])
  const manualNext = useCallback(() => {
    setIndex((i) => (i + 1) % count)
    setResetKey((k) => k + 1)
  }, [count])
  const manualPrev = useCallback(() => {
    setIndex((i) => (i - 1 + count) % count)
    setResetKey((k) => k + 1)
  }, [count])

  useEffect(() => {
    if (count < 2) return
    const timer = window.setInterval(next, DISPLAY_MS)
    return () => window.clearInterval(timer)
  }, [count, next, resetKey])

  if (count === 0) return null

  const fadeTransition = reduceMotion
    ? { duration: 0.4 }
    : { duration: FADE_S, ease: EASE }

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
        <motion.div
          key={i}
          className={`absolute inset-0 ${i === index ? '' : 'pointer-events-none'}`}
          initial={false}
          // Kamerablende: das einlaufende Bild startet minimal größer und setzt sanft auf
          animate={{
            opacity: i === index ? 1 : 0,
            scale: reduceMotion ? 1 : i === index ? 1 : 1.06,
          }}
          transition={fadeTransition}
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
              <div className="mx-auto max-w-7xl">
                {slide.title && (
                  // Titel läuft aus einer Maske nach oben ein
                  <div className="overflow-hidden">
                    <motion.h2
                      className="tracking-nav text-2xl font-semibold uppercase drop-shadow sm:text-4xl"
                      initial={false}
                      animate={
                        reduceMotion
                          ? { opacity: i === index ? 1 : 0, y: '0%' }
                          : { y: i === index ? '0%' : '110%', opacity: i === index ? 1 : 0 }
                      }
                      transition={
                        reduceMotion
                          ? { duration: 0.4 }
                          : {
                              duration: 0.9,
                              ease: EASE,
                              delay: i === index ? 0.35 : 0,
                            }
                      }
                    >
                      {slide.link ? <Link href={slide.link}>{slide.title}</Link> : slide.title}
                    </motion.h2>
                  </div>
                )}
                {slide.subtitle && (
                  <motion.p
                    className="mt-2 max-w-xl text-sm text-white/85 sm:text-base"
                    initial={false}
                    animate={{
                      opacity: i === index ? 1 : 0,
                      y: reduceMotion ? 0 : i === index ? 0 : 16,
                    }}
                    transition={
                      reduceMotion
                        ? { duration: 0.4 }
                        : { duration: 0.9, ease: EASE, delay: i === index ? 0.5 : 0 }
                    }
                  >
                    {slide.subtitle}
                  </motion.p>
                )}
              </div>
            </div>
          )}
        </motion.div>
      ))}
      </motion.div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={manualPrev}
            aria-label="Vorheriges Bild"
            className="absolute top-1/2 left-1 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-white opacity-60 transition-all duration-300 hover:scale-110 hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7 drop-shadow" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={manualNext}
            aria-label="Nächstes Bild"
            className="absolute top-1/2 right-1 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-white opacity-60 transition-all duration-300 hover:scale-110 hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7 drop-shadow" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Bild ${i + 1}`}
                onClick={() => goTo(i)}
                className="group flex h-6 items-center"
              >
                {/* Schmaler Balken; der aktive füllt sich über die Anzeigedauer */}
                <span className="relative block h-0.5 w-7 overflow-hidden rounded-full bg-white/40 transition-colors group-hover:bg-white/70">
                  {i === index && (
                    <motion.span
                      key={`${index}-${resetKey}`}
                      className="absolute inset-y-0 left-0 bg-white"
                      initial={{ width: reduceMotion ? '100%' : '0%' }}
                      animate={{ width: '100%' }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: DISPLAY_MS / 1000, ease: 'linear' }
                      }
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
