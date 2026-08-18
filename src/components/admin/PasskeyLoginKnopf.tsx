'use client'

import React from 'react'

import { PasskeyAnmeldung } from '../office/PasskeyAnmeldung'

/**
 * Derselbe Knopf über dem Anmeldeformular des Admin-Panels.
 *
 * Nach erfolgreicher Anmeldung wird die Seite neu geladen — Payload liest die
 * Sitzung dann über die Passkey-Strategie und lässt durch.
 */
export function PasskeyLoginKnopf() {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <PasskeyAnmeldung
        aussehen="admin"
        aufErfolg={() => {
          window.location.href = '/admin'
        }}
      />
    </div>
  )
}
