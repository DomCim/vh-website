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

/**
 * Dieselben Regeln für jeden, der fragt.
 *
 * **Warum `/api/media/` ausdrücklich erlaubt ist.** Die Bilder der Artikel
 * liegen unter `/api/media/file/…` — sie werden von Payload ausgeliefert und
 * nicht aus einem Ordner. Mit einem bloßen `Disallow: /api/` ist damit jedes
 * Produktfoto gesperrt, und das fiel lange nicht auf: Die Seiten selbst waren
 * ja erreichbar, nur die Bilder darin nicht.
 *
 * Bemerkt hat es erst das Merchant Center, und zwar deutlich: „Qualitäts- und
 * Richtlinienüberprüfungen auf Produktseiten nicht möglich — 19 Produkte
 * (100 %)". Ohne Bild kein Eintrag bei Google Shopping, und in der Bildersuche
 * ohnehin nichts.
 *
 * Google nimmt bei mehreren zutreffenden Zeilen die **genauere**: `/api/media/`
 * ist länger als `/api/` und gewinnt. Alles andere unter `/api/` bleibt
 * gesperrt, wie es sein soll — dort liegen Bestellungen, Postfach und Zugänge.
 *
 * **Warum Googlebot und Googlebot-Image eigens dastehen.** Fachlich genügt die
 * Gruppe mit dem Stern; die Prüfung des Merchant Centers verlangt die beiden
 * aber namentlich. Es kostet vier Zeilen, und eine Beanstandung, die man mit
 * vier Zeilen ausräumen kann, diskutiert man nicht.
 */
const REGELN = {
  allow: ['/', '/api/media/'],
  disallow: ['/admin', '/api/'],
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', ...REGELN },
      { userAgent: 'Googlebot', ...REGELN },
      { userAgent: 'Googlebot-Image', ...REGELN },
    ],
    sitemap: `${basis()}/sitemap.xml`,
  }
}
