import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { KontoAnmeldung } from '../../../../components/shop/KontoAnmeldung'
import { payloadClient } from '../../../../lib/data'
import { formatPrice, isLocale, t } from '../../../../lib/i18n'
import { SITZUNGS_COOKIE, sitzungLesen } from '../../../../lib/kundenportal'

export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

export default async function KontoSeite({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const email = sitzungLesen((await cookies()).get(SITZUNGS_COOKIE)?.value)

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="tracking-nav text-ink text-2xl font-semibold uppercase">
        {dict.account.title}
      </h1>

      {!email ? (
        <div className="mt-8">
          <KontoAnmeldung labels={dict.account} />
        </div>
      ) : (
        <Bestellliste email={email} locale={locale} dict={dict} />
      )}
    </div>
  )
}

async function Bestellliste({
  email,
  locale,
  dict,
}: {
  email: string
  locale: 'de' | 'fr' | 'en'
  dict: ReturnType<typeof t>
}) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'orders',
    where: { 'customer.email': { equals: email } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const statusText = (status: string) =>
    (dict.orderStatus as unknown as Record<string, string>)[status] ?? status

  return (
    <>
      <p className="text-ink-soft mt-2 text-sm">{email}</p>

      {docs.length === 0 ? (
        <p className="text-ink-soft mt-8">{dict.account.noOrders}</p>
      ) : (
        <ul className="divide-line mt-8 divide-y border-y">
          {docs.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-semibold">
                  {dict.account.orderNumber} {o.orderNumber}
                </p>
                <p className="text-ink-soft text-xs">
                  {new Date(o.createdAt).toLocaleDateString(locale)} · {statusText(o.status)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm">{formatPrice(o.total, locale)}</span>
                {o.accessToken && (
                  <Link
                    href={`/${locale}/bestellung/${o.accessToken}`}
                    className="tracking-nav hover:text-bronze text-xs font-semibold uppercase underline transition-colors"
                  >
                    {dict.account.showOrder}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <AbmeldeButton text={dict.account.signOut} />
      </div>
    </>
  )
}

function AbmeldeButton({ text }: { text: string }) {
  return (
    <form
      action={async () => {
        'use server'
        const speicher = await cookies()
        speicher.set(SITZUNGS_COOKIE, '', { path: '/', maxAge: 0 })
      }}
    >
      <button
        type="submit"
        className="tracking-nav text-ink-soft hover:text-bronze cursor-pointer text-xs font-semibold uppercase underline transition-colors"
      >
        {text}
      </button>
    </form>
  )
}
