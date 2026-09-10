import { headers } from 'next/headers'
import Link from 'next/link'
import React from 'react'

import { Reveal, RevealItem, RevealStagger } from '../../../components/motion/Reveal'
import { defaultLocale, isLocale, t } from '../../../lib/i18n'
import { SPRACH_KOPF } from '../../../lib/sprachwahl'

/**
 * Die Seite für eine Adresse, die es nicht gibt.
 *
 * **Vorher stand hier Nexts eigene Notseite:** weiße Fläche, ein englischer
 * Satz („404: This page could not be found."), kein Kopf, kein Fuß, kein Weg
 * zurück. Wer aus einem Suchergebnis oder einem alten Lesezeichen kam, war
 * damit endgültig weg — und zwar auch auf Französisch, denn der Satz stand
 * immer auf Englisch.
 *
 * **Warum wir trotzdem nicht auf die Startseite umleiten.** Das ist der
 * naheliegende Griff und der falsche: Google wertet eine Umleitung von einer
 * nicht vorhandenen Adresse auf die Startseite als „Soft 404" — die Adresse
 * fliegt genauso aus dem Index, nur meldet die Search Console den Fehler
 * nicht mehr. Damit verlöre der Betrieb die einzige Liste, aus der hervorgeht,
 * welche alten Adressen überhaupt noch aufgerufen werden; genau aus ihr
 * entstehen die Umleitungen in `next.config.mjs`. Und für den Besucher wäre
 * es auch nicht besser: Wer „Brasero Corten" gesucht hat und wortlos auf der
 * Startseite steht, denkt, er habe sich vertippt.
 *
 * Der Statuscode bleibt deshalb 404 und ehrlich. Was sich ändert, ist, was
 * dabei zu sehen ist: die Suche, die Rubriken und der Weg zur Maßanfertigung —
 * dieselben Wege, die eine Umleitung ersetzen sollte, nur ohne den Preis.
 *
 * **Die Sprache kommt aus dem Kopf, nicht aus dem Pfad.** Next reicht
 * `not-found.tsx` keine Wegparameter durch, obwohl die Sprache im Pfad steht.
 * Die Middleware schreibt sie deshalb in `SPRACH_KOPF`. Fehlt er einmal, ist
 * Deutsch die Rückfallebene — eine Fehlerseite in der falschen Sprache ist
 * immer noch besser als keine.
 */
export default async function NichtGefunden() {
  const kopf = await headers()
  const gemeldet = kopf.get(SPRACH_KOPF) ?? ''
  const locale = isLocale(gemeldet) ? gemeldet : defaultLocale
  const dict = t(locale)

  const wege = [
    { pfad: '/kollektion', name: dict.nav.collection },
    { pfad: '/projekte', name: dict.nav.projects },
    { pfad: '/massanfertigung', name: dict.nav.custom },
    { pfad: '/kontakt', name: dict.nav.contact },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
      <Reveal>
        <h1 className="tracking-nav text-ink heading-rule text-2xl font-semibold uppercase">
          {dict.notFound.title}
        </h1>
      </Reveal>

      <Reveal>
        <p className="text-ink-soft mt-6 max-w-2xl leading-relaxed">{dict.notFound.lead}</p>
      </Reveal>

      <form action={`/${locale}/suche`} className="mt-8 flex max-w-xl gap-3">
        <input
          type="search"
          name="q"
          placeholder={dict.search.placeholder}
          aria-label={dict.search.placeholder}
          className="border-line focus:border-ink w-full border bg-paper px-4 py-3 text-sm outline-none transition-colors"
        />
        <button
          type="submit"
          className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-6 py-3 text-xs font-semibold whitespace-nowrap text-on-ink uppercase transition-colors"
        >
          {dict.search.submit}
        </button>
      </form>

      <Reveal>
        <h2 className="tracking-nav text-ink mt-14 mb-6 text-sm font-semibold uppercase">
          {dict.notFound.waysTitle}
        </h2>
      </Reveal>

      <RevealStagger className="grid gap-4 sm:grid-cols-2">
        {wege.map((weg) => (
          <RevealItem key={weg.pfad}>
            <Link
              href={`/${locale}${weg.pfad}`}
              className="border-line hover:border-ink tracking-nav text-ink block border px-5 py-4 text-xs font-semibold uppercase transition-colors"
            >
              {weg.name}
            </Link>
          </RevealItem>
        ))}
      </RevealStagger>

      <Reveal>
        <Link href={`/${locale}`} className="text-ink-soft hover:text-ink mt-10 inline-block text-sm underline underline-offset-4 transition-colors">
          {dict.common.backHome}
        </Link>
      </Reveal>
    </div>
  )
}
