'use client'

import React from 'react'

import type { Entwurf } from '../../lib/buero/entwurf'

/**
 * Die Frage, die ein gefundener Entwurf stellt.
 *
 * Bewusst eine Frage und keine stille Wiederherstellung: Wer ein Formular
 * öffnet und ungefragt einen halben Stand vorfindet, weiß im ersten Moment
 * nicht, ob er einen Fehler sieht oder seine eigene Arbeit von vorhin. Dieselbe
 * Überlegung wie bei der Leiste über den Listen — ein alter Stand ist
 * brauchbar, ein alter Stand, der sich für den aktuellen ausgibt, ist
 * gefährlich.
 *
 * Deshalb steht dabei, *wo* und *wann* angefangen wurde. Das ist meistens die
 * ganze Information, die es zur Entscheidung braucht.
 */
export function EntwurfLeiste<T extends object>({
  angebot,
  aufWeitermachen,
  aufVerwerfen,
}: {
  angebot: Entwurf<T> | null
  aufWeitermachen: () => void
  aufVerwerfen: () => void
}) {
  if (!angebot) return null

  const wann = angebot.zeit ? new Date(angebot.zeit) : null
  const zeit = wann
    ? wann.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="buero-entwurf" role="status">
      <span>
        {angebot.geraet ? `Am ${angebot.geraet} ` : 'Vorhin '}
        {zeit ? `am ${zeit} ` : ''}
        angefangen.
      </span>
      <span className="buero-entwurf-knoepfe">
        <button type="button" onClick={aufWeitermachen}>
          Weitermachen
        </button>
        <button type="button" className="buero-leise" onClick={aufVerwerfen}>
          Verwerfen
        </button>
      </span>
    </div>
  )
}
