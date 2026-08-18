import Link from 'next/link'
import React from 'react'

import type { Locale } from '../lib/i18n'

/**
 * Abschluss-Baustein für Produkt- und Referenzseiten.
 * Bei Einzelfertigung ist die Maßanfrage der eigentliche Weg zum Auftrag —
 * bisher endeten beide Seiten in einer Sackgasse.
 */
export function MassanfertigungHinweis({
  locale,
  text,
  label,
}: {
  locale: Locale
  text: string
  label: string
}) {
  return (
    <div className="border-line mt-16 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
      <p className="text-ink-soft text-sm">{text}</p>
      <Link
        href={`/${locale}/massanfertigung`}
        className="bg-ink tracking-nav hover:bg-bronze px-8 py-3 text-xs font-semibold text-white uppercase transition-colors"
      >
        {label}
      </Link>
    </div>
  )
}
