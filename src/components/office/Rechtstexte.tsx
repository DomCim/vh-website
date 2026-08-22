'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { locales, type Locale } from '../../lib/i18n'
import { Fussleiste } from './Fussleiste'

type Text = {
  feld: string
  label: string
  pfad: string
  hinweis?: string
  text: string
  bearbeitbar: boolean
}

const SPRACHNAMEN: Record<Locale, string> = {
  de: 'Deutsch',
  fr: 'Französisch',
  en: 'Englisch',
}

/**
 * Impressum, AGB, Widerruf & Co. — im Büro statt im Admin-Panel.
 *
 * **Drei Sprachen, eine Seite.** Die Rechtstexte gibt es dreimal, und im
 * Admin-Panel bedeutet das: Sprache oben umstellen, alle Felder neu laden,
 * einzeln speichern. Hier steht die Sprachwahl über den Feldern, und ein
 * Speichern schreibt die ganze Sprachfassung.
 *
 * **Warum ein leeres Feld hier wirklich leer ist.** Payload reicht für eine
 * fehlende Übersetzung sonst den deutschen Text durch. Das sieht aus, als sei
 * übersetzt, und beim Speichern stünde der deutsche Text als französischer
 * fest. Die Route fragt deshalb ohne Rückfall — was hier leer ist, ist auch
 * dort leer.
 */
export function Rechtstexte() {
  const [sprache, setSprache] = useState<Locale>('de')
  const [texte, setTexte] = useState<Text[]>([])
  const [entwurf, setEntwurf] = useState<Record<string, string>>({})
  const [stand, setStand] = useState<'laedt' | 'bereit' | 'speichert' | 'fehler'>('laedt')
  const [meldung, setMeldung] = useState<string | null>(null)

  const holen = useCallback(async (welche: Locale) => {
    setStand('laedt')
    setMeldung(null)
    try {
      const res = await fetch(`/api/office/rechtstexte?sprache=${welche}`)
      if (!res.ok) throw new Error(String(res.status))
      const daten = (await res.json()) as { texte: Text[] }
      setTexte(daten.texte)
      setEntwurf(Object.fromEntries(daten.texte.map((t) => [t.feld, t.text])))
      setStand('bereit')
    } catch {
      setStand('fehler')
    }
  }, [])

  useEffect(() => {
    void holen(sprache)
  }, [holen, sprache])

  const geaendert = texte.some((t) => (entwurf[t.feld] ?? '') !== t.text)

  async function speichern() {
    setStand('speichert')
    setMeldung(null)
    try {
      const res = await fetch('/api/office/rechtstexte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ was: 'speichern', sprache, texte: entwurf }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setMeldung('Gespeichert. Die Seiten draußen zeigen es sofort.')
      await holen(sprache)
    } catch {
      setStand('fehler')
      setMeldung('Das Speichern hat nicht geklappt.')
    }
  }

  async function entwuerfe() {
    setStand('speichert')
    setMeldung(null)
    try {
      const res = await fetch('/api/office/rechtstexte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ was: 'entwuerfe' }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const daten = (await res.json()) as { geschrieben: string[] }
      setMeldung(
        daten.geschrieben.length
          ? `Eingespielt: ${daten.geschrieben.join(', ')}. Bitte durchlesen und anpassen.`
          : 'Es stand überall schon etwas — nichts geändert.',
      )
      await holen(sprache)
    } catch {
      setStand('fehler')
      setMeldung('Das Einspielen hat nicht geklappt.')
    }
  }

  return (
    <>
      <div className="buero-reiter" role="tablist">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={l === sprache}
            className={`buero-knopf schmal ${l === sprache ? '' : 'leise'}`}
            onClick={() => setSprache(l)}
          >
            {SPRACHNAMEN[l]}
          </button>
        ))}
      </div>

      {stand === 'laedt' && <p className="buero-unterzeile">Wird geholt …</p>}

      {texte.map((t) => (
        <div key={t.feld} className="buero-karte" style={{ marginBottom: '1rem' }}>
          <div className="buero-feld">
            <span>{t.label}</span>
            {t.hinweis && <p className="buero-unterzeile">{t.hinweis}</p>}
            {t.bearbeitbar ? (
              <textarea
                rows={10}
                value={entwurf[t.feld] ?? ''}
                onChange={(e) => setEntwurf((v) => ({ ...v, [t.feld]: e.target.value }))}
                placeholder="Noch nichts hinterlegt"
              />
            ) : (
              <>
                {/*
                  Kein Textfeld, wenn im Datensatz mehr steht als Absätze:
                  Speichern würde die Formatierung stillschweigend wegwerfen.
                */}
                <p className="buero-warnung">
                  Dieser Text enthält Formatierungen, die hier nicht dargestellt werden können.
                  Bitte in der Website-Verwaltung bearbeiten.
                </p>
                <pre className="buero-vorschau">{t.text}</pre>
              </>
            )}
            <a
              className="buero-unterzeile"
              href={`/${sprache}${t.pfad}`}
              target="_blank"
              rel="noreferrer"
            >
              Seite ansehen ↗
            </a>
          </div>
        </div>
      ))}

      {meldung && <p className="buero-unterzeile">{meldung}</p>}

      <Fussleiste>
        <button
          type="button"
          className="buero-knopf"
          disabled={stand === 'speichert' || stand === 'laedt' || !geaendert}
          onClick={speichern}
        >
          {stand === 'speichert' ? 'Speichert …' : `${SPRACHNAMEN[sprache]} speichern`}
        </button>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={stand === 'speichert' || stand === 'laedt'}
          onClick={entwuerfe}
        >
          Entwürfe einspielen
        </button>
      </Fussleiste>
      <p className="buero-unterzeile">
        &bdquo;Entwürfe einspielen&ldquo; schreibt Widerrufsbelehrung, Muster-Formular sowie Versand &amp;
        Zahlung in allen drei Sprachen — aber nur dort, wo noch nichts steht. Vorhandene Texte
        bleiben unangetastet. Die Entwürfe sind keine Rechtsberatung und gehören vor dem
        Verkaufsstart geprüft.
      </p>
    </>
  )
}
