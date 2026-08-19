'use client'

import { useParams } from 'next/navigation'
import React from 'react'

import { BelegFormular } from '../../../../../components/office/BelegFormular'
import { useAbgleich, useDatensatz, useRahmen } from '../../../../../lib/buero/bestand'
import { AUSGABEN_KATEGORIEN } from '../../../../../lib/listen'

/**
 * Ein Beleg zum Bearbeiten — aus dem Bestand im Gerät.
 *
 * Die Kennung steht in der Adresse, alles Übrige liegt schon da. Damit lässt
 * sich ein Beleg auch dann öffnen, wenn gerade kein Netz vorhanden ist; nur
 * der Scan selbst braucht eine Leitung, denn der liegt als Datei auf dem
 * Server.
 */

type Beleg = {
  id: number | string
  title?: string | null
  document?: number | string | null
  [feld: string]: unknown
}

type Medium = { id: number | string; url?: string | null }

export function BelegAnsicht() {
  const { id } = useParams<{ id: string }>()
  const beleg = useDatensatz<Beleg>('belege', id)
  const dokumentId = beleg?.document ?? null
  const medium = useDatensatz<Medium>('medien', dokumentId ?? undefined)
  const { kiVerfuegbar } = useRahmen()
  const { bereit } = useAbgleich()

  if (!beleg) {
    return (
      <>
        <h1>Beleg</h1>
        <div className="buero-leer">
          {bereit ? 'Diesen Beleg gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  return (
    <>
      <h1>{(beleg.title as string) || 'Beleg'}</h1>
      <p className="buero-unterzeile">Änderungen wirken sich auf den Steuer-Export aus.</p>
      <BelegFormular
        werte={{
          id: beleg.id,
          title: beleg.title as string,
          supplierName: beleg.supplierName as string,
          invoiceNumber: beleg.invoiceNumber as string,
          invoiceDate: beleg.invoiceDate as string,
          dueDate: beleg.dueDate as string,
          netAmount: beleg.netAmount as number,
          vatRate: beleg.vatRate as number,
          vatAmount: beleg.vatAmount as number,
          grossAmount: beleg.grossAmount as number,
          category: beleg.category as string,
          paymentMethod: beleg.paymentMethod as string,
          paid: (beleg.paid as boolean) ?? true,
          deductible: (beleg.deductible as boolean) ?? true,
          notes: beleg.notes as string,
          documentId: typeof dokumentId === 'number' ? dokumentId : Number(dokumentId) || null,
          documentUrl: medium?.url ?? null,
          extraction: beleg.extraction as never,
        }}
        kategorien={[...AUSGABEN_KATEGORIEN]}
        kiVerfuegbar={kiVerfuegbar}
      />
    </>
  )
}
