import Link from 'next/link'
import React from 'react'

import { type VerknuepfteArbeit } from '../lib/arbeiten'
import type { Locale } from '../lib/i18n'

/**
 * Verknüpfte Arbeiten unter einem Text.
 *
 * Steht unter Referenzen („Verwendete Arbeiten") und unter Ratgebern
 * („Passende Arbeiten"). Beide Seiten hatten dieselbe Kachelreihe, einmal
 * abgeschrieben — und die Abschrift wäre beim ersten Umbau die schlechtere
 * von beiden geworden.
 *
 * **Warum das der eigentliche Weg zum Auftrag ist.** Ein Ratgeber über
 * Rostschutz bringt Leser, aber keinen Auftrag, solange am Ende der Seite
 * nichts steht. Die Kacheln sind kein Werbeblock: Sie zeigen, worum es im
 * Text gerade ging.
 */
export function ArbeitenListe({
  locale,
  titel,
  arbeiten,
}: {
  locale: Locale
  titel: string
  arbeiten: VerknuepfteArbeit[]
}) {
  if (arbeiten.length === 0) return null

  return (
    <div className="mt-16">
      <h2 className="tracking-nav text-ink heading-rule text-lg font-semibold uppercase">
        {titel}
      </h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {arbeiten.map((p) => (
          <li key={p.id}>
            <Link href={`/${locale}/${p.kategorieSlug}/${p.slug}`} className="group block">
              {p.bild && (
                <div className="bg-paper-soft overflow-hidden">
                  <img
                    src={p.bild}
                    alt={p.bildAlt ?? p.titel}
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              )}
              <p className="group-hover:text-bronze mt-3 text-sm font-semibold transition-colors">
                {p.titel}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
