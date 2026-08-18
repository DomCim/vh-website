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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1>Postfach</h1>
          <p className="buero-unterzeile">
            Direkt beim Anbieter gelesen — was hier gelöscht wird, ist auch am Rechner weg.
          </p>
        </div>
        <Link href="/office/post/protokoll" className="buero-knopf leise">
          Ausgangsprotokoll
        </Link>
      </div>

      <Postfach vorgabe={an ? { an, betreff: betreff ?? '', text: '' } : null} />
    </>
  )
}
