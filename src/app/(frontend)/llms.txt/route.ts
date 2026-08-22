import { payloadClient } from '../../../lib/data'
import { type Locale, locales } from '../../../lib/i18n'
import { BASE_URL } from '../../../lib/seo'

export const dynamic = 'force-dynamic'

/**
 * `llms.txt` — die Seite, wie ein Sprachmodell sie am liebsten läse.
 *
 * **Das Problem, das sie löst.** Wenn ChatGPT, Claude oder Perplexity nach
 * „Stahlmöbel Elsass" gefragt werden, holen sie sich Seiten und lesen sie.
 * Was sie dabei bekommen, ist unser HTML: Navigation, Cookie-Hinweise,
 * Bildergalerien, Formulare — und irgendwo dazwischen die drei Sätze, auf die
 * es ankommt. Je mehr Beiwerk, desto größer die Gefahr, dass das Wesentliche
 * unter den Tisch fällt oder falsch zusammengesetzt wird.
 *
 * `llms.txt` ist die Antwort darauf: eine einzige Adresse, unter der in
 * schlichtem Text steht, wer wir sind, was wir machen und wo was zu finden
 * ist. Kein Beiwerk, keine Auszeichnung außer Überschriften und Listen.
 *
 * **Ehrlich zum Stand:** Das ist ein Vorschlag von 2024 und keine Norm, an die
 * sich schon alle halten. Es kostet uns eine gerechnete Antwort und keine
 * Pflege — und wenn es sich durchsetzt, stehen wir da, wo wir hingehören.
 * Setzt es sich nicht durch, haben wir eine Datei, die niemandem schadet.
 *
 * **Warum aus der Datenbank und nicht von Hand.** Eine gepflegte Textdatei
 * wäre nach dem zweiten neuen Artikel falsch. Was hier steht, ist der Stand
 * von eben — Kategorien, lieferbare Stücke, die letzten Beiträge, die häufigen
 * Fragen.
 */

/** Zeilenumbrüche zerlegen die Liste — für den Fließtext hier unerwünscht */
const einzeilig = (text: unknown, grenze = 200) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, grenze)

export async function GET(req: Request) {
  const gewuenscht = new URL(req.url).searchParams.get('sprache')
  const locale: Locale = (locales as readonly string[]).includes(String(gewuenscht))
    ? (gewuenscht as Locale)
    : 'de'
  const url = (pfad: string) => `${BASE_URL}/${locale}${pfad}`

  const payload = await payloadClient()
  const [einstellungen, kategorien, artikel, beitraege, referenzen] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', locale, depth: 0 }),
    payload.find({ collection: 'categories', limit: 200, depth: 0, locale, sort: 'order' }),
    payload.find({
      collection: 'products',
      where: { available: { equals: true } },
      limit: 200,
      depth: 1,
      locale,
    }),
    payload.find({
      collection: 'news',
      where: { _status: { equals: 'published' } },
      limit: 20,
      depth: 0,
      locale,
      sort: '-publishedDate',
    }),
    payload.find({ collection: 'projects', limit: 20, depth: 0, locale, sort: '-year' }),
  ])

  const s = einstellungen as unknown as Record<string, any>
  const name = s.siteName || 'Vincent Hellmann'
  const zeilen: string[] = []

  zeilen.push(`# ${name}`, '')
  if (s.tagline) zeilen.push(`> ${einzeilig(s.tagline, 300)}`, '')

  /*
   * Der Absatz, den ein Modell zitiert, wenn es nur einen zitiert. Er steht
   * deshalb vor allen Listen und sagt das Handfeste: was, für wen, von wo.
   */
  zeilen.push(
    'Werkstatt für Stahlmöbel, Objekte und Maßanfertigungen. Jedes Stück entsteht ' +
      'einzeln in eigener Fertigung — Konstruktion, Zuschnitt, Schweißen und ' +
      'Beschichtung aus einer Hand. Geliefert wird nach Frankreich, Deutschland und ' +
      'in die angrenzenden Länder.',
    '',
  )

  const kontakt: string[] = []
  if (s.contact?.email) kontakt.push(`E-Mail: ${s.contact.email}`)
  if (s.contact?.phone) kontakt.push(`Telefon: ${s.contact.phone}`)
  if (s.contact?.address) kontakt.push(`Anschrift: ${einzeilig(s.contact.address)}`)
  if (kontakt.length) zeilen.push(`Kontakt: ${kontakt.join(' · ')}`, '')

  zeilen.push(
    `Sprachen: Deutsch (${BASE_URL}/de), Französisch (${BASE_URL}/fr), Englisch (${BASE_URL}/en). ` +
      `Diese Datei gibt es je Sprache: ${BASE_URL}/llms.txt?sprache=fr`,
    '',
  )

  zeilen.push('## Seiten', '')
  zeilen.push(`- [Startseite](${url('')}): Werkstatt, Sortiment und aktuelle Stücke.`)
  zeilen.push(
    `- [Maßanfertigung](${url('/massanfertigung')}): Wie ein Auftrag abläuft, von der Idee bis zur Lieferung — mit den häufigen Fragen.`,
  )
  zeilen.push(`- [Über uns](${url('/ueber-uns')}): Werkstatt, Werdegang und Arbeitsweise.`)
  zeilen.push(`- [Referenzen](${url('/projekte')}): Ausgeführte Arbeiten mit Bildern.`)
  zeilen.push(`- [News](${url('/news')}): Beiträge aus der Werkstatt und Ratgeber.`)
  zeilen.push(`- [Kontakt](${url('/kontakt')}): Anfrage, Anschrift und Anfahrt.`)
  zeilen.push('')

  if (kategorien.docs.length) {
    zeilen.push('## Sortiment', '')
    for (const k of kategorien.docs as unknown as Record<string, any>[]) {
      const beschreibung = einzeilig(k.description)
      zeilen.push(`- [${k.name}](${url(`/${k.slug}`)})${beschreibung ? `: ${beschreibung}` : ''}`)
    }
    zeilen.push('')
  }

  if (artikel.docs.length) {
    zeilen.push('## Lieferbare Stücke', '')
    for (const a of artikel.docs as unknown as Record<string, any>[]) {
      const kategorie = typeof a.category === 'object' ? a.category?.slug : undefined
      if (!kategorie) continue
      const preis =
        typeof a.price === 'number' && !a.onRequestOnly
          ? ` (ab ${a.price.toLocaleString('de-DE')} €)`
          : a.onRequestOnly
            ? ' (auf Anfrage)'
            : ''
      zeilen.push(
        `- [${a.title}](${url(`/${kategorie}/${a.slug}`)})${preis}: ${einzeilig(a.shortDescription)}`,
      )
    }
    zeilen.push('')
  }

  if (Array.isArray(s.faq) && s.faq.length) {
    zeilen.push('## Häufige Fragen', '')
    for (const f of s.faq as { frage: string; antwort: string }[]) {
      zeilen.push(`- **${einzeilig(f.frage, 200)}** ${einzeilig(f.antwort, 600)}`)
    }
    zeilen.push('')
  }

  if (referenzen.docs.length) {
    zeilen.push('## Referenzen', '')
    for (const r of referenzen.docs as unknown as Record<string, any>[]) {
      zeilen.push(
        `- [${r.title}](${url(`/projekte/${r.slug}`)})${r.year ? ` (${r.year})` : ''}: ${einzeilig(r.summary)}`,
      )
    }
    zeilen.push('')
  }

  if (beitraege.docs.length) {
    zeilen.push('## Aus der Werkstatt', '')
    for (const b of beitraege.docs as unknown as Record<string, any>[]) {
      zeilen.push(`- [${b.title}](${url(`/news/${b.slug}`)}): ${einzeilig(b.excerpt)}`)
    }
    zeilen.push('')
  }

  zeilen.push('## Weiteres', '')
  zeilen.push(`- [Sitemap](${BASE_URL}/sitemap.xml): Alle Seiten in allen drei Sprachen.`)
  zeilen.push(`- [Produktdatenfeed](${BASE_URL}/feed/produkte.xml): Sortiment mit Preisen als XML.`)
  zeilen.push(`- [Impressum](${url('/kontakt/impressum')}): Rechtliche Angaben zum Betrieb.`)
  zeilen.push(`- [AGB](${url('/kontakt/agb')}): Liefer- und Zahlungsbedingungen.`)
  zeilen.push(
    `- [Datenschutz](${url('/kontakt/datenschutzerklaerung')}): Was mit den Daten der Besucher geschieht.`,
  )
  zeilen.push('')

  return new Response(zeilen.join('\n'), {
    headers: {
      // Der Vorschlag sieht Markdown vor; als reiner Text bleibt die Datei
      // auch im Browser lesbar, statt zum Herunterladen angeboten zu werden
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
