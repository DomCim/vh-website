import Link from 'next/link'
import React from 'react'

import { Benachrichtigungen } from '../../../../components/office/Benachrichtigungen'
import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer } from '../../../../lib/office'
import { postfaecher } from '../../../../lib/postfach'

export const dynamic = 'force-dynamic'

/**
 * Was am eigenen Gerät eingestellt wird — plus der Verweis dorthin, wo die
 * Zugangsdaten liegen. Passwörter werden hier bewusst nicht angezeigt.
 */
export default async function EinstellungenSeite() {
  const benutzer = await bueroBenutzer()
  const payload = await payloadClient()
  const faecher = await postfaecher(payload)

  return (
    <>
      <h1>Einstellungen</h1>
      <p className="buero-unterzeile">Angemeldet als {benutzer.email}</p>

      <Benachrichtigungen />

      <h2>Postfächer</h2>
      <div className="buero-liste">
        {faecher.length === 0 ? (
          <div className="buero-leer">
            Noch kein Postfach eingerichtet — in der Website-Verwaltung unter Integrationen.
          </div>
        ) : (
          faecher.map((f) => (
            <div key={f.id} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{f.label}</div>
                <div className="buero-zeile-neben">
                  {f.address} · {f.imapHost}
                </div>
              </div>
              {f.isDefault && <span className="buero-marker">Standard</span>}
            </div>
          ))
        )}
      </div>
      <p className="buero-unterzeile" style={{ marginTop: '.75rem' }}>
        Server und Passwörter stehen in der{' '}
        <Link href="/admin/globals/integrations" style={{ textDecoration: 'underline' }}>
          Website-Verwaltung unter Integrationen
        </Link>{' '}
        — dort liegen alle Zugangsdaten an einer Stelle.
      </p>

      <h2>Zwei-Faktor</h2>
      <p className="buero-unterzeile">
        Die Anmeldung ist dieselbe wie in der Website-Verwaltung. Zwei-Faktor wird{' '}
        <Link href="/admin/account" style={{ textDecoration: 'underline' }}>
          im eigenen Benutzerkonto
        </Link>{' '}
        eingerichtet.
      </p>
    </>
  )
}
