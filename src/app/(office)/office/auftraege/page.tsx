import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { text: string; art: string }> = {
  geplant: { text: 'Geplant', art: '' },
  inFertigung: { text: 'In Fertigung', art: 'offen' },
  fertig: { text: 'Fertig', art: 'gut' },
  geliefert: { text: 'Geliefert', art: 'gut' },
  abgebrochen: { text: 'Abgebrochen', art: 'warn' },
}

const HERKUNFT: Record<string, string> = {
  shop: 'Shop-Bestellung',
  angebot: 'Angebot',
  manuell: 'von Hand',
}

export default async function AuftraegeSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'jobs',
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const laufend = docs.filter((j) => j.status === 'geplant' || j.status === 'inFertigung')

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1>Fertigungsaufträge</h1>
          <p className="buero-unterzeile">
            {totalDocs} Aufträge · {laufend.length} laufen gerade
          </p>
        </div>
        <Link href="/office/auftraege/neu" className="buero-knopf">
          Auftrag anlegen
        </Link>
      </div>

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">
            Noch kein Auftrag. Bezahlte Shop-Bestellungen landen hier von selbst.
          </div>
        ) : (
          docs.map((j) => {
            const s = STATUS[j.status] ?? { text: j.status, art: '' }
            const spaet =
              j.status !== 'fertig' &&
              j.status !== 'geliefert' &&
              j.status !== 'abgebrochen' &&
              j.dueDate &&
              new Date(j.dueDate).getTime() < Date.now()
            return (
              <Link key={j.id} href={`/office/auftraege/${j.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {j.jobNumber} · {j.title}
                  </div>
                  <div className="buero-zeile-neben">
                    {HERKUNFT[j.source] ?? j.source}
                    {j.customerName ? ` · ${j.customerName}` : ''}
                    {j.dueDate ? ` · fertig bis ${datum(j.dueDate)}` : ''}
                  </div>
                </div>
                <span className={`buero-marker ${spaet ? 'warn' : s.art}`}>
                  {spaet ? 'überfällig' : s.text}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
