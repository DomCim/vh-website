import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { locales, type Locale } from '../../../../lib/i18n'
import { absoluteUrl, BASE_URL } from '../../../../lib/seo'

export const dynamic = 'force-dynamic'

/**
 * Der Produktdatenfeed für das Google Merchant Center.
 *
 * **Warum das mehr ist als noch eine Datei.** Wer sein Sortiment dort
 * hinterlegt, erscheint in den kostenlosen Einträgen von Google Shopping —
 * ohne Anzeigenbudget, mit Bild, Preis und Verfügbarkeit. Für einen Betrieb
 * mit wenigen, teuren Stücken ist das die Sorte Reichweite, die man sonst
 * nicht bekommt: Wer „Pflanzkübel Stahl 100 cm" sucht, sieht das Stück, statt
 * es zu suchen.
 *
 * **Warum eine Datei und kein Hochladen von Hand.** Ein Feed aus der Datenbank
 * ist immer richtig: Preisänderung, neues Bild, ausverkauft — Google holt sich
 * die Datei täglich selbst. Eine Tabelle, die jemand pflegt, ist am zweiten
 * Tag falsch.
 *
 * **Was Google verlangt.** Kennung, Titel, Beschreibung, Link, Bild,
 * Verfügbarkeit und Preis sind Pflicht. Eine EAN oder Herstellernummer gibt es
 * bei Einzelanfertigung nicht; `identifier_exists: no` sagt das ausdrücklich,
 * sonst weist Google die Ware zurück.
 *
 * **Was draußen bleibt:** Stücke auf Anfrage. Ein Eintrag ohne Preis ist im
 * Merchant Center kein Eintrag, sondern ein Fehler — und ein erfundener Preis
 * wäre schlimmer als kein Eintrag.
 *
 * Aufruf: `/feed/produkte.xml`, für die französische Fassung `?sprache=fr`.
 */

const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Google will „1490.00 EUR" — Punkt statt Komma, Währung dahinter */
const preis = (wert: number) => `${wert.toFixed(2)} EUR`

export async function GET(req: Request) {
  const gewuenscht = new URL(req.url).searchParams.get('sprache')
  const locale: Locale = (locales as readonly string[]).includes(String(gewuenscht))
    ? (gewuenscht as Locale)
    : 'de'

  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'products',
    where: { onRequestOnly: { not_equals: true } },
    limit: 500,
    depth: 1,
    locale,
    overrideAccess: true,
  })

  const eintraege: string[] = []

  for (const p of docs as unknown as Record<string, any>[]) {
    const kategorie = typeof p.category === 'object' ? p.category : null
    const pfad = `/${locale}/${kategorie?.slug ?? 'kollektion'}/${p.slug}`
    const bild = Array.isArray(p.images) ? p.images[0] : null
    const bildUrl = absoluteUrl(typeof bild === 'object' ? bild?.url : undefined)
    // Ohne Bild kein Eintrag — Google nimmt ihn ohnehin nicht an
    if (!bildUrl) continue

    /*
     * Jede Variante ist ein eigener Eintrag.
     *
     * Ein Kübel in 100 × 50 kostet anderes als derselbe in 60 × 30; ein
     * einzelner Eintrag „ab 1.490 €" wäre ein falscher Preis, und falsche
     * Preise sperrt Google. `item_group_id` hält die Varianten trotzdem als
     * eine Familie zusammen.
     */
    const varianten: { id: string; titel: string; wert: number }[] =
      Array.isArray(p.variants) && p.variants.length
        ? p.variants
            .filter((v: any) => typeof v.price === 'number')
            .map((v: any) => ({
              id: `${p.id}-${String(v.id ?? v.title).replace(/[^\w-]+/g, '')}`,
              titel: `${p.title} — ${v.title}`,
              wert: v.price as number,
            }))
        : typeof p.price === 'number'
          ? [{ id: String(p.id), titel: String(p.title), wert: p.price as number }]
          : []

    for (const v of varianten) {
      const beschreibung = String(p.shortDescription ?? p.title ?? '').slice(0, 5000)
      eintraege.push(
        [
          '<item>',
          `<g:id>${escape(v.id)}</g:id>`,
          ...(varianten.length > 1
            ? [`<g:item_group_id>${escape(String(p.id))}</g:item_group_id>`]
            : []),
          `<g:title>${escape(v.titel)}</g:title>`,
          `<g:description>${escape(beschreibung)}</g:description>`,
          `<g:link>${escape(`${BASE_URL}${pfad}`)}</g:link>`,
          `<g:image_link>${escape(bildUrl)}</g:image_link>`,
          `<g:availability>${p.available === false ? 'out_of_stock' : 'in_stock'}</g:availability>`,
          `<g:price>${preis(v.wert)}</g:price>`,
          '<g:condition>new</g:condition>',
          '<g:identifier_exists>no</g:identifier_exists>',
          '<g:brand>Vincent Hellmann</g:brand>',
          ...(typeof p.shippingCost === 'number'
            ? [
                `<g:shipping><g:country>FR</g:country><g:price>${preis(p.shippingCost)}</g:price></g:shipping>`,
              ]
            : []),
          '</item>',
        ].join(''),
      )
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Vincent Hellmann</title>
<link>${BASE_URL}/${locale}</link>
<description>Stahlmöbel und Objekte aus eigener Werkstatt</description>
${eintraege.join('\n')}
</channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Google holt den Feed täglich; eine Stunde Zwischenspeicher genügt
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
