'use client'

import { motion, useReducedMotion } from 'motion/react'
import React from 'react'

/**
 * Maskierter Text-Reveal: Die Überschrift schiebt sich Wort für Wort
 * aus einer unsichtbaren Maske nach oben.
 *
 * Wichtig: Beobachtet wird der äußere Container (sichtbar), nicht die
 * maskierten Wörter selbst — ein von overflow-hidden vollständig
 * verdecktes Element würde nie als "im Viewport" gemeldet.
 */
export function SplitTextReveal({
  text,
  as: Tag = 'h2',
  className,
  delay = 0,
}: {
  text: string
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  className?: string
  delay?: number
}) {
  const reduceMotion = useReducedMotion()
  const words = text.split(/\s+/).filter(Boolean)

  if (reduceMotion) return <Tag className={className}>{text}</Tag>

  return (
    <Tag className={className} aria-label={text}>
      <motion.span
        className="inline"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: delay } },
        }}
        aria-hidden
      >
        {words.map((word, i) => (
          <React.Fragment key={i}>
            <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
              <motion.span
                className="inline-block will-change-transform"
                variants={{
                  hidden: { y: '110%' },
                  visible: {
                    y: 0,
                    transition: { duration: 0.7, ease: [0.22, 0.65, 0.28, 1] },
                  },
                }}
              >
                {word}
              </motion.span>
            </span>
            {/* Leerzeichen außerhalb der Maske, sonst verschluckt inline-block es */}
            {i < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        ))}
      </motion.span>
    </Tag>
  )
}
