import { headers as naechsteHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import React from 'react'

import { BueroAnmeldung } from '../../../../components/office/BueroAnmeldung'
import { payloadClient } from '../../../../lib/data'

export const dynamic = 'force-dynamic'

export default async function AnmeldeSeite({
  searchParams,
}: {
  searchParams: Promise<{ ziel?: string }>
}) {
  const { ziel } = await searchParams

  // Wer schon angemeldet ist, soll hier nicht hängen bleiben
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await naechsteHeaders() })
  if (user) redirect((user as { role?: string }).role === 'inhaber' ? '/office' : '/office/kein-zugang')

  return (
    <>
      <h1>Anmelden</h1>
      <p className="buero-unterzeile">Belege, Rechnungen, Inventar und Steuer-Export.</p>
      <BueroAnmeldung ziel={ziel && ziel.startsWith('/office') ? ziel : '/office'} />
    </>
  )
}
