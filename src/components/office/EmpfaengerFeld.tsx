'use client'

import React, { useMemo, useRef, useState } from 'react'

import { useBestand } from '../../lib/buero/bestand'

/**
 * Das „An"-Feld: gewählte Empfänger als Plättchen, Vorschläge beim Tippen.
 *
 * **Warum Vorschläge.** Adressen tippt man falsch. Nicht oft, aber wenn, dann
 * fällt es erst auf, wenn die Antwort ausbleibt — bei einem Angebot also eine
 * Woche später. Wer im Büro schreibt, schreibt fast immer an jemanden, der als
 * Geschäftspartner hinterlegt ist; die Adresse steht längst da.
 *
 * **Warum aus dem Gerät.** Die Partner liegen ohnehin im örtlichen Bestand
 * (siehe `lib/bereiche.ts`). Keine Anfrage je Buchstabe, keine Wartezeit, und
 * im Funkloch geht es genauso — das Büro arbeitet ohne Netz, und ein Feld, das
 * dann nichts mehr weiß, wäre ein Rückschritt.
 *
 * **Warum Plättchen und keine Kommaliste.** „a@x.fr, b@y.fr, c@z.fr" ist eine
 * Zeile, in der man beim Löschen leicht ein Zeichen zu viel erwischt — und am
 * Telefon sieht man vom dritten Empfänger ohnehin nur noch das Ende. Als
 * Plättchen ist jeder Empfänger ein Ding: sichtbar, einzeln wegnehmbar, und
 * mit dem **Namen** statt der Adresse, wenn wir ihn kennen.
 *
 * Nach außen bleibt es trotzdem eine Kommaliste (`wert`/`aendern`) — so
 * versteht es der Versand, und ein Entwurf aus einer älteren Fassung geht
 * ohne Umbau weiter.
 */

type Partner = {
  id: number | string
  name?: string | null
  email?: string | null
  role?: string | null
}

const ROLLE: Record<string, string> = {
  kunde: 'Kunde',
  lieferant: 'Lieferant',
  dienstleister: 'Dienstleister',
  beides: 'Partner',
}

/** Aus „a@x.fr, b@y.fr" die einzelnen Empfänger. */
export function zuListe(wert: string): string[] {
  return wert
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Zurück in die Kommaliste — samt dem, was gerade noch im Feld steht.
 *
 * Das Angefangene gehört dazu: Wer eine Adresse tippt und gleich auf „Senden"
 * drückt, ohne die Eingabetaste zu benutzen, meint sie trotzdem.
 */
export function alsWert(liste: string[], eingabe = ''): string {
  return [...liste, eingabe.trim()].filter(Boolean).join(', ')
}

/** Der Name zu einer Adresse, wenn wir einen kennen — sonst die Adresse. */
export function nameZu(partner: Partner[], adresse: string): string {
  const treffer = partner.find((p) => p.email?.toLowerCase() === adresse.toLowerCase())
  return treffer?.name?.trim() || adresse
}

/**
 * Die Vorschläge zu einem Suchwort.
 *
 * Ohne React, damit die Regeln ohne Bildschirm prüfbar sind. Wer schon gewählt
 * ist, taucht nicht noch einmal auf — ein Empfänger zweimal in derselben Mail
 * ist keine Absicht, sondern ein Versehen.
 */
export function vorschlaege(
  partner: Partner[],
  suche: string,
  schonDrin: string[] = [],
  grenze = 6,
): Partner[] {
  const wort = suche.trim().toLowerCase()
  if (wort.length < 2) return []

  const gewaehlt = new Set(schonDrin.map((a) => a.toLowerCase()))
  return partner
    .filter((p) => p.email?.includes('@') && !gewaehlt.has(p.email.toLowerCase()))
    .filter(
      (p) =>
        String(p.name ?? '').toLowerCase().includes(wort) ||
        String(p.email ?? '').toLowerCase().includes(wort),
    )
    .slice(0, grenze)
}

/** Sieht das nach einer Adresse aus? Für das Übernehmen von Hand getippter. */
export const sichtAusWieAdresse = (wert: string) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(wert.trim())

export function EmpfaengerFeld({
  wert,
  aendern,
  platzhalter = 'Name oder E-Mail …',
}: {
  wert: string
  aendern: (wert: string) => void
  platzhalter?: string
}) {
  const partner = useBestand<Partner>('partner')
  const [eingabe, setEingabe] = useState('')
  const [offen, setOffen] = useState(false)
  const feld = useRef<HTMLInputElement>(null)

  const liste = useMemo(() => zuListe(wert), [wert])
  const treffer = useMemo(
    () => vorschlaege(partner, eingabe, liste),
    [partner, eingabe, liste],
  )

  function hinzufuegen(adresse: string) {
    const sauber = adresse.trim()
    if (!sauber) return
    // Doppelte still übergehen: Der Empfänger steht ja schon da
    const neu = liste.some((a) => a.toLowerCase() === sauber.toLowerCase())
      ? liste
      : [...liste, sauber]
    aendern(alsWert(neu))
    setEingabe('')
    setOffen(false)
    feld.current?.focus()
  }

  function wegnehmen(adresse: string) {
    aendern(alsWert(liste.filter((a) => a !== adresse), eingabe))
    feld.current?.focus()
  }

  return (
    <div className="buero-vorschlag-feld">
      <div className="buero-empfaenger" onClick={() => feld.current?.focus()}>
        {liste.map((adresse) => (
          <span key={adresse} className="buero-plaettchen" title={adresse}>
            {nameZu(partner, adresse)}
            <button
              type="button"
              aria-label={`${adresse} entfernen`}
              onClick={(e) => {
                e.stopPropagation()
                wegnehmen(adresse)
              }}
            >
              ×
            </button>
          </span>
        ))}

        <input
          ref={feld}
          type="text"
          inputMode="email"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={eingabe}
          placeholder={liste.length === 0 ? platzhalter : ''}
          onChange={(e) => {
            const text = e.target.value
            // Ein Komma heißt „fertig" — wie in jedem Mailprogramm
            if (text.endsWith(',')) hinzufuegen(text.slice(0, -1))
            else {
              setEingabe(text)
              setOffen(true)
            }
          }}
          onFocus={() => setOffen(true)}
          /* Erst schließen, wenn der Tipp durch ist — sonst verschwindet die
             Liste, bevor der Finger den Eintrag erreicht */
          onBlur={() => {
            window.setTimeout(() => setOffen(false), 150)
            /*
             * Eine fertige Adresse wird beim Verlassen zum Plättchen — wer sie
             * tippt und gleich auf „Senden" drückt, meint sie.
             *
             * Halbfertiges bleibt dagegen stehen, wo es steht: „kath" ist kein
             * Empfänger, und als Plättchen sähe es aus wie einer.
             */
            if (sichtAusWieAdresse(eingabe)) hinzufuegen(eingabe)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOffen(false)
            if (e.key === 'Enter') {
              e.preventDefault()
              if (offen && treffer[0]) hinzufuegen(String(treffer[0].email))
              else if (eingabe.trim()) hinzufuegen(eingabe)
            }
            /* Rücktaste im leeren Feld nimmt das letzte Plättchen — die Geste,
               die man aus jedem Empfängerfeld kennt */
            if (e.key === 'Backspace' && !eingabe && liste.length > 0) {
              e.preventDefault()
              wegnehmen(liste[liste.length - 1])
            }
          }}
        />
      </div>

      {offen && treffer.length > 0 && (
        <div className="buero-vorschlag-blatt" role="listbox">
          {treffer.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected="false"
              /* `onMouseDown` statt `onClick`: Der Klick käme erst nach dem
                 Verlassen des Feldes, und dann ist die Liste schon zu */
              onMouseDown={(e) => {
                e.preventDefault()
                hinzufuegen(String(p.email))
              }}
            >
              <strong>{p.name || p.email}</strong>
              <span>{p.email}</span>
              {p.role && <em>{ROLLE[p.role] ?? p.role}</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
