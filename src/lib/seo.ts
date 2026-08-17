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

/** JSON-LD-Objekt als <script>-Inhalt (Server-Komponenten) */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify({ '@context': 'https://schema.org', ...data })
}

export function absoluteUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`
}
