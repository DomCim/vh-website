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
  referenz,
}: {
  locale: Locale
  text: string
  label: string
  /**
   * Pfad der Referenz, von der aus gefragt wird.
   *
   * Geht als `?referenz=` mit ins Formular. Ohne ihn landet man wie bisher
   * auf einem leeren Maßformular — für die Produktseite ist das richtig,
   * für eine Referenz war es eine verschenkte Gelegenheit.
   */
  referenz?: string
}) {
  const ziel = referenz
    ? `/${locale}/massanfertigung?referenz=${encodeURIComponent(referenz)}`
    : `/${locale}/massanfertigung`
  return (
    <div className="border-line mt-16 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
      <p className="text-ink-soft text-sm">{text}</p>
      <Link
        href={ziel}
        className="bg-ink tracking-nav hover:bg-bronze px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors"
      >
        {label}
      </Link>
    </div>
  )
}
