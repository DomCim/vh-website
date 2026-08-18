import Link from 'next/link'
import React from 'react'

import { formatPrice, type Locale } from '../../lib/i18n'

type Labels = {
  status: string
  pending: string
  paid: string
  inProduction: string
  shipped: string
  cancelled: string
  expectedReady: string
  tracking: string
  items: string
  subtotal: string
  discount: string
  shipping: string
  pickup: string
  deliveryAddress: string
}

export type BestellungAnsicht = {
  orderNumber: string
  status: string
  createdAt?: string | null
  expectedReady?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  subtotal: number
  discount?: number | null
  shippingTotal?: number | null
  total: number
  promotionTitle?: string | null
  deliveryMethod?: string | null
  items?:
    | {
        titleSnapshot: string
        variantTitle?: string | null
        color?: string | null
        quantity: number
        unitPrice: number
      }[]
    | null
  shippingAddress?: {
    line1?: string | null
    line2?: string | null
    postalCode?: string | null
    city?: string | null
    country?: string | null
  } | null
}

const SCHRITTE = ['paid', 'inProduction', 'shipped'] as const

/** Fortschritt der Bestellung — bezahlt → in Fertigung → versendet */
function Fortschritt({ status, labels }: { status: string; labels: Labels }) {
  if (status === 'cancelled' || status === 'pending') return null
  const aktuell = SCHRITTE.indexOf(status as (typeof SCHRITTE)[number])
  return (
    <ol className="mt-6 flex flex-wrap gap-x-2 gap-y-3 text-xs">
      {SCHRITTE.map((schritt, i) => {
        const erreicht = i <= aktuell
        return (
          <li key={schritt} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${erreicht ? 'bg-bronze' : 'bg-line'}`}
            />
            <span className={erreicht ? 'text-ink font-semibold' : 'text-ink-soft'}>
              {labels[schritt]}
            </span>
            {i < SCHRITTE.length - 1 && <span aria-hidden className="bg-line ml-1 h-px w-6" />}
          </li>
        )
      })}
    </ol>
  )
}

export function Bestellstand({
  bestellung,
  locale,
  labels,
}: {
  bestellung: BestellungAnsicht
  locale: Locale
  labels: Labels
}) {
  const statusText =
    (labels as unknown as Record<string, string>)[bestellung.status] ?? bestellung.status
  const abholung = bestellung.deliveryMethod === 'pickup'
  const a = bestellung.shippingAddress

  return (
    <div>
      <p className="text-ink-soft text-sm">
        {labels.status}: <strong className="text-ink">{statusText}</strong>
      </p>
      <Fortschritt status={bestellung.status} labels={labels} />

      {bestellung.expectedReady && bestellung.status === 'inProduction' && (
        <p className="mt-4 text-sm">
          {labels.expectedReady}: <strong>{bestellung.expectedReady}</strong>
        </p>
      )}

      {bestellung.trackingNumber && (
        <p className="mt-4 text-sm">
          {labels.tracking}:{' '}
          {bestellung.trackingUrl ? (
            <Link href={bestellung.trackingUrl} className="hover:text-bronze underline">
              {bestellung.trackingNumber}
            </Link>
          ) : (
            <strong>{bestellung.trackingNumber}</strong>
          )}
        </p>
      )}

      <h2 className="tracking-nav text-ink mt-10 text-xs font-semibold uppercase">{labels.items}</h2>
      <ul className="divide-line mt-3 divide-y border-y">
        {(bestellung.items ?? []).map((p, i) => (
          <li key={i} className="flex justify-between gap-4 py-3 text-sm">
            <span>
              {p.quantity}× {p.titleSnapshot}
              {[p.variantTitle, p.color].filter(Boolean).length > 0 && (
                <span className="text-ink-soft">
                  {' '}
                  ({[p.variantTitle, p.color].filter(Boolean).join(', ')})
                </span>
              )}
            </span>
            <span className="whitespace-nowrap">
              {formatPrice(p.unitPrice * p.quantity, locale)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">{labels.subtotal}</dt>
          <dd>{formatPrice(bestellung.subtotal, locale)}</dd>
        </div>
        {Boolean(bestellung.discount) && (
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              {labels.discount}
              {bestellung.promotionTitle ? ` (${bestellung.promotionTitle})` : ''}
            </dt>
            <dd>−{formatPrice(bestellung.discount ?? 0, locale)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-soft">{abholung ? labels.pickup : labels.shipping}</dt>
          <dd>{formatPrice(bestellung.shippingTotal ?? 0, locale)}</dd>
        </div>
        <div className="border-line flex justify-between border-t pt-2 font-semibold">
          <dt>Σ</dt>
          <dd>{formatPrice(bestellung.total, locale)}</dd>
        </div>
      </dl>

      {!abholung && a?.line1 && (
        <>
          <h2 className="tracking-nav text-ink mt-10 text-xs font-semibold uppercase">
            {labels.deliveryAddress}
          </h2>
          <address className="text-ink-soft mt-2 text-sm not-italic">
            {[a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(' '), a.country]
              .filter(Boolean)
              .map((zeile) => (
                <React.Fragment key={zeile}>
                  {zeile}
                  <br />
                </React.Fragment>
              ))}
          </address>
        </>
      )}
    </div>
  )
}
