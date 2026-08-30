'use client'

import React, { useEffect, useState } from 'react'

/**
 * Der Kalender aufs Telefon — Abonnement und CalDAV-Konto.
 *
 * Zwei Wege, und der Unterschied ist der Grund, warum es beide gibt:
 *
 *   - **Abonnieren** ist in zehn Sekunden eingerichtet und **liest nur**. Ein
 *     abonnierter Kalender lässt sich am iPhone nicht beschreiben; das
 *     Pluszeichen bietet ihn gar nicht erst an.
 *   - **Das CalDAV-Konto** ist etwas mehr Tipparbeit und geht in beide
 *     Richtungen: Ein Termin, den man am Telefon einträgt, steht danach hier.
 *
 * Wer nur nachsehen will, was ansteht, nimmt das Abonnement. Wer unterwegs
 * Termine einträgt, braucht das Konto.
 *
 * Die Adressen enthalten einen Schlüssel, der so viel wert ist wie ein
 * Passwort (siehe `lib/kalender/zugang.ts`) — deshalb steht hier der Hinweis
 * dazu und ein Weg, ihn zurückzuziehen.
 */

type Stand = {
  eingerichtet: boolean
  abonnement: string | null
  caldav: string | null
  benutzername: string
  schluessel: string | null
}

export function Zugang() {
  const [stand, setStand] = useState<Stand | null>(null)
  const [offen, setOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [kopiert, setKopiert] = useState<string | null>(null)

  useEffect(() => {
    if (!offen || stand) return
    fetch('/api/office/kalender-zugang')
      .then((a) => (a.ok ? a.json() : null))
      .then((d) => d && setStand(d))
      .catch(() => {
        /* Ohne Netz bleibt der Abschnitt eben leer — er ist kein Arbeitsmittel */
      })
  }, [offen, stand])

  const einrichten = async () => {
    setLaeuft(true)
    try {
      const antwort = await fetch('/api/office/kalender-zugang', { method: 'POST' })
      if (antwort.ok) setStand(await antwort.json())
    } finally {
      setLaeuft(false)
    }
  }

  const zurueckziehen = async () => {
    setLaeuft(true)
    try {
      const antwort = await fetch('/api/office/kalender-zugang', { method: 'DELETE' })
      if (antwort.ok) setStand(await antwort.json())
    } finally {
      setLaeuft(false)
    }
  }

  const kopieren = async (wert: string, was: string) => {
    try {
      await navigator.clipboard.writeText(wert)
      setKopiert(was)
      setTimeout(() => setKopiert(null), 2000)
    } catch {
      /* Ohne Zwischenablage bleibt der Text zum Markieren stehen */
    }
  }

  if (!offen) {
    return (
      <p style={{ marginTop: '1.5rem' }}>
        <button type="button" className="buero-knopf leise schmal" onClick={() => setOffen(true)}>
          Kalender aufs Telefon
        </button>
      </p>
    )
  }

  return (
    <section className="buero-kalender-zugang">
      <h2>Kalender aufs Telefon</h2>

      {!stand ? (
        <p className="buero-unterzeile">Einen Augenblick…</p>
      ) : !stand.eingerichtet ? (
        <>
          <p className="buero-unterzeile">
            Noch nicht eingerichtet. Der Zugang gilt nur für dich — wer ihn bekommt, sieht deinen
            Kalender, ohne sich anzumelden. Gib ihn deshalb nicht weiter.
          </p>
          <button
            type="button"
            className="buero-knopf schmal"
            onClick={einrichten}
            disabled={laeuft}
          >
            {laeuft ? 'Einen Augenblick…' : 'Zugang einrichten'}
          </button>
        </>
      ) : (
        <>
          <div className="buero-kalender-zugang-block">
            <h3>Abonnieren — nur ansehen</h3>
            <p className="buero-unterzeile">
              Am iPhone antippen, dann fragt der Kalender, ob er das Abonnement anlegen soll. Er
              holt sich den Stand etwa halbstündlich. Termine anlegen geht so <strong>nicht</strong>
              — dafür ist das Konto darunter da.
            </p>
            <div className="buero-kalender-zugang-adresse">
              <code>{stand.abonnement}</code>
              <button
                type="button"
                className="buero-knopf leise schmal"
                onClick={() => kopieren(stand.abonnement!, 'abo')}
              >
                {kopiert === 'abo' ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
          </div>

          <div className="buero-kalender-zugang-block">
            <h3>Konto — ansehen und eintragen</h3>
            <p className="buero-unterzeile">
              Am iPhone unter <strong>Einstellungen → Apps → Kalender → Accounts → Account
              hinzufügen → Andere → CalDAV-Account</strong>. Damit stehen Termine, die du unterwegs
              anlegst, auch hier im Büro.
            </p>
            <dl className="buero-kalender-zugang-liste">
              <dt>Server</dt>
              <dd>
                <code>{stand.caldav}</code>
                <button
                  type="button"
                  className="buero-knopf leise schmal"
                  onClick={() => kopieren(stand.caldav!, 'server')}
                >
                  {kopiert === 'server' ? 'Kopiert' : 'Kopieren'}
                </button>
              </dd>
              <dt>Benutzername</dt>
              <dd>
                <code>{stand.benutzername}</code>
              </dd>
              <dt>Passwort</dt>
              <dd>
                <code>{stand.schluessel}</code>
                <button
                  type="button"
                  className="buero-knopf leise schmal"
                  onClick={() => kopieren(stand.schluessel!, 'wort')}
                >
                  {kopiert === 'wort' ? 'Kopiert' : 'Kopieren'}
                </button>
              </dd>
            </dl>
            <p className="buero-unterzeile">
              Das ist nicht dein Anmeldepasswort, sondern ein eigener Schlüssel nur für den
              Kalender. Er lässt sich einzeln zurückziehen.
            </p>
          </div>

          <p style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="buero-knopf leise schmal"
              onClick={zurueckziehen}
              disabled={laeuft}
            >
              Zugang zurückziehen
            </button>{' '}
            <button
              type="button"
              className="buero-knopf leise schmal"
              onClick={einrichten}
              disabled={laeuft}
            >
              Neuen Schlüssel
            </button>
          </p>
          <p className="buero-unterzeile">
            Ist ein Telefon abhandengekommen, hilft ein neuer Schlüssel: Der alte gilt dann sofort
            nicht mehr. Alle Geräte müssen danach neu eingerichtet werden.
          </p>
        </>
      )}
    </section>
  )
}
