'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Rueckmeldung } from './Rueckmeldung'

/**
 * Rollen anlegen und Rechte anhaken.
 *
 * Das Datenmodell stand schon, die Oberfläche fehlte — und damit blieb es
 * praktisch bei „Inhaber" und „Redaktion". Wer eine Werkstattrolle ohne
 * Umsätze wollte, hätte ins Admin-Panel wechseln müssen und wusste das nicht.
 *
 * Der Katalog der Rechte kommt vom Server, damit er nicht an zwei Stellen
 * gepflegt wird: Kommt dort ein Recht dazu, steht es hier von selbst.
 *
 * Die Inhaberrolle bleibt unangetastet. Sie darf alles, weil sie an ihrem
 * Schlüssel erkannt wird — Haken hätten dort keine Wirkung, und ein Kästchen,
 * das nichts tut, ist schlimmer als keines.
 */

type Rolle = {
  id: number
  name: string
  schluessel: string
  rechte: string[]
  eingebaut: boolean
  konten: number
  allmaechtig: boolean
}

type Recht = { wert: string; text: string }

const FEHLERTEXT: Record<string, string> = {
  'noch-belegt': 'An dieser Rolle hängen noch Konten — erst umhängen, dann löschen.',
  eingebaut: 'Eingebaute Rollen lassen sich nicht löschen.',
  'name-fehlt': 'Die Rolle braucht einen Namen.',
  'nicht-erlaubt': 'Dafür fehlt dir das Recht.',
}

export function RollenVerwaltung() {
  const [rollen, setRollen] = useState<Rolle[] | null>(null)
  const [katalog, setKatalog] = useState<Recht[]>([])
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [neuerName, setNeuerName] = useState('')

  const holen = useCallback(async () => {
    try {
      const antwort = await fetch('/api/office/rolle', { credentials: 'include' })
      if (!antwort.ok) throw new Error('nicht erreichbar')
      const daten = await antwort.json()
      setRollen(daten.rollen)
      setKatalog(daten.katalog)
    } catch {
      setMeldung('Die Rollen brauchen eine Verbindung.')
    }
  }, [])

  useEffect(() => {
    void holen()
  }, [holen])

  async function rufen(koerper: Record<string, unknown>, erfolg: string) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const antwort = await fetch('/api/office/rolle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(koerper),
      })
      const daten = await antwort.json().catch(() => ({}))
      if (!antwort.ok) {
        setMeldung(FEHLERTEXT[daten.error as string] ?? 'Das hat nicht geklappt.')
        return false
      }
      setMeldung(erfolg)
      await holen()
      return true
    } catch {
      setMeldung('Die Rollen brauchen eine Verbindung.')
      return false
    } finally {
      setLaeuft(false)
    }
  }

  /** Einen Haken setzen oder wegnehmen — gespeichert wird sofort. */
  function hakenUmlegen(rolle: Rolle, recht: string, an: boolean) {
    const rechte = an ? [...rolle.rechte, recht] : rolle.rechte.filter((r) => r !== recht)
    // Erst anzeigen, dann speichern: Ein Kästchen, das nach dem Klick eine
    // Sekunde lang im alten Zustand steht, wird ein zweites Mal geklickt.
    setRollen((alle) => (alle ?? []).map((r) => (r.id === rolle.id ? { ...r, rechte } : r)))
    void rufen({ aktion: 'aendern', id: rolle.id, rechte }, `„${rolle.name}" geändert.`)
  }

  if (!rollen) {
    return (
      <>
        <h2>Rollen</h2>
        <div className="buero-leer">{meldung ?? 'wird geholt …'}</div>
      </>
    )
  }

  return (
    <>
      <h2>Rollen</h2>
      <p className="buero-unterzeile">
        Was eine Rolle darf, gilt für jedes Konto mit dieser Rolle — im Büro und an allen
        Schnittstellen. Wer ein Recht nicht hat, sieht den Bereich gar nicht erst.
      </p>
      <Rueckmeldung text={meldung} />

      {rollen.map((rolle) => (
        <div key={rolle.id} className="buero-karte" style={{ marginBottom: '.8rem' }}>
          <div className="buero-reihe">
            <label className="buero-feld">
              <span>Name</span>
              <input
                defaultValue={rolle.name}
                disabled={laeuft}
                onBlur={(e) =>
                  e.target.value.trim() !== rolle.name &&
                  rufen(
                    { aktion: 'aendern', id: rolle.id, name: e.target.value },
                    'Name geändert.',
                  )
                }
              />
            </label>
            <div className="buero-feld">
              <span>Schlüssel</span>
              <p style={{ margin: '.55rem 0 0' }}>
                <span className="buero-marker">{rolle.schluessel}</span>{' '}
                {rolle.konten > 0 ? `· ${rolle.konten} Konto/Konten` : '· niemand'}
              </p>
            </div>
          </div>

          {rolle.allmaechtig ? (
            <p className="buero-unterzeile">
              Die Inhaberrolle darf alles — unabhängig von Haken. Das ist der Weg zurück, falls
              sich jemand beim Umbauen der Rechte aussperrt.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '.3rem .9rem',
                marginTop: '.4rem',
              }}
            >
              {katalog.map((recht) => (
                <label
                  key={recht.wert}
                  style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}
                >
                  <input
                    type="checkbox"
                    checked={rolle.rechte.includes(recht.wert)}
                    disabled={laeuft}
                    onChange={(e) => hakenUmlegen(rolle, recht.wert, e.target.checked)}
                  />
                  <span>{recht.text}</span>
                </label>
              ))}
            </div>
          )}

          {!rolle.eingebaut && (
            <button
              type="button"
              className="buero-knopf schmal gefahr"
              style={{ marginTop: '.6rem' }}
              disabled={laeuft || rolle.konten > 0}
              title={rolle.konten > 0 ? 'Erst die Konten umhängen' : undefined}
              onClick={() =>
                window.confirm(`Rolle „${rolle.name}" wirklich löschen?`) &&
                rufen({ aktion: 'loeschen', id: rolle.id }, 'Rolle gelöscht.')
              }
            >
              Löschen
            </button>
          )}
        </div>
      ))}

      <div className="buero-karte">
        <div className="buero-reihe">
          <label className="buero-feld">
            <span>Neue Rolle</span>
            <input
              value={neuerName}
              placeholder="z.B. Werkstatt oder Buchhaltung"
              onChange={(e) => setNeuerName(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft || !neuerName.trim()}
          onClick={async () => {
            const gut = await rufen(
              { aktion: 'anlegen', name: neuerName, rechte: ['buero.oeffnen'] },
              'Rolle angelegt — jetzt die Haken setzen.',
            )
            if (gut) setNeuerName('')
          }}
        >
          Anlegen
        </button>
        <p className="buero-unterzeile" style={{ marginTop: '.4rem' }}>
          Eine neue Rolle darf zunächst nur das Büro öffnen. Alles Weitere wird angehakt — so
          bekommt niemand versehentlich mehr, als gemeint war.
        </p>
      </div>
    </>
  )
}
