import { notFound } from 'next/navigation'
import React from 'react'

import { KundenstimmeFormular } from '../../../../components/shop/KundenstimmeFormular'
import { payloadClient } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

// Die Seite gehört zu genau einer Bestellung und hat in keiner Suchmaschine
// etwas verloren.
export const metadata = { robots: { index: false, follow: false } }

export default async function KundenstimmeSeite({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ bestellung?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const { bestellung: token } = await searchParams
  const dict = t(locale)

  const payload = await payloadClient()
  const { docs } = token
    ? await payload.find({
        collection: 'orders',
        where: { accessToken: { equals: token } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] }
  const bestellung = docs[0]

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="tracking-nav text-ink mb-6 text-2xl font-semibold uppercase">
        {dict.review.title}
      </h1>

      {!bestellung ? (
        <p className="text-ink-soft">{dict.review.unknown}</p>
      ) : (
        <>
          <p className="text-ink-soft">
            {dict.review.intro.replace(
              '{stueck}',
              bestellung.items?.[0]?.titleSnapshot ?? dict.review.yourPiece,
            )}
          </p>
          <KundenstimmeFormular
            token={token!}
            name={bestellung.customer?.name}
            dict={dict.review}
          />
        </>
      )}
    </div>
  )
}
