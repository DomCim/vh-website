'use client'

import React, { useState } from 'react'

import { textAlsAbsaetze } from '../../lib/signaturHtml'
import { Fussleiste } from './Fussleiste'
import { Schreibfeld } from './Schreibfeld'
import { Rueckmeldung } from './Rueckmeldung'

export type NewsVorschlag = {
  id: number | string
  titel: string
  auszug: string
  link: string
}

/**
 * Newsletter schreiben und verschicken.
 *
 * Zwei Sicherungen sind eingebaut, weil ein Newsletter nicht zurückzuholen
 * ist: Der Testversand geht an eine einzelne Adresse, und der echte Versand
 * fragt vorher nach. Vorlage ist ein News-Beitrag — was auf der Website
 * steht, muss niemand zweimal schreiben.
 */
export function NewsletterVersand({
  beitraege,
  empfaenger,
  eigeneAdresse,
}: {
  beitraege: NewsVorschlag[]
  empfaenger: number
  eigeneAdresse?: string | null
}) {
  const [betreff, setBetreff] = useState('')
  const [html, setHtml] = useState('')
  // Das Schreibfeld übernimmt seinen Inhalt nur beim Aufbau — der Zähler
  // baut es neu auf, wenn ein Beitrag übernommen wird.
  const [fassung, setFassung] = useState(0)
  const [link, setLink] = useState('')
  const [linkText, setLinkText] = useState('Zum Beitrag')
  const [testAn, setTestAn] = useState(eigeneAdresse ?? '')
  const [laeuft, setLaeuft] = useState<null | 'test' | 'alle'>(null)
  const [meldung, setMeldung] = useState<string | null>(null)

  function uebernehmen(id: string) {
    const b = beitraege.find((x) => String(x.id) === id)
    if (!b) return
    setBetreff(b.titel)
    setHtml(textAlsAbsaetze(b.auszug))
    setFassung((f) => f + 1)
    setLink(b.link)
    setLinkText('Zum Beitrag')
  }

  async function senden(art: 'test' | 'alle') {
    if (art === 'alle' && !confirm(`Newsletter jetzt an ${empfaenger} Empfänger schicken?`)) return
    setLaeuft(art)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          betreff,
          // Aus der Rückfallebene des Schreibfelds kommt Klartext ohne
          // Auszeichnung — der geht als Text, sonst als gestalteter Rumpf
          ...(html.includes('<') ? { html } : { text: html }),
          link,
          linkText,
          testAn: art === 'test' ? testAn : undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        setMeldung(j.error === 'unvollstaendig' ? 'Betreff und Text fehlen.' : 'Das ging schief.')
        return
      }
      setMeldung(
        j.test
          ? `Testmail an ${testAn} ist raus.`
          : `Verschickt an ${j.verschickt} Empfänger${j.fehler ? `, ${j.fehler} nicht zustellbar` : ''}.`,
      )
    } catch {
      setMeldung('Das ging schief.')
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <>
      {beitraege.length > 0 && (
        <label className="buero-feld">
          <span>Aus einem Beitrag übernehmen</span>
          <select defaultValue="" onChange={(e) => uebernehmen(e.target.value)}>
            <option value="">— auswählen —</option>
            {beitraege.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.titel}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="buero-feld">
        <span>Betreff</span>
        <input value={betreff} onChange={(e) => setBetreff(e.target.value)} />
      </label>

      <div className="buero-feld">
        <span>Text</span>
        <Schreibfeld key={fassung} wert={html} aendern={setHtml} />
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Knopf-Ziel (optional)</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
        </label>
        <label className="buero-feld">
          <span>Knopf-Beschriftung</span>
          <input value={linkText} onChange={(e) => setLinkText(e.target.value)} />
        </label>
      </div>

      <div className="buero-reihe">
        <label className="buero-feld">
          <span>Testmail an</span>
          <input value={testAn} onChange={(e) => setTestAn(e.target.value)} />
        </label>
      </div>

      <Rueckmeldung text={meldung} />

      <Fussleiste>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={laeuft !== null || !testAn}
          onClick={() => senden('test')}
        >
          {laeuft === 'test' ? 'Sendet …' : 'Test verschicken'}
        </button>
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft !== null || empfaenger === 0}
          onClick={() => senden('alle')}
        >
          {laeuft === 'alle' ? 'Sendet …' : `An ${empfaenger} Empfänger schicken`}
        </button>
      </Fussleiste>
    </>
  )
}
