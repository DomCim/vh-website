'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { postenTrifft, suchwoerter } from '../../../../lib/inventarsuche'
import { balkenKlasse } from '../../../../lib/listen'
import { euro } from '../../../../lib/format'

/**
 * Inventar — Bestandswert und Mindestbestände rechnet die Seite selbst.
 *
 * Die Suche steht in der Adresse (`?q=`), und zwar bewusst: Wer „Regal C"
 * tippt, einen Posten öffnet und zurückgeht, soll wieder vor „Regal C"
 * stehen und nicht vor dreihundert Zeilen. Geschrieben wird sie mit
 * `history.replaceState` und nicht über den Router — der holte bei jedem
 * Tastendruck die Seite neu vom Server, und am Lager ist der oft nicht da.
 */

const ART: Record<string, string> = {
  material: 'Material',
  werkzeug: 'Werkzeug',
  maschine: 'Maschine',
  fertigware: 'Fertiges Stück',
  sonstiges: 'Sonstiges',
}

type Posten = {
  id: number | string
  name?: string | null
  type?: string | null
  location?: string | null
  unit?: string | null
  quantity?: number | null
  minQuantity?: number | null
  unitValue?: number | null
  supplierRef?: string | null
  notes?: string | null
  /** Je nach Tiefe des Abgleichs eine Kennung oder der ganze Partner */
  supplier?: number | string | { id?: number | string; name?: string | null } | null
}

type Partner = { id: number | string; name?: string | null }

export function InventarAnsicht() {
  const alle = useBestand<Posten>('inventar')
  const partner = useBestand<Partner>('partner')
  const adresse = useSearchParams()
  const [suche, setSuche] = useState(() => adresse.get('q') ?? '')

  const posten = useMemo(
    () => [...alle].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de')),
    [alle],
  )

  /** Der Name des Lieferanten — die Suche soll „Würth" finden, nicht „17". */
  const lieferantName = useMemo(() => {
    const namen = new Map(partner.map((p) => [String(p.id), p.name ?? '']))
    return (s: Posten['supplier']) =>
      s == null ? '' : typeof s === 'object' ? (s.name ?? '') : (namen.get(String(s)) ?? '')
  }, [partner])

  const gefunden = useMemo(() => {
    const woerter = suchwoerter(suche)
    if (woerter.length === 0) return posten
    return posten.filter((i) =>
      postenTrifft(i, woerter, { art: ART[i.type ?? ''], lieferant: lieferantName(i.supplier) }),
    )
  }, [posten, suche, lieferantName])

  function suchen(text: string) {
    setSuche(text)
    const url = new URL(window.location.href)
    if (text.trim()) url.searchParams.set('q', text)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', url)
  }

  const wert =
    Math.round(posten.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitValue ?? 0), 0) * 100) / 100
  const knapp = posten.filter(
    (i) => typeof i.minQuantity === 'number' && (i.quantity ?? 0) < i.minQuantity,
  )

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
          <h1>Inventar</h1>
          <p className="buero-unterzeile">
            {posten.length} Posten · Bestandswert {euro(wert)}
          </p>
        </div>
        <Link href="/office/inventar/neu" className="buero-knopf">
          Posten anlegen
        </Link>
      </div>

      {knapp.length > 0 && (
        <p className="buero-hinweis">
          {knapp.length} Posten liegen unter dem Mindestbestand:{' '}
          {knapp.map((k) => k.name).join(', ')}
        </p>
      )}

      {posten.length > 0 && (
        <label className="buero-feld">
          <span>Suchen</span>
          <input
            type="search"
            value={suche}
            onChange={(e) => suchen(e.target.value)}
            placeholder="Bezeichnung, Lagerort, Lieferant, Artikelnummer, Notiz — oder „knapp“"
            aria-describedby="inventar-suche-stand"
          />
          <span id="inventar-suche-stand" className="buero-feld-hinweis" role="status">
            {suche.trim()
              ? `${gefunden.length} von ${posten.length} Posten`
              : 'Mehrere Wörter grenzen ein: „M8 Regal C“ findet die Schraube im Regal C.'}
          </span>
        </label>
      )}

      <div className="buero-liste">
        {posten.length === 0 ? (
          <div className="buero-leer">Noch nichts erfasst.</div>
        ) : gefunden.length === 0 ? (
          <div className="buero-leer">Kein Posten passt zur Suche.</div>
        ) : (
          gefunden.map((i) => {
            const wenig = typeof i.minQuantity === 'number' && (i.quantity ?? 0) < i.minQuantity
            return (
              // Rot heißt „über der Zeit": Unter dem Mindestbestand fehlt
              // Material, bevor der nächste Auftrag es braucht.
              <Link
                key={i.id}
                href={`/office/inventar/${i.id}`}
                className={`buero-zeile ${balkenKlasse(wenig ? 'warn' : '')}`}
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{i.name}</div>
                  <div className="buero-zeile-neben">
                    {ART[i.type ?? ''] ?? i.type}
                    {i.location ? ` · ${i.location}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  {wenig && <span className="buero-marker warn">knapp</span>}
                  <span className="buero-betrag">
                    {i.quantity ?? 0} {i.unit ?? ''}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
