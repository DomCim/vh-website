import React from 'react'

import { AUSGABEN_KATEGORIEN } from '../../../../../collections/Expenses'
import { BelegFormular } from '../../../../../components/office/BelegFormular'
import { payloadClient } from '../../../../../lib/data'
import { kiZugang } from '../../../../../lib/ki'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function NeuerBeleg() {
  await bueroBenutzer()
  const payload = await payloadClient()
  const ki = await kiZugang(payload)

  return (
    <>
      <h1>Beleg erfassen</h1>
      <p className="buero-unterzeile">
        Beleg fotografieren, kurz prüfen, speichern. Der Scan bleibt am Eintrag hängen.
      </p>
      <BelegFormular
        werte={{ invoiceDate: new Date().toISOString().slice(0, 10) }}
        kategorien={[...AUSGABEN_KATEGORIEN]}
        kiVerfuegbar={Boolean(ki)}
      />
    </>
  )
}
