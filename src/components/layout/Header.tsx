'use client'

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useState } from 'react'

import type { Locale } from '../../lib/i18n'
import { CartLink } from '../shop/CartLink'
import { SprachWahl } from './SprachWahl'

type Category = {
  id: number | string
  slug: string
  name: string
}

type Dict = {
  nav: {
    news: string
    contact: string
    cart: string
    promotions: string
    projects: string
    about: string
    custom: string
    search: string
    menu: string
    language: string
  }
}

export function Header({
  locale,
  categories,
  dict,
}: {
  locale: Locale
  categories: Category[]
  dict: Dict
}) {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const { scrollY } = useScroll()

  // Header taucht beim Hochscrollen sofort wieder auf, verschwindet beim Runterscrollen
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() ?? 0
    if (open) {
      setHidden(false)
      return
    }
    setHidden(latest > previous && latest > 140)
  })

  const items: { href: string; label: string }[] = [
    { href: `/${locale}/news`, label: dict.nav.news },
    ...categories.map((c) => ({ href: `/${locale}/${c.slug}`, label: c.name })),
    { href: `/${locale}/projekte`, label: dict.nav.projects },
    { href: `/${locale}/massanfertigung`, label: dict.nav.custom },
    { href: `/${locale}/ueber-uns`, label: dict.nav.about },
    { href: `/${locale}/kontakt`, label: dict.nav.contact },
  ]

  // Sprachumschalter: gleicher Pfad in der jeweils anderen Sprache
  const pathFor = (target: Locale) =>
    pathname?.replace(new RegExp(`^/${locale}(?=/|$)`), `/${target}`) || `/${target}`

  const isActive = (href: string) =>
    pathname === href || (pathname?.startsWith(`${href}/`) ?? false)

  return (
    <motion.header
      className="site-header border-line bg-paper/95 fixed inset-x-0 top-0 z-50 border-b backdrop-blur"
      animate={reduceMotion ? undefined : { y: hidden ? '-100%' : '0%' }}
      transition={{ duration: 0.35, ease: [0.22, 0.65, 0.28, 1] }}
    >
      <div className="site-header-bar mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href={`/${locale}`} className="shrink-0" onClick={() => setOpen(false)}>
          <img
            src="/logo.svg"
            alt="Vincent Hellmann"
            className="site-logo h-4 w-auto sm:h-5"
          />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`tracking-nav text-xs font-medium uppercase transition-colors ${
                isActive(item.href) ? 'text-ink' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <SprachWahl locale={locale} pfadFuer={pathFor} label={dict.nav.language} />

          <Link
            href={`/${locale}/suche`}
            aria-label={dict.nav.search}
            title={dict.nav.search}
            className="text-ink-soft hover:text-bronze flex h-10 w-10 items-center justify-center transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </Link>

          <CartLink locale={locale} label={dict.nav.cart} />

          <button
            type="button"
            aria-label={dict.nav.menu}
            className="text-ink flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            <span
              className={`bg-ink h-0.5 w-6 transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`}
            />
            <span className={`bg-ink h-0.5 w-6 transition-opacity ${open ? 'opacity-0' : ''}`} />
            <span
              className={`bg-ink h-0.5 w-6 transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-line bg-paper border-t lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="tracking-nav text-ink border-line border-b py-3 text-sm font-medium uppercase last:border-b-0"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </motion.header>
  )
}
