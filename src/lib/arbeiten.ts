/**
 * Verknüpfte Arbeiten — die Daten hinter den Kacheln.
 *
 * Steht bewusst neben der Anzeige (`components/ArbeitenListe.tsx`) und nicht
 * darin: Was hier passiert, ist reine Auswahl und lässt sich ohne Browser
 * prüfen — und genau das ist der Teil, an dem still etwas schiefgeht.
 */

export type VerknuepfteArbeit = {
  id: number | string
  titel: string
  slug: string
  kategorieSlug: string
  bild?: string
  bildAlt?: string
}

/**
 * Aus den verknüpften Datensätzen die Kacheln machen.
 *
 * Drei Dinge fallen dabei weg: nicht aufgelöste Verweise (reine Zahlen —
 * `depth` reichte nicht), Artikel ohne Kategorie oder Pfad (für die gäbe es
 * keine Adresse, und eine Kachel, die ins Leere führt, ist schlimmer als
 * keine) — und **interne Artikel**: Ihre Seite gibt es öffentlich nicht,
 * und eine Referenz, die auf einen 404 zeigt, verriete obendrein, dass da
 * etwas ist.
 */
export function arbeitenAus(
  verweise: unknown,
  bild: (m: unknown) => string | undefined,
  bildAlt: (m: unknown, fallback: string) => string,
): VerknuepfteArbeit[] {
  const liste = Array.isArray(verweise) ? verweise : []
  return liste
    .filter((p): p is Record<string, any> => typeof p === 'object' && p !== null)
    .filter((p) => !p.intern)
    .map((p) => ({
      id: p.id,
      titel: String(p.title ?? ''),
      slug: String(p.slug ?? ''),
      kategorieSlug:
        typeof p.category === 'object' && p.category ? String(p.category.slug ?? '') : '',
      bild: bild(p.images?.[0]),
      bildAlt: bildAlt(p.images?.[0], String(p.title ?? '')),
    }))
    .filter((p) => p.titel && p.slug && p.kategorieSlug)
}
