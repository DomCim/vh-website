import React from 'react'

import { NewsletterVersand } from '../../../../components/office/NewsletterVersand'
import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

const BASIS = (process.env.NEXT_PUBLIC_SERVER_URL || 'https://www.vincent-hellmann.com').replace(
  /\/$/,
  '',
)

export default async function NewsletterSeite() {
  const benutzer = await bueroBenutzer()
  const payload = await payloadClient()

  const [bestaetigt, offen, abgemeldet, news] = await Promise.all([
    payload.count({
      collection: 'newsletter-subscribers',
      where: { status: { equals: 'bestaetigt' } },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'newsletter-subscribers',
      where: { status: { equals: 'offen' } },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'newsletter-subscribers',
      where: { status: { equals: 'abgemeldet' } },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'news',
      sort: '-publishedDate',
      limit: 10,
      depth: 0,
      locale: 'de',
      overrideAccess: true,
    }),
  ])

  const beitraege = news.docs.map((b) => ({
    id: b.id,
    titel: b.title ?? 'ohne Titel',
    auszug: b.excerpt ?? '',
    link: `${BASIS}/de/news/${b.slug}`,
  }))

  return (
    <>
      <h1>Newsletter</h1>
      <p className="buero-unterzeile">
        {bestaetigt.totalDocs} bestätigt · {offen.totalDocs} noch nicht bestätigt ·{' '}
        {abgemeldet.totalDocs} abgemeldet
      </p>

      {bestaetigt.totalDocs === 0 ? (
        <div className="buero-hinweis">
          Noch niemand auf der Liste. Die Anmeldung steht im Fuß jeder Seite der Website — bis
          jemand bestätigt hat, geht hier nichts raus.
        </div>
      ) : (
        <div className="buero-hinweis">
          Ein Newsletter lässt sich nicht zurückholen. Erst den Testversand ansehen, dann losschicken.
        </div>
      )}

      <NewsletterVersand
        beitraege={beitraege}
        empfaenger={bestaetigt.totalDocs}
        eigeneAdresse={benutzer.email}
      />
    </>
  )
}
