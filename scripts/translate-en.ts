/**
 * Spielt englische Übersetzungen für die Seed-Inhalte ein (Kategorien,
 * Produkte, News, Startseite, Einstellungen). DE und FR bleiben unberührt;
 * bestehende EN-Werte werden überschrieben.
 *
 * Aufruf:  payload run scripts/translate-en.ts
 * Oder im Docker-Stack einmalig TRANSLATE_EN=true setzen.
 */
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { richText } from '../src/lib/richtext'

const colorMapEN: Record<string, string> = {
  'Anthrazitgrau (RAL 7016)': 'Anthracite grey (RAL 7016)',
  'Reinweiß (RAL 9010)': 'Pure white (RAL 9010)',
  'Rubinrot (RAL 3003)': 'Ruby red (RAL 3003)',
  'Taubenblau (RAL 5014)': 'Pigeon blue (RAL 5014)',
  'Resedagrün (RAL 6011)': 'Reseda green (RAL 6011)',
}

const categoriesEN: Record<string, { name: string; description: string }> = {
  'outdoor-moebel': {
    name: 'Outdoor Furniture',
    description:
      'Sofas, armchairs, tables and loungers made of powder-coated steel — weatherproof, durable and finished in the colour of your choice.',
  },
  leuchten: {
    name: 'Lighting',
    description:
      'Sculptural steel luminaires that shape a room — every piece a one-off from our workshop.',
  },
  objekte: {
    name: 'Objects',
    description:
      'Decorative objects and sculptures made of steel — from the illuminated heart to the life-size animal sculpture.',
  },
  'next-concept': {
    name: 'Next Concept',
    description:
      'Products and solutions by Next-Concept SAS: planters for municipalities and businesses as well as custom mechanical engineering.',
  },
  pflanzkuebel: {
    name: 'Planters',
    description:
      'Robust steel planters for private gardens, cities and municipalities — in standard and custom sizes.',
  },
  maschinenbau: {
    name: 'Mechanical Engineering',
    description: 'CNC machining, toolmaking and special-purpose machines — precision from one source.',
  },
}

type ProductEN = {
  title: string
  short: string
  description: string
  variants?: string[]
}

const productsEN: Record<string, ProductEN> = {
  'outdoor-sofa-os': {
    title: 'Outdoor Sofa OS',
    short: 'Weatherproof three-seater sofa made of powder-coated steel with outdoor cushions.',
    description:
      'The outdoor sofa of the OS collection combines clean lines with uncompromising durability. The frame is made of steel, galvanised and powder-coated in the colour of your choice. The cushions are water-repellent and UV-resistant. Every sofa is handcrafted in our workshop — custom sizes on request.',
    variants: ['2-seater', '3-seater'],
  },
  'outdoor-sessel-os': {
    title: 'Outdoor Armchair OS',
    short: 'The matching armchair for the OS collection — comfortable, robust, weatherproof.',
    description:
      'The outdoor armchair of the OS collection offers the same seating comfort as the sofa — as a compact single piece. Steel frame, galvanised and powder-coated, with weatherproof cushions. Combines with all furniture of the OS series.',
  },
  'outdoor-tisch-ot': {
    title: 'Outdoor Table OT',
    short: 'Steel table of the OT series — as a side or lounge table.',
    description:
      'The table of the OT series complements the outdoor furniture with a sturdy, easy-care surface. Made entirely of steel, galvanised and powder-coated — permanently weather-resistant.',
    variants: ['Side table', 'Lounge table'],
  },
  'outdoor-liege-vague': {
    title: 'Outdoor Lounger Vague',
    short: 'Curved designer lounger made of steel — a wave for the garden.',
    description:
      'The Vague lounger follows a flowing, wave-shaped line and is made of steel. Despite the solid material it appears light and elegant — a sculptural statement for garden, terrace or pool area.',
  },
  'deckenleuchte-kristall': {
    title: 'Ceiling Light Crystal',
    short: 'Sculptural steel ceiling light — a custom-made lighting object.',
    description:
      'The Crystal ceiling light is made individually for your space. Faceted steel surfaces refract the light and create a striking, warm atmosphere. We define size, colour and light temperature together with you.',
  },
  'herz-objekt': {
    title: 'Illuminated Heart',
    short: 'Illuminated steel heart — in three sizes, an eye-catcher indoors and out.',
    description:
      'The illuminated heart is formed from steel profiles and fitted with warm-white lighting. Whether as a garden object, at the entrance or as a gift with meaning — every heart is handcrafted and available in three sizes and your preferred colour.',
    variants: ['Small (60 cm)', 'Medium (100 cm)', 'Large (160 cm)'],
  },
  'stier-skulptur': {
    title: 'Bull Sculpture',
    short: 'Life-size bull sculpture made of steel — strength given form.',
    description:
      'The bull sculpture is built from individually formed steel elements and made entirely in our workshop. A one-off for collectors, companies and public spaces. Made to order only — get in touch.',
  },
  'pflanzkuebel-stahl': {
    title: 'Steel Planter',
    short: 'Robust steel planter — for gardens, cities and municipalities.',
    description:
      'Our planters are made of steel and designed for permanent outdoor use — from private gardens to pedestrian zones. Standard sizes from stock, custom sizes and company logos on request.',
    variants: ['60 × 60 cm', '100 × 40 cm', '120 × 50 cm'],
  },
}

const newsEN: Record<string, { title: string; excerpt: string; content: string }> = {
  'neuer-online-shop': {
    title: 'The new online shop is here',
    excerpt:
      'Selected furniture and objects can now be ordered directly online — custom pieces remain available on request as always.',
    content:
      'With our new website you can order selected pieces from the Outdoor Furniture, Lighting and Objects collections online and pay securely. We continue to handle individual commissions, custom sizes and projects for municipalities and companies personally — from the first sketch to delivery. Have a look around, and feel free to contact us via the contact form.',
  },
  'herz-aus-stahl': {
    title: 'Insight: how a steel heart is made',
    excerpt: 'From steel profile to illuminated object — a look behind the scenes of our workshop.',
    content:
      'Each of our illuminated hearts starts out as a plain steel profile. In the workshop it is formed, welded, ground and powder-coated before the lighting is installed. No two pieces are alike — that is exactly what makes every heart unique. In the gallery on our homepage we show a few moments from the making.',
  },
}

async function run() {
  const payload: Payload = await getPayload({ config })
  console.log('EN-Übersetzung startet …')

  // ── Kategorien ────────────────────────────────────────────────────────────
  for (const [slug, en] of Object.entries(categoriesEN)) {
    const { docs } = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    if (!docs[0]) continue
    await payload.update({
      collection: 'categories',
      id: docs[0].id,
      locale: 'en',
      data: { name: en.name, description: en.description },
    })
    console.log(`  ✓ Kategorie: ${slug}`)
  }

  // ── Produkte ──────────────────────────────────────────────────────────────
  for (const [slug, en] of Object.entries(productsEN)) {
    const { docs } = await payload.find({
      collection: 'products',
      where: { slug: { equals: slug } },
      locale: 'de',
      limit: 1,
    })
    const doc = docs[0]
    if (!doc) continue
    await payload.update({
      collection: 'products',
      id: doc.id,
      locale: 'en',
      data: {
        title: en.title,
        shortDescription: en.short,
        description: richText(en.description),
        // Array-Zeilen über ihre IDs ansprechen, damit DE/FR erhalten bleiben
        variants: en.variants
          ? doc.variants?.map((v, i) => ({
              id: v.id,
              title: en.variants![i] ?? v.title,
              price: v.price,
            }))
          : undefined,
        colorOptions: doc.colorOptions?.map((c) => ({
          id: c.id,
          name: colorMapEN[c.name] ?? c.name,
          hex: c.hex,
        })),
      },
    })
    console.log(`  ✓ Produkt: ${slug}`)
  }

  // ── News ──────────────────────────────────────────────────────────────────
  for (const [slug, en] of Object.entries(newsEN)) {
    const { docs } = await payload.find({
      collection: 'news',
      where: { slug: { equals: slug } },
      limit: 1,
      draft: true,
    })
    if (!docs[0]) continue
    await payload.update({
      collection: 'news',
      id: docs[0].id,
      locale: 'en',
      data: {
        title: en.title,
        excerpt: en.excerpt,
        content: richText(en.content),
      },
    })
    console.log(`  ✓ News: ${slug}`)
  }

  // ── Startseite ────────────────────────────────────────────────────────────
  const homepageDe = await payload.findGlobal({ slug: 'homepage', locale: 'de', depth: 0 })

  const heroEN: Record<string, { t: string; s: string }> = {
    'Outdoor Möbel': { t: 'Outdoor Furniture', s: 'Steel sofas, armchairs and tables — built to last for decades' },
    Objekte: { t: 'Objects', s: 'Illuminated hearts and sculptures with character' },
    'Unikate aus Stahl': { t: 'One-offs in steel', s: 'Craftsmanship and precision from our workshop' },
    Leuchten: { t: 'Lighting', s: 'Custom-made lighting objects' },
    'Liege Vague': { t: 'Vague Lounger', s: 'Design that follows the body' },
  }
  const highlightsEN = [
    { title: 'Made to measure', text: 'Custom sizes and individual adjustments are our standard, not the exception.' },
    { title: 'Your colour', text: 'Powder coating in any RAL colour — to match house, garden or corporate design.' },
    { title: 'Personalisation', text: 'Engravings, logos and lettering make your piece one of a kind.' },
  ]
  const valuesEN = [
    { title: 'Durability', text: 'Steel, galvanised and powder-coated — built for generations.' },
    { title: 'Individuality', text: 'No piece leaves the workshop like any other.' },
    { title: 'Sustainability', text: 'Long-lasting materials and regional production instead of throwaway design.' },
    { title: 'Design', text: 'Clean lines that endure — beyond short-lived trends.' },
    { title: 'Function', text: 'Beauty that stands up to everyday life: weatherproof, sturdy, easy to care for.' },
  ]

  await payload.updateGlobal({
    slug: 'homepage',
    locale: 'en',
    data: {
      missionTitle: 'Furniture, lighting and objects made of steel',
      missionText:
        'We craft high-quality furniture, lighting and design objects from steel — for homes, gardens, businesses and public spaces. Every piece is made with artisanal precision in our workshop and can be individually adapted in size, colour and finish.',
      heroSlides: homepageDe.heroSlides?.map((s) => ({
        id: s.id,
        image: typeof s.image === 'object' ? s.image?.id : s.image,
        title: (s.title && heroEN[s.title]?.t) || s.title,
        subtitle: (s.title && heroEN[s.title]?.s) || s.subtitle,
        link: s.link?.replace('/de/', '/en/'),
      })),
      highlights: homepageDe.highlights?.map((h, i) => ({
        id: h.id,
        ...(highlightsEN[i] ?? { title: h.title, text: h.text }),
      })),
      values: homepageDe.values?.map((v, i) => ({
        id: v.id,
        ...(valuesEN[i] ?? { title: v.title, text: v.text }),
      })),
    },
  })
  console.log('  ✓ Startseite')

  // ── Website-Einstellungen ─────────────────────────────────────────────────
  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'en',
    data: {
      tagline: 'Furniture, lighting and objects made of steel',
      seo: {
        metaTitle: 'Vincent Hellmann – Furniture, lighting and objects made of steel',
        metaDescription:
          'High-quality outdoor furniture, lighting and design objects made of steel. Handcrafted, customisable and built for generations.',
      },
    },
  })
  console.log('  ✓ Einstellungen')

  console.log('✓ EN-Übersetzung abgeschlossen.')
}

await run()
process.exit(0)
