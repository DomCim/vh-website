import Link from 'next/link'
import React from 'react'

export const dynamic = 'force-dynamic'

export default function KeinZugang() {
  return (
    <div className="buero-karte" style={{ maxWidth: '34rem' }}>
      <h1>Kein Zugang</h1>
      <p className="buero-unterzeile">
        Dieser Bereich zeigt Belege, Umsätze und Inventar. Er ist der Inhaberrolle vorbehalten.
      </p>
      <p style={{ fontSize: '.9rem' }}>
        Wenn das ein Versehen ist: In der Website-Verwaltung unter <strong>Benutzer</strong> die
        Rolle auf „Inhaber&ldquo; setzen und neu anmelden.
      </p>
      <p style={{ marginTop: '1.25rem' }}>
        <Link href="/admin" className="buero-knopf leise">
          Zur Website-Verwaltung
        </Link>
      </p>
    </div>
  )
}
