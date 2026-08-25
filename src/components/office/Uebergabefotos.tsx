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

  /*
   * Ein Abschnitt mit Überschrift, keine eigene Karte.
   *
   * Als Karte sah es am Handy aus, als gehörten die Fotos zur Zeiterfassung
   * darüber: Beides waren randlose Kästen in derselben Grauabstufung, und
   * unter „2 h 00 min · Löschen" folgte gleich „Zustand bei der Übergabe" —
   * ein Block, zwei Themen. Die Nachbarn hier (Arbeitszeit, Unterlagen zum
   * Vorgang) sind ebenfalls Abschnitte mit einer `h2` auf der Seite; eine
   * Karte dazwischen liest sich als Anhängsel des Vorigen statt als eigener
   * Punkt.
   */
  return (
    <>
      <h2 style={{ marginTop: '1.5rem' }}>Zustand bei der Übergabe</h2>
      <p className="buero-unterzeile">
        {bilder.length
          ? `${bilder.length} ${bilder.length === 1 ? 'Foto' : 'Fotos'} auf dem Lieferschein — sie belegen, wie die Ware das Haus verlassen hat.`
          : 'Ware und Verpackung vor dem Verladen aufnehmen. Die Fotos stehen auf dem Lieferschein und sind der Nachweis, wenn später etwas beschädigt ankommt.'}
      </p>

      {bilder.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '.6rem',
            // Unten mehr Luft: Sonst klebt die Bildunterschrift der letzten
            // Reihe an der Beschriftung des Eingabefelds darunter, und beide
            // sind kleine graue Schrift — man liest es als eine Zeile.
            margin: '.8rem 0 1.4rem',
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

      {/*
       * Bemerkung und Knopf gehören zusammen: Die Bemerkung gilt für das Foto,
       * das als nächstes aufgenommen wird. Weit auseinander sah sie aus wie
       * eine Angabe für sich, und wer gleich auf „Foto aufnehmen" tippte, ließ
       * sie leer.
       *
       * Nicht in `buero-reihe`, obwohl das naheliegt: Die Klasse ist ein Grid
       * mit gleich breiten Spalten ab 7,5rem — am Handy stünden Feld und Knopf
       * dann nebeneinander gequetscht. Hier soll das Feld die Breite nehmen
       * und der Knopf nur, was er braucht; passt beides nicht, rutscht der
       * Knopf darunter.
       */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '.6rem',
          alignItems: 'flex-end',
          marginTop: '.2rem',
        }}
      >
        <label className="buero-feld" style={{ flex: '1 1 14rem', marginBottom: 0 }}>
          <span>Bemerkung zum nächsten Foto</span>
          <input
            value={bemerkung}
            disabled={laeuft}
            onChange={(e) => setBemerkung(e.target.value)}
            placeholder='z.B. „auf Palette, Kanten mit Filz"'
          />
        </label>

        <label
          className="buero-knopf leise"
          style={{
            cursor: laeuft ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
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
      </div>

      <Rueckmeldung text={meldung} />
    </>
  )
}
