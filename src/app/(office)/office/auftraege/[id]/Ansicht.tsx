'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { AuftragFormular } from '../../../../../components/office/AuftragFormular'
import { VersandKnopf } from '../../../../../components/office/VersandKnopf'
import { Zahlungsleiste } from '../../../../../components/office/Zahlungsleiste'
import { Zeiterfassung } from '../../../../../components/office/Zeiterfassung'
import { useAbgleich, useBestand, useDatensatz, useRahmen } from '../../../../../lib/buero/bestand'
import { bestandsPruefung, type Posten } from '../../../../../lib/buero/material'

/**
 * Ein Auftrag mit allem, was daran hängt.
 *
 * Material, Kalkulation und Bestandswarnung rechnet die Seite selbst aus dem
 * Inventar, das ohnehin im Gerät liegt. Früher waren das drei zusätzliche
 * Abfragen bei jedem Aufruf.
 */

type Auftrag = {
  id: number | string
  jobNumber?: string | null
  title?: string | null
  positions?: { description?: string | null; quantity?: number | null; price?: number | null }[] | null
  material?: { item?: unknown; quantity?: number | null }[] | null
  [feld: string]: unknown
}

export function AuftragAnsicht() {
  const { id } = useParams<{ id: string }>()
  const j = useDatensatz<Auftrag>('auftraege', id)
  const inventar = useBestand<Posten>('inventar')
  const { stundensatz } = useRahmen()
  const { bereit } = useAbgleich()

  const posten = useMemo(
    () => [...inventar].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de')),
    [inventar],
  )

  const bedarf = useMemo(
    () => bestandsPruefung(j?.material ?? [], posten),
    [j?.material, posten],
  )

  const auftragswert = useMemo(
    () => (j?.positions ?? []).reduce((s, p) => s + (p.price ?? 0) * (p.quantity ?? 1), 0),
    [j?.positions],
  )

  const materialkosten = useMemo(
    () =>
      bedarf.reduce((summe, b) => {
        const stueck = posten.find((p) => Number(p.id) === b.itemId)
        return summe + b.benoetigt * (stueck?.unitValue ?? 0)
      }, 0),
    [bedarf, posten],
  )

  if (!j) {
    return (
      <>
        <h1>Auftrag</h1>
        <div className="buero-leer">
          {bereit ? 'Diesen Auftrag gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  const fehlend = bedarf.filter((b) => b.fehlt > 0)
  const bestellId = j.order as number | string | null
  const angebotId = j.quote as number | string | null

  return (
    <>
      <h1>{j.jobNumber}</h1>
      <p className="buero-unterzeile">{j.title}</p>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', margin: '.6rem 0 1rem' }}>
        <a className="buero-knopf schmal" href={`/api/office/auftrag/${j.id}/bestaetigung`}>
          Auftragsbestätigung
        </a>
        <a className="buero-knopf schmal" href={`/api/office/auftrag/${j.id}/lieferschein`}>
          Lieferschein
        </a>
        <VersandKnopf art="lieferschein" id={j.id} leise />
      </div>

      {(bestellId || angebotId) && (
        <p className="buero-unterzeile">
          {bestellId && (
            <Link
              href={`/admin/collections/orders/${bestellId}`}
              style={{ textDecoration: 'underline' }}
            >
              Zur Bestellung
            </Link>
          )}
          {bestellId && angebotId && ' · '}
          {angebotId && (
            <Link href={`/office/angebote/${angebotId}`} style={{ textDecoration: 'underline' }}>
              Zum Angebot
            </Link>
          )}
        </p>
      )}

      {fehlend.length > 0 && !j.materialGebucht && (
        <p className="buero-hinweis">
          Material fehlt:{' '}
          {fehlend.map((f) => `${f.name} — ${f.fehlt} ${f.einheit} nachbestellen`).join(', ')}
        </p>
      )}

      <Zahlungsleiste
        auftragId={j.id}
        auftragswert={auftragswert}
        zahlplan={j.zahlplan as { anzahlungProzent?: number; zwischenProzent?: number }}
        fertigBis={j.dueDate as string}
      />

      <AuftragFormular
        werte={{
          id: j.id,
          jobNumber: j.jobNumber,
          status: j.status as string,
          source: j.source as string,
          title: j.title,
          customerName: j.customerName as string,
          startDate: j.startDate as string,
          dueDate: j.dueDate as string,
          notes: j.notes as string,
          materialGebucht: Boolean(j.materialGebucht),
          customerOrderRef: j.customerOrderRef as string,
          orderedAt: j.orderedAt as string,
          confirmedAt: j.confirmedAt as string,
          anzahlungProzent: (j.zahlplan as { anzahlungProzent?: number })?.anzahlungProzent ?? 0,
          zwischenProzent: (j.zahlplan as { zwischenProzent?: number })?.zwischenProzent ?? 0,
          meilensteinBezeichnung: (j.meilenstein as { bezeichnung?: string })?.bezeichnung ?? '',
          meilensteinErreichtAm: (j.meilenstein as { erreichtAm?: string })?.erreichtAm ?? '',
          rechnungsBasis: j.rechnungsBasis as string,
          positions: (j.positions ?? []).map((p) => ({
            description: p.description ?? '',
            quantity: p.quantity ?? 1,
            price: p.price ?? 0,
          })),
          material: (j.material ?? []).map((m) => ({
            item: Number(typeof m.item === 'object' ? (m.item as { id?: number })?.id : m.item),
            quantity: m.quantity ?? 0,
          })),
        }}
        posten={posten.map((p) => ({
          id: Number(p.id),
          name: p.name ?? '',
          unit: p.unit ?? '',
          quantity: p.quantity ?? 0,
        }))}
      />

      <Zeiterfassung
        auftragId={j.id}
        laeuftSeit={j.runningSince as string}
        buchungen={(j.timeEntries ?? []) as never}
        stundensatz={stundensatz}
        auftragswert={auftragswert}
        materialkosten={materialkosten}
      />
    </>
  )
}
