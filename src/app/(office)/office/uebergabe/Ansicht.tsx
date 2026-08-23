'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { Fussleiste } from '../../../../components/office/Fussleiste'
import { useBestand } from '../../../../lib/buero/bestand'
import { datum } from '../../../../lib/format'
import { Rueckmeldung } from '../../../../components/office/Rueckmeldung'

/**
 * Die Übergabemappen — Ordner, über die Unterlagen mit der Kundschaft hin und
 * her gehen.
 *
 * Bei Lohnfertigung kommen die Daten vor der Entscheidung: Zeichnung,
 * Stückzahl, Werkstoff — und erst danach sagt man zu oder ab. Statt drei
 * Fassungen in drei Postfächern gibt es hier einen Ordner je Vorgang, mit
 * Link und Passwort für den Auftraggeber.
 *
 * Eine Mappe hängt immer an einem Geschäftspartner oder einer Anfrage. Ohne
 * Bezug ließe sie sich anlegen und wäre in einem halben Jahr ein Rätsel.
 */

type Mappe = {
  id: number | string
  title?: string | null
  email?: string | null
  contact?: number | { id: number } | null
  anfrage?: number | { id: number } | null
  geschlossen?: boolean | null
  zugaenge?: { gueltigBis?: string | null; zurueckgezogen?: boolean | null }[] | null
  updatedAt?: string | null
}

type Datei = { id: number | string; mappe?: number | { id: number } | null }
type Partner = { id: number | string; name?: string | null; email?: string | null }
type Anfrage = { id: number | string; name?: string | null; email?: string | null; createdAt?: string | null }

const bezug = (wert: unknown) =>
  typeof wert === 'object' && wert ? String((wert as { id?: number }).id ?? '') : String(wert ?? '')

/** Gilt für diese Mappe gerade noch ein Zugang? */
export function offenerZugang(m: Mappe, jetzt = Date.now()): boolean {
  return (m.zugaenge ?? []).some(
    (z) => !z.zurueckgezogen && z.gueltigBis && new Date(z.gueltigBis).getTime() > jetzt,
  )
}

export function MappenAnsicht() {
  const router = useRouter()
  const mappen = useBestand<Mappe>('mappen')
  const dateien = useBestand<Datei>('werkstattdateien')
  const partner = useBestand<Partner>('partner')
  const anfragen = useBestand<Anfrage>('anfragen')

  const [neu, setNeu] = useState(false)
  const [wer, setWer] = useState('')
  const [welcheAnfrage, setWelcheAnfrage] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const sortiert = useMemo(
    () => [...mappen].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [mappen],
  )

  const anzahl = useMemo(() => {
    const zaehler = new Map<string, number>()
    for (const d of dateien) {
      const schluessel = bezug(d.mappe)
      if (schluessel) zaehler.set(schluessel, (zaehler.get(schluessel) ?? 0) + 1)
    }
    return zaehler
  }, [dateien])

  async function anlegen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/uebergabe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aktion: 'anlegen',
          contact: wer || undefined,
          anfrage: welcheAnfrage || undefined,
        }),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung(
          daten.error === 'kein-bezug'
            ? 'Bitte einen Geschäftspartner oder eine Anfrage auswählen.'
            : 'Das hat nicht geklappt.',
        )
        return
      }
      router.push(`/office/uebergabe/${daten.id}`)
    } catch {
      // Bewusst kein Eintrag in die Warteschlange: Eine Mappe ohne Netz
      // anzulegen brächte nichts — der Link, um den es geht, entsteht ohnehin
      // erst auf dem Server
      setMeldung('Dafür braucht es Netz.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <>
      <div>
        <h1>Übergabemappen</h1>
        <p className="buero-unterzeile">
          {sortiert.length} {sortiert.length === 1 ? 'Mappe' : 'Mappen'} ·{' '}
          {sortiert.filter((m) => offenerZugang(m)).length} mit gültigem Zugang
        </p>
      </div>

      <Rueckmeldung text={meldung} />

      {neu && (
        <div className="buero-karte" style={{ marginBottom: '1rem' }}>
          <label className="buero-feld">
            <span>Geschäftspartner</span>
            <select value={wer} onChange={(e) => setWer(e.target.value)}>
              <option value="">— keiner —</option>
              {[...partner]
                .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                .map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>oder Anfrage</span>
            <select value={welcheAnfrage} onChange={(e) => setWelcheAnfrage(e.target.value)}>
              <option value="">— keine —</option>
              {[...anfragen]
                .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
                .slice(0, 100)
                .map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name} · {datum(a.createdAt)}
                  </option>
                ))}
            </select>
          </label>
          <p className="buero-unterzeile">
            Die Bezeichnung entsteht daraus von selbst; ändern lässt sie sich in der Mappe.
          </p>
        </div>
      )}

      <div className="buero-liste">
        {sortiert.length === 0 ? (
          <div className="buero-leer">Noch keine Mappe.</div>
        ) : (
          sortiert.map((m) => {
            const gueltig = offenerZugang(m)
            return (
              <Link key={m.id} href={`/office/uebergabe/${m.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{m.title || 'Übergabemappe'}</div>
                  <div className="buero-zeile-neben">
                    {anzahl.get(String(m.id)) ?? 0} Dateien
                    {m.email ? ` · ${m.email}` : ''} · {datum(m.updatedAt)}
                  </div>
                </div>
                <span
                  className={`buero-marker ${m.geschlossen ? '' : gueltig ? 'gut' : 'offen'}`}
                >
                  {m.geschlossen ? 'Geschlossen' : gueltig ? 'Zugang offen' : 'Kein Zugang'}
                </span>
              </Link>
            )
          })
        )}
      </div>

      <Fussleiste>
        {neu ? (
          <>
            <button
              type="button"
              className="buero-knopf stumm"
              onClick={() => setNeu(false)}
              disabled={laeuft}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="buero-knopf"
              disabled={laeuft || (!wer && !welcheAnfrage)}
              onClick={() => void anlegen()}
            >
              {laeuft ? 'wird angelegt …' : 'Mappe anlegen'}
            </button>
          </>
        ) : (
          <button type="button" className="buero-knopf" onClick={() => setNeu(true)}>
            Neue Mappe
          </button>
        )}
      </Fussleiste>
    </>
  )
}
