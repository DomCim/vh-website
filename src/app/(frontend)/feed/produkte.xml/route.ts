import { NextResponse } from 'next/server'

import { bildQuellen, type BildQuelle } from '../../../../components/Bild'
import { aktionFuerArtikel, mitRabatt, type Preisaktion } from '../../../../lib/aktionspreis'
import { payloadClient } from '../../../../lib/data'
import { type Locale, locales } from '../../../../lib/i18n'
import { laufendeAktionen } from '../../../../lib/promotions'
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
 * **Warum eine Adresse und kein Hochladen von Hand.** Was hier steht, kommt
 * bei jedem Abruf aus der Datenbank: Preisänderung, neues Bild, ausverkauft —
 * beim nächsten Abruf stimmt es. Google holt sich die Adresse nach einem
 * eingestellten Takt selbst. Eine Tabelle, die jemand pflegt, ist am zweiten
 * Tag falsch.
 *
 * **Was Google verlangt.** Kennung, Titel, Beschreibung, Link, Bild,
 * Verfügbarkeit und Preis sind Pflicht. Eine EAN oder Herstellernummer gibt es
 * bei Einzelanfertigung nicht; `identifier_exists: no` sagt das ausdrücklich,
 * sonst weist Google die Ware zurück.
 *
 * **Der Versand steht mit drin** — für Frankreich, Deutschland und Österreich,
 * mit derselben Zahl, die auch die Kasse berechnet. Ohne Versandangabe weist
 * Google für ein Zielland alle Artikel ab.
 *
 * **Was draußen bleibt:** Stücke auf Anfrage und alles ohne Bild. Ein Eintrag
 * ohne Preis ist im Merchant Center kein Eintrag, sondern ein Fehler — und ein
 * erfundener Preis wäre schlimmer als kein Eintrag.
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

/**
 * Der Zeitraum einer Aktion, wie Google ihn erwartet: zwei Zeitpunkte, durch
 * einen Schrägstrich getrennt. Der Beginn liegt bewusst in der Vergangenheit —
 * die Aktion läuft ja bereits, sonst stünde sie hier nicht.
 */
const zeitraum = (aktion: Preisaktion) =>
  `${new Date(Date.now() - 60_000).toISOString().replace(/\.\d+Z$/, 'Z')}/${new Date(
    aktion.giltBis,
  )
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')}`

/**
 * Für diese Länder steht der Versand im Feed.
 *
 * **Warum überhaupt im Feed und nicht im Merchant Center.** Google nimmt
 * beides — eine Regel im Konto oder die Angabe je Stück. Fehlt für ein
 * Zielland aber beides, weist es dort **alle** Artikel ab, nicht einzelne.
 * Die Angabe hier kommt aus derselben Zahl, die auch die Kasse berechnet;
 * eine Regel im Konto wäre eine zweite Quelle für dieselbe Wahrheit, und die
 * beiden laufen früher oder später auseinander.
 *
 * **Warum dieselbe Zahl für alle drei Länder.** Weil der Shop es so hält: In
 * `lib/checkout.ts` ist der Versand ein fester Betrag je Stück, ohne Blick
 * auf die Anschrift. Wer in München bestellt, zahlt denselben Versand wie
 * jemand in Straßburg. Google verlangt, dass die Angabe im Feed dem
 * entspricht, was an der Kasse wirklich verlangt wird — und genau das tut
 * sie damit.
 *
 * Daran hängt auch, warum eine Frachtberechnung über DHL hier **nicht**
 * hilft: Sie käme auf einen anderen Betrag als die Kasse, und die Abweichung
 * ist genau das, was Google beanstandet.
 *
 * Wer die Liste erweitert, prüft zweierlei: Wird dorthin wirklich geliefert,
 * und stimmt die Währung? Der Feed rechnet ausschließlich in Euro — für
 * Polen, Schweden oder die Schweiz wäre er falsch.
 */
const VERSANDLAENDER = ['FR', 'DE', 'AT'] as const

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

  /*
   * Läuft eine Aktion, gehört sie in den Feed — sonst steht bei Google ein
   * anderer Preis als auf der Seite, und genau daran nimmt das Merchant
   * Center Anstoß („Preisabweichung"). Google kennt dafür ein eigenes Feld:
   * `g:price` bleibt der reguläre Preis, `g:sale_price` ist der Aktionspreis.
   * Ihn einfach in `g:price` zu schreiben wäre schlechter — dann fiele der
   * durchgestrichene Preis im Shopping-Ergebnis weg, und der ist der halbe
   * Grund für eine Aktion.
   */
  const aktionen = await laufendeAktionen(payload, locale)

  const eintraege: string[] = []

  for (const p of docs as unknown as Record<string, any>[]) {
    const kategorie = typeof p.category === 'object' ? p.category : null
    const aktion = aktionFuerArtikel({ id: p.id, categoryId: kategorie?.id ?? p.category }, aktionen)
    const pfad = `/${locale}/${kategorie?.slug ?? 'kollektion'}/${p.slug}`
    /*
     * Der Zuschnitt und nicht das Original.
     *
     * Die hochgeladenen Dateien sind Archivware: Das Foto des Coeur wiegt
     * 5,9 MB, der Kübel 3,1 MB. Payload legt daneben WebP-Fassungen an, und
     * `large` hat dieselbe Auflösung bei einem Bruchteil der Größe — beim
     * Coeur 122 KB statt 5,9 MB. Google lädt jedes Bild im Feed herunter, und
     * zwar wieder und wieder; das Original hinauszureichen kostet Bandbreite
     * auf beiden Seiten und bringt kein einziges Pixel mehr.
     *
     * Gibt es keinen Zuschnitt — bei Bildern, die vor der Größenstaffelung
     * hochgeladen wurden —, nimmt `bildQuellen` die größte vorhandene Fassung
     * und zur Not das Original. Ein Eintrag ohne Bild wäre der schlechteste
     * Ausgang von allen.
     */
    const bild = Array.isArray(p.images) ? p.images[0] : null
    const gewaehlt = bildQuellen(bild as BildQuelle, 'large')?.src
    const bildUrl = absoluteUrl(gewaehlt ?? (typeof bild === 'object' ? bild?.url : undefined))
    // Ohne Bild kein Eintrag — Google nimmt ihn ohnehin nicht an
    if (!bildUrl) continue

    /*
     * Jede Variante ist ein eigener Eintrag.
     *
     * Ein Kübel in 100 × 50 kostet anderes als derselbe in 60 × 30; ein
     * einzelner Eintrag „ab 1.490 €" wäre ein falscher Preis, und falsche
     * Preise sperrt Google. `item_group_id` hält die Varianten trotzdem als
     * eine Familie zusammen — im Ergebnis stehen sie dann nebeneinander und
     * nicht als vier fremde Stücke.
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
      /*
       * `||` und nicht `??` — an echten Daten aufgefallen.
       *
       * Payload legt für ein Textfeld, das nie ausgefüllt wurde, eine leere
       * Zeichenkette an und nicht `null`. Mit `??` kam die leere Zeichenkette
       * durch, und im Feed stand `<g:description></g:description>`. Google
       * verlangt eine Beschreibung und weist den Eintrag sonst ab — es waren
       * auf Anhieb 7 von 19 Stücken, und gemerkt hätte man es erst an einer
       * roten Datenquelle im Merchant Center.
       *
       * Der Titel ist dabei die Notlösung und keine gute Beschreibung. Wo er
       * einspringt, gehört im Büro eine Kurzbeschreibung nachgetragen: Sie
       * steht nicht nur hier, sondern auch auf der Artikelseite.
       */
      const beschreibung = String(p.shortDescription || p.title || '').slice(0, 5000)
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
          ...(aktion
            ? [
                `<g:sale_price>${preis(mitRabatt(v.wert, aktion.prozent))}</g:sale_price>`,
                `<g:sale_price_effective_date>${zeitraum(aktion)}</g:sale_price_effective_date>`,
              ]
            : []),
          '<g:condition>new</g:condition>',
          '<g:identifier_exists>no</g:identifier_exists>',
          '<g:brand>Vincent Hellmann</g:brand>',
          /*
           * Auch die Null steht ausdrücklich da.
           *
           * Ist am Stück kein Versand hinterlegt, schlägt die Kasse nichts
           * auf — es ist also versandkostenfrei und keine fehlende Angabe.
           * Ließe man den Block weg, sucht Google die Zahl in den
           * Kontoeinstellungen und findet dort nichts.
           */
          ...VERSANDLAENDER.map(
            (land) =>
              `<g:shipping><g:country>${land}</g:country><g:price>${preis(typeof p.shippingCost === 'number' ? p.shippingCost : 0)}</g:price></g:shipping>`,
          ),
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
      // Google holt den Feed nach eigenem Takt; eine Stunde Zwischenspeicher
      // genügt und hält neugierige Abrufe vom Rechnen ab
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
