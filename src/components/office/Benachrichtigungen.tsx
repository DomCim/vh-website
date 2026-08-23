'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Rueckmeldung } from './Rueckmeldung'

type Stand = 'unbekannt' | 'nicht-moeglich' | 'aus' | 'an' | 'abgelehnt'

/** base64url aus dem Server in das Format, das der Browser erwartet */
function schluesselUmwandeln(base64: string): Uint8Array {
  const rest = '='.repeat((4 - (base64.length % 4)) % 4)
  const roh = atob((base64 + rest).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(roh.length)
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
  return bytes
}

const geraeteName = () => {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android-Gerät'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows-Rechner'
  return 'Gerät'
}

/**
 * An- und Abmelden für Benachrichtigungen.
 *
 * Auf dem iPhone kommen Push-Meldungen nur an, wenn die Seite als App zum
 * Startbildschirm hinzugefügt wurde — das steht hier auch so da, sonst sucht
 * man den Fehler an der falschen Stelle.
 */
export function Benachrichtigungen() {
  const [stand, setStand] = useState<Stand>('unbekannt')
  const [geraete, setGeraete] = useState(0)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const pruefen = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStand('nicht-moeglich')
      return
    }
    if (Notification.permission === 'denied') {
      setStand('abgelehnt')
      return
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration('/office')
      const vorhanden = await reg?.pushManager.getSubscription()
      setStand(vorhanden ? 'an' : 'aus')
    } catch {
      setStand('aus')
    }
    try {
      const res = await fetch('/api/office/push', { credentials: 'include' })
      if (res.ok) setGeraete((await res.json()).geraete ?? 0)
    } catch {
      // Zählerstand ist Beiwerk
    }
  }, [])

  useEffect(() => {
    void pruefen()
  }, [pruefen])

  async function anmelden() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const erlaubnis = await Notification.requestPermission()
      if (erlaubnis !== 'granted') {
        setStand(erlaubnis === 'denied' ? 'abgelehnt' : 'aus')
        return
      }

      const reg = await navigator.serviceWorker.register('/office-sw.js', { scope: '/office' })
      await navigator.serviceWorker.ready

      const res = await fetch('/api/office/push', { credentials: 'include' })
      const { publicKey } = await res.json()
      if (!publicKey) {
        setMeldung('Der Server hat keinen Schlüssel geliefert.')
        return
      }

      const anmeldung = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: schluesselUmwandeln(publicKey) as BufferSource,
      })

      const daten = anmeldung.toJSON() as { endpoint?: string; keys?: Record<string, string> }
      const gespeichert = await fetch('/api/office/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...daten, label: geraeteName() }),
      })
      if (!gespeichert.ok) {
        setMeldung('Die Anmeldung ließ sich nicht speichern.')
        return
      }
      setStand('an')
      setMeldung('Dieses Gerät bekommt jetzt Meldungen.')
      void pruefen()
    } catch (err) {
      setMeldung(err instanceof Error ? err.message : 'Die Anmeldung hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  async function abmelden() {
    setLaeuft(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/office')
      const vorhanden = await reg?.pushManager.getSubscription()
      if (vorhanden) {
        await fetch('/api/office/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: vorhanden.endpoint }),
        })
        await vorhanden.unsubscribe()
      }
      setStand('aus')
      setMeldung('Dieses Gerät bekommt keine Meldungen mehr.')
      void pruefen()
    } finally {
      setLaeuft(false)
    }
  }

  async function probe() {
    setLaeuft(true)
    try {
      const res = await fetch('/api/office/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'probe' }),
      })
      const j = await res.json()
      setMeldung(
        j?.zugestellt ? `An ${j.zugestellt} Gerät(e) verschickt.` : 'Kein Gerät angemeldet.',
      )
    } finally {
      setLaeuft(false)
    }
  }

  const alsAppInstalliert =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true)

  return (
    <div className="buero-karte">
      <h2 style={{ marginTop: 0 }}>Benachrichtigungen</h2>
      <Rueckmeldung text={meldung} />

      {stand === 'nicht-moeglich' && (
        <p className="buero-unterzeile">
          Dieser Browser kann keine Benachrichtigungen anzeigen.
        </p>
      )}

      {stand === 'abgelehnt' && (
        <p className="buero-unterzeile">
          Benachrichtigungen wurden für diese Seite abgelehnt. Das lässt sich nur in den
          Browser-Einstellungen wieder ändern.
        </p>
      )}

      {!alsAppInstalliert && stand !== 'nicht-moeglich' && (
        <p className="buero-unterzeile">
          Auf dem iPhone kommen Meldungen erst an, wenn das Büro über &bdquo;Teilen &rarr; Zum
          Home-Bildschirm&ldquo; als App abgelegt ist.
        </p>
      )}

      <p className="buero-unterzeile">
        Gemeldet werden neue Bestellungen, neue Anfragen und fehlgeschlagene Mails.
        {geraete > 0 ? ` Zurzeit ${geraete} angemeldete(s) Gerät(e).` : ''}
      </p>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        {stand === 'an' ? (
          <>
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft}
              onClick={() => void abmelden()}
            >
              Dieses Gerät abmelden
            </button>
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft}
              onClick={() => void probe()}
            >
              Probemeldung schicken
            </button>
          </>
        ) : (
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft || stand === 'nicht-moeglich' || stand === 'abgelehnt'}
            onClick={() => void anmelden()}
          >
            Dieses Gerät anmelden
          </button>
        )}
      </div>
    </div>
  )
}
