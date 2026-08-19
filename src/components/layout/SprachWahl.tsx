'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

import { type Locale, locales } from '../../lib/i18n'

/**
 * Die Sprachwahl — am Rechner nebeneinander, am Telefon zusammengeklappt.
 *
 * Drei Kürzel mit Trennstrichen sind am Rechner die schnellste Form: alles
 * sichtbar, ein Klick. Am Telefon kosten sie rund siebzig Pixel in einer
 * Zeile, die ohnehin knapp ist — und das ging zulasten des Warenkorbs, der
 * dort schlicht aus dem Bild geschoben wurde. Ein Einkaufswagen, den man
 * nicht sieht, ist ein Einkauf, der nicht stattfindet.
 *
 * Zusammengeklappt steht dort nur noch die aktuelle Sprache. Das ist die
 * Angabe, die man tatsächlich braucht — die anderen beiden interessieren
 * genau dann, wenn man wechseln will.
 */
export function SprachWahl({
  locale,
  pfadFuer,
  label,
}: {
  locale: Locale
  pfadFuer: (ziel: Locale) => string
  label: string
}) {
  const [offen, setOffen] = useState(false)
  const huelle = useRef<HTMLDivElement>(null)

  // Draußen tippen und Escape schließen — beides erwartet man von einem
  // Aufklappmenü, und ohne das bleibt es am Telefon gern offen stehen
  useEffect(() => {
    if (!offen) return
    const beiKlick = (e: MouseEvent) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false)
    }
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('mousedown', beiKlick)
    document.addEventListener('keydown', beiTaste)
    return () => {
      document.removeEventListener('mousedown', beiKlick)
      document.removeEventListener('keydown', beiTaste)
    }
  }, [offen])

  return (
    <>
      {/* Am Rechner: alle drei nebeneinander, wie gehabt */}
      <div className="tracking-nav text-ink-soft hidden items-center gap-2 text-xs uppercase lg:flex">
        {locales.map((code, i) => (
          <React.Fragment key={code}>
            {i > 0 && <span className="text-line">|</span>}
            <Link
              href={pfadFuer(code)}
              className={code === locale ? 'text-ink font-semibold' : 'hover:text-ink'}
            >
              {code.toUpperCase()}
            </Link>
          </React.Fragment>
        ))}
      </div>

      {/* Am Telefon: nur die aktuelle Sprache, der Rest klappt auf */}
      <div ref={huelle} className="relative lg:hidden">
        <button
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={offen}
          onClick={() => setOffen((v) => !v)}
          className="tracking-nav text-ink-soft hover:text-ink flex h-10 items-center gap-1 px-1 text-xs uppercase transition-colors"
        >
          {locale.toUpperCase()}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
            className={`transition-transform ${offen ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {offen && (
          <div
            role="menu"
            className="border-line bg-paper absolute top-full right-0 z-50 mt-1 min-w-24 border py-1 shadow-lg"
          >
            {locales.map((code) => (
              <Link
                key={code}
                role="menuitem"
                href={pfadFuer(code)}
                onClick={() => setOffen(false)}
                className={`tracking-nav block px-4 py-2 text-xs uppercase ${
                  code === locale ? 'text-ink font-semibold' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {code.toUpperCase()}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
