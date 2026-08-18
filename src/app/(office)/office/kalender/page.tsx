import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, euro } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

type Eintrag = {
  tag: string
  titel: string
  neben?: string
  href: string
  art: 'auftrag' | 'bestellung' | 'angebot' | 'beleg'
}

const ART_TEXT: Record<Eintrag['art'], string> = {
  auftrag: 'Auftrag',
  bestellung: 'Bestellung',
  angebot: 'Angebot',
  beleg: 'Beleg',
}

const tagesStempel = (v: string | Date) => {
  const d = new Date(v)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Kalender: was wann fällig ist.
 *
 * Vorher standen Termine in vier Listen — Aufträge, Bestellungen, Angebote,
 * Belege — und ob eine Woche überladen ist, sah man erst, wenn es zu spät
 * war. Hier liegt alles nebeneinander auf einem Blatt.
 */
export default async function KalenderSeite({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>
}) {
  await bueroBenutzer()
  const { monat } = await searchParams
  const payload = await payloadClient()

  const heute = new Date()
  const gewaehlt = /^\d{4}-\d{2}$/.test(monat ?? '')
    ? new Date(`${monat}-01T00:00:00`)
    : new Date(heute.getFullYear(), heute.getMonth(), 1)

  const beginn = new Date(gewaehlt.getFullYear(), gewaehlt.getMonth(), 1)
  const ende = new Date(gewaehlt.getFullYear(), gewaehlt.getMonth() + 1, 1)

  const zeitraum = (feld: string) => ({
    and: [
      { [feld]: { greater_than_equal: beginn.toISOString() } },
      { [feld]: { less_than: ende.toISOString() } },
    ],
  })

  const [auftraege, bestellungen, angebote, belege] = await Promise.all([
    payload.find({
      collection: 'jobs',
      where: {
        and: [
          { status: { in: ['geplant', 'inFertigung', 'fertig'] } },
          zeitraum('dueDate') as never,
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'orders',
      where: {
        and: [{ status: { in: ['paid', 'inProduction'] } }, zeitraum('expectedReady') as never],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'quotes',
      where: { and: [{ status: { equals: 'versendet' } }, zeitraum('validUntil') as never] },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'expenses',
      where: { and: [{ paid: { equals: false } }, zeitraum('dueDate') as never] },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const eintraege: Eintrag[] = [
    ...auftraege.docs.map((a) => ({
      tag: tagesStempel(a.dueDate!),
      titel: a.title ?? a.jobNumber ?? 'Auftrag',
      neben: a.customerName ?? undefined,
      href: `/office/auftraege/${a.id}`,
      art: 'auftrag' as const,
    })),
    ...bestellungen.docs.map((b) => ({
      tag: tagesStempel(b.expectedReady!),
      titel: b.orderNumber ?? 'Bestellung',
      neben: b.customer?.name ?? undefined,
      href: `/office/bestellungen/${b.id}`,
      art: 'bestellung' as const,
    })),
    ...angebote.docs.map((a) => ({
      tag: tagesStempel(a.validUntil!),
      titel: `${a.quoteNumber ?? 'Angebot'} läuft ab`,
      neben: a.customerName ?? undefined,
      href: `/office/angebote/${a.id}`,
      art: 'angebot' as const,
    })),
    ...belege.docs.map((b) => ({
      tag: tagesStempel(b.dueDate!),
      titel: b.supplierName || b.title || 'Beleg',
      neben: euro(b.grossAmount),
      href: `/office/belege/${b.id}`,
      art: 'beleg' as const,
    })),
  ]

  const nachTag = new Map<string, Eintrag[]>()
  for (const e of eintraege) {
    nachTag.set(e.tag, [...(nachTag.get(e.tag) ?? []), e])
  }

  // Montag als erster Tag der Woche — hier arbeitet niemand nach US-Kalender
  const ersterWochentag = (beginn.getDay() + 6) % 7
  const tageImMonat = new Date(gewaehlt.getFullYear(), gewaehlt.getMonth() + 1, 0).getDate()
  const zellen: (number | null)[] = [
    ...Array.from({ length: ersterWochentag }, () => null),
    ...Array.from({ length: tageImMonat }, (_, i) => i + 1),
  ]
  while (zellen.length % 7 !== 0) zellen.push(null)

  const monatsName = beginn.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const verschieben = (schritt: number) => {
    const d = new Date(gewaehlt.getFullYear(), gewaehlt.getMonth() + schritt, 1)
    return `/office/kalender?monat=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

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
          <h1>Kalender</h1>
          <p className="buero-unterzeile">
            {monatsName} · {eintraege.length} Termine
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <Link className="buero-knopf schmal" href={verschieben(-1)}>
            Zurück
          </Link>
          <Link className="buero-knopf schmal" href="/office/kalender">
            Heute
          </Link>
          <Link className="buero-knopf schmal" href={verschieben(1)}>
            Weiter
          </Link>
        </div>
      </div>

      <div className="buero-kalender">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t) => (
          <div key={t} className="buero-kalender-kopf">
            {t}
          </div>
        ))}
        {zellen.map((tag, i) => {
          if (!tag) return <div key={`leer-${i}`} className="buero-kalender-zelle leer" />
          const stempel = tagesStempel(new Date(gewaehlt.getFullYear(), gewaehlt.getMonth(), tag))
          const heutiger = stempel === tagesStempel(heute)
          return (
            <div key={stempel} className={`buero-kalender-zelle${heutiger ? ' heute' : ''}`}>
              <div className="buero-kalender-tag">{tag}</div>
              {(nachTag.get(stempel) ?? []).map((e, k) => (
                <Link key={k} href={e.href} className={`buero-kalender-eintrag ${e.art}`}>
                  <strong>{e.titel}</strong>
                  {e.neben ? <span> {e.neben}</span> : null}
                </Link>
              ))}
            </div>
          )
        })}
      </div>

      <p className="buero-unterzeile" style={{ marginTop: '1rem' }}>
        {Object.entries(ART_TEXT)
          .map(([, text]) => text)
          .join(' · ')}{' '}
        — Fertigstellungen, zugesagte Liefertermine, ablaufende Angebote und fällige Belege.
      </p>
    </>
  )
}
