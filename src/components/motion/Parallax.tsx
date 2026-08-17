'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import React, { useRef } from 'react'

/**
 * Sanfter Parallax-Effekt: der Inhalt bewegt sich beim Scrollen langsamer
 * als die Seite und wirkt dadurch räumlich.
 */
export function Parallax({
  children,
  className,
  amount = 60,
}: {
  children: React.ReactNode
  className?: string
  amount?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [-amount, amount])

  if (reduceMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  }

  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ''}`}>
      <motion.div style={{ y }} className="h-full w-full will-change-transform">
        {children}
      </motion.div>
    </div>
  )
}
