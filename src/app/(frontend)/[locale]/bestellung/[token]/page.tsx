import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Bestellstand, type BestellungAnsicht } from '../../../../../components/shop/Bestellstand'
import { GoogleBewertung } from '../../../../../components/shop/GoogleBewertung'
import { payloadClient } from '../../../../../lib/data'
import { bewertungsDaten } from '../../../../../lib/googleBewertung'
import { isLocale, t } from '../../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

/**
 * Bestellstatus ohne Anmeldung — erreichbar über den Link aus der
 * Bestellbestätigung. Der Schlüssel ist nicht verbrauchbar, ein Vorab-Aufruf
 * durch Outlook Safe Links schadet also nicht.
 */
export default async function BestellStatusSeite({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'orders',
    where: { accessToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const bestellung = docs[0]

  /*
   * Wer auf Rechnung bestellt, landet hier statt auf der Danke-Seite — für
   * ihn ist das die Bestätigungsseite. Also gehört die Frage nach der
   * Bewertung auch hierhin, sonst fehlte die Hälfte der Bestellungen.
   */
  const bewertung = await bewertungsDaten(payload, bestellung as never)

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
      <h1 className="tracking-nav text-ink text-2xl font-semibold uppercase">
        {dict.orderStatus.title}
      </h1>

      {!bestellung ? (
        <p className="text-ink-soft mt-6">{dict.orderStatus.notFound}</p>
      ) : (
        <>
          <p className="text-ink-soft mt-2 text-sm">
            {dict.account.orderNumber} {bestellung.orderNumber}
          </p>
          <div className="mt-8">
            <Bestellstand
              bestellung={bestellung as unknown as BestellungAnsicht}
              locale={locale}
              labels={dict.orderStatus}
            />
          </div>
          {bewertung && (
            <GoogleBewertung
              daten={bewertung}
              labels={{
                title: dict.thanks.reviewTitle,
                text: dict.thanks.reviewText,
                button: dict.thanks.reviewButton,
                loading: dict.thanks.reviewLoading,
                error: dict.thanks.reviewError,
              }}
            />
          )}

          <Link
            href={`/${locale}/konto`}
            className="text-ink-soft hover:text-bronze mt-10 inline-block text-sm underline transition-colors"
          >
            {dict.orderStatus.allOrders}
          </Link>
        </>
      )}
    </div>
  )
}
