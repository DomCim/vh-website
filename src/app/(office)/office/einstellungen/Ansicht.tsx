'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React from 'react'

import { BenutzerVerwaltung } from '../../../../components/office/BenutzerVerwaltung'
import { EinstellungenFormular } from '../../../../components/office/EinstellungenFormular'
import { MailVorlagen } from '../../../../components/office/MailVorlagen'
import { RollenVerwaltung } from '../../../../components/office/RollenVerwaltung'
import { TaktStand } from '../../../../components/office/TaktStand'

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
 *
 * Was nur den einen Menschen und sein Gerät angeht — Passwort, Zwei-Faktor,
 * Meldungen, hängengebliebene Einträge — steht seit 09/2026 unter
 * `/office/konto`. Hier bleibt, was für den Betrieb gilt.
 */

const TEILE = [
  { schluessel: 'benutzer', label: 'Benutzer' },
  { schluessel: 'betrieb', label: 'Betrieb' },
  { schluessel: 'mailvorlagen', label: 'Mail-Vorlagen' },
  { schluessel: 'integrationen', label: 'Integrationen' },
] as const

export function EinstellungenAnsicht() {
  const suche = useSearchParams()
  const teil = suche.get('teil') ?? 'benutzer'

  return (
    <>
      <h1>Einstellungen</h1>
      <p className="buero-unterzeile">
        Was hier steht, gilt für den ganzen Betrieb. Das eigene Passwort, die Meldungen dieses
        Geräts und die angemeldeten Geräte stehen unter{' '}
        <Link href="/office/konto" style={{ textDecoration: 'underline' }}>
          Mein Konto
        </Link>
        .
      </p>

      <div className="buero-reiter">
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

      {teil === 'benutzer' && (
        <>
          <BenutzerVerwaltung />
          <RollenVerwaltung />
        </>
      )}

      {teil === 'betrieb' && (
        <EinstellungenFormular bereich="betrieb" titel="Betrieb und Website" />
      )}

      {/* Eigener Reiter und nicht in „Integrationen" mitten zwischen den
          Zugangsdaten: Das sind Texte, die der Betrieb schreibt, und sie
          brauchen ein Schreibfeld samt Vorschau — kein Formularfeld. */}
      {teil === 'mailvorlagen' && <MailVorlagen />}

      {teil === 'integrationen' && (
        <>
          {/* Über dem Formular, weil die Frage „läuft er überhaupt?" vor jeder
              Einstellung kommt — und weil sein Ausfall sonst niemandem
              auffiele, seit er in einem eigenen Container arbeitet. */}
          <TaktStand />
          <EinstellungenFormular bereich="integrationen" titel="Integrationen" />
        </>
      )}
    </>
  )
}
