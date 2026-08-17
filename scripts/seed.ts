/**
 * Seed-Skript: befüllt die Datenbank mit Startdaten (Kategorien, Produkte,
 * News, Beispiel-Aktion, Startseite, Einstellungen).
 *
 * Bilder werden von der bestehenden Firmen-Website vincent-hellmann.com
 * geladen (eigene Produktfotos des Betreibers).
 *
 * Aufruf:  pnpm seed   (bzw. `payload run scripts/seed.ts`)
 * Idempotent: bereits geseedete Daten werden nicht doppelt angelegt.
 *
 * WICHTIG: Preise sind Platzhalter/Demowerte und müssen im Admin unter
 * „Produkte" mit den echten Verkaufspreisen ersetzt werden.
 */
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { richText } from '../src/lib/richtext'

const ORIGIN = 'https://www.vincent-hellmann.com'

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@vincent-hellmann.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'change-me-123'

async function uploadImage(
  payload: Payload,
  path: string,
  alt: string,
): Promise<number | undefined> {
  const url = `${ORIGIN}${path}`
  const name = path.split('/').pop() || 'bild.jpg'

  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: name } },
    limit: 1,
  })
  if (existing.docs[0]) return existing.docs[0].id as number

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = Buffer.from(await res.arrayBuffer())
    const doc = await payload.create({
      collection: 'media',
      data: { alt },
      file: {
        data,
        name,
        mimetype: res.headers.get('content-type') || 'image/jpeg',
        size: data.byteLength,
      },
    })
    console.log(`  ✓ Bild: ${name}`)
    return doc.id as number
  } catch (err) {
    console.warn(`  ⚠ Bild konnte nicht geladen werden (${url}):`, err)
    return undefined
  }
}

async function run() {
  const payload = await getPayload({ config })
  console.log('Seed startet …')

  // ── Admin-Benutzer ─────────────────────────────────────────────────────────
  const users = await payload.find({ collection: 'users', limit: 1 })
  if (users.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Admin' },
    })
    console.log(`✓ Admin angelegt: ${ADMIN_EMAIL} (Passwort bitte sofort ändern!)`)
  }

  const seeded = await payload.find({
    collection: 'categories',
    where: { slug: { equals: 'outdoor-moebel' } },
    limit: 1,
  })
  if (seeded.totalDocs > 0) {
    console.log('Daten bereits vorhanden — Seed wird übersprungen.')
    return
  }

  // ── Bilder ────────────────────────────────────────────────────────────────
  console.log('Lade Bilder von der bestehenden Website …')
  const img = {
    sofagruppe: await uploadImage(payload, '/fileadmin/_processed_/a/7/csm_Vincent_Hellmann_Sofagruppe_DSCF1185_2_992fde3e5f.jpg', 'Outdoor-Sofagruppe aus Stahl'),
    herzGross: await uploadImage(payload, '/fileadmin/_processed_/e/c/csm_Vincent_Hellmann_Herz_DSCF1323_1d2f822c97.jpg', 'Beleuchtetes Herz-Objekt aus Stahl'),
    stier: await uploadImage(payload, '/fileadmin/_processed_/1/e/csm_Vincent_Hellmann_2024.12_Hellmann_Stier_L1060435_021230b679.jpg', 'Stier-Skulptur aus Stahl'),
    leuchte: await uploadImage(payload, '/fileadmin/_processed_/1/1/csm_Vincent_Hellmann_Deckenleuchte_DSCF1382_2_5052bc438e.jpg', 'Deckenleuchte aus Stahl'),
    liege: await uploadImage(payload, '/fileadmin/_processed_/6/b/csm_Vincent_Hellmann_Liege_L1012238_e8e756f854.jpg', 'Outdoor-Liege Vague'),
    liegeDetail: await uploadImage(payload, '/fileadmin/_processed_/3/2/csm_Vincent_Hellmann_2024.12_Hellmann_Liege_Detail_L1010957_25f7a73678.jpg', 'Detail der Outdoor-Liege'),
    sitzgruppeBlau: await uploadImage(payload, '/fileadmin/_processed_/1/6/csm_Vincent-Hellmann_Sitzgruppe_blau_f43ed72158.jpg', 'Blaue Outdoor-Sitzgruppe'),
    sofaGruen: await uploadImage(payload, '/fileadmin/_processed_/9/f/csm_Vincent_Hellmann_Sofa_DSCF1185_3_1_gruen_fcbf2f0150.jpg', 'Outdoor-Sofa in Grün'),
    sofaRot: await uploadImage(payload, '/fileadmin/_processed_/3/7/csm_Vincent_Hellmann_Sofa_DSCF1185_red_3_42a01a52d6.jpg', 'Outdoor-Sofa in Rot'),
    sofaSeite: await uploadImage(payload, '/fileadmin/_processed_/3/9/csm_Vincent_Hellmann_Sofa_seitlich_DSCF1187_14e3fcec86.jpg', 'Outdoor-Sofa Seitenansicht'),
    sessel: await uploadImage(payload, '/fileadmin/_processed_/5/4/csm_Vincent_Hellmann_Sessel_DSCF1192_a6fedd41a3.jpg', 'Outdoor-Sessel aus Stahl'),
    tisch: await uploadImage(payload, '/fileadmin/_processed_/6/7/csm_Vincent_Hellmann_Tisch_DSCF1226_c3fd15e9be.jpg', 'Outdoor-Tisch aus Stahl'),
    leuchteBreit: await uploadImage(payload, '/fileadmin/vh/media/leuchten/Vincent_Hellmann_2024.12_Hellmann_Deckenleuchte_DSCF1382_breit.jpg', 'Deckenleuchte — Gesamtansicht'),
    leuchteDetail: await uploadImage(payload, '/fileadmin/vh/media/leuchten/Vincent_Hellmann_2024.12_Hellmann_Deckenleuchte_DSCF1388.jpg', 'Deckenleuchte — Detail'),
    herz3x: await uploadImage(payload, '/fileadmin/vh/media/herz/Vincent-Hellmann_Herzen_3x_2.jpg', 'Herz-Objekte in drei Größen'),
    herzKlein: await uploadImage(payload, '/fileadmin/_processed_/3/1/csm_Vincent_Hellmann_Herz_DSCF1362-2_e382becd48.jpg', 'Herz-Objekt aus Stahl'),
    stierDetail: await uploadImage(payload, '/fileadmin/_processed_/4/d/csm_Vincent_Hellmann_Stier_DSCF1294_2_355c80b1f0.jpg', 'Stier-Skulptur — Detail'),
    maschine: await uploadImage(payload, '/fileadmin/_processed_/8/3/csm_Vincent_Hellmann_next_concept_maschine_IMG_1952_ret_b3e8a8bc81.jpg', 'Maschinenbau bei Next Concept'),
    office: await uploadImage(payload, '/fileadmin/_processed_/b/a/csm_Vincent-Hellmann_Office_2025-04_L1000859_fd5ef85f1f.jpg', 'Büro und Werkstatt'),
  }

  // ── Kategorien ────────────────────────────────────────────────────────────
  console.log('Lege Kategorien an …')
  const cat = async (
    de: { name: string; description: string },
    fr: { name: string; description: string },
    slug: string,
    image?: number,
    parent?: number,
    order = 0,
  ) => {
    const doc = await payload.create({
      collection: 'categories',
      locale: 'de',
      data: { name: de.name, description: de.description, slug, image, parent, order },
    })
    await payload.update({
      collection: 'categories',
      id: doc.id,
      locale: 'fr',
      data: { name: fr.name, description: fr.description },
    })
    return doc.id as number
  }

  const outdoorId = await cat(
    { name: 'Outdoor Möbel', description: 'Sofas, Sessel, Tische und Liegen aus pulverbeschichtetem Stahl — wetterfest, langlebig und in Wunschfarbe gefertigt.' },
    { name: 'Mobilier Outdoor', description: 'Canapés, fauteuils, tables et chaises longues en acier thermolaqué — résistants aux intempéries, durables et fabriqués dans la couleur de votre choix.' },
    'outdoor-moebel', img.sitzgruppeBlau, undefined, 1,
  )
  const leuchtenId = await cat(
    { name: 'Leuchten', description: 'Skulpturale Leuchten aus Stahl, die Räume prägen — jedes Stück ein Unikat aus unserer Werkstatt.' },
    { name: 'Luminaires', description: "Des luminaires sculpturaux en acier qui marquent l'espace — chaque pièce est unique et sort de notre atelier." },
    'leuchten', img.leuchteBreit, undefined, 2,
  )
  const objekteId = await cat(
    { name: 'Objekte', description: 'Dekorative Objekte und Skulpturen aus Stahl — vom beleuchteten Herz bis zur lebensgroßen Tierskulptur.' },
    { name: 'Objets', description: "Objets décoratifs et sculptures en acier — du cœur illuminé à la sculpture animale grandeur nature." },
    'objekte', img.herz3x, undefined, 3,
  )
  const nextConceptId = await cat(
    { name: 'Next Concept', description: 'Produkte und Lösungen der Next-Concept SAS: Pflanzkübel für Kommunen und Gewerbe sowie individueller Maschinenbau.' },
    { name: 'Next Concept', description: 'Produits et solutions de Next-Concept SAS : bacs à plantes pour collectivités et entreprises ainsi que construction mécanique sur mesure.' },
    'next-concept', img.maschine, undefined, 4,
  )
  const pflanzId = await cat(
    { name: 'Pflanzkübel', description: 'Robuste Pflanzkübel aus Stahl für private Gärten, Städte und Gemeinden — in Standard- und Sondergrößen.' },
    { name: 'Bacs à plantes', description: 'Bacs à plantes robustes en acier pour jardins privés, villes et communes — en tailles standard et sur mesure.' },
    'pflanzkuebel', img.office, nextConceptId, 1,
  )
  await cat(
    { name: 'Maschinenbau', description: 'CNC-Fertigung, Werkzeugbau und Sondermaschinen — Präzision aus einer Hand.' },
    { name: 'Construction mécanique', description: 'Usinage CNC, outillage et machines spéciales — la précision par un seul partenaire.' },
    'maschinenbau', img.maschine, nextConceptId, 2,
  )

  // ── Produkte ──────────────────────────────────────────────────────────────
  console.log('Lege Produkte an …')
  const product = async (opts: {
    de: { title: string; short: string; description: string }
    fr: { title: string; short: string; description: string }
    slug: string
    category: number
    images: (number | undefined)[]
    price?: number
    shippingCost?: number
    variants?: { de: string; fr: string; price: number }[]
    colors?: { de: string; fr: string; hex: string }[]
    onRequestOnly?: boolean
    featured?: boolean
    order?: number
  }) => {
    const images = opts.images.filter((i): i is number => typeof i === 'number')
    if (images.length === 0) return
    const doc = await payload.create({
      collection: 'products',
      locale: 'de',
      data: {
        title: opts.de.title,
        shortDescription: opts.de.short,
        description: richText(opts.de.description),
        slug: opts.slug,
        category: opts.category,
        images,
        price: opts.price,
        shippingCost: opts.shippingCost,
        variants: opts.variants?.map((v) => ({ title: v.de, price: v.price })),
        colorOptions: opts.colors?.map((c) => ({ name: c.de, hex: c.hex })),
        onRequestOnly: opts.onRequestOnly ?? false,
        featured: opts.featured ?? false,
        order: opts.order ?? 0,
      },
    })
    // FR-Übersetzung: Array-Zeilen über ihre IDs ansprechen, sonst gehen die DE-Werte verloren
    await payload.update({
      collection: 'products',
      id: doc.id,
      locale: 'fr',
      data: {
        title: opts.fr.title,
        shortDescription: opts.fr.short,
        description: richText(opts.fr.description),
        variants: opts.variants?.map((v, i) => ({
          id: doc.variants?.[i]?.id,
          title: v.fr,
          price: v.price,
        })),
        colorOptions: opts.colors?.map((c, i) => ({
          id: doc.colorOptions?.[i]?.id,
          name: c.fr,
          hex: c.hex,
        })),
      },
    })
  }

  const ralColors = [
    { de: 'Anthrazitgrau (RAL 7016)', fr: 'Gris anthracite (RAL 7016)', hex: '#383e42' },
    { de: 'Reinweiß (RAL 9010)', fr: 'Blanc pur (RAL 9010)', hex: '#f1ece1' },
    { de: 'Rubinrot (RAL 3003)', fr: 'Rouge rubis (RAL 3003)', hex: '#8d1d2c' },
    { de: 'Taubenblau (RAL 5014)', fr: 'Bleu pigeon (RAL 5014)', hex: '#606e8c' },
    { de: 'Resedagrün (RAL 6011)', fr: 'Vert réséda (RAL 6011)', hex: '#587246' },
  ]

  await product({
    de: {
      title: 'Outdoor-Sofa OS',
      short: 'Wetterfestes 3-Sitzer-Sofa aus pulverbeschichtetem Stahl mit Outdoor-Polstern.',
      description:
        'Das Outdoor-Sofa der OS-Kollektion verbindet klare Linien mit kompromissloser Langlebigkeit. Der Rahmen wird aus Stahl gefertigt, verzinkt und in Ihrer Wunschfarbe pulverbeschichtet. Die Polster sind wasserabweisend und UV-beständig. Jedes Sofa entsteht in Handarbeit in unserer Werkstatt — auf Wunsch auch in Sondermaßen.',
    },
    fr: {
      title: 'Canapé Outdoor OS',
      short: "Canapé 3 places résistant aux intempéries en acier thermolaqué avec coussins d'extérieur.",
      description:
        "Le canapé outdoor de la collection OS allie lignes épurées et durabilité sans compromis. Le cadre est fabriqué en acier, galvanisé et thermolaqué dans la couleur de votre choix. Les coussins sont déperlants et résistants aux UV. Chaque canapé est fabriqué à la main dans notre atelier — sur demande également en dimensions spéciales.",
    },
    slug: 'outdoor-sofa-os',
    category: outdoorId,
    shippingCost: 150,
    images: [img.sofaGruen, img.sofaRot, img.sofaSeite, img.sofagruppe],
    variants: [
      { de: '2-Sitzer', fr: '2 places', price: 1990 },
      { de: '3-Sitzer', fr: '3 places', price: 2490 },
    ],
    colors: ralColors,
    featured: true,
    order: 1,
  })

  await product({
    de: {
      title: 'Outdoor-Sessel OS',
      short: 'Der passende Sessel zur OS-Kollektion — bequem, robust, wetterfest.',
      description:
        'Der Outdoor-Sessel der OS-Kollektion bietet den gleichen Sitzkomfort wie das Sofa — als kompaktes Einzelstück. Stahlrahmen, verzinkt und pulverbeschichtet, mit wetterfesten Polstern. Kombinierbar mit allen Möbeln der OS-Serie.',
    },
    fr: {
      title: 'Fauteuil Outdoor OS',
      short: 'Le fauteuil assorti à la collection OS — confortable, robuste, résistant aux intempéries.',
      description:
        "Le fauteuil outdoor de la collection OS offre le même confort d'assise que le canapé — en pièce individuelle compacte. Cadre en acier, galvanisé et thermolaqué, avec coussins résistants aux intempéries. Combinable avec tous les meubles de la série OS.",
    },
    slug: 'outdoor-sessel-os',
    category: outdoorId,
    shippingCost: 90,
    images: [img.sessel],
    price: 1290,
    colors: ralColors,
    featured: true,
    order: 2,
  })

  await product({
    de: {
      title: 'Outdoor-Tisch OT',
      short: 'Stahltisch der OT-Serie — als Beistell- oder Loungetisch.',
      description:
        'Der Tisch der OT-Serie ergänzt die Outdoor-Möbel um eine stabile, pflegeleichte Ablagefläche. Vollständig aus Stahl gefertigt, verzinkt und pulverbeschichtet — dadurch dauerhaft witterungsbeständig.',
    },
    fr: {
      title: 'Table Outdoor OT',
      short: "Table en acier de la série OT — comme table d'appoint ou table lounge.",
      description:
        "La table de la série OT complète le mobilier outdoor par une surface stable et facile d'entretien. Entièrement fabriquée en acier, galvanisée et thermolaquée — donc durablement résistante aux intempéries.",
    },
    slug: 'outdoor-tisch-ot',
    category: outdoorId,
    shippingCost: 90,
    images: [img.tisch],
    variants: [
      { de: 'Beistelltisch', fr: "Table d'appoint", price: 690 },
      { de: 'Loungetisch', fr: 'Table lounge', price: 990 },
    ],
    colors: ralColors,
    order: 3,
  })

  await product({
    de: {
      title: 'Outdoor-Liege Vague',
      short: 'Geschwungene Design-Liege aus Stahl — eine Welle für den Garten.',
      description:
        'Die Liege Vague folgt einer fließenden, wellenförmigen Linie und wird aus Stahl gefertigt. Trotz des massiven Materials wirkt sie leicht und elegant — ein skulpturales Statement für Garten, Terrasse oder Poolbereich.',
    },
    fr: {
      title: 'Chaise longue Vague',
      short: 'Chaise longue design galbée en acier — une vague pour le jardin.',
      description:
        "La chaise longue Vague suit une ligne fluide et ondulée et est fabriquée en acier. Malgré la robustesse du matériau, elle paraît légère et élégante — une déclaration sculpturale pour le jardin, la terrasse ou l'espace piscine.",
    },
    slug: 'outdoor-liege-vague',
    category: outdoorId,
    shippingCost: 150,
    images: [img.liege, img.liegeDetail],
    price: 1790,
    colors: ralColors,
    featured: true,
    order: 4,
  })

  await product({
    de: {
      title: 'Deckenleuchte Kristall',
      short: 'Skulpturale Deckenleuchte aus Stahl — ein Lichtobjekt in Maßanfertigung.',
      description:
        'Die Deckenleuchte Kristall wird individuell für Ihren Raum gefertigt. Facettierte Stahlflächen brechen das Licht und schaffen eine markante, warme Atmosphäre. Größe, Farbe und Lichtfarbe stimmen wir gemeinsam mit Ihnen ab.',
    },
    fr: {
      title: 'Plafonnier Cristal',
      short: 'Plafonnier sculptural en acier — un objet lumineux sur mesure.',
      description:
        "Le plafonnier Cristal est fabriqué individuellement pour votre espace. Des surfaces d'acier facettées réfractent la lumière et créent une atmosphère chaleureuse et marquante. Nous définissons ensemble la taille, la couleur et la température de lumière.",
    },
    slug: 'deckenleuchte-kristall',
    category: leuchtenId,
    images: [img.leuchteBreit, img.leuchteDetail, img.leuchte],
    onRequestOnly: true,
    order: 1,
  })

  await product({
    de: {
      title: 'Herz-Objekt beleuchtet',
      short: 'Beleuchtetes Herz aus Stahl — in drei Größen, innen wie außen ein Blickfang.',
      description:
        'Das beleuchtete Herz wird aus Stahlprofilen geformt und mit warmweißer Beleuchtung ausgestattet. Ob als Gartenobjekt, vor dem Eingang oder als Geschenk mit Bedeutung — jedes Herz wird in Handarbeit gefertigt und ist in drei Größen sowie Wunschfarbe erhältlich.',
    },
    fr: {
      title: 'Cœur illuminé',
      short: "Cœur illuminé en acier — en trois tailles, accrocheur à l'intérieur comme à l'extérieur.",
      description:
        "Le cœur illuminé est formé de profilés d'acier et équipé d'un éclairage blanc chaud. Objet de jardin, décoration d'entrée ou cadeau porteur de sens — chaque cœur est fabriqué à la main et disponible en trois tailles et dans la couleur de votre choix.",
    },
    slug: 'herz-objekt',
    category: objekteId,
    shippingCost: 60,
    images: [img.herzGross, img.herzKlein, img.herz3x],
    variants: [
      { de: 'Klein (60 cm)', fr: 'Petit (60 cm)', price: 490 },
      { de: 'Mittel (100 cm)', fr: 'Moyen (100 cm)', price: 890 },
      { de: 'Groß (160 cm)', fr: 'Grand (160 cm)', price: 1490 },
    ],
    colors: ralColors,
    featured: true,
    order: 1,
  })

  await product({
    de: {
      title: 'Stier-Skulptur',
      short: 'Lebensgroße Stier-Skulptur aus Stahl — Kraft in Form gebracht.',
      description:
        'Die Stier-Skulptur entsteht aus einzeln geformten Stahlelementen und wird vollständig in unserer Werkstatt gefertigt. Ein Unikat für Sammler, Unternehmen und öffentliche Räume. Fertigung nur auf Anfrage — sprechen Sie uns an.',
    },
    fr: {
      title: 'Sculpture Taureau',
      short: 'Sculpture de taureau grandeur nature en acier — la force mise en forme.',
      description:
        "La sculpture de taureau est constituée d'éléments d'acier formés individuellement et entièrement fabriquée dans notre atelier. Une pièce unique pour collectionneurs, entreprises et espaces publics. Fabrication uniquement sur demande — contactez-nous.",
    },
    slug: 'stier-skulptur',
    category: objekteId,
    images: [img.stier, img.stierDetail],
    onRequestOnly: true,
    order: 2,
  })

  await product({
    de: {
      title: 'Pflanzkübel Stahl',
      short: 'Robuster Pflanzkübel aus Stahl — für Gärten, Städte und Gemeinden.',
      description:
        'Unsere Pflanzkübel werden aus Stahl gefertigt und sind für den dauerhaften Einsatz im Außenbereich ausgelegt — vom privaten Garten bis zur Fußgängerzone. Standardgrößen ab Lager, Sondergrößen und Firmenlogos auf Anfrage.',
    },
    fr: {
      title: 'Bac à plantes en acier',
      short: 'Bac à plantes robuste en acier — pour jardins, villes et communes.',
      description:
        "Nos bacs à plantes sont fabriqués en acier et conçus pour une utilisation extérieure durable — du jardin privé à la zone piétonne. Tailles standard en stock, tailles spéciales et logos d'entreprise sur demande.",
    },
    slug: 'pflanzkuebel-stahl',
    category: pflanzId,
    shippingCost: 40,
    images: [img.office],
    variants: [
      { de: '60 × 60 cm', fr: '60 × 60 cm', price: 349 },
      { de: '100 × 40 cm', fr: '100 × 40 cm', price: 449 },
      { de: '120 × 50 cm', fr: '120 × 50 cm', price: 549 },
    ],
    colors: ralColors,
    order: 1,
  })

  // ── News ──────────────────────────────────────────────────────────────────
  console.log('Lege News an …')
  const newsItem = async (opts: {
    de: { title: string; excerpt: string; content: string }
    fr: { title: string; excerpt: string; content: string }
    slug: string
    image?: number
    date: string
  }) => {
    if (typeof opts.image !== 'number') return
    const doc = await payload.create({
      collection: 'news',
      locale: 'de',
      data: {
        title: opts.de.title,
        excerpt: opts.de.excerpt,
        content: richText(opts.de.content),
        slug: opts.slug,
        coverImage: opts.image,
        publishedDate: opts.date,
        _status: 'published',
      },
    })
    await payload.update({
      collection: 'news',
      id: doc.id,
      locale: 'fr',
      data: {
        title: opts.fr.title,
        excerpt: opts.fr.excerpt,
        content: richText(opts.fr.content),
      },
    })
  }

  await newsItem({
    de: {
      title: 'Der neue Online-Shop ist da',
      excerpt:
        'Ausgewählte Möbel und Objekte können ab sofort direkt online bestellt werden — Maßanfertigungen bleiben wie gewohnt auf Anfrage.',
      content:
        'Mit unserer neuen Website können Sie ausgewählte Stücke aus den Kollektionen Outdoor Möbel, Leuchten und Objekte direkt online bestellen und sicher bezahlen. Individuelle Anfertigungen, Sondermaße und Projekte für Kommunen und Unternehmen begleiten wir weiterhin persönlich — vom ersten Entwurf bis zur Lieferung. Schauen Sie sich um und schreiben Sie uns bei Fragen gerne über das Kontaktformular.',
    },
    fr: {
      title: 'La nouvelle boutique en ligne est arrivée',
      excerpt:
        'Une sélection de meubles et objets peut désormais être commandée directement en ligne — les fabrications sur mesure restent comme toujours sur demande.',
      content:
        "Avec notre nouveau site, vous pouvez commander en ligne et payer en toute sécurité une sélection de pièces des collections Mobilier Outdoor, Luminaires et Objets. Nous continuons d'accompagner personnellement les fabrications individuelles, les dimensions spéciales et les projets pour collectivités et entreprises — du premier croquis à la livraison. N'hésitez pas à nous écrire via le formulaire de contact.",
    },
    slug: 'neuer-online-shop',
    image: img.sofagruppe,
    date: new Date().toISOString(),
  })

  await newsItem({
    de: {
      title: 'Einblick: So entsteht ein Herz aus Stahl',
      excerpt:
        'Vom Stahlprofil zum beleuchteten Objekt — ein Blick hinter die Kulissen unserer Werkstatt.',
      content:
        'Jedes unserer beleuchteten Herzen beginnt als nüchternes Stahlprofil. In der Werkstatt wird es geformt, verschweißt, verschliffen und pulverbeschichtet, bevor die Beleuchtung eingesetzt wird. Kein Stück gleicht dem anderen — genau das macht jedes Herz zum Unikat. In unserer Galerie auf der Startseite zeigen wir einige Momente aus der Fertigung.',
    },
    fr: {
      title: "Aperçu : comment naît un cœur en acier",
      excerpt:
        "Du profilé d'acier à l'objet illuminé — un regard dans les coulisses de notre atelier.",
      content:
        "Chacun de nos cœurs illuminés commence comme un simple profilé d'acier. À l'atelier, il est formé, soudé, poncé et thermolaqué avant l'installation de l'éclairage. Aucune pièce ne ressemble à une autre — c'est précisément ce qui fait de chaque cœur une pièce unique. Dans notre galerie en page d'accueil, nous montrons quelques moments de la fabrication.",
    },
    slug: 'herz-aus-stahl',
    image: img.herzKlein,
    date: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
  })

  // ── Beispiel-Aktion ───────────────────────────────────────────────────────
  console.log('Lege Beispiel-Aktion an …')
  const promoStart = new Date()
  const promoEnd = new Date(Date.now() + 60 * 24 * 3600 * 1000)
  const promo = await payload.create({
    collection: 'promotions',
    locale: 'de',
    data: {
      title: 'Willkommens-Aktion',
      description: '10 % Rabatt auf alle Outdoor-Möbel — zum Start des neuen Online-Shops.',
      discountType: 'percent',
      discountValue: 10,
      startDate: promoStart.toISOString(),
      endDate: promoEnd.toISOString(),
      appliesTo: 'categories',
      categories: [outdoorId],
      active: true,
      image: img.sitzgruppeBlau,
    },
  })
  await payload.update({
    collection: 'promotions',
    id: promo.id,
    locale: 'fr',
    data: {
      title: 'Offre de bienvenue',
      description: '10 % de remise sur tout le mobilier outdoor — pour le lancement de la nouvelle boutique en ligne.',
    },
  })

  // ── Startseite ────────────────────────────────────────────────────────────
  console.log('Befülle Startseite …')
  const heroSlides = [
    { image: img.sofagruppe, de: { t: 'Outdoor Möbel', s: 'Sofas, Sessel und Tische aus Stahl — gebaut für Jahrzehnte' }, fr: { t: 'Mobilier Outdoor', s: 'Canapés, fauteuils et tables en acier — construits pour des décennies' }, link: '/de/outdoor-moebel' },
    { image: img.herzGross, de: { t: 'Objekte', s: 'Beleuchtete Herzen und Skulpturen mit Charakter' }, fr: { t: 'Objets', s: 'Cœurs illuminés et sculptures de caractère' }, link: '/de/objekte' },
    { image: img.stier, de: { t: 'Unikate aus Stahl', s: 'Handwerk und Präzision aus unserer Werkstatt' }, fr: { t: "Pièces uniques en acier", s: 'Artisanat et précision de notre atelier' }, link: '/de/objekte' },
    { image: img.leuchte, de: { t: 'Leuchten', s: 'Lichtobjekte in Maßanfertigung' }, fr: { t: 'Luminaires', s: 'Objets lumineux sur mesure' }, link: '/de/leuchten' },
    { image: img.liege, de: { t: 'Liege Vague', s: 'Design, das sich dem Körper anpasst' }, fr: { t: 'Chaise longue Vague', s: 'Un design qui épouse le corps' }, link: '/de/outdoor-moebel' },
  ].filter((s) => typeof s.image === 'number')

  const homepageDe = await payload.updateGlobal({
    slug: 'homepage',
    locale: 'de',
    data: {
      heroSlides: heroSlides.map((s) => ({ image: s.image, title: s.de.t, subtitle: s.de.s, link: s.link })),
      missionTitle: 'Möbel, Leuchten und Objekte aus Stahl',
      missionText:
        'Wir fertigen hochwertige Möbel, Leuchten und Designobjekte aus Stahl — für Zuhause, Garten, Gewerbe und öffentliche Räume. Jedes Stück entsteht mit handwerklicher Präzision in unserer Werkstatt und wird auf Wunsch in Größe, Farbe und Ausführung individuell angepasst.',
      gallery: [img.office, img.maschine, img.herzKlein, img.liegeDetail].filter(
        (i): i is number => typeof i === 'number',
      ),
      highlights: [
        { title: 'Maßanfertigung', text: 'Sondergrößen und individuelle Anpassungen sind bei uns Standard, nicht Ausnahme.' },
        { title: 'Wunschfarbe', text: 'Pulverbeschichtung in jeder RAL-Farbe — passend zu Haus, Garten oder Corporate Design.' },
        { title: 'Personalisierung', text: 'Gravuren, Logos und Schriftzüge machen Ihr Stück einzigartig.' },
      ],
      values: [
        { title: 'Langlebigkeit', text: 'Stahl, verzinkt und pulverbeschichtet — gebaut für Generationen.' },
        { title: 'Individualität', text: 'Kein Stück verlässt die Werkstatt wie das andere.' },
        { title: 'Nachhaltigkeit', text: 'Langlebige Materialien und regionale Fertigung statt Wegwerfdesign.' },
        { title: 'Design', text: 'Klare Linien, die Bestand haben — jenseits kurzlebiger Trends.' },
        { title: 'Funktion', text: 'Schönheit, die den Alltag aushält: wetterfest, stabil, pflegeleicht.' },
      ],
    },
  })
  const frHighlights = [
    { title: 'Sur mesure', text: "Les tailles spéciales et adaptations individuelles sont chez nous la norme, pas l'exception." },
    { title: 'Couleur au choix', text: 'Thermolaquage dans toutes les teintes RAL — assorti à la maison, au jardin ou à votre identité visuelle.' },
    { title: 'Personnalisation', text: 'Gravures, logos et lettrages rendent votre pièce unique.' },
  ]
  const frValues = [
    { title: 'Durabilité', text: 'Acier, galvanisé et thermolaqué — construit pour des générations.' },
    { title: 'Individualité', text: "Aucune pièce ne quitte l'atelier comme une autre." },
    { title: 'Écoresponsabilité', text: 'Des matériaux durables et une fabrication régionale plutôt que du design jetable.' },
    { title: 'Design', text: 'Des lignes claires qui durent — au-delà des tendances éphémères.' },
    { title: 'Fonctionnalité', text: "Une beauté qui résiste au quotidien : robuste, stable, facile d'entretien." },
  ]
  // FR-Übersetzung über die bestehenden Zeilen-IDs, damit die DE-Werte erhalten bleiben
  await payload.updateGlobal({
    slug: 'homepage',
    locale: 'fr',
    data: {
      heroSlides: heroSlides.map((s, i) => ({
        id: homepageDe.heroSlides?.[i]?.id,
        image: s.image,
        title: s.fr.t,
        subtitle: s.fr.s,
        link: s.link.replace('/de/', '/fr/'),
      })),
      missionTitle: 'Meubles, luminaires et objets en acier',
      missionText:
        "Nous fabriquons des meubles, luminaires et objets design de haute qualité en acier — pour la maison, le jardin, les entreprises et les espaces publics. Chaque pièce naît avec une précision artisanale dans notre atelier et peut être adaptée individuellement en taille, couleur et finition.",
      highlights: frHighlights.map((h, i) => ({ id: homepageDe.highlights?.[i]?.id, ...h })),
      values: frValues.map((v, i) => ({ id: homepageDe.values?.[i]?.id, ...v })),
    },
  })

  // ── Website-Einstellungen ─────────────────────────────────────────────────
  console.log('Befülle Website-Einstellungen …')
  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'de',
    data: {
      siteName: 'Vincent Hellmann',
      tagline: 'Möbel, Leuchten und Objekte aus Stahl',
      contact: {
        phone: '+33 7 67 91 88 39',
        email: 'info@vincent-hellmann.com',
        company: 'Next-Concept SAS',
        address: 'Frankreich',
      },
      social: {
        facebook: 'https://www.facebook.com/vincent.hellmann',
        instagram: 'https://www.instagram.com/vincenthellmann',
        youtube: 'https://www.youtube.com/@Selfmaderouter67',
      },
      seo: {
        metaTitle: 'Vincent Hellmann – Möbel, Leuchten und Objekte aus Stahl',
        metaDescription:
          'Hochwertige Outdoor-Möbel, Leuchten und Designobjekte aus Stahl. Handgefertigt, individuell anpassbar und gebaut für Generationen.',
      },
    },
  })
  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'fr',
    data: {
      tagline: 'Meubles, luminaires et objets en acier',
      seo: {
        metaTitle: 'Vincent Hellmann – Meubles, luminaires et objets en acier',
        metaDescription:
          "Mobilier outdoor, luminaires et objets design de haute qualité en acier. Faits main, personnalisables et construits pour des générations.",
      },
    },
  })

  // ── Rechtliches (Platzhalter — bitte durch echte Texte ersetzen!) ─────────
  await payload.updateGlobal({
    slug: 'legal',
    locale: 'de',
    data: {
      impressum: richText(
        'Platzhalter: Bitte hier das vollständige Impressum einfügen (Firmenname, Anschrift, Vertretungsberechtigte, Registernummer, USt-ID, Kontakt). Die Inhalte der bisherigen Website können im Admin-Panel unter „Rechtliches" eingepflegt werden.',
      ),
      datenschutz: richText(
        'Platzhalter: Bitte hier die Datenschutzerklärung einfügen. Hinweis: Durch Shop (Stripe) und Kontaktformular verarbeitet die Website personenbezogene Daten — die Erklärung sollte Stripe als Zahlungsdienstleister und den E-Mail-Versand erwähnen.',
      ),
      agb: richText(
        'Platzhalter: Bitte hier die Allgemeinen Geschäftsbedingungen für den Online-Shop einfügen (Vertragsschluss, Preise, Lieferung, Widerrufsrecht, Gewährleistung).',
      ),
    },
  })

  console.log('✓ Seed abgeschlossen.')
  console.log(`  Admin-Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log('  WICHTIG: Passwort ändern, Demo-Preise prüfen, Rechtstexte einfügen!')
}

await run()
process.exit(0)
