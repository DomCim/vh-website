import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { text: string; art: string }> = {
  neu: { text: 'Neu', art: 'offen' },
  inBearbeitung: { text: 'In Bearbeitung', art: 'offen' },
  beantwortet: { text: 'Beantwortet', art: 'gut' },
  erledigt: { text: 'Erledigt', art: '' },
}

const ART: Record<string, string> = {
  kontakt: 'Kontaktformular',
  produkt: 'Produktanfrage',
  massanfertigung: 'Maßanfertigung',
}

export default async function AnfragenSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'inquiries',
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const neu = docs.filter((a) => a.status === 'neu')

  return (
    <>
      <div>
        <h1>Anfragen</h1>
        <p className="buero-unterzeile">
          {totalDocs} Anfragen · {neu.length} unbeantwortet
        </p>
      </div>

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">Noch keine Anfrage.</div>
        ) : (
          docs.map((a) => {
            const s = STATUS[a.status] ?? { text: a.status, art: '' }
            return (
              <Link key={a.id} href={`/office/anfragen/${a.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {a.name} · {ART[a.type] ?? a.type}
                  </div>
                  <div className="buero-zeile-neben">
                    {datum(a.createdAt)} · {a.email}
                  </div>
                </div>
                <span className={`buero-marker ${s.art}`}>{s.text}</span>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
