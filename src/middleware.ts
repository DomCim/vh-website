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
export function middleware(anfrage: NextRequest) {
  const { pathname, search } = anfrage.nextUrl

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
   */
  matcher: ['/((?!(?:api|office|admin|_next|media|js)(?:/|$)|.*\\.).*)'],
}
