'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { bildUrl } from '../../../../components/office/ArtikelBezug'
import { useBestand } from '../../../../lib/buero/bestand'
import { balkenKlasse } from '../../../../lib/listen'

/** Artikel — hier hängen Stückliste und Dienstleister dran. */

type Artikel = {
  id: number | string
  title?: string | null
  images?: unknown[] | null
  billOfMaterials?: unknown[] | null
  serviceProviders?: unknown[] | null
}

type Medium = {
  id: number | string
  url?: string | null
  sizes?: Record<string, { url?: string | null } | undefined> | null
}

/*
 * Das Bild vom Shop, klein.
 *
 * „Kübel groß" und „Kübel klein" unterscheiden sich in der Liste sonst durch
 * ein Wort. Mit dem Bild greift man nach dem richtigen, ohne zu lesen — und
 * es ist ohnehin da, es steht auf der Website.
 */
function Vorschau({ artikel, medien }: { artikel: Artikel; medien: Medium[] }) {
  const url = bildUrl(artikel, medien)
  return (
    <span
      style={{
        width: 44,
        height: 44,
        flex: '0 0 auto',
        marginRight: '.85rem',
        borderRadius: 8,
        border: '1px solid var(--buero-linie)',
        background: 'var(--buero-papier)',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: '.7rem', color: 'var(--buero-tinte-leise)' }}>—</span>
      )}
    </span>
  )
}

export function ArtikelAnsicht() {
  const alle = useBestand<Artikel>('artikel')
  const medien = useBestand<Medium>('medien')
  const artikel = useMemo(
    () => [...alle].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'de')),
    [alle],
  )
  const ohneListe = artikel.filter((p) => (p.billOfMaterials ?? []).length === 0)

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
          {ohneListe.length} von {artikel.length} Artikeln haben noch keine Stückliste.
        </p>
      )}

      <div className="buero-liste">
        {artikel.length === 0 ? (
          <div className="buero-leer">Noch keine Artikel angelegt.</div>
        ) : (
          artikel.map((p) => {
            const zeilen = (p.billOfMaterials ?? []).length
            const dienste = (p.serviceProviders ?? []).length
            return (
              // Bronze heißt „wartet auf uns": Ohne Stückliste lässt sich weder
              // Material planen noch nachkalkulieren.
              <Link
                key={p.id}
                href={`/office/artikel/${p.id}`}
                className={`buero-zeile ${balkenKlasse(zeilen === 0 ? 'offen' : '')}`}
              >
                <Vorschau artikel={p} medien={medien} />
                <div className="buero-zeile-haupt" style={{ flex: 1 }}>
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
