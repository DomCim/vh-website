/**
 * Beispieldaten fuer das Buero - NUR fuer die Vorschau.
 *
 * Der normale Seed legt Shop-Inhalte an (Kategorien, Produkte, News). Das
 * Buero bleibt dabei leer: keine Bestellung, keine Rechnung, kein Auftrag -
 * und eine Uebersicht, die ueberall 0,00 EUR zeigt, sagt ueber das System
 * nichts aus.
 *
 * Dieses Skript fuellt es mit einer erfundenen, aber plausiblen Lage: ein
 * paar Bestellungen in verschiedenen Zustaenden, zwei Auftraege mitten in der
 * Fertigung mit gekoppelten Laufmarken, bezahlte und offene Rechnungen,
 * Material im Lager, eine frische Anfrage.
 *
 * ALLE NAMEN SIND ERFUNDEN. Es darf nichts hineingeraten, was es wirklich
 * gibt - die Bilder daraus landen auf einer oeffentlichen Seite.
 *
 * Aufruf im Container:
 *   node_modules/.bin/payload run scripts/demo-buero.ts
 */

import { getPayload } from 'payload'
import config from '@payload-config'

import { naechsterMarkenCode } from '../src/lib/nummernkreis'

const tage = (n: number) => new Date(Date.now() + n * 86400000).toISOString()

async function run() {
  const payload = await getPayload({ config })

  /*
   * Erst leeren, dann neu anlegen - das Skript soll mehrfach laufen koennen,
   * ohne dass sich die Beispiele stapeln. Es raeumt AUSSCHLIESSLICH die
   * Buero-Sammlungen; Produkte, Kategorien und News bleiben stehen.
   */
  const raeumen = [
    'job-tags',
    'jobs',
    'orders',
    'outgoing-invoices',
    'expenses',
    'inventory-items',
    'inquiries',
    'contacts',
  ] as const
  for (const c of raeumen) {
    const weg = await payload.delete({ collection: c, where: { id: { exists: true } } })
    const n = Array.isArray(weg?.docs) ? weg.docs.length : 0
    if (n) console.log(`geleert: ${c} (${n})`)
  }

  // ---------------------------------------------------------------- Kontakte
  const kunden = [
    {
      name: 'Hôtel du Parc, Strasbourg',
      role: 'kunde',
      email: 'reception@hotel-du-parc.example',
      city: 'Strasbourg',
      country: 'FR',
      sprache: 'fr',
    },
    {
      name: 'Weingut Sonnenhang',
      role: 'kunde',
      email: 'kontakt@weingut-sonnenhang.example',
      city: 'Ihringen',
      country: 'DE',
      sprache: 'de',
    },
    {
      name: 'Architekturbüro Lindner & Partner',
      role: 'kunde',
      email: 'projekte@lindner-partner.example',
      city: 'Karlsruhe',
      country: 'DE',
      sprache: 'de',
    },
    {
      name: 'Stahlhandel Rheinau GmbH',
      role: 'lieferant',
      email: 'vertrieb@stahlhandel-rheinau.example',
      city: 'Rheinau',
      country: 'DE',
      sprache: 'de',
    },
  ]
  const angelegt: Record<string, unknown> = {}
  for (const k of kunden) {
    const d = await payload.create({ collection: 'contacts', data: k as never })
    angelegt[k.name] = d.id
    console.log('Kontakt:', k.name)
  }

  // ---------------------------------------------------------------- Material
  const material = [
    { name: 'Stahlblech 3 mm, 1000 × 2000', type: 'material', quantity: 14, unit: 'Tafel', minQuantity: 6, unitValue: 68, location: 'Regal A' },
    { name: 'Vierkantrohr 40 × 40 × 3', type: 'material', quantity: 32, unit: 'm', minQuantity: 20, unitValue: 9.4, location: 'Regal B' },
    { name: 'Edelstahlblech 2 mm', type: 'material', quantity: 5, unit: 'Tafel', minQuantity: 6, unitValue: 142, location: 'Regal A' },
    { name: 'Pulverlack Telemagenta RAL 4010', type: 'material', quantity: 2, unit: 'kg', minQuantity: 3, unitValue: 38, location: 'Lackraum' },
    { name: 'Schweißdraht G3Si1, 1,0 mm', type: 'material', quantity: 8, unit: 'Rolle', minQuantity: 4, unitValue: 24, location: 'Werkbank' },
    { name: 'Plasmaschneider', type: 'maschine', quantity: 1, unit: 'Stück', unitValue: 2400, location: 'Halle' },
    { name: 'Kantenfräsmaschine', type: 'maschine', quantity: 1, unit: 'Stück', unitValue: 3800, location: 'Halle' },
  ]
  const materialIds: unknown[] = []
  for (const m of material) {
    const d = await payload.create({ collection: 'inventory-items', data: m as never })
    materialIds.push(d.id)
    console.log('Lager:', m.name)
  }

  // ------------------------------------------------------------ Bestellungen
  const bestellungen = [
    {
      status: 'shipped',
      kunde: 'Marie Feldmann',
      email: 'm.feldmann@example.org',
      titel: 'Herz-Objekt, mittel',
      menge: 1,
      preis: 340,
      ort: 'Freiburg',
      tracking: '00340434161234567890',
    },
    {
      status: 'inProduction',
      kunde: 'Hôtel du Parc, Strasbourg',
      email: 'reception@hotel-du-parc.example',
      titel: 'Brasero Ø 80 cm',
      menge: 2,
      preis: 1290,
      ort: 'Strasbourg',
    },
    {
      status: 'paid',
      kunde: 'Tobias Renner',
      email: 't.renner@example.org',
      titel: 'Deckenleuchte Kristall',
      menge: 1,
      preis: 690,
      ort: 'Offenburg',
    },
    {
      status: 'pending',
      kunde: 'Weingut Sonnenhang',
      email: 'kontakt@weingut-sonnenhang.example',
      titel: 'Outdoor-Tisch, 220 cm',
      menge: 1,
      preis: 1850,
      ort: 'Ihringen',
    },
  ]
  for (const [i, b] of bestellungen.entries()) {
    const gesamt = b.menge * b.preis
    await payload.create({
      collection: 'orders',
      data: {
        orderNumber: `BE-2026-${String(1041 + i).padStart(4, '0')}`,
        status: b.status,
        items: [
          {
            titleSnapshot: b.titel,
            quantity: b.menge,
            unitPrice: b.preis,
            subtotal: gesamt,
          },
        ],
        subtotal: gesamt,
        total: gesamt,
        deliveryMethod: 'shipping',
        customer: { name: b.kunde, email: b.email, phone: '' },
        shippingAddress: { city: b.ort, country: b.ort === 'Strasbourg' ? 'Frankreich' : 'Deutschland' },
        trackingNumber: b.tracking,
        paymentProvider: 'paypal',
      } as never,
    })
    console.log('Bestellung:', b.titel, b.status)
  }

  // ----------------------------------------------------------------- Auftrag
  const auftraege = [
    {
      title: 'Feuerstelle Terrasse, Sonderanfertigung',
      status: 'inFertigung',
      source: 'angebot',
      customerName: 'Hôtel du Parc, Strasbourg',
      contact: angelegt['Hôtel du Parc, Strasbourg'],
      startDate: tage(-12),
      dueDate: tage(9),
      positions: [
        { description: 'Feuerschale Ø 110 cm, 4 mm Cortenstahl', quantity: 1, price: 2400 },
        { description: 'Sockel, feuerverzinkt', quantity: 1, price: 780 },
      ],
    },
    {
      title: 'Weinregal-Wand, 4 Elemente',
      status: 'inFertigung',
      source: 'angebot',
      customerName: 'Weingut Sonnenhang',
      contact: angelegt['Weingut Sonnenhang'],
      startDate: tage(-5),
      dueDate: tage(21),
      positions: [{ description: 'Regalelement 200 × 60 cm, pulverbeschichtet', quantity: 4, price: 465 }],
    },
    {
      title: 'Empfangstheke, Stahl und Eiche',
      status: 'geplant',
      source: 'manuell',
      customerName: 'Architekturbüro Lindner & Partner',
      contact: angelegt['Architekturbüro Lindner & Partner'],
      startDate: tage(14),
      dueDate: tage(45),
      positions: [{ description: 'Theke 320 cm, Korpus Stahl, Auflage Eiche', quantity: 1, price: 5900 }],
    },
  ]
  const auftragIds: unknown[] = []
  for (const [i, a] of auftraege.entries()) {
    const d = await payload.create({
      collection: 'jobs',
      data: { jobNumber: `AU-2026-${String(11 + i).padStart(4, '0')}`, ...a } as never,
    })
    auftragIds.push(d.id)
    console.log('Auftrag:', a.title, a.status)
  }

  // --------------------------------------------------------------- Laufmarken
  /*
   * Die Codes kommen aus dem Nummernkreis und nicht aus der Schleife.
   *
   * Erst standen hier `M-001` bis `M-008` fest im Text — und der Zähler
   * `laufmarke` in `counters` blieb dabei auf 0 stehen. Die nächste Marke, die
   * das Büro anlegte, hieß deshalb wieder `M-001` und lief in die
   * Eindeutigkeitsprüfung: „Das folgende Feld ist nicht korrekt: code". Drei
   * Prüfungen sahen aus wie ein Fehler im Büro und waren einer hier.
   */
  for (let i = 1; i <= 8; i++) {
    const code = await naechsterMarkenCode(payload)
    const gekoppelt = i <= 3 ? auftragIds[0] : i <= 5 ? auftragIds[1] : null
    await payload.create({
      collection: 'job-tags',
      data: {
        code,
        auftrag: gekoppelt,
        gekoppeltAm: gekoppelt ? tage(-4) : null,
        notiz: gekoppelt ? 'An der Tafel, wandert mit dem Teil.' : null,
      } as never,
    })
    console.log('Laufmarke:', code, gekoppelt ? 'gekoppelt' : 'frei')
  }

  // ---------------------------------------------------------------- Ausgaben
  const ausgaben = [
    { title: 'Stahlblech und Vierkantrohr', supplierName: 'Stahlhandel Rheinau GmbH', category: 'material', netAmount: 1240.5, vatRate: 20, grossAmount: 1488.6, invoiceDate: tage(-22), paid: true },
    { title: 'Pulverlack, 3 Farben', supplierName: 'Lackzentrum Baden', category: 'material', netAmount: 318, vatRate: 20, grossAmount: 381.6, invoiceDate: tage(-15), paid: true },
    { title: 'Schweißgas, Flaschenmiete Quartal', supplierName: 'Gase Süd', category: 'material', netAmount: 96, vatRate: 20, grossAmount: 115.2, invoiceDate: tage(-9), paid: true },
    { title: 'Halle, Miete September', supplierName: 'Immobilien Lauterbourg', category: 'miete', netAmount: 850, vatRate: 0, grossAmount: 850, invoiceDate: tage(-6), paid: true },
    { title: 'Trennscheiben und Schleifmittel', supplierName: 'Werkzeug Kessler', category: 'werkzeug', netAmount: 214.8, vatRate: 20, grossAmount: 257.76, invoiceDate: tage(-3), paid: false, dueDate: tage(11) },
    { title: 'Diesel Transporter', supplierName: 'Tankstelle Lauterbourg', category: 'fahrzeug', netAmount: 132.4, vatRate: 20, grossAmount: 158.88, invoiceDate: tage(-2), paid: true },
  ]
  for (const a of ausgaben) {
    await payload.create({ collection: 'expenses', data: a as never })
    console.log('Ausgabe:', a.title)
  }

  // --------------------------------------------------------------- Rechnungen
  const rechnungen = [
    {
      invoiceNumber: 'RE-2026-0031',
      status: 'bezahlt',
      customerName: 'Marie Feldmann',
      issueDate: tage(-28),
      dueDate: tage(-14),
      paidDate: tage(-19),
      items: [{ description: 'Herz-Objekt, mittel', quantity: 1, unitPrice: 340, vatRate: 20 }],
      total: 408,
    },
    {
      invoiceNumber: 'RE-2026-0032',
      status: 'bezahlt',
      customerName: 'Tobias Renner',
      issueDate: tage(-16),
      dueDate: tage(-2),
      paidDate: tage(-8),
      items: [{ description: 'Deckenleuchte Kristall', quantity: 1, unitPrice: 690, vatRate: 20 }],
      total: 828,
    },
    {
      invoiceNumber: 'RE-2026-0033',
      status: 'gestellt',
      customerName: 'Hôtel du Parc, Strasbourg',
      issueDate: tage(-11),
      dueDate: tage(3),
      items: [{ description: 'Anzahlung Feuerstelle Terrasse', quantity: 1, unitPrice: 1590, vatRate: 20 }],
      total: 1908,
    },
    {
      invoiceNumber: 'RE-2026-0034',
      status: 'gestellt',
      customerName: 'Architekturbüro Lindner & Partner',
      issueDate: tage(-34),
      dueDate: tage(-6),
      items: [{ description: 'Entwurf und Statik Empfangstheke', quantity: 1, unitPrice: 640, vatRate: 20 }],
      total: 768,
    },
  ]
  for (const r of rechnungen) {
    await payload.create({ collection: 'outgoing-invoices', data: r as never })
    console.log('Rechnung:', r.invoiceNumber, r.status)
  }

  // ---------------------------------------------------------------- Anfragen
  const anfragen = [
    {
      type: 'massanfertigung',
      status: 'neu',
      name: 'Katrin Obermaier',
      email: 'k.obermaier@example.org',
      message:
        'Wir suchen eine Feuerschale für die Hotelterrasse, ungefähr 90 cm, passend zu den bestehenden Loungemöbeln. Ist das machbar und was kostet es ungefähr?',
    },
    {
      type: 'produkt',
      status: 'inBearbeitung',
      name: 'Peter Waldmann',
      email: 'p.waldmann@example.org',
      message: 'Gibt es den Outdoor-Sessel auch in Anthrazit statt Rot?',
    },
  ]
  for (const a of anfragen) {
    await payload.create({ collection: 'inquiries', data: a as never })
    console.log('Anfrage:', a.name)
  }

  console.log('\nBeispieldaten fürs Büro liegen. Alle Namen erfunden.')
}

await run()
process.exit(0)
