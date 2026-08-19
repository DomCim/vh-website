'use client'

import Link from 'next/link'
import React from 'react'

import { useDarf } from '../../lib/buero/rechte'

/**
 * Der Verweis in die Website-Verwaltung, oben rechts.
 *
 * Nur für Leute, die dort auch etwas dürfen. Wer ihn ohne das Recht anklickt,
 * landet auf einer Anmeldemaske, die ihn nicht einlässt — und hält das für
 * einen Fehler.
 */
export function AdminVerweis() {
  const darf = useDarf()
  if (!darf('website.pflegen')) return null
  return (
    <Link href="/admin" className="buero-marker buero-nur-breit">
      Website-Verwaltung
    </Link>
  )
}
