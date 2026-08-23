'use client'

import Link from 'next/link'
import React from 'react'

import { FehlermeldungFormular } from '../../../../components/office/FehlermeldungFormular'
import { useRahmen } from '../../../../lib/buero/bestand'

/**
 * Fehler melden.
 *
 * Eine eigene Seite und kein Fenster über dem Formular: Wer etwas meldet, will
 * in Ruhe tippen und ein Foto heraussuchen, und ein Fenster, das dabei über
 * der halben Seite liegt, drängt zur Kürze. Die Seite davor merkt sich das
 * Formular von selbst.
 */
export default function MeldenSeite() {
  const { meldenMoeglich } = useRahmen()

  return (
    <>
      <h1>Fehler melden</h1>
      <p className="buero-unterzeile">
        Etwas stimmt nicht, sieht falsch aus oder fehlt? Hier hin damit — daraus wird ein Eintrag im
        Repository, den sich jemand ansieht.
      </p>

      {meldenMoeglich ? (
        <FehlermeldungFormular />
      ) : (
        <div className="buero-leer">
          Dafür fehlt noch der Zugang. Unter{' '}
          <Link href="/office/einstellungen" style={{ textDecoration: 'underline' }}>
            Einstellungen
          </Link>{' '}
          → Integrationen → Fehlermeldungen gehören Repository und Zugangswort hin.
        </div>
      )}
    </>
  )
}
