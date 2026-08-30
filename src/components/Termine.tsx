import React from 'react'

import type { OeffentlicherTermin } from '../lib/kalender/oeffentlich'
import type { Locale } from '../lib/i18n'
import { t } from '../lib/i18n'

/**
 * Ein öffentlicher Termin, wie ihn die Website zeigt.
 *
 * Woher die Angaben kommen, steht in `lib/kalender/merkmale.ts`: Vincent
 * schreibt sie als Flaggen in die Notiz seines Termins — auch vom Telefon
 * aus, weil die Notiz über CalDAV unverändert hier ankommt.
 *
 * Eine Stelle für beide Auftritte (eigene Seite und Startseite), damit ein
 * abgesagter Termin nicht an einer von zwei Stellen wie ein gültiger aussieht.
 */

/**
 * Die Zeitzone der Werkstatt — nicht die des Servers.
 *
 * Diese Seite wird auf dem Server gebaut, und der Container läuft nach UTC.
 * Ohne Angabe formatierte er die Uhrzeit in UTC: Ein Termin um 9 Uhr stand
 * für **jeden** Besucher als „07:00" da. Genau so gemeldet, nachdem die
 * Uhrzeit im Büro längst stimmte — dort rechnet der Browser, hier der Server.
 *
 * Dieselbe Festlegung wie beim Tagesstempel der Statistik (`lib/statistik.ts`)
 * und aus demselben Grund: Die Werkstatt steht in Frankreich, und was auf der
 * Website steht, ist eine Ansage an Besucher vor Ort.
 */
const ZONE = 'Europe/Paris'

/** Der Tag, groß herausgestellt — daran findet man sich in einer Liste zurecht. */
function Tagesblock({ termin, sprache }: { termin: OeffentlicherTermin; sprache: Locale }) {
  const d = new Date(termin.beginn)
  return (
    <div className="border-line bg-paper-soft flex h-16 w-16 shrink-0 flex-col items-center justify-center border">
      {/* Auch die Tageszahl in der Zone der Werkstatt — `getDate()` nähme
          die des Servers, und ein Termin am späten Abend stünde dann unter
          dem falschen Tag. */}
      <span className="text-ink text-xl leading-none font-semibold">
        {d.toLocaleDateString(sprache, { day: 'numeric', timeZone: ZONE })}
      </span>
      <span className="text-ink-soft mt-1 text-[10px] uppercase">
        {d.toLocaleDateString(sprache, { month: 'short', timeZone: ZONE })}
      </span>
    </div>
  )
}

/**
 * Der Zeitraum in Worten.
 *
 * Ganztägige Termine bekommen keine Uhrzeit — „ganztägig" ist die Auskunft,
 * „00:00" wäre eine falsche.
 */
function zeitraum(termin: OeffentlicherTermin, sprache: Locale): string {
  const dict = t(sprache)
  const beginn = new Date(termin.beginn)
  const ende = termin.ende ? new Date(termin.ende) : null

  const tag = beginn.toLocaleDateString(sprache, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: ZONE,
  })

  if (termin.ganztaegig) {
    // Über mehrere Tage: „30. August bis 2. September"
    // Verglichen wird der Tag in der Zone der Werkstatt; `toDateString()`
    // nähme die des Servers und zöge einen Abendtermin über zwei Tage
    const alsTag = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: ZONE })
    if (ende && alsTag(ende) !== alsTag(beginn)) {
      return `${tag} – ${ende.toLocaleDateString(sprache, { day: 'numeric', month: 'long', timeZone: ZONE })}`
    }
    return `${tag} · ${dict.events.allDay}`
  }

  const uhr = (d: Date) =>
    d.toLocaleTimeString(sprache, { hour: '2-digit', minute: '2-digit', timeZone: ZONE })

  return ende ? `${tag} · ${uhr(beginn)} – ${uhr(ende)}` : `${tag} · ${uhr(beginn)}`
}

export function TerminKarte({
  termin,
  sprache,
}: {
  termin: OeffentlicherTermin
  sprache: Locale
}) {
  const dict = t(sprache)

  return (
    <article
      className={`border-line flex gap-4 border bg-paper p-5 ${
        // Ein abgesagter Termin bleibt stehen, tritt aber zurück — wer schon
        // hinfahren wollte, sucht genau ihn; wer plant, soll ihn nicht zählen
        termin.abgesagt ? 'opacity-60' : ''
      }`}
    >
      <Tagesblock termin={termin} sprache={sprache} />

      <div className="min-w-0">
        {termin.abgesagt && (
          <span className="tracking-nav mb-2 inline-block bg-ink px-2 py-1 text-[10px] font-semibold text-on-ink uppercase">
            {dict.events.cancelled}
          </span>
        )}

        <h3
          className={`tracking-nav text-ink text-sm font-semibold uppercase ${
            termin.abgesagt ? 'line-through' : ''
          }`}
        >
          {termin.titel}
        </h3>

        <p className="text-ink-soft mt-1 text-xs">{zeitraum(termin, sprache)}</p>
        {termin.ort && <p className="text-ink-soft text-xs">{termin.ort}</p>}

        {termin.beschreibungHtml && (
          /*
           * Der Text ist schon ausgezeichnet und entschärft (siehe
           * `merkmale.ts`, `alsHtml`): erst alles unschädlich gemacht, dann
           * `**fett**` und `*kursiv*` gesetzt. Nur diese beiden Auszeichnungen
           * überleben, alles andere ist Text geworden.
           */
          <p
            className="text-ink-soft mt-3 text-sm"
            dangerouslySetInnerHTML={{ __html: termin.beschreibungHtml }}
          />
        )}

        {termin.link && (
          <a
            href={termin.link}
            target="_blank"
            rel="noopener noreferrer"
            className="tracking-nav text-ink mt-3 inline-block text-xs font-medium uppercase underline-offset-4 hover:underline"
          >
            {dict.events.more} →
          </a>
        )}
      </div>
    </article>
  )
}
