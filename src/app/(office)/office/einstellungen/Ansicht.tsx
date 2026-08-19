'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React from 'react'

import { Benachrichtigungen } from '../../../../components/office/Benachrichtigungen'
import { BenutzerVerwaltung } from '../../../../components/office/BenutzerVerwaltung'
import { EinstellungenFormular } from '../../../../components/office/EinstellungenFormular'
import { Haengengebliebenes } from '../../../../components/office/Haengengebliebenes'
import { MeinKonto } from '../../../../components/office/MeinKonto'
import { useRahmen } from '../../../../lib/buero/bestand'

/**
 * Einstellungen — alles Betriebliche an einem Ort.
 *
 * Bisher führte jeder Weg zu den Zugangsdaten über das Admin-Panel: mitten
 * aus dem Büro heraus in eine andere Oberfläche mit anderem Aufbau. Jetzt
 * bleibt das Admin-Panel für die öffentliche Website, und alles, was den
 * Betrieb angeht, steht hier.
 *
 * Ohne Netz geht das nicht — anders als die übrigen Büro-Seiten. Das ist
 * Absicht: Einstellungen zwischenzuspeichern hieße, Zugangsdaten im Gerät zu
 * halten, und ein Zugangsdatum, das man offline ändert, wäre eine Falle.
 */

const TEILE = [
  { schluessel: 'geraet', label: 'Dieses Gerät' },
  { schluessel: 'konto', label: 'Mein Konto' },
  { schluessel: 'benutzer', label: 'Benutzer' },
  { schluessel: 'betrieb', label: 'Betrieb' },
  { schluessel: 'integrationen', label: 'Integrationen' },
] as const

export function EinstellungenAnsicht() {
  const suche = useSearchParams()
  const teil = suche.get('teil') ?? 'geraet'
  const { benutzer } = useRahmen()

  return (
    <>
      <h1>Einstellungen</h1>
      <p className="buero-unterzeile">
        Angemeldet als {benutzer.email || '…'}
        {benutzer.name ? ` (${benutzer.name})` : ''}
      </p>

      <div
        className="buero-nav"
        style={{ borderRadius: 10, border: '1px solid var(--buero-linie)', marginBottom: '1rem' }}
      >
        {TEILE.map((t) => (
          <Link
            key={t.schluessel}
            href={`/office/einstellungen?teil=${t.schluessel}`}
            aria-current={teil === t.schluessel ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {teil === 'geraet' && (
        <>
          <Benachrichtigungen />
          <Haengengebliebenes />
        </>
      )}

      {teil === 'konto' && <MeinKonto />}

      {teil === 'benutzer' && <BenutzerVerwaltung />}

      {teil === 'betrieb' && (
        <EinstellungenFormular bereich="betrieb" titel="Betrieb und Website" />
      )}

      {teil === 'integrationen' && (
        <EinstellungenFormular bereich="integrationen" titel="Integrationen" />
      )}
    </>
  )
}
