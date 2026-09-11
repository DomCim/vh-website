'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'

/** Geschäftspartner — sortiert aus dem Bestand im Gerät. */

const ART: Record<string, string> = {
  lieferant: 'Lieferant',
  kunde: 'Kunde',
  dienstleister: 'Dienstleister',
  beides: 'Mehreres',
}

/**
 * Die Filter über der Liste.
 *
 * **Warum Filter und nicht zwei getrennte Listen.** „Kunde" und „Lieferant"
 * sind keine zwei Arten von Datensatz, sondern zwei Rollen desselben Betriebs
 * — und einer kann beides sein. Genau deshalb ist auch die Auswahl im
 * Rechnungsformular bewusst ungefiltert (siehe `PartnerBezug`): Eine harte
 * Schranke hieße nur, dass jemand denselben Betrieb zweimal anlegt, und dann
 * stehen zwei Anschriften da, von denen eine veraltet.
 *
 * Was fehlte, war die Übersicht: Wer einen Kunden pflegen will, sucht ihn
 * zwischen Stahlhändlern und Verzinkereien. Das löst ein Filter, ohne die
 * Daten zu zerschneiden. `beides` erscheint in jeder Auswahl, denn ein Betrieb
 * mit beiden Rollen ist auch ein Kunde.
 */
const FILTER = [
  { wert: 'alle', text: 'Alle' },
  { wert: 'kunde', text: 'Kundschaft' },
  { wert: 'lieferant', text: 'Lieferanten' },
  { wert: 'dienstleister', text: 'Dienstleister' },
] as const

type Partner = {
  id: number | string
  name?: string | null
  ansprechpartner?: string | null
  city?: string | null
  email?: string | null
  phone?: string | null
  role?: string | null
}

export function PartnerAnsicht() {
  const alle = useBestand<Partner>('partner')
  const [suche, setSuche] = useState('')
  const [rolle, setRolle] = useState<string>('alle')

  const partner = useMemo(() => {
    const begriff = suche.trim().toLocaleLowerCase('de')
    return [...alle]
      .filter((p) => {
        if (rolle !== 'alle' && p.role !== rolle && p.role !== 'beides') return false
        if (!begriff) return true
        // Gesucht wird über alles, was jemand im Kopf hat: Firma, Mensch, Ort.
        return [p.name, p.ansprechpartner, p.city, p.email]
          .filter(Boolean)
          .some((f) => String(f).toLocaleLowerCase('de').includes(begriff))
      })
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
  }, [alle, suche, rolle])

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
          <h1>Geschäftspartner</h1>
          <p className="buero-unterzeile">
            {partner.length === alle.length
              ? `${alle.length} Einträge — Lieferanten, Kunden und die Betriebe, die zuarbeiten.`
              : `${partner.length} von ${alle.length} Einträgen`}
          </p>
        </div>
        <Link href="/office/partner/neu" className="buero-knopf">
          Partner anlegen
        </Link>
      </div>

      <div className="buero-reihe" style={{ marginBottom: '1rem' }}>
        <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
          <span>Suchen</span>
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Firma, Ansprechpartner, Ort"
          />
        </label>
        <label className="buero-feld">
          <span>Rolle</span>
          <select value={rolle} onChange={(e) => setRolle(e.target.value)}>
            {FILTER.map((f) => (
              <option key={f.wert} value={f.wert}>
                {f.text}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="buero-liste">
        {partner.length === 0 ? (
          <div className="buero-leer">
            {alle.length === 0 ? 'Noch niemand erfasst.' : 'Dazu passt niemand.'}
          </div>
        ) : (
          partner.map((k) => (
            <Link key={k.id} href={`/office/partner/${k.id}`} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{k.name}</div>
                <div className="buero-zeile-neben">
                  {[k.ansprechpartner, k.city, k.email, k.phone].filter(Boolean).join(' · ') ||
                    'ohne Kontaktdaten'}
                </div>
              </div>
              <span className="buero-marker">{ART[k.role ?? 'beides'] ?? k.role}</span>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
