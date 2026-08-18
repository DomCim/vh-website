import Link from 'next/link'
import React from 'react'

import { Sicherungen } from '../../../../components/office/Sicherungen'
import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer } from '../../../../lib/office'
import {
  nasEingerichtet,
  sicherungenListe,
  sicherungsZiel,
  zielName,
  zustandLesen,
} from '../../../../lib/sicherung'

export const dynamic = 'force-dynamic'

const zeitpunkt = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

export default async function SicherungsSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const [sicherungen, ziel, zustand] = await Promise.all([
    sicherungenListe(),
    sicherungsZiel(payload),
    zustandLesen(payload, 'sicherung'),
  ])

  const bereit = nasEingerichtet(ziel)
  const name = zielName(ziel)
  const letzte = zeitpunkt(zustand?.lastRun)

  // Älter als anderthalb Tage heißt: Der nächtliche Lauf ist ausgefallen.
  const veraltet =
    !zustand?.lastRun || Date.now() - new Date(zustand.lastRun).getTime() > 36 * 3600 * 1000

  return (
    <>
      <h1>Sicherung</h1>
      <p className="buero-unterzeile">
        Datenbank und Bilder in einem Archiv — und von dort auf die NAS.
      </p>

      <div className={`buero-hinweis${veraltet || zustand?.ok === false ? ' warn' : ''}`}>
        {letzte ? (
          <>
            <strong>Zuletzt gesichert:</strong> {letzte}
            {zustand?.note ? ` · ${zustand.note}` : ''}
            {veraltet && ' — das ist zu lange her, bitte nachsehen.'}
          </>
        ) : (
          <>
            <strong>Noch nie gesichert.</strong> Der nächtliche Lauf braucht einen Cron, der{' '}
            <code>/api/wartung</code> aufruft — siehe README.
          </>
        )}
      </div>

      {!bereit && (
        <div className="buero-hinweis warn">
          Es ist kein Netzwerkspeicher hinterlegt. Solange liegen die Sicherungen nur auf demselben
          Server wie die Daten — gegen ein versehentlich gelöschtes Feld hilft das, gegen einen
          verlorenen Server nicht.{' '}
          <Link href="/admin/globals/integrations" style={{ textDecoration: 'underline' }}>
            NAS eintragen
          </Link>
        </div>
      )}

      {bereit && (
        <p className="buero-unterzeile" style={{ marginTop: 0 }}>
          Ziel: {name}
          {ziel.protokoll === 'webdav'
            ? ` · ${ziel.webdavUrl}`
            : ` · \\\\${ziel.smbServer}\\${ziel.smbFreigabe}${ziel.smbPfad ? `\\${ziel.smbPfad}` : ''}`}
          {' · '}
          {ziel.automatik === false
            ? 'Automatik aus'
            : `täglich ab ${ziel.uhrzeit || '03:30'} Uhr`}
        </p>
      )}

      <Sicherungen sicherungen={sicherungen} nasBereit={bereit} zielName={name} />

      <p className="buero-unterzeile" style={{ marginTop: '1.5rem' }}>
        Zum Zurückspielen liegt in jedem Archiv eine <code>LIESMICH.txt</code> mit den nötigen
        Schritten. Ein Backup, das nie zurückgespielt wurde, ist eine Vermutung — einmal im Jahr
        ausprobieren.
      </p>
    </>
  )
}
