'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { absenden } from '../../lib/buero/warteschlange'
import { Fussleiste } from './Fussleiste'
import { Zahleingabe } from './Zahleingabe'

export type PostenAuswahl = { id: number; name: string; unit: string }
export type LieferantAuswahl = { id: number; name: string }

export type Eingangszeile = { item: number | ''; quantity: number; note?: string }

/**
 * Wareneingang buchen — mit Lieferschein.
 *
 * Der Ablauf, für den das gebaut ist, findet an der Werkbank statt und nicht
 * am Schreibtisch: Karton auf, Lieferschein abfotografieren, Mengen abhaken,
 * fertig. Deshalb geht das Foto über dieselbe Warteschlange wie das Belegfoto
 * — ohne Netz bleibt es im Gerät und geht später von selbst raus.
 *
 * Gebucht wird beim Anlegen, und zwar einmal. Wer sich vertippt hat, bucht am
 * Posten eine Korrektur; dann steht im Verlauf, dass korrigiert wurde, statt
 * dass eine Zahl still eine andere wird.
 */
export function WareneingangFormular({
  posten,
  lieferanten,
  vorbelegung,
}: {
  posten: PostenAuswahl[]
  lieferanten: LieferantAuswahl[]
  /** Aus der Nachbestellliste vorbelegt: Lieferant und die erwarteten Posten */
  vorbelegung?: { supplier?: number; lines?: Eingangszeile[] }
}) {
  const router = useRouter()
  const heute = new Date().toISOString().slice(0, 10)

  const [receivedAt, setReceivedAt] = useState(heute)
  const [supplier, setSupplier] = useState<number | ''>(vorbelegung?.supplier ?? '')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [note, setNote] = useState('')
  const [zeilen, setZeilen] = useState<Eingangszeile[]>(
    vorbelegung?.lines?.length ? vorbelegung.lines : [{ item: '', quantity: 1 }],
  )
  const [bild, setBild] = useState<{ id?: number; url?: string } | null>(null)
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)

  async function hochladen(datei: File) {
    setLaeuft('upload')
    setMeldung(null)
    try {
      // Solange der Server das Bild nicht hat, zeigt die Seite es aus dem Gerät
      const ausDemGeraet = URL.createObjectURL(datei)
      const { id, antwort } = await absenden({
        pfad: '/api/office/beleg-upload',
        bereich: 'medien',
        koerper: {},
        datei: { name: datei.name, blob: datei },
        vorschau: { url: ausDemGeraet },
      })
      setBild({ id: id as number, url: (antwort?.url as string) ?? ausDemGeraet })
    } catch {
      setMeldung('Das Bild ließ sich nicht hochladen.')
    } finally {
      setLaeuft(null)
    }
  }

  const gefuellteZeilen = zeilen.filter((z) => z.item && z.quantity > 0).length

  async function speichern() {
    const gefuellt = zeilen.filter((z) => z.item && z.quantity > 0)
    if (!gefuellt.length) {
      setMeldung('Ohne Posten und Menge gibt es nichts zu buchen.')
      return
    }
    setLaeuft('speichern')
    setMeldung(null)
    try {
      const { id, sofort, antwort } = await absenden({
        pfad: '/api/office/wareneingang',
        bereich: 'wareneingaenge',
        koerper: {
          receivedAt,
          supplier: supplier || undefined,
          supplierName: lieferanten.find((l) => l.id === supplier)?.name,
          deliveryNote,
          document: bild?.id,
          note,
          lines: gefuellt,
        },
        vorschau: {
          receivedAt,
          supplierName: lieferanten.find((l) => l.id === supplier)?.name,
          deliveryNote,
          lines: gefuellt,
        },
      })
      if (sofort) {
        setMeldung(`Gebucht als ${(antwort?.receiptNumber as string) ?? 'Wareneingang'}.`)
        router.push(`/office/wareneingang/${id}`)
      } else {
        setMeldung('Gemerkt — geht raus, sobald wieder Netz da ist.')
      }
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <div className="buero-karte">
      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Geliefert am</span>
          <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
        </label>
        <label className="buero-feld">
          <span>Lieferant</span>
          <select
            value={supplier}
            onChange={(e) => setSupplier(Number(e.target.value) || '')}
          >
            <option value="">— wählen —</option>
            {lieferanten.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="buero-feld">
          <span>Lieferscheinnummer</span>
          <input
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            placeholder="steht auf dem Papier"
          />
        </label>
      </div>

      <label className="buero-feld">
        <span>Lieferschein fotografieren oder auswählen</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          disabled={laeuft === 'upload'}
          onChange={(e) => {
            const d = e.target.files?.[0]
            if (d) void hochladen(d)
          }}
        />
        <span style={{ marginTop: '.4rem' }}>
          Der Zettel im Karton ist in zwei Wochen weg — gebraucht wird er, wenn die Rechnung kommt
          und die Mengen nicht stimmen.
        </span>
      </label>
      {bild?.url && (
        <p className="buero-unterzeile">
          <a href={bild.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            Lieferschein ansehen
          </a>
        </p>
      )}

      <h2>Gelieferte Posten</h2>
      {zeilen.map((z, i) => (
        <div key={i} className="buero-reihe">
          <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
            <span>Posten</span>
            <select
              value={z.item}
              onChange={(e) =>
                setZeilen((v) =>
                  v.map((x, idx) => (idx === i ? { ...x, item: Number(e.target.value) || '' } : x)),
                )
              }
            >
              <option value="">— wählen —</option>
              {posten.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.unit ? ` (${p.unit})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>Menge</span>
            <Zahleingabe
              wert={z.quantity}
              beiLeer={0}
              aendern={(v) =>
                setZeilen((alle) =>
                  alle.map((x, idx) => (idx === i ? { ...x, quantity: v ?? 0 } : x)),
                )
              }
            />
          </label>
          <label className="buero-feld">
            <span>Bemerkung</span>
            <input
              value={z.note ?? ''}
              placeholder="z.B. Charge, Rest fehlt"
              onChange={(e) =>
                setZeilen((v) => v.map((x, idx) => (idx === i ? { ...x, note: e.target.value } : x)))
              }
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="buero-knopf leise"
              onClick={() => setZeilen((v) => v.filter((_, idx) => idx !== i))}
            >
              Entfernen
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="buero-knopf leise"
        onClick={() => setZeilen((v) => [...v, { item: '', quantity: 1 }])}
      >
        Posten hinzufügen
      </button>

      <label className="buero-feld" style={{ marginTop: '1rem' }}>
        <span>Notiz</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>

      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <Fussleiste hinweis={gefuellteZeilen > 0 ? `${gefuellteZeilen} Posten` : undefined}>
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft !== null}
          onClick={() => void speichern()}
        >
          Wareneingang buchen
        </button>
      </Fussleiste>
    </div>
  )
}
