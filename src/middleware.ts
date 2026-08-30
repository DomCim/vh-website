import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { mitSprache, pfadNenntSprache, SPRACH_COOKIE, spracheWaehlen } from './lib/sprachwahl'

/**
 * Wer ohne Sprachkürzel kommt, wird in seine Sprache geschickt.
 *
 * Die Entscheidung selbst steht in `lib/sprachwahl.ts`; hier geht es nur
 * darum, sie an der richtigen Stelle anzuwenden — und vor allem: an den
 * falschen Stellen **nicht**.
 *
 * **Was hier nicht angefasst wird** (siehe `config.matcher`): das Büro unter
 * `/office`, die Payload-Verwaltung unter `/admin`, sämtliche Schnittstellen
 * unter `/api` und alles mit einem Punkt im Namen — Bilder, `sitemap.xml`,
 * `office-sw.js`, die Schriftarten. Eine Umleitung dort wäre kein
 * Sprachwechsel, sondern ein Ausfall: Der Abhol-Link eines Zulieferers zeigt
 * auf `/api/weitergabe`, und die installierte Büro-App holt ihren Dienstboten
 * unter `/office-sw.js`.
 *
 * **307 und nicht 308.** Die Umleitung hängt am Besucher, nicht am Pfad — sie
 * darf sich niemals dauerhaft in einem Browser oder einem Zwischenspeicher
 * festsetzen. Aus demselben Grund steht `Vary` dabei: Antwort und Ziel hängen
 * von Kopf und Cookie ab.
 */
/**
 * Die Verben, die WebDAV über HTTP hinaus mitbringt.
 *
 * Next kennt in einer Route nur GET, HEAD, OPTIONS, POST, PUT, DELETE und
 * PATCH (`next/dist/server/web/http.js`). Ein exportiertes `PROPFIND` wird
 * schlicht nicht angesprungen — die Antwort wäre `405`, und zwar ausgerechnet
 * bei den Anfragen, mit denen das iPhone ein CalDAV-Konto überhaupt erst
 * einrichtet.
 *
 * Deshalb der Umweg: Diese Verben kommen als `POST` in der Route an und
 * tragen ihren echten Namen in einem eigenen Kopf mit. Die Route liest ihn
 * und verzweigt selbst (siehe `api/caldav/[[...pfad]]/route.ts`).
 */
const DAV_VERBEN = ['PROPFIND', 'REPORT', 'PROPPATCH', 'MKCALENDAR', 'MKCOL']
export const DAV_KOPF = 'x-dav-methode'

export async function middleware(anfrage: NextRequest) {
  const { pathname, search } = anfrage.nextUrl

  // CalDAV steht ganz vorn — siehe die beiden Vermerke darin
  if (pathname.startsWith('/api/caldav')) {
    /*
     * Erst einmal: **kein Sprachkürzel**. Der Abgleich lief hier zunächst in
     * die Sprachumleitung und landete bei `/en/api/caldav/…` — eine Adresse,
     * die es nicht gibt. Alles unter `/api` ist von der Umleitung
     * ausgenommen (siehe `config.matcher`); dieser eine Zweig ist nur
     * deshalb überhaupt hier, weil Next die WebDAV-Verben sonst gar nicht
     * durchlässt. Die Umleitung darf ihn folglich nicht anfassen.
     */
    if (!DAV_VERBEN.includes(anfrage.method)) return NextResponse.next()

    /*
     * Das echte Verb in den Kopf, und als `POST` weiterreichen.
     *
     * Next entscheidet am Verb, **bevor** eine Route gefragt wird, und
     * beantwortet alles außerhalb seiner sieben selbst — ein exportiertes
     * `PROPFIND` wird nie angesprungen. Ein `rewrite` hilft nicht, es setzt
     * nur ein Ziel und lässt das Verb, wie es war. Die Anfrage muss hier
     * also wirklich zu einem `POST` werden; die Route liest den Kopf und
     * verteilt selbst.
     *
     * Der Rumpf wird vorher **ganz gelesen**. Ihn als Strom weiterzugeben
     * brach im Container mit „transformAlgorithm is not a function": Ein
     * laufender Anfragestrom lässt sich hier nicht zuverlässig
     * weiterverschicken. Die Rümpfe sind ein paar Zeilen XML, das Einlesen
     * kostet also nichts.
     *
     * **Kein Kreislauf:** Die neue Anfrage ist ein `POST`, und `POST` steht
     * nicht in `DAV_VERBEN` — sie fällt oben durch die Bedingung und geht
     * geradewegs an die Route.
     */
    const kopf = new Headers(anfrage.headers)
    kopf.set(DAV_KOPF, anfrage.method)
    kopf.delete('content-length')

    const rumpf = await anfrage.text()
    return fetch(`${anfrage.nextUrl.origin}${pathname}${search}`, {
      method: 'POST',
      headers: kopf,
      body: rumpf || undefined,
      redirect: 'manual',
    })
  }

  // Eine Adresse, die ihre Sprache nennt, bleibt, wie sie ist — sie ist die
  // Zusage an jeden, der den Link weitergibt
  if (pfadNenntSprache(pathname)) return NextResponse.next()

  const sprache = spracheWaehlen({
    gemerkt: anfrage.cookies.get(SPRACH_COOKIE)?.value,
    kopf: anfrage.headers.get('accept-language'),
  })

  const ziel = new URL(`${mitSprache(pathname, sprache)}${search}`, anfrage.url)
  const antwort = NextResponse.redirect(ziel, 307)
  antwort.headers.set('Vary', 'Accept-Language, Cookie')
  return antwort
}

export const config = {
  /*
   * Alles außer: Schnittstellen, Büro, Verwaltung, Nexts eigenem Kram, den
   * Medien — und allem mit einem Punkt, also jeder Datei.
   *
   * Dazu als einzige Ausnahme unter `/api` der CalDAV-Weg: Dort muss die
   * Middleware ans Werk, weil Next die WebDAV-Verben sonst gar nicht erst
   * durchlässt (siehe oben). Die Sprachumleitung greift dort nicht — der
   * Block steht vor ihr und antwortet selbst.
   */
  matcher: ['/((?!(?:api|office|admin|_next|media|js)(?:/|$)|.*\\.).*)', '/api/caldav/:pfad*'],
}
