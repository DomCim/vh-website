import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import {
  eigenerSchrittIndex,
  MARKEN_COOKIE,
  markenSitzung,
  markenSitzungLesen,
  kontaktKennung,
  sichtFuerDienstleister,
} from '../../../../../lib/laufmarken'
import { benachrichtige } from '../../../../../lib/push'
import { ipAus, zuVieleAnfragen } from '../../../../../lib/rateLimit'
import { passwortStimmt } from '../../../../../lib/uebergabe'
import { hatRecht } from '../../../../../lib/rechte'

export const dynamic = 'force-dynamic'

/**
 * Der Scan einer Laufmarke — eine Adresse, drei Sichten.
 *
 * Wer mit Büro-Konto kommt, wird zur Büro-Seite geschickt. Wer als Betrieb
 * angemeldet ist **und** am gekoppelten Auftrag einen Fremd-Schritt hat,
 * sieht genau diesen Schritt (die Whitelist steht in lib/laufmarken.ts).
 * Alle anderen sehen einen Satz — und zwar denselben Satz für eine echte
 * Marke, eine freie Marke und einen erfundenen Code: Wer eine Kennung errät,
 * soll nicht erfahren, ob es sie gibt (dasselbe Prinzip wie bei der
 * Übergabemappe).
 *
 * Geschrieben wird hier nur an zwei Stellen und nie mehr: `angekommenAm` und
 * `fertigGemeldetAm` am eigenen Schritt. **Nie der Stand, nie der
 * Auftragsstatus** — am Statuswechsel hängen die Kundenmails (Jobs.ts,
 * afterChange), und ein Scan des Verzinkers darf keine Kundenpost auslösen.
 */

type Payload = Awaited<ReturnType<typeof payloadClient>>

const GAST = { sicht: 'gast' as const }

/** Die Marke samt gekoppeltem Auftrag — `null`, wenn es nichts zu sehen gibt. */
async function markeMitAuftrag(payload: Payload, code: string) {
  if (!code || code.length > 20) return null
  const { docs } = await payload.find({
    collection: 'job-tags',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const marke = docs[0]
  if (!marke?.auftrag) return null
  const auftrag = await payload
    .findByID({
      collection: 'jobs',
      id: kontaktKennung(marke.auftrag) ?? 0,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if (!auftrag) return null
  return { marke, auftrag }
}

/** Die Bilder zu den Positionen — kleine Größe, eine Abfrage je Sammlung. */
async function positionsBilder(
  payload: Payload,
  artikelIds: number[],
): Promise<Map<number, string>> {
  const bilder = new Map<number, string>()
  const ids = [...new Set(artikelIds)].filter((n) => Number.isInteger(n) && n > 0)
  if (!ids.length) return bilder

  const { docs: produkte } = await payload.find({
    collection: 'products',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 0,
    overrideAccess: true,
  })
  const medienIds = new Map<number, number>()
  for (const p of produkte) {
    const erstes = Array.isArray(p.images) ? p.images[0] : null
    const medienId = kontaktKennung(erstes)
    if (medienId) medienIds.set(p.id, medienId)
  }
  if (!medienIds.size) return bilder

  const { docs: medien } = await payload.find({
    collection: 'media',
    where: { id: { in: [...medienIds.values()] } },
    limit: medienIds.size,
    depth: 0,
    overrideAccess: true,
  })
  for (const [produktId, medienId] of medienIds) {
    const m = medien.find((x) => x.id === medienId) as
      | { url?: string | null; sizes?: { card?: { url?: string | null } } }
      | undefined
    const url = m?.sizes?.card?.url ?? m?.url
    if (url) bilder.set(produktId, url)
  }
  return bilder
}

/** Die volle Dienstleister-Antwort — Whitelist plus aufgelöste Bilder. */
async function dienstleisterAntwort(
  payload: Payload,
  code: string,
  auftrag: { dueDate?: string | null; arbeitsplan?: unknown; positions?: unknown },
  kontaktId: number,
) {
  const sicht = sichtFuerDienstleister(auftrag as never, kontaktId)
  if (!sicht) return null
  const bilder = await positionsBilder(
    payload,
    sicht.positionen.map((p) => p.artikel ?? 0),
  )
  return {
    sicht: 'dienstleister' as const,
    marke: code,
    schritt: sicht.schritt,
    wunschtermin: sicht.wunschtermin,
    positionen: sicht.positionen.map((p) => ({
      beschreibung: p.beschreibung,
      menge: p.menge,
      farbe: p.farbe,
      bild: (p.artikel && bilder.get(p.artikel)) || null,
    })),
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const payload = await payloadClient()

    // 1. Büro-Konto? Dann entscheidet die Büro-Seite, was zu sehen ist.
    const { user } = await payload.auth({ headers: req.headers })
    if (user && hatRecht(user as never, 'buero.oeffnen')) {
      return NextResponse.json({ sicht: 'buero' })
    }

    // 2. Angemeldeter Betrieb mit eigenem Schritt an diesem Auftrag?
    const kontaktId = markenSitzungLesen((await cookies()).get(MARKEN_COOKIE)?.value)
    if (kontaktId) {
      const treffer = await markeMitAuftrag(payload, code)
      if (treffer) {
        const antwort = await dienstleisterAntwort(payload, code, treffer.auftrag, kontaktId)
        if (antwort) return NextResponse.json(antwort)
      }
      // Angemeldet, aber ohne Schritt an diesem Auftrag: exakt die Gast-Sicht
      // — ein fremder Betrieb erfährt nicht mehr als ein Unbekannter
    }

    // 3. Alle anderen — dieselbe Antwort für echte, freie und erfundene Codes
    return NextResponse.json(GAST)
  } catch (err) {
    console.error('Laufmarke lesen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const b = (await req.json()) as Record<string, unknown>
    const payload = await payloadClient()

    // ── Anmelden mit dem PIN des Betriebs ─────────────────────────────────
    if (b.aktion === 'anmelden') {
      /*
       * Zehn Versuche je Viertelstunde, gezählt an Code **und** Adresse —
       * dieselbe Bremse wie an der Übergabemappe. Acht Stellen aus 31
       * Zeichen sind rund 10^12 Möglichkeiten.
       */
      if (zuVieleAnfragen(`marke:${code}:${ipAus(req)}`, 10, 15 * 60 * 1000)) {
        return NextResponse.json({ error: 'zu-viele-versuche' }, { status: 429 })
      }

      const treffer = await markeMitAuftrag(payload, code)
      /*
       * Geprüft wird nur gegen die Betriebe, die an diesem Auftrag einen
       * Fremd-Schritt haben — nie gegen die ganze Kartei. Der PIN weist den
       * Betrieb nur im Zusammenhang der Marke aus; eine globale Suche wäre
       * eine scrypt-Schleife über alle Kontakte, und eine PIN-Kollision
       * zweier Betriebe würde zum Sicherheitsproblem statt zur Fußnote.
       */
      const kandidaten = treffer
        ? [
            ...new Set(
              ((treffer.auftrag.arbeitsplan ?? []) as { art?: string; dienstleister?: unknown }[])
                .filter((s) => s.art === 'fremd')
                .map((s) => kontaktKennung(s.dienstleister))
                .filter((n): n is number => n !== null),
            ),
          ]
        : []

      const pin = String(b.pin ?? '')
      for (const kontaktId of kandidaten) {
        const kontakt = await payload
          .findByID({ collection: 'contacts', id: kontaktId, depth: 0, overrideAccess: true })
          .catch(() => null)
        if (kontakt && passwortStimmt(pin, kontakt.markenZugang?.pin)) {
          const antwort = await dienstleisterAntwort(payload, code, treffer!.auftrag, kontaktId)
          if (!antwort) break
          const sitzung = markenSitzung(kontaktId)
          const res = NextResponse.json(antwort)
          res.cookies.set(sitzung.name, sitzung.wert, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: sitzung.maxAge,
            path: '/',
          })
          return res
        }
      }

      // Ein Fehlertext für „Code gibt es nicht", „Marke frei", „PIN falsch"
      // und „Betrieb gehört nicht zu diesem Auftrag" — siehe Kopfkommentar
      return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })
    }

    // ── Der Betrieb meldet: angekommen / fertig ───────────────────────────
    if (b.aktion === 'angekommen' || b.aktion === 'fertig') {
      const kontaktId = markenSitzungLesen((await cookies()).get(MARKEN_COOKIE)?.value)
      if (!kontaktId) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })

      const treffer = await markeMitAuftrag(payload, code)
      if (!treffer) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })

      const plan = (treffer.auftrag.arbeitsplan ?? []) as Record<string, unknown>[]
      const index = eigenerSchrittIndex({ arbeitsplan: plan as never }, kontaktId)
      if (index < 0) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })

      const feld = b.aktion === 'angekommen' ? 'angekommenAm' : 'fertigGemeldetAm'
      /*
       * Genau ein Zeitstempel, einmal erzeugt: Derselbe Plan wird geschrieben
       * **und** zurückgegeben. Zwei `new Date()` an zwei Stellen lieferten dem
       * ersten Aufruf eine andere Zeit, als gespeichert war — Millisekunden
       * nur, aber genug, dass „idempotent" gelogen gewesen wäre.
       */
      let neuerPlan = plan
      // Schon gemeldet? Dann ist nichts zu tun — ein Doppel-Scan ändert nichts
      if (!plan[index][feld]) {
        neuerPlan = plan.map((s, i) =>
          i === index ? { ...s, [feld]: new Date().toISOString() } : s,
        )
        /*
         * Lesen–Ändern–Schreiben der ganzen Liste, jede Zeile mit ihrer
         * Kennung: So behält Payload alle Felder, die hier nicht stehen.
         * Geschrieben wird genau ein Zeitstempel — nie `stand`, nie der
         * Auftragsstatus (Kundenmails!).
         */
        await payload.update({
          collection: 'jobs',
          id: treffer.auftrag.id,
          overrideAccess: true,
          data: { arbeitsplan: neuerPlan as never },
        })

        if (b.aktion === 'fertig') {
          const kontakt = await payload
            .findByID({ collection: 'contacts', id: kontaktId, depth: 0, overrideAccess: true })
            .catch(() => null)
          await benachrichtige(payload, {
            titel: `${kontakt?.name ?? 'Ein Betrieb'} meldet fertig`,
            text: `${code} kann abgeholt werden.`,
            url: `/office/marke/${code}`,
            tag: `marke-${code}`,
          }).catch(() => undefined)
        }
      }

      const antwort = await dienstleisterAntwort(
        payload,
        code,
        { ...treffer.auftrag, arbeitsplan: neuerPlan as never },
        kontaktId,
      )
      return NextResponse.json(antwort ?? GAST)
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Laufmarken-Aktion fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
