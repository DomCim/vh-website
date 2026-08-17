'use client'

import { motion, useReducedMotion } from 'motion/react'
import React from 'react'

/**
 * Endlos laufendes Markenband — große, ruhig durchziehende Schlagworte
 * als Trenner zwischen Sektionen.
 */
export function Marquee({ words, speed = 40 }: { words: string[]; speed?: number }) {
  const reduceMotion = useReducedMotion()
  const row = (
    <>
      {words.map((word, i) => (
        <span key={i} className="mx-8 inline-flex items-center gap-16">
          <span>{word}</span>
          <span className="text-bronze text-2xl leading-none">•</span>
        </span>
      ))}
    </>
  )

  return (
    <div className="border-line text-ink/90 overflow-hidden border-y bg-white py-6 whitespace-nowrap select-none">
      {reduceMotion ? (
        <div className="tracking-brand text-xl font-semibold uppercase sm:text-2xl">{row}</div>
      ) : (
        <motion.div
          className="tracking-brand inline-block text-xl font-semibold uppercase will-change-transform sm:text-2xl"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
        >
          {/* Inhalt doppelt, damit die Schleife nahtlos läuft */}
          {row}
          {row}
        </motion.div>
      )}
    </div>
  )
}
