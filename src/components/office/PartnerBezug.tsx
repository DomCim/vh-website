'use client'

import React, { useMemo } from 'react'

import { useBestand } from '../../lib/buero/bestand'

/**
 * Der Geschäftspartner zu einem Vorgang — die Karteikarte, endlich benutzt.
 *
 * Die Kartei unter „Partner" gab es längst, nur hing sie an nichts: Angebot,
 * Auftrag und Rechnung kannten den Partner nur als getippten Namen, und so
 * wurden dieselben Angaben bis zu viermal abgeschrieben — Anfrage, Angebot,
 * Auftrag, Rechnung. Schlimmer: Ohne Verknüpfung blieb der Empfänger im
 * Versandfenster leer, das Kundenportal kannte den Vorgang nicht, und die
 * Statusmail ging auf Deutsch an französische Kundschaft.
 *
 * Der Auswähler liest aus dem Bestand im Gerät und funktioniert damit auch
 * ohne Netz. Wer auswählt, bekommt Name und Anschrift übernommen — das ist
 * der Sinn der Auswahl. Wer abweichen will, tippt danach; die Felder bleiben
 * frei beschreibbar, und ohne Partner geht es weiter wie bisher.
 */

export type Partner = {
  id: number | string
  name?: string | null
  role?: string | null
  email?: string | null
  phone?: string | null
  line1?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  vatId?: string | null
  siret?: string | null
  sprache?: string | null
}

/**
 * Die Anschrift, wie sie ins Adressfeld gehört — ohne den Namen, der steht
 * auf den Papieren als eigene Zeile darüber. Nur was da ist, zeilenweise.
 */
export function partnerAnschrift(p: Partner): string {
  const ort = [p.postalCode, p.city].filter(Boolean).join(' ')
  return [p.line1, ort, p.country].filter(Boolean).join('\n')
}

export function PartnerBezug({
  wert,
  aendern,
  beschriftung = 'Geschäftspartner',
  gesperrt = false,
}: {
  wert: number | '' | null | undefined
  /** Bekommt neben der Kennung den ganzen Datensatz — für die Übernahme. */
  aendern: (id: number | '', partner: Partner | null) => void
  beschriftung?: string
  /** Zu, wenn der Datensatz festgeschrieben ist — etwa eine gestellte Rechnung. */
  gesperrt?: boolean
}) {
  const partner = useBestand<Partner>('partner')

  // Bewusst ungefiltert: Auch ein Lieferant kann Kunde werden — eine harte
  // Rollen-Schranke hieße nur, dass jemand denselben Betrieb zweimal anlegt.
  const sortiert = useMemo(
    () => [...partner].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de')),
    [partner],
  )

  return (
    <label className="buero-feld">
      <span>{beschriftung}</span>
      <select
        value={wert ?? ''}
        disabled={gesperrt}
        onChange={(e) => {
          const id = Number(e.target.value) || ''
          const satz = id ? (sortiert.find((p) => String(p.id) === String(id)) ?? null) : null
          aendern(id, satz)
        }}
      >
        <option value="">— ohne —</option>
        {sortiert.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
