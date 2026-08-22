import { locales, type Locale } from './i18n'

export const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** Kanonische URL + hreflang-Alternates für einen Pfad (ohne Locale-Präfix) */
export function alternatesFor(locale: Locale, path: string) {
  return {
    canonical: `${BASE_URL}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `${BASE_URL}/${l}${path}`])),
      'x-default': `${BASE_URL}/de${path}`,
    },
  }
}

/**
 * Der Brotkrumen-Pfad für das Suchergebnis.
 *
 * Google zeigt darüber statt der nackten Adresse den Weg an
 * („vincent-hellmann.com › Kollektion › Pflanzkübel"). Das ist keine Kosmetik:
 * Der Weg sagt vor dem Klick, wo man landet — und in einer Ergebnisliste
 * entscheidet das mit.
 *
 * Die Sprache steht im Pfad und gehört deshalb in jede Station; der Name ist
 * das, was der Mensch liest, nicht der Slug.
 */
export function breadcrumbJsonLd(
  locale: Locale,
  stationen: { name: string; pfad: string }[],
): string {
  return jsonLd({
    '@type': 'BreadcrumbList',
    itemListElement: stationen.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      item: `${BASE_URL}/${locale}${s.pfad}`,
    })),
  })
}

/** JSON-LD-Objekt als <script>-Inhalt (Server-Komponenten) */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify({ '@context': 'https://schema.org', ...data })
}

export function absoluteUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`
}
