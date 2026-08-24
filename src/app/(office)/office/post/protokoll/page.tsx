import React from 'react'

import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

const ANLASS: Record<string, string> = {
  bestellung: 'Bestellung',
  fertigung: 'Fertigung',
  versand: 'Versand',
  anfrage: 'Anfrage',
  zugangscode: 'Zugangscode',
  postfach: 'Aus dem Postfach',
  sonstiges: 'Sonstiges',
}

const ERGEBNIS: Record<string, { text: string; art: string }> = {
  gesendet: { text: 'gesendet', art: 'gut' },
  fehler: { text: 'fehlgeschlagen', art: 'warn' },
  ohneVersand: { text: 'nicht verschickt', art: 'offen' },
}

const zeitpunkt = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

/**
 * Was das System verschickt hat.
 *
 * Bestellbestätigungen und Codes gehen automatisch raus — hier steht, ob sie
 * wirklich angekommen sind. Kommt die Frage „ich habe nichts bekommen", ist
 * das die Stelle zum Nachsehen.
 */
export default async function ProtokollSeite({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await bueroBenutzer()
  const { filter } = await searchParams
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'mail-log',
    where: filter === 'fehler' ? { status: { equals: 'fehler' } } : {},
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const fehler = docs.filter((m) => m.status === 'fehler').length

  return (
    <>
      <div>
        <h1>Ausgangsprotokoll</h1>
        <p className="buero-unterzeile">
          {totalDocs} Mails{fehler > 0 ? ` · ${fehler} davon fehlgeschlagen` : ''}. Nur Kopfdaten,
          kein Inhalt.
        </p>
      </div>

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">Noch nichts verschickt.</div>
        ) : (
          docs.map((m) => {
            const e = ERGEBNIS[m.status] ?? { text: m.status, art: '' }
            return (
              // Rot heißt „über der Zeit": Eine Mail, die nicht rausging,
              // wartet auf jemanden. Erfolgreiche bleiben farblos — sonst
              // wäre das ganze Protokoll grün und die Farbe wertlos.
              <div key={m.id} className={`buero-zeile ${e.art === 'warn' ? 'ist-warn' : ''}`}>
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{m.subject}</div>
                  <div className="buero-zeile-neben">
                    an {m.to} · {ANLASS[m.kind ?? 'sonstiges'] ?? m.kind} ·{' '}
                    {zeitpunkt(m.createdAt)}
                    {m.error ? ` · ${m.error}` : ''}
                  </div>
                </div>
                <span className={`buero-marker ${e.art}`}>{e.text}</span>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
