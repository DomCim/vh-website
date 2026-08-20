import type { MetadataRoute } from 'next'

/**
 * Bei jedem Abruf neu, nicht einmal beim Bauen.
 *
 * Ohne das legt Next die Datei beim Bauen fest — und dort gibt es
 * `NEXT_PUBLIC_SERVER_URL` nicht, denn die Adresse steht erst im Stack. In
 * der ausgelieferten `robots.txt` stand deshalb der Rückfallwert:
 *
 *     Sitemap: http://localhost:3000/sitemap.xml
 *
 * Das ist keine Kleinigkeit. Die Sitemap ist der Weg, auf dem Google erfährt,
 * welche Seiten es überhaupt gibt und in welchen drei Sprachen — und diese
 * Adresse kann kein Suchdienst der Welt abrufen. Die `sitemap.xml` selbst ist
 * seit jeher dynamisch und war richtig; nur der Wegweiser dorthin zeigte ins
 * Nichts.
 *
 * Kosten: eine gerechnete Antwort je Abruf einer Datei mit vier Zeilen.
 */
export const dynamic = 'force-dynamic'

const basis = () => process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: `${basis()}/sitemap.xml`,
  }
}
