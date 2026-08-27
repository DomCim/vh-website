import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/** Ein Schritt, wie ihn das Formular schickt — die Vorlagenform ohne Stand */
type Ablaufschritt = {
  was?: string
  art?: string
  minuten?: number | string | null
  dienstleister?: number | string | null
  kosten?: number | string | null
  vorlaufTage?: number | string | null
  notiz?: string
}

/*
 * Die Säuberung des Ablaufs — dieselbe wie in der Auftrags-Route, nur ohne
 * `stand` und `erledigtAm`: Eine Vorlage kennt keinen Stand, den bekommt erst
 * die Abschrift am Auftrag.
 */
const sauberAblauf = (schritte: Ablaufschritt[] | undefined) =>
  (schritte ?? [])
    .filter((s) => s.was?.trim())
    .map((s) => ({
      was: s.was as string,
      art: (s.art === 'fremd' ? 'fremd' : 'eigen') as 'eigen' | 'fremd',
      minuten: s.minuten === '' || s.minuten == null ? null : Number(s.minuten) || 0,
      dienstleister: Number(s.dienstleister) || undefined,
      kosten: s.kosten === '' || s.kosten == null ? null : Number(s.kosten) || 0,
      vorlaufTage: s.vorlaufTage === '' || s.vorlaufTage == null ? null : Number(s.vorlaufTage) || 0,
      notiz: s.notiz || undefined,
    }))

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
      /** Der Ablauf als Vorlage am Artikel — ohne Stand, den kennt nur der Auftrag */
      ablauf?: Ablaufschritt[]
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
        ablauf?: Ablaufschritt[]
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
          /*
           * Die Kennung ist die Lebensversicherung dieser Abschrift: Mit ihr
           * behält Payload alle Unterfelder der Zeile, die hier nicht stehen
           * (nachgemessen 08/2026 — Bild und Ablauf überleben). Ohne sie
           * entstünden neue Zeilen, und alles Ungenannte wäre weg.
           */
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
          // Nur anfassen, wenn das Formular ihn mitschickt — ein älteres
          // Formular im Gerät kennt das Feld nicht und darf nichts leeren
          ...(neu && neu.ablauf !== undefined ? { arbeitsplan: sauberAblauf(neu.ablauf) } : {}),
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
        // Wie bei den Varianten: nur anfassen, wenn mitgeschickt
        ...(b.ablauf !== undefined ? { arbeitsplan: sauberAblauf(b.ablauf) } : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Stückliste speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
