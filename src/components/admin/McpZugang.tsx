'use client'

import { Button, CopyToClipboard, useFormFields } from '@payloadcms/ui'
import { useMemo } from 'react'

/**
 * Zeigt die fertige Verbindungsadresse für den MCP-Server zum Kopieren an
 * und kann einen neuen Schlüssel erzeugen.
 */
export function McpZugang() {
  const apiKey = useFormFields(([felder]) => felder?.['mcp.apiKey']?.value as string | undefined)
  const readonlyKey = useFormFields(
    ([felder]) => felder?.['mcp.readonlyKey']?.value as string | undefined,
  )
  const setzeWert = useFormFields(([, dispatch]) => dispatch)

  const basis = typeof window === 'undefined' ? '' : window.location.origin

  const url = useMemo(
    () => (apiKey ? `${basis}/api/mcp?key=${encodeURIComponent(apiKey)}` : null),
    [apiKey, basis],
  )
  const urlNurLesen = useMemo(
    () => (readonlyKey ? `${basis}/api/mcp?key=${encodeURIComponent(readonlyKey)}` : null),
    [readonlyKey, basis],
  )

  const neuerSchluessel = (pfad: 'mcp.apiKey' | 'mcp.readonlyKey') => {
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const wert = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    setzeWert({ type: 'UPDATE', path: pfad, value: wert })
  }

  const Zeile = ({
    titel,
    wert,
    pfad,
    hinweis,
  }: {
    titel: string
    wert: string | null
    pfad: 'mcp.apiKey' | 'mcp.readonlyKey'
    hinweis: string
  }) => (
    <div style={{ marginBottom: '1.25rem' }}>
      <strong>{titel}</strong>
      <p style={{ margin: '.15rem 0 .5rem', opacity: 0.75 }}>{hinweis}</p>
      {wert ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
          <code
            style={{
              padding: '.4rem .6rem',
              border: '1px solid currentColor',
              borderRadius: 4,
              wordBreak: 'break-all',
              flex: '1 1 20rem',
            }}
          >
            {wert}
          </code>
          <CopyToClipboard value={wert} />
        </div>
      ) : (
        <p style={{ margin: 0, opacity: 0.75 }}>Noch kein Schlüssel hinterlegt.</p>
      )}
      <Button size="small" buttonStyle="secondary" onClick={() => neuerSchluessel(pfad)}>
        Neuen Schlüssel erzeugen
      </Button>
    </div>
  )

  return (
    <div style={{ marginBlock: '1.5rem', maxWidth: '46rem' }}>
      <h4 style={{ marginBottom: '.35rem' }}>Verbindung für den KI-Assistenten</h4>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Diese Adresse in Claude als eigenen Connector eintragen. Nach dem Erzeugen eines neuen
        Schlüssels erst <strong>speichern</strong>, dann kopieren. Der volle Schlüssel wirkt wie ein
        Admin-Passwort.
      </p>
      <Zeile
        titel="Voller Zugriff"
        wert={url}
        pfad="mcp.apiKey"
        hinweis="Inhalte anlegen, ändern und löschen, Bestellungen pflegen."
      />
      <Zeile
        titel="Nur lesen"
        wert={urlNurLesen}
        pfad="mcp.readonlyKey"
        hinweis="Nur Auswertungen und Einsicht — mit diesem Schlüssel sind keine Änderungen möglich."
      />
      <p style={{ opacity: 0.75 }}>
        In Claude Code stattdessen mit Kopfzeile verbinden — dann steht der Schlüssel nicht in
        Server-Protokollen:
        <br />
        <code>
          claude mcp add --transport http vh-website {basis}/api/mcp --header
          &quot;Authorization: Bearer &lt;Schlüssel&gt;&quot;
        </code>
      </p>
    </div>
  )
}
