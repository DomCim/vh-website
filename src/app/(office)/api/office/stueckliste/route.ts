import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Stückliste und Dienstleister eines Artikels speichern.
 *
 * Der Artikel selbst wird in der Website-Verwaltung gepflegt — hier geht es
 * nur um Materialbedarf und Fremdleistung, die ins Büro gehören.
 *
 * Dazu die Listen der Varianten. Die stehen in derselben Sammlung wie Titel
 * und Preis, und die dürfen dabei nicht verlorengehen: Geschrieben wird
 * deshalb die vorhandene Variantenzeile, ergänzt um Liste und Minuten — und
 * ausdrücklich in der Sprache des Hauses, damit die französische und die
 * englische Bezeichnung unangetastet bleiben.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'website.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      produktId?: number
      zeilen?: { item?: number; quantity?: number; note?: string }[]
      dienstleister?: {
        contact?: number
        service?: string
        cost?: number
        leadTime?: string
        note?: string
      }[]
      arbeitsminuten?: number
      varianten?: {
        id?: string
        zeilen?: { item?: number; quantity?: number; note?: string }[]
        minuten?: number | null
        dienstleister?: {
          contact?: number
          service?: string
          cost?: number
          leadTime?: string
          note?: string
        }[]
      }[]
    }
    if (!b.produktId) return NextResponse.json({ error: 'produktId fehlt' }, { status: 400 })

    const sauber = (zeilen: { item?: number; quantity?: number; note?: string }[] | undefined) =>
      (zeilen ?? [])
        .filter((z) => z.item && z.quantity)
        .map((z) => ({ item: z.item as number, quantity: z.quantity as number, note: z.note }))

    const sauberDienste = (
      dienste:
        | { contact?: number; service?: string; cost?: number; leadTime?: string; note?: string }[]
        | undefined,
    ) =>
      (dienste ?? [])
        .filter((d) => d.contact && d.service?.trim())
        .map((d) => ({
          contact: d.contact as number,
          service: d.service as string,
          cost: d.cost,
          leadTime: d.leadTime,
          note: d.note,
        }))

    /*
     * Varianten nur anfassen, wenn welche mitgeschickt wurden. Ein Formular,
     * das sie nicht kennt (ältere Fassung im Gerät), soll sie nicht leeren.
     */
    let varianten: Record<string, unknown>[] | undefined
    if (b.varianten?.length) {
      const produkt = await payload.findByID({
        collection: 'products',
        id: b.produktId,
        depth: 0,
        locale: 'de',
        overrideAccess: true,
      })
      varianten = (produkt?.variants ?? []).map((v) => {
        const neu = b.varianten!.find((x) => x.id && String(x.id) === String(v.id))
        return {
          id: v.id,
          title: v.title,
          price: v.price,
          billOfMaterials: neu ? sauber(neu.zeilen) : (v.billOfMaterials ?? []),
          serviceProviders: neu ? sauberDienste(neu.dienstleister) : (v.serviceProviders ?? []),
          productionMinutes: neu
            ? neu.minuten
              ? Math.max(0, Math.round(neu.minuten))
              : null
            : (v.productionMinutes ?? null),
        }
      })
    }

    await payload.update({
      collection: 'products',
      id: b.produktId,
      overrideAccess: true,
      locale: 'de',
      data: {
        ...(varianten ? { variants: varianten as never } : {}),
        productionMinutes:
          typeof b.arbeitsminuten === 'number' ? Math.max(0, Math.round(b.arbeitsminuten)) : undefined,
        billOfMaterials: sauber(b.zeilen),
        serviceProviders: sauberDienste(b.dienstleister),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Stückliste speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
