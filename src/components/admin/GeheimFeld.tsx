'use client'

import { CopyToClipboard, FieldLabel, useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import React, { useState } from 'react'

/**
 * Eingabefeld für Geheimnisse: Passwörter, Schlüssel, Token.
 *
 * Bisher standen SMTP-Passwort, Stripe-Schlüssel und Postfach-Zugänge im
 * Klartext in der Verwaltung — wer jemandem über die Schulter schaute oder
 * einen Bildschirm teilte, sah alles. Ein reines Passwortfeld wäre allerdings
 * genauso unpraktisch: Diese Werte werden nicht getippt, sondern von woanders
 * hierher und wieder zurück kopiert.
 *
 * Deshalb beides: verdeckt wie ein Passwort, mit einem Knopf zum Aufdecken —
 * und einem zum Kopieren, ohne dass der Wert überhaupt sichtbar wird.
 */
export const GeheimFeld: TextFieldClientComponent = ({ field, path }) => {
  const { setValue, value } = useField<string>({ path })
  const [sichtbar, setSichtbar] = useState(false)

  const beschriftung = field?.label
  const hinweis =
    typeof field?.admin?.description === 'string' ? field.admin.description : undefined
  const gefuellt = Boolean(value)

  return (
    <div className="field-type text" style={{ marginBottom: '1.5rem' }}>
      <FieldLabel label={beschriftung} path={path} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap' }}>
        <input
          type={sichtbar ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value)}
          // Der Browser soll hier nichts einsetzen, was er sich woanders gemerkt hat
          autoComplete="off"
          spellCheck={false}
          style={{ flex: '1 1 18rem', minWidth: 0 }}
        />

        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          style={{ margin: 0 }}
          onClick={() => setSichtbar((v) => !v)}
          aria-pressed={sichtbar}
        >
          {sichtbar ? 'Verbergen' : 'Anzeigen'}
        </button>

        {/* Kopieren geht auch im verdeckten Zustand — genau dafür ist es da */}
        {gefuellt && (
          <CopyToClipboard value={value} defaultMessage="Kopieren" successMessage="Kopiert" />
        )}
      </div>

      {hinweis && <div className="field-description">{hinweis}</div>}
      {!gefuellt && (
        <div className="field-description" style={{ opacity: 0.7 }}>
          Noch nichts hinterlegt.
        </div>
      )}
    </div>
  )
}
