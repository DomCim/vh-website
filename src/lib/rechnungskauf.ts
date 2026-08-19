import type { Payload } from 'payload'

import { geplanteStufen, type Zahlplan } from './anzahlung'
import type { Locale } from './i18n'
import { rechnungskaufEmail, type CompanyInfo } from './mail'
import { variantenMinuten } from './material'
import { benachrichtige } from './push'
import { sendMail } from './sendMail'
import { firmenAngaben } from './settings'

/**
 * Kauf auf Rechnung im Shop.
 *
 * PayPal zieht das Geld sofort ein — die Rechnung nicht. Damit läuft eine
 * Rechnungs-Bestellung wie das Projektgeschäft: Es entsteht sofort ein
 * Fertigungsauftrag mit dem Zahlplan vom Artikel, die vorhandenen Auslöser
 * legen die Anzahlungsrechnung als Entwurf an (lib/rechnungsstufen.ts), das
 * Büro verschickt sie mit GiroCode — und gefertigt wird nach Zahlungseingang.
 * Es gibt bewusst keinen zweiten Rechnungsweg nur für den Shop.
 *
 * Zwei Dinge, die hier anders sind als bei `auftragAusBestellung`
 * (lib/orderHooks.ts, dem Weg für bezahlte PayPal-Bestellungen):
 *
 * **Die Preise stehen netto am Auftrag.** Der Shop rechnet brutto, die
 * Rechnung netto plus ausgewiesener Steuer. Stünden die Bruttopreise am
 * Auftrag, schlüge die Rechnung die Steuer ein zweites Mal drauf.
 *
 * **Alle Positionen kommen mit, auch Lagerware, Versand und Rabatt.** Der
 * Auftrag ist hier zugleich der Träger der Rechnung — was der Kunde schuldet,
 * muss vollständig draufstehen, sonst stimmt keine Stufe.
 */

type Bestellung = {
  id: number | string
  orderNumber: string
  total?: number | null
  subtotal?: number | null
  discount?: number | null
  shippingTotal?: number | null
  promotionTitle?: string | null
  deliveryMethod?: string | null
  accessToken?: string | null
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null
  shippingAddress?: {
    line1?: string | null
    line2?: string | null
    postalCode?: string | null
    city?: string | null
    country?: string | null
  } | null
  items?:
    | {
        product?: unknown
        titleSnapshot: string
        variantId?: string | null
        variantTitle?: string | null
        color?: string | null
        quantity: number
        unitPrice: number
      }[]
    | null
}

const runden = (n: number) => Math.round(n * 100) / 100

/** Brutto vom Shop → netto für die Rechnung. */
const netto = (brutto: number, satz: number) => runden(brutto / (1 + satz / 100))

/**
 * Der Geschäftspartner zur Bestellung — gefunden oder angelegt.
 *
 * Ohne Partner hätte die Rechnung aus dem Büro keine Empfängeradresse, und
 * das Kundenportal fände die Rechnungen nicht. Mit ihm läuft beides über
 * dieselben Wege wie im Projektgeschäft.
 */
async function partnerZurBestellung(payload: Payload, bestellung: Bestellung): Promise<number | undefined> {
  const email = bestellung.customer?.email?.toLowerCase().trim()
  if (!email) return undefined

  const { docs } = await payload.find({
    collection: 'contacts',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return docs[0].id as number

  const neu = await payload.create({
    collection: 'contacts',
    overrideAccess: true,
    data: {
      name: bestellung.customer?.name || email,
      role: 'kunde',
      email,
      phone: bestellung.customer?.phone || undefined,
    },
  })
  return neu.id as number
}

/** Der Zahlplan der Bestellung: vom teuersten Posten, der einen hat. */
async function zahlplanAusBestellung(payload: Payload, bestellung: Bestellung): Promise<Zahlplan> {
  let plan: Zahlplan = {}
  let teuerster = 0
  for (const pos of bestellung.items ?? []) {
    const id = typeof pos.product === 'object' ? (pos.product as { id?: number })?.id : pos.product
    if (typeof id !== 'number') continue
    const produkt = await payload
      .findByID({ collection: 'products', id, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!produkt) continue
    const anteil = (Number(produkt.anzahlungProzent) || 0) + (Number(produkt.zwischenProzent) || 0)
    const wert = pos.unitPrice * pos.quantity
    /*
     * Bei gemischtem Korb entscheidet das teuerste Stück mit Zahlplan: Es ist
     * das, dessen Fertigung das Geld bindet. Ein Mittelwert über den Korb wäre
     * eine Zahl, die an keinem Artikel steht und die niemandem erklärbar ist.
     */
    if (anteil > 0 && wert > teuerster) {
      teuerster = wert
      plan = {
        anzahlungProzent: Number(produkt.anzahlungProzent) || 0,
        zwischenProzent: Number(produkt.zwischenProzent) || 0,
      }
    }
  }
  return plan
}

/**
 * Die zugesagte Werkstattzeit einer Bestellung — Summe über die Artikel.
 *
 * Kennt ein Artikel seine Fertigungszeit nicht, bleibt die Summe
 * unvollständig; dann steht am Auftrag lieber nichts als eine zu kleine Zahl,
 * die in der Wochen-Auslastung eine freie Woche vortäuscht.
 */
async function geplanteMinuten(payload: Payload, bestellung: Bestellung): Promise<number | undefined> {
  let minuten = 0
  for (const pos of bestellung.items ?? []) {
    const id = typeof pos.product === 'object' ? (pos.product as { id?: number })?.id : pos.product
    if (typeof id !== 'number') return undefined
    const produkt = await payload
      .findByID({ collection: 'products', id, depth: 0, overrideAccess: true })
      .catch(() => null)
    // Die Zeit der bestellten Variante, sonst die des Artikels
    const dauer = produkt ? variantenMinuten(produkt, pos) : null
    if (!dauer) return undefined
    minuten += dauer * (pos.quantity || 1)
  }
  return minuten > 0 ? minuten : undefined
}

/**
 * Auftrag und Rechnungsentwurf zu einer Rechnungs-Bestellung.
 *
 * Gibt es einen Zahlplan, entsteht der Anzahlungsentwurf über den
 * vorhandenen Auslöser am Auftrag. Ohne Zahlplan legt diese Funktion selbst
 * einen vollständigen Rechnungsentwurf an — sonst gäbe es eine Bestellung,
 * auf die nie jemand eine Rechnung schreibt.
 */
export async function rechnungskaufAnlegen(payload: Payload, bestellung: Bestellung): Promise<void> {
  const einstellungen = (await payload.findGlobal({ slug: 'site-settings', depth: 0 })) as {
    company?: { vatRate?: number | null } | null
  }
  const satz = Number(einstellungen?.company?.vatRate) || 0

  const kontakt = await partnerZurBestellung(payload, bestellung)
  const plan = await zahlplanAusBestellung(payload, bestellung)

  /*
   * Der Artikelbezug wandert mit.
   *
   * Er trägt keine Zahl und keinen Text — nur das Bild, das später auf
   * Auftragsbestätigung, Lieferschein und Rechnung steht. Wer packt oder baut,
   * sieht damit sofort, worum es geht, statt eine Zeile zu lesen.
   */
  const positionen: {
    description: string
    quantity: number
    price: number
    product?: number
  }[] = (bestellung.items ?? []).map((p) => ({
    description: [p.titleSnapshot, p.variantTitle, p.color].filter(Boolean).join(' · '),
    quantity: p.quantity,
    price: netto(p.unitPrice, satz),
    product:
      typeof p.product === 'object' && p.product
        ? Number((p.product as { id?: number }).id)
        : (Number(p.product) || undefined),
  }))

  if ((bestellung.shippingTotal ?? 0) > 0) {
    positionen.push({ description: 'Versand', quantity: 1, price: netto(bestellung.shippingTotal!, satz) })
  }
  if ((bestellung.discount ?? 0) > 0) {
    positionen.push({
      description: bestellung.promotionTitle ? `Rabatt: ${bestellung.promotionTitle}` : 'Rabatt',
      quantity: 1,
      price: -netto(bestellung.discount!, satz),
    })
  }

  const auftrag = await payload.create({
    collection: 'jobs',
    overrideAccess: true,
    data: {
      title: `Bestellung ${bestellung.orderNumber} (Rechnung)`,
      status: 'geplant',
      source: 'shop',
      customerName: bestellung.customer?.name ?? undefined,
      contact: kontakt,
      order: Number(bestellung.id),
      plannedMinutes: await geplanteMinuten(payload, bestellung),
      zahlplan: plan,
      positions: positionen,
    },
  })

  // Ohne Stufen entsteht über die Auslöser nichts — dann eine vollständige
  // Rechnung als Entwurf, über den ganzen Betrag.
  if (geplanteStufen(plan).length === 0) {
    await payload.create({
      collection: 'outgoing-invoices',
      overrideAccess: true,
      data: {
        status: 'entwurf',
        stufe: 'vollstaendig',
        auftrag: Number(auftrag.id),
        customer: kontakt,
        customerName: bestellung.customer?.name ?? undefined,
        items: positionen.map((p) => ({
          description: p.description,
          quantity: p.quantity,
          unit: 'Stück',
          unitPrice: p.price,
          vatRate: satz,
          product: p.product,
        })),
        note: `Kauf auf Rechnung zur Bestellung ${bestellung.orderNumber}.`,
      },
    })
  }

  await benachrichtige(payload, {
    titel: 'Bestellung auf Rechnung',
    text: `${bestellung.orderNumber}: Rechnungsentwurf liegt bereit — prüfen und verschicken.`,
    url: '/office/rechnungen?filter=alle',
    tag: `rechnungskauf-${bestellung.id}`,
  }).catch(() => undefined)
}

/**
 * Kurze Eingangsbestätigung — die eigentliche Rechnung folgt aus dem Büro.
 *
 * Die Vorlage steht in `lib/mail.ts`, wie alle anderen auch: mit Logo, Corten-
 * Strich, den Positionen samt Summe und den Pflichtangaben im Fuß. Vorher war
 * das HTML hier von Hand gebaut — ohne Logo, ohne Fuß und ohne eine einzige
 * Zahl darin.
 */
export async function rechnungskaufBestaetigen(
  payload: Payload,
  bestellung: Bestellung,
  locale: Locale,
): Promise<void> {
  const email = bestellung.customer?.email
  if (!email) return

  // Firmierung und Handarbeits-Hinweis wie bei der PayPal-Bestätigung. Fehlen
  // sie, geht die Mail trotzdem raus — sie ist wichtiger als ihr Fuß.
  let firma: CompanyInfo | undefined
  let handarbeit: string | null = null
  try {
    const einstellungen = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
    firma = firmenAngaben(einstellungen)
    handarbeit = (einstellungen as { craft?: { notice?: string | null } })?.craft?.notice ?? null
  } catch (err) {
    payload.logger.warn({ err }, 'Firmenangaben für die Eingangsbestätigung nicht lesbar')
  }

  await sendMail(payload, {
    ...rechnungskaufEmail(
      {
        ...bestellung,
        total: bestellung.total ?? 0,
        subtotal: bestellung.subtotal ?? bestellung.total ?? 0,
      },
      locale,
      firma,
      handarbeit,
    ),
    art: 'bestellung',
    bezug: { order: bestellung.id },
  }).catch(() => undefined)
}
