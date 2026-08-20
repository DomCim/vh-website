'use client'

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import type { Locale } from '../../lib/i18n'
import { CartLink } from '../shop/CartLink'
import { SprachWahl } from './SprachWahl'
import { Logo } from './Logo'

/**
 * Kopfleiste der Website.
 *
 * Drei Spalten statt einer Reihe: Logo links, Navigation in der Mitte,
 * Werkzeuge rechts. Vorher standen alle drei in einer Reihe mit
 * `justify-between` — dann sitzt die Navigation dort, wo der Platz gerade
 * bleibt, und wandert bei jedem neuen Menüpunkt. Mit dem Raster steht sie in
 * der Mitte der Leiste, unabhängig davon, wie breit Logo und Werkzeuge sind.
 *
 * Und die Kategorien liegen unter einem Punkt. Jede neue Produktwelt im CMS
 * war vorher ein weiterer Punkt in der obersten Reihe; bei neun Punkten brachen
 * „Next Concept" und „Über uns" auf zwei Zeilen um, und die Leiste sah kaputt
 * aus. Jetzt wächst das Aufklappmenü statt der Leiste.
 */

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
    collection: string
    account: string
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
  const [kollektionOffen, setKollektionOffen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const { scrollY } = useScroll()
  const leiste = useRef<HTMLElement>(null)

  // Header taucht beim Hochscrollen sofort wieder auf, verschwindet beim Runterscrollen
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() ?? 0
    if (open) {
      setHidden(false)
      return
    }
    setHidden(latest > previous && latest > 140)
  })

  // Beim Seitenwechsel schließen — sonst bliebe das Menü über der neuen Seite
  useEffect(() => {
    setOpen(false)
    setKollektionOffen(false)
  }, [pathname])

  // Klick daneben und Escape schließen das Aufklappmenü
  useEffect(() => {
    if (!kollektionOffen) return
    const beiKlick = (e: MouseEvent) => {
      if (!leiste.current?.contains(e.target as Node)) setKollektionOffen(false)
    }
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKollektionOffen(false)
    }
    document.addEventListener('mousedown', beiKlick)
    window.addEventListener('keydown', beiTaste)
    return () => {
      document.removeEventListener('mousedown', beiKlick)
      window.removeEventListener('keydown', beiTaste)
    }
  }, [kollektionOffen])

  const kategorien = categories.map((c) => ({ href: `/${locale}/${c.slug}`, label: c.name }))

  /** Was in der obersten Reihe steht — die Kategorien stecken im Aufklappmenü. */
  const items: { href: string; label: string }[] = [
    { href: `/${locale}/massanfertigung`, label: dict.nav.custom },
    { href: `/${locale}/projekte`, label: dict.nav.projects },
    { href: `/${locale}/ueber-uns`, label: dict.nav.about },
    { href: `/${locale}/news`, label: dict.nav.news },
    { href: `/${locale}/kontakt`, label: dict.nav.contact },
  ]

  // Sprachumschalter: gleicher Pfad in der jeweils anderen Sprache
  const pathFor = (target: Locale) =>
    pathname?.replace(new RegExp(`^/${locale}(?=/|$)`), `/${target}`) || `/${target}`

  const isActive = (href: string) =>
    pathname === href || (pathname?.startsWith(`${href}/`) ?? false)

  const kollektionAktiv = kategorien.some((k) => isActive(k.href))
  const linkKlasse = (aktiv: boolean) =>
    `tracking-nav text-xs font-medium whitespace-nowrap uppercase transition-colors ${
      aktiv ? 'text-ink' : 'text-ink-soft hover:text-ink'
    }`

  return (
    <motion.header
      ref={leiste}
      className="site-header border-line bg-paper/95 fixed inset-x-0 top-0 z-50 border-b backdrop-blur"
      animate={reduceMotion ? undefined : { y: hidden ? '-100%' : '0%' }}
      transition={{ duration: 0.35, ease: [0.22, 0.65, 0.28, 1] }}
    >
      {/*
       * Am Rechner drei Spalten: Schriftzug links, Navigation mittig,
       * Werkzeuge rechts. Der großzügige Abstand hält die Navigation vom
       * Schriftzug weg — daran lag es, dass die Leiste vollgestopft wirkte.
       *
       * Am Handy dagegen eine schlichte Reihe. Das Raster mit zwei gleich
       * breiten Außenspalten war dort der Fehler: Der Schriftzug ist rund
       * 230 Pixel breit, die Werkzeuge brauchen mehr als ihre halbe Leiste —
       * und was nicht hineinpasste, lief nach rechts aus dem Bild. Zuletzt
       * der Warenkorb, also ausgerechnet der Knopf, an dem das Geld hängt.
       */}
      <div className="site-header-bar mx-auto flex h-20 max-w-[88rem] items-center justify-between gap-3 px-4 sm:px-6 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-8">
        <Link href={`/${locale}`} className="min-w-0 shrink justify-self-start" onClick={() => setOpen(false)}>
          <Logo className="site-logo text-ink h-3.5 w-auto sm:h-4 md:h-5" />
        </Link>

        <nav className="hidden items-center justify-center gap-6 xl:flex">
          {kategorien.length > 0 && (
            <div
              className="relative"
              /*
               * Aufklappen beim Drüberfahren, damit man am Rechner nicht erst
               * klicken muss — und trotzdem ein echter Knopf darunter, weil
               * Hovern mit der Tastatur nichts tut.
               */
              onMouseEnter={() => setKollektionOffen(true)}
              onMouseLeave={() => setKollektionOffen(false)}
            >
              <button
                type="button"
                aria-expanded={kollektionOffen}
                aria-current={kollektionAktiv ? 'page' : undefined}
                className={`${linkKlasse(kollektionAktiv || kollektionOffen)} flex cursor-pointer items-center gap-1`}
                onClick={() => setKollektionOffen((v) => !v)}
              >
                {dict.nav.collection}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className={`transition-transform ${kollektionOffen ? 'rotate-180' : ''}`}
                >
                  <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {kollektionOffen && (
                <div
                  role="menu"
                  aria-label={dict.nav.collection}
                  className="border-line bg-paper absolute top-full left-1/2 min-w-52 -translate-x-1/2 border py-2 shadow-lg"
                >
                  {kategorien.map((k) => (
                    <Link
                      key={k.href}
                      href={k.href}
                      role="menuitem"
                      className={`tracking-nav block px-5 py-2.5 text-xs font-medium whitespace-nowrap uppercase transition-colors ${
                        isActive(k.href) ? 'text-ink' : 'text-ink-soft hover:text-bronze'
                      }`}
                      onClick={() => setKollektionOffen(false)}
                    >
                      {k.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {items.map((item) => (
            <Link key={item.href} href={item.href} className={linkKlasse(isActive(item.href))}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/*
         * Am Handy bleiben nur Suche, Warenkorb und das Menü stehen. Sprache
         * und Konto stehen im Menü — beides braucht man selten mitten im
         * Stöbern, der Warenkorb dagegen immer.
         */}
        <div className="flex shrink-0 items-center gap-1 justify-self-end sm:gap-3">
          <span className="hidden sm:block">
            <SprachWahl locale={locale} pfadFuer={pathFor} label={dict.nav.language} />
          </span>

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

          {/*
           * Der Weg zur eigenen Übersicht.
           *
           * Das Kundenportal gab es längst — nur führte kein sichtbarer Weg
           * dorthin: Wer den Link aus der Bestellmail nicht mehr hatte, kam
           * nicht hinein. Angemeldet wird dort mit der E-Mail-Adresse und
           * einem sechsstelligen Code, ohne Passwort.
           *
           * Am Handy steht es im Menü: Dort ist Platz für ein Wort, und in
           * der Leiste ist er knapp.
           */}
          <Link
            href={`/${locale}/konto`}
            aria-label={dict.nav.account}
            title={dict.nav.account}
            className="text-ink-soft hover:text-bronze hidden h-10 w-10 items-center justify-center transition-colors sm:flex"
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
              <circle cx="12" cy="8" r="3.6" />
              <path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" strokeLinecap="round" />
            </svg>
          </Link>

          <CartLink locale={locale} label={dict.nav.cart} />

          <button
            type="button"
            aria-label={dict.nav.menu}
            aria-expanded={open}
            className="text-ink flex h-10 w-10 flex-col items-center justify-center gap-1.5 xl:hidden"
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
        <nav className="border-line bg-paper border-t xl:hidden">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6">
            {/* Am Handy bleibt alles untereinander sichtbar — ein Aufklappmenü
                im Aufklappmenü wäre ein Tipp mehr für nichts. */}
            {kategorien.length > 0 && (
              <>
                <span className="tracking-nav text-ink-soft pt-2 pb-1 text-[0.65rem] uppercase">
                  {dict.nav.collection}
                </span>
                {kategorien.map((k) => (
                  <Link
                    key={k.href}
                    href={k.href}
                    className="tracking-nav text-ink border-line border-b py-3 pl-3 text-sm font-medium uppercase"
                    onClick={() => setOpen(false)}
                  >
                    {k.label}
                  </Link>
                ))}
              </>
            )}
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="tracking-nav text-ink border-line border-b py-3 text-sm font-medium uppercase"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={`/${locale}/konto`}
              className="tracking-nav text-ink border-line border-b py-3 text-sm font-medium uppercase"
              onClick={() => setOpen(false)}
            >
              {dict.nav.account}
            </Link>

            {/* Die Sprachwahl steht am Handy nicht mehr in der Leiste — dort
                war der Platz für den Warenkorb nötig. */}
            <div className="flex items-center gap-3 pt-4 sm:hidden">
              <span className="tracking-nav text-ink-soft text-[0.65rem] uppercase">
                {dict.nav.language}
              </span>
              <SprachWahl locale={locale} pfadFuer={pathFor} label={dict.nav.language} />
            </div>
          </div>
        </nav>
      )}
    </motion.header>
  )
}
