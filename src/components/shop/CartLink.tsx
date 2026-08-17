'use client'

import Link from 'next/link'
import React from 'react'

import type { Locale } from '../../lib/i18n'
import { useCart } from './CartProvider'

export function CartLink({ locale, label }: { locale: Locale; label: string }) {
  const { count } = useCart()

  return (
    <Link
      href={`/${locale}/warenkorb`}
      aria-label={label}
      className="text-ink hover:text-bronze relative flex h-10 w-10 items-center justify-center transition-colors"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 4h2l2.4 12.2A2 2 0 0 0 9.4 18h8.9a2 2 0 0 0 2-1.6L22 8H6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="21" r="1" fill="currentColor" />
        <circle cx="18" cy="21" r="1" fill="currentColor" />
      </svg>
      {count > 0 && (
        <span className="bg-bronze absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  )
}
