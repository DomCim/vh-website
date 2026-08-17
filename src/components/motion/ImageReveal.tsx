'use client'

import { motion, useReducedMotion } from 'motion/react'
import React from 'react'

/**
 * Curtain-Reveal: Das Bild wird beim Scrollen von einer Blende freigegeben,
 * während es gleichzeitig sanft aus einer leichten Vergrößerung zurückzoomt.
 */
export function ImageReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={`${className ?? ''} overflow-hidden`}
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      whileInView={{ clipPath: 'inset(0 0 0% 0)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, delay, ease: [0.22, 0.65, 0.28, 1] }}
    >
      <motion.div
        className="h-full w-full will-change-transform"
        initial={{ scale: 1.15 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 1.2, delay, ease: [0.22, 0.65, 0.28, 1] }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
