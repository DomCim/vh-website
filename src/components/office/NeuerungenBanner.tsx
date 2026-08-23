'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useAlsGesehen, useUngesehene } from '../../lib/buero/neuerungen'

/**
 * „Es gibt Neues" — der einzige Hinweis darauf, dass sich am Haus etwas
 * geändert hat.
 *
 * Vorher stand das Änderungsprotokoll unter Sonstiges → Neuerungen und wartete
 * darauf, dass jemand von sich aus nachsieht. Getan hat das niemand: Man
 * öffnet keine Seite, um zu erfahren, ob es etwas zu erfahren gibt. Also sagt
 * es das Büro von selbst — einmal, ruhig, und danach nie wieder.
 *
 * Bewusst kein Zähler an der Navigation: Ein Zähler steht für Arbeit, die
 * liegen bleibt, und verschwindet, wenn sie getan ist. Das hier verschwindet
 * durchs Hinsehen und ist deshalb ein Banner, der weggeht.
 *
 * Er steht nur im Büro. Die Website geht das nichts an.
 */
export function NeuerungenBanner() {
  const pfad = usePathname()
  const offene = useUngesehene()
  const abhaken = useAlsGesehen()

  // Auf der Seite selbst wäre er ein Hinweis auf das, was darunter steht
  if (!offene.length || pfad?.startsWith('/office/neuerungen')) return null

  const neueste = offene[0]
  const mehr = offene.length - 1

  return (
    <div className="buero-neu-banner" role="status">
      <Link href="/office/neuerungen" className="buero-neu-banner-text">
        <span className="buero-neu-banner-marke">Neu</span>
        <span className="buero-neu-banner-titel">{neueste.titel}</span>
        {mehr > 0 ? (
          <span className="buero-neu-banner-mehr">
            und {mehr} weitere{mehr === 1 ? 'r Eintrag' : ' Einträge'}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        className="buero-neu-banner-weg"
        onClick={abhaken}
        aria-label="Hinweis auf Neuerungen ausblenden"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
        </svg>
      </button>
    </div>
  )
}
