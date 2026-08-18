import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function ArtikelSeite() {
  await bueroBenutzer()
  const payload = await payloadClient()

  const { docs, totalDocs } = await payload.find({
    collection: 'products',
    sort: 'title',
    limit: 300,
    depth: 0,
    locale: 'de',
    overrideAccess: true,
  })

  const ohneListe = docs.filter((p) => (p.billOfMaterials ?? []).length === 0)

  return (
    <>
      <div>
        <h1>Artikel</h1>
        <p className="buero-unterzeile">
          Titel, Preis und Bilder stehen in der{' '}
          <Link href="/admin/collections/products" style={{ textDecoration: 'underline' }}>
            Website-Verwaltung
          </Link>
          . Hier hängen Stückliste und Dienstleister dran — daran erkennt das System bei einer
          Bestellung, ob alles im Haus ist.
        </p>
      </div>

      {ohneListe.length > 0 && (
        <p className="buero-hinweis">
          {ohneListe.length} von {totalDocs} Artikeln haben noch keine Stückliste.
        </p>
      )}

      <div className="buero-liste">
        {docs.length === 0 ? (
          <div className="buero-leer">Noch keine Artikel angelegt.</div>
        ) : (
          docs.map((p) => {
            const zeilen = (p.billOfMaterials ?? []).length
            const dienste = (p.serviceProviders ?? []).length
            return (
              <Link key={p.id} href={`/office/artikel/${p.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{p.title}</div>
                  <div className="buero-zeile-neben">
                    {zeilen === 0 ? 'keine Stückliste' : `${zeilen} Materialposten`}
                    {dienste > 0 ? ` · ${dienste} Dienstleister` : ''}
                  </div>
                </div>
                {zeilen === 0 && <span className="buero-marker offen">offen</span>}
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
