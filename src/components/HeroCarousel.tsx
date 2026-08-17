'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'

export type HeroSlide = {
  image?: string
  alt?: string
  title?: string | null
  subtitle?: string | null
  link?: string | null
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const count = slides.length
  const reduceMotion = useReducedMotion()

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count])
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count])

  useEffect(() => {
    if (count < 2) return
    const timer = window.setInterval(next, 6000)
    return () => window.clearInterval(timer)
  }, [count, next])

  if (count === 0) return null

  return (
    <section className="bg-dark relative h-[60vh] min-h-[420px] w-full overflow-hidden md:h-[75vh]">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {slide.image && (
            // Langsamer Ken-Burns-Zoom auf dem aktiven Slide
            <motion.img
              src={slide.image}
              alt={slide.alt || slide.title || ''}
              className="h-full w-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
              animate={reduceMotion ? undefined : { scale: i === index ? 1.08 : 1 }}
              transition={{ duration: 7, ease: 'linear' }}
            />
          )}
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
