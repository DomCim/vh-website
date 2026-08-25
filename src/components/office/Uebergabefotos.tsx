'use client'

import React, { useRef, useState } from 'react'

import { abgleichen, useBestand } from '../../lib/buero/bestand'
import { Rueckmeldung } from './Rueckmeldung'

/**
 * Fotos vom Zustand bei der Übergabe.
 *
 * Vor dem Verladen: „Foto aufnehmen" antippen, die Kamera geht auf, das Bild
 * ist am Auftrag. Auf dem Lieferschein steht es danach mit auf dem Blatt, das
 * der Empfänger unterschreibt.
 *
 * Der Grund für das Ganze ist ein Streit, der sonst nicht zu gewinnen ist:
 * Kommt eine Kante verbogen an, steht Aussage gegen Aussage — war sie das
 * vorher, oder ist es beim Transport passiert? Ein Foto von der verpackten
 * Ware beantwortet das, und zwar zu einem Zeitpunkt, an dem noch niemand
 * streitet.
 *
 * **Die Bemerkung wird vor dem Foto getippt, nicht danach.** Wer erst
 * fotografiert, hat das Telefon schon wieder in der Tasche; das Feld bliebe
 * leer. Steht sie vorher da, fährt sie mit dem Bild zusammen los.
 *
 * Das braucht Netz. Ein Foto von mehreren Megabyte gehört nicht in die
 * Warteschlange des Browsers — und die Verladung wartet nicht auf ein Blatt
 * Papier.
 */
type Medium = {
  id: number | string
  url?: string | null
  sizes?: Record<string, { url?: string | null } | undefined> | null
}

export function Uebergabefotos({
  id,
  fotos,
}: {
  id: number | string
  fotos: { bild?: unknown; bemerkung?: string | null }[]
}) {
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [bemerkung, setBemerkung] = useState('')
  const feld = useRef<HTMLInputElement>(null)

  /*
   * Die Bilder kommen aus dem Gerätebestand, nicht aus dem Auftrag.
   *
   * Am Auftrag steht nur die Kennung — der Abgleich schickt die Verweise ohne
   * Tiefe, sonst käme mit jedem Auftrag die halbe Mediathek mit. Nachgesehen
   * wird deshalb dort, wo die Bilder ohnehin liegen; damit stehen die Fotos
   * auch in der Werkstatt ohne Netz. Denselben Weg geht `ArtikelBezug`.
   */
  const medien = useBestand<Medium>('medien')

  const bilder = fotos.flatMap((f) => {
    const id = String((typeof f.bild === 'object' && f.bild ? (f.bild as { id?: unknown }).id : f.bild) ?? '')
    const medium = medien.find((m) => String(m.id) === id)
    // Klein zuerst: In einem Feld von 120 Pixeln ist ein 4000er-Foto Ballast
    const url = medium?.sizes?.klein?.url || medium?.sizes?.thumbnail?.url || medium?.url
    return url ? [{ url, bemerkung: f.bemerkung }] : []
  })

  async function hochladen(datei: File) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const paket = new FormData()
      paket.append('datei', datei)
      if (bemerkung.trim()) paket.append('bemerkung', bemerkung.trim())

      const antwort = await fetch(`/api/office/auftrag/${id}/uebergabefoto`, {
        method: 'POST',
        body: paket,
      })
      if (!antwort.ok) {
        const { error } = await antwort.json().catch(() => ({ error: '' }))
        setMeldung(
          error === 'zu-gross'
            ? 'Das Foto ist zu groß (mehr als 25 MB).'
            : error === 'dateityp'
              ? 'Das ist kein Bild.'
              : 'Das hat nicht geklappt.',
        )
        return
      }
      setBemerkung('')
      setMeldung('Foto ist am Auftrag — es steht auf dem nächsten Lieferschein.')

      /*
       * Beide Bereiche nachziehen, und zwar sofort.
       *
       * Der Auftrag bringt den neuen Verweis, die Mediathek das Bild dazu —
       * fehlt einer von beiden, bleibt die Karte leer, obwohl das Foto längst
       * hochgeladen ist. Wer dann noch einmal auf den Knopf drückt, hat es
       * doppelt am Auftrag.
       */
      await abgleichen(['auftraege', 'medien']).catch(() => undefined)
    } catch {
      setMeldung('Das hat nicht geklappt — ohne Netz geht ein Foto nicht raus.')
    } finally {
      setLaeuft(false)
      if (feld.current) feld.current.value = ''
    }
  }

  return (
    <div className="buero-karte">
      <h2>Zustand bei der Übergabe</h2>
      <p className="buero-unterzeile">
        {bilder.length
          ? `${bilder.length} ${bilder.length === 1 ? 'Foto' : 'Fotos'} — sie stehen auf dem Lieferschein.`
          : 'Noch keine Fotos. Ware und Verpackung vor dem Verladen aufnehmen — das ist der Nachweis, wenn später etwas beschädigt ankommt.'}
      </p>

      {bilder.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '.6rem',
            margin: '.8rem 0',
          }}
        >
          {bilder.map((f, i) => (
            <figure key={i} style={{ margin: 0 }}>
              <img
                src={f.url!}
                alt={f.bemerkung ?? 'Foto zur Übergabe'}
                style={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid var(--buero-linie)',
                }}
              />
              {f.bemerkung && (
                <figcaption
                  style={{
                    fontSize: '.78rem',
                    lineHeight: 1.35,
                    color: 'var(--buero-tinte-leise)',
                    marginTop: '.4rem',
                  }}
                >
                  {f.bemerkung}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      <label className="buero-feld">
        <span>Bemerkung zum nächsten Foto</span>
        <input
          value={bemerkung}
          disabled={laeuft}
          onChange={(e) => setBemerkung(e.target.value)}
          placeholder='z.B. „auf Palette, Kanten mit Filz"'
        />
      </label>

      <label className="buero-knopf leise" style={{ display: 'inline-block', cursor: 'pointer' }}>
        {laeuft ? 'wird hochgeladen …' : 'Foto aufnehmen'}
        <input
          ref={feld}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={laeuft}
          style={{ display: 'none' }}
          onChange={(e) => {
            const d = e.target.files?.[0]
            if (d) void hochladen(d)
          }}
        />
      </label>

      <Rueckmeldung text={meldung} />
    </div>
  )
}
