'use client'

import { useSearchParams } from 'next/navigation'
import React, { Suspense, useMemo } from 'react'

import { AuftragFormular, type AuftragWerte } from '../../../../../components/office/AuftragFormular'
import { werteAusVorlage } from '../../../../../lib/buero/auftragVorlage'
import { useAbgleich, useBestand, useDatensatz } from '../../../../../lib/buero/bestand'
import type { Posten } from '../../../../../lib/buero/material'

/**
 * Neuer Auftrag — leer, oder nach dem Muster eines vorhandenen.
 *
 * `?vorlage=<id>` kommt vom Knopf „Duplizieren" am Auftrag; was dabei
 * mitkommt und was nicht, steht in `lib/buero/auftragVorlage.ts`. Kunde und
 * Bezeichnung bleiben mit Absicht leer.
 */
export default function NeuerAuftragSeite() {
  return (
    <Suspense fallback={null}>
      <NeuerAuftrag />
    </Suspense>
  )
}

function NeuerAuftrag() {
  const vorlageId = useSearchParams().get('vorlage') ?? undefined
  const vorlage = useDatensatz<Record<string, unknown>>('auftraege', vorlageId)
  const { bereit } = useAbgleich()

  const inventar = useBestand<Posten>('inventar')
  const posten = useMemo(
    () =>
      [...inventar]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
        .map((p) => ({
          id: Number(p.id),
          name: p.name ?? '',
          unit: p.unit ?? '',
          quantity: p.quantity ?? 0,
        })),
    [inventar],
  )

  const werte: AuftragWerte = useMemo(
    () => (vorlage ? werteAusVorlage(vorlage) : {}),
    [vorlage],
  )

  /*
   * Das Formular liest seine Anfangswerte genau einmal — dasselbe gilt beim
   * Inventar. Solange die Vorlage noch aus dem Gerät kommt, darf es deshalb
   * nicht leer aufgehen: Sonst steht ein leeres Formular da, und die Vorlage
   * trifft zu spät ein, um noch etwas zu füllen.
   */
  if (vorlageId && !vorlage && !bereit) return null

  return (
    <>
      <h1>{vorlage ? 'Auftrag duplizieren' : 'Neuer Auftrag'}</h1>
      <p className="buero-unterzeile">
        {vorlage
          ? 'Positionen, Material, Ablauf und Zahlplan sind übernommen. Kunde und Bezeichnung bleiben leer — ein Duplikat entsteht meist für jemand anderen.'
          : 'Für alles, was nicht aus dem Shop oder einem Angebot kommt.'}
      </p>
      <AuftragFormular werte={werte} posten={posten} />
    </>
  )
}
