import Link from 'next/link'
import React from 'react'

import { Postfach } from '../../../../components/office/Postfach'
import { bueroBenutzer } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

/**
 * Postfach im Büro.
 *
 * Mit `?an=` und `?betreff=` lässt sich direkt ein Entwurf öffnen — so
 * springt „Antworten" bei einer Anfrage gleich ins richtige Formular.
 */
export default async function PostSeite({
  searchParams,
}: {
  searchParams: Promise<{ an?: string; betreff?: string }>
}) {
  await bueroBenutzer()
  const { an, betreff } = await searchParams

  return (
    <>
      {/*
        * Das Ausgangsprotokoll ist ein Nachschlagewerk, keine Handlung — man
        * geht einmal im Monat hin, wenn eine Mail nicht angekommen ist. Als
        * voller Knopf belegte es am Telefon eine eigene Zeile über allem,
        * jedes Mal. Als Verweis unter der Zeile steht es weiter da und kostet
        * nichts.
        */}
      <h1>Postfach</h1>
      <p className="buero-unterzeile">
        Direkt beim Anbieter gelesen — was hier gelöscht wird, ist auch am Rechner weg.{' '}
        <Link href="/office/post/protokoll" className="buero-knopf stumm">
          Ausgangsprotokoll
        </Link>
      </p>

      {/*
        * Der Rumpf bleibt leer: Die Signatur legt das Schreibfeld selbst
        * hinein, sobald es weiß, über welches Postfach verschickt wird — und
        * das entscheidet sich erst im Browser.
        */}
      <Postfach
        vorgabe={an ? { an, cc: '', bcc: '', betreff: betreff ?? '', text: '', html: '' } : null}
      />
    </>
  )
}
