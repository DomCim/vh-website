'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React from 'react'

import { Benachrichtigungen } from '../../../../components/office/Benachrichtigungen'
import { BestandNeuHolen } from '../../../../components/office/BestandNeuHolen'
import { Haengengebliebenes } from '../../../../components/office/Haengengebliebenes'
import { MeinKonto } from '../../../../components/office/MeinKonto'
import { useRahmen } from '../../../../lib/buero/bestand'

/**
 * Mein Konto — alles, was nur mich und dieses Gerät angeht.
 *
 * **Warum eine eigene Seite.** „Dieses Gerät" und „Mein Konto" standen als
 * Reiter in den Einstellungen, zwischen Benutzerverwaltung, Betriebsdaten und
 * Zugangsdaten zu fremden Diensten. Das ist zweierlei: Was dort steht, gilt
 * für den ganzen Betrieb und ändert sich einmal im Jahr; was hier steht, gilt
 * für mich und für das Gerät in meiner Hand. Hinweis von Dominik, und er hat
 * recht — es sind Benutzereinstellungen und keine allgemeinen.
 *
 * Erreichbar ist die Seite deshalb über den eigenen Namen am Fuß der
 * Seitenleiste, nicht über den Punkt „Einstellungen" daneben.
 *
 * Ohne Netz geht das nicht — anders als die übrigen Büro-Seiten, und aus
 * demselben Grund wie bei den Einstellungen: Ein Zugangsdatum, das man
 * offline ändert, wäre eine Falle.
 */

const TEILE = [
  { schluessel: 'zugang', label: 'Zugang' },
  { schluessel: 'geraet', label: 'Dieses Gerät' },
] as const

export function KontoAnsicht() {
  const suche = useSearchParams()
  const teil = suche.get('teil') ?? 'zugang'
  const { benutzer } = useRahmen()

  return (
    <>
      <h1>Mein Konto</h1>
      <p className="buero-unterzeile">
        Angemeldet als {benutzer.email || '…'}
        {benutzer.name ? ` (${benutzer.name})` : ''}
      </p>

      <div className="buero-reiter">
        {TEILE.map((t) => (
          <Link
            key={t.schluessel}
            href={`/office/konto?teil=${t.schluessel}`}
            aria-current={teil === t.schluessel ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Passwort, Zwei-Faktor und die Liste der angemeldeten Geräte */}
      {teil === 'zugang' && <MeinKonto />}

      {teil === 'geraet' && (
        <>
          <Benachrichtigungen />
          <Haengengebliebenes />
          <BestandNeuHolen />
        </>
      )}
    </>
  )
}
