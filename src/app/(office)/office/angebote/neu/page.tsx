'use client'

import { useSearchParams } from 'next/navigation'
import React, { Suspense } from 'react'

import { AngebotFormular } from '../../../../../components/office/AngebotFormular'
import { useBestand } from '../../../../../lib/buero/bestand'

/**
 * Neues Angebot — braucht nichts vom Server.
 *
 * Die beiden Daten entstehen im Browser; die Nummer vergibt ohnehin erst der
 * Server beim Versenden.
 *
 * Kommt der Aufruf mit `?anfrage=…` aus einer Anfrage, werden Name und
 * Produkt übernommen und die Anfrage verknüpft. Die Verknüpfung ist kein
 * Ordnungsmerkmal, sondern trägt Geld: Über sie findet der spätere Auftrag
 * seinen Zahlplan (Anzahlung/Zwischenrechnung vom Artikel) — ohne sie wurde
 * jedes Projekt erst ganz am Ende abgerechnet. Gelesen wird aus dem Bestand
 * im Gerät, das geht auch ohne Netz.
 */

type Anfrage = {
  id: number | string
  name?: string | null
  productTitle?: string | null
}

function NeuesAngebot() {
  const suche = useSearchParams()
  const anfrageId = suche.get('anfrage')
  const anfragen = useBestand<Anfrage>('anfragen')
  const anfrage = anfrageId
    ? anfragen.find((a) => String(a.id) === String(anfrageId))
    : undefined

  const heute = new Date()
  const in30Tagen = new Date(heute.getTime() + 30 * 24 * 60 * 60 * 1000)

  return (
    <AngebotFormular
      // Erst rendern, wenn die Anfrage da ist — sonst stünde das Formular
      // schon mit leeren Feldern da, wenn der Bestand eintrifft
      key={anfrage ? `anfrage-${anfrage.id}` : 'leer'}
      werte={{
        issueDate: heute.toISOString().slice(0, 10),
        validUntil: in30Tagen.toISOString().slice(0, 10),
        ...(anfrage
          ? {
              inquiry: Number(anfrage.id) || undefined,
              customerName: anfrage.name ?? undefined,
              title: anfrage.productTitle ?? undefined,
            }
          : {}),
      }}
    />
  )
}

export default function NeuesAngebotSeite() {
  return (
    <>
      <h1>Neues Angebot</h1>
      <p className="buero-unterzeile">
        Die Nummer wird erst beim Versenden vergeben — ein verworfener Entwurf reißt so keine Lücke
        in die Reihe.
      </p>
      {/* useSearchParams verlangt eine Suspense-Grenze beim Bauen der Seite */}
      <Suspense fallback={null}>
        <NeuesAngebot />
      </Suspense>
    </>
  )
}
