'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'

import { useBestand } from '../../lib/buero/bestand'
import { datum } from '../../lib/format'
import { auswahlSenden, lesbareGroesse, type Uploadstand } from '../../lib/hochladen'

/**
 * Die Dateien eines Vorgangs — Anfrage, Angebot oder Auftrag.
 *
 * Bis hierher hingen Dateien am Artikel: die Laserdatei zur eigenen Variante.
 * Bei Lohnfertigung gibt es keinen Artikel — der Auftraggeber schickt seine
 * Zeichnung, und die gehört an den Vorgang. Schon vor dem Auftrag: Sie ist ja
 * der Grund, aus dem überhaupt gerechnet wird.
 *
 * Gezeigt wird alles, was an diesem Vorgang hängt — auch das, was über eine
 * Übergabemappe hereinkam. Genau darum tragen Mappendateien die Anker der
 * Mappe: Wer in der Werkstatt am Auftrag steht, sucht dort und nicht in einer
 * Mappe, an die sich niemand erinnert.
 *
 * Wer eine Datei **hinaus** geben will, tut das in der Mappe und dort
 * ausdrücklich. Hier abgelegte Dateien bleiben im Haus.
 */

type Datei = {
  id: number | string
  anfrage?: number | { id: number } | null
  angebot?: number | { id: number } | null
  auftrag?: number | { id: number } | null
  mappe?: number | { id: number } | null
  folder?: string | null
  label?: string | null
  filename?: string | null
  filesize?: number | null
  herkunft?: string | null
  freigabe?: boolean | null
  note?: string | null
  createdAt?: string | null
}

type Mappe = {
  id: number | string
  title?: string | null
  anfrage?: number | { id: number } | null
  angebot?: number | { id: number } | null
  auftrag?: number | { id: number } | null
}

const bezug = (wert: unknown) =>
  typeof wert === 'object' && wert ? String((wert as { id?: number }).id ?? '') : String(wert ?? '')

export function Vorgangsdateien({
  anfrage,
  angebot,
  auftrag,
  kontakt,
  darfAendern = true,
}: {
  anfrage?: number | string
  angebot?: number | string
  auftrag?: number | string
  /** Wenn die Seite den Geschäftspartner kennt — für eine neue Mappe */
  kontakt?: number | string | null
  darfAendern?: boolean
}) {
  const router = useRouter()
  const alle = useBestand<Datei>('werkstattdateien')
  const mappen = useBestand<Mappe>('mappen')

  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [staende, setStaende] = useState<Uploadstand[]>([])
  const feld = useRef<HTMLInputElement>(null)

  /*
   * Der eine Anker dieses Blocks. In einem `useMemo`, weil sonst bei jedem
   * Neuzeichnen ein neues Objekt entstünde — und damit alles darunter neu
   * gerechnet würde, obwohl sich nichts geändert hat.
   */
  const anker = useMemo(
    () =>
      anfrage
        ? ({ feld: 'anfrage', id: anfrage } as const)
        : angebot
          ? ({ feld: 'angebot', id: angebot } as const)
          : auftrag
            ? ({ feld: 'auftrag', id: auftrag } as const)
            : null,
    [anfrage, angebot, auftrag],
  )

  const dateien = useMemo(() => {
    if (!anker) return []
    return alle
      .filter((d) => bezug(d[anker.feld]) === String(anker.id))
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  }, [alle, anker])

  /*
   * Die Mappen zu diesem Vorgang — als Weg zurück zum Zugang, wenn der
   * Auftraggeber nachliefern soll oder etwas herausgehen muss.
   *
   * Gezählt wird beides: Mappen, die am Vorgang hängen, und solche, aus denen
   * schon eine Datei hier gelandet ist. Eine Mappe kann angelegt worden sein,
   * bevor es den Auftrag gab.
   */
  const beteiligteMappen = useMemo(() => {
    if (!anker) return []
    const kennungen = new Set(dateien.map((d) => bezug(d.mappe)).filter(Boolean))
    return mappen.filter(
      (m) => kennungen.has(String(m.id)) || bezug(m[anker.feld]) === String(anker.id),
    )
  }, [dateien, mappen, anker])

  if (!anker) return null

  async function hochladen(auswahl: File[]) {
    if (auswahl.length === 0 || !anker) return
    setLaeuft(true)
    setMeldung(null)
    try {
      const { fehler } = await auswahlSenden(
        auswahl,
        (d) =>
          `/api/office/vorgangsdatei?${anker.feld}=${anker.id}&name=${encodeURIComponent(d.name)}`,
        setStaende,
      )
      if (fehler > 0) setMeldung('Nicht alles ist durchgegangen — siehe Liste.')
    } finally {
      setLaeuft(false)
    }
  }

  /*
   * Der Weg vom Vorgang zur Mappe.
   *
   * Ohne diesen Knopf müsste man die Mappe anderswo anlegen und dort den
   * Vorgang wieder heraussuchen — und genau das unterbleibt dann im Alltag.
   * Der Geschäftspartner kommt mit, wenn die Seite ihn kennt; sonst genügt
   * der Vorgang als Bezug.
   */
  async function mappeAnlegen() {
    if (!anker) return
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/uebergabe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aktion: 'anlegen',
          [anker.feld]: anker.id,
          contact: kontakt || undefined,
        }),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung('Das hat nicht geklappt.')
        return
      }
      router.push(`/office/uebergabe/${daten.id}`)
    } catch {
      setMeldung('Dafür braucht es Netz.')
    } finally {
      setLaeuft(false)
    }
  }

  async function loeschen(id: number | string) {
    if (!anker) return
    setLaeuft(true)
    try {
      const res = await fetch('/api/office/vorgangsdatei', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'loeschen', id, [anker.feld]: anker.id }),
      })
      if (!res.ok) setMeldung('Das hat nicht geklappt.')
    } catch {
      setMeldung('Dafür braucht es Netz.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <>
      <h2>Unterlagen zum Vorgang</h2>
      <p className="buero-unterzeile">
        Zeichnungen, CAD-Dateien und Schriftstücke, die zu diesem Vorgang gehören — auch das, was
        über eine Übergabemappe hereinkam.
      </p>

      {meldung && <p className="buero-hinweis">{meldung}</p>}

      {dateien.length > 0 ? (
        <div className="buero-liste">
          {dateien.map((d) => {
            const vomKunden = d.herkunft === 'kunde'
            return (
              <div key={d.id} className={`buero-zeile ${vomKunden ? 'ist-offen' : ''}`}>
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{d.label || d.filename || 'Datei'}</div>
                  <div className="buero-zeile-neben">
                    {vomKunden ? 'vom Auftraggeber' : 'aus dem Haus'}
                    {d.folder ? ` · ${d.folder}` : ''}
                    {d.filesize ? ` · ${lesbareGroesse(d.filesize)}` : ''} · {datum(d.createdAt)}
                    {d.freigabe ? ' · freigegeben' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                  <a
                    className="buero-knopf leise schmal"
                    href={`/api/office/werkstattdatei/${d.id}`}
                  >
                    Laden
                  </a>
                  {darfAendern && (
                    <button
                      type="button"
                      className="buero-knopf stumm schmal"
                      disabled={laeuft}
                      onClick={() => {
                        if (confirm(`„${d.label || d.filename}“ löschen?`)) void loeschen(d.id)
                      }}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="buero-leer">Noch nichts abgelegt.</div>
      )}

      {staende.length > 0 && (
        <div className="buero-liste" style={{ marginTop: '.6rem' }}>
          {staende.map((s) => (
            <div key={s.schluessel} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{s.name}</div>
                <div className="buero-zeile-neben">
                  {s.stand === 'fertig'
                    ? 'übertragen'
                    : s.stand === 'fehler'
                      ? (s.fehler ?? 'nicht übertragen')
                      : s.stand === 'laeuft'
                        ? `${Math.round((s.getan / Math.max(1, s.bytes)) * 100)} % von ${lesbareGroesse(s.bytes)}`
                        : 'wartet'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {beteiligteMappen.length > 0 && (
        <p className="buero-unterzeile" style={{ marginTop: '.5rem' }}>
          Aus der Übergabemappe:{' '}
          {beteiligteMappen.map((m, i) => (
            <React.Fragment key={m.id}>
              {i > 0 && ' · '}
              <Link href={`/office/uebergabe/${m.id}`} style={{ textDecoration: 'underline' }}>
                {m.title || 'Mappe'}
              </Link>
            </React.Fragment>
          ))}
        </p>
      )}

      {darfAendern && (
        <div style={{ marginTop: '.6rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <input
            ref={feld}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const auswahl = Array.from(e.target.files ?? [])
              e.target.value = ''
              void hochladen(auswahl)
            }}
          />
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft}
            onClick={() => feld.current?.click()}
          >
            Dateien ablegen
          </button>
          {beteiligteMappen.length === 0 && (
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft}
              onClick={() => void mappeAnlegen()}
            >
              Übergabemappe anlegen
            </button>
          )}
        </div>
      )}
    </>
  )
}
