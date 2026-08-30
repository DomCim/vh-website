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

export function middleware(anfrage: NextRequest) {
  const { pathname, search } = anfrage.nextUrl

  /*
   * CalDAV: das echte Verb retten und als POST weiterreichen.
   *
   * Muss vor allem anderen stehen, und es genügt nicht, den Kopf zu setzen
   * und weiterzureichen: Next prüft das Verb, **bevor** eine Route gefragt
   * wird, und beantwortet alles außerhalb seiner Liste selbst mit einem
   * nackten `400` (`route-modules/app-route/module.js`, `resolve`). Ein
   * `rewrite` ändert daran nichts — es setzt nur ein Ziel, das Verb bleibt.
   *
   * Also wird die Anfrage hier zu einem echten `POST` umgeschrieben und an
   * dieselbe Adresse weitergereicht. Das Verb steht im Kopf, die Route liest
   * es dort. Ein Umweg, ja — aber der einzige, der ohne eigenen Server neben
   * Next auskommt.
   *
   * **Warum das nicht im Kreis läuft:** Die weitergereichte Anfrage ist ein
   * `POST`, und `POST` steht nicht in `DAV_VERBEN`. Sie kommt hier also ein
   * zweites Mal vorbei, fällt durch diese Bedingung hindurch und geht
   * geradewegs an die Route. Wer die Liste je erweitert, muss das im Kopf
   * behalten: Ein `POST` darin wäre eine Schleife ohne Boden.
   */
  if (pathname.startsWith('/api/caldav') && DAV_VERBEN.includes(anfrage.method)) {
    const kopf = new Headers(anfrage.headers)
    kopf.set(DAV_KOPF, anfrage.method)
    return fetch(new URL(`${pathname}${search}`, anfrage.url), {
      method: 'POST',
      headers: kopf,
      body: anfrage.body,
      // Ohne das lehnt undici einen Rumpf am POST ab
      // @ts-expect-error — gehört zur Laufzeit, fehlt in den Typen
      duplex: 'half',
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
