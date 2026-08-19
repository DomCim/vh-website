import type { Payload } from 'payload'

import { geplanteStufen, type Zahlplan } from './anzahlung'
import { benachrichtige } from './push'
import { sendMail } from './sendMail'
import type { Locale } from './i18n'

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
  discount?: number | null
  shippingTotal?: number | null
  promotionTitle?: string | null
  deliveryMethod?: string | null
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null
  items?:
    | {
        product?: unknown
        titleSnapshot: string
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

  const positionen: { description: string; quantity: number; price: number }[] = (
    bestellung.items ?? []
  ).map((p) => ({
    description: [p.titleSnapshot, p.variantTitle, p.color].filter(Boolean).join(' · '),
    quantity: p.quantity,
    price: netto(p.unitPrice, satz),
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

const EINGANG: Record<Locale, { betreff: string; text: string }> = {
  de: {
    betreff: 'Ihre Bestellung {nummer} ist eingegangen – Vincent Hellmann',
    text: 'vielen Dank für Ihre Bestellung {nummer}. Sie erhalten in Kürze die Rechnung per E-Mail — mit einem QR-Code, den Sie einfach mit Ihrer Banking-App scannen. Die Fertigung beginnt, sobald die Zahlung eingegangen ist.',
  },
  fr: {
    betreff: 'Votre commande {nummer} est bien reçue – Vincent Hellmann',
    text: 'merci pour votre commande {nummer}. Vous recevrez prochainement la facture par e-mail — avec un QR code à scanner avec votre application bancaire. La fabrication démarre dès réception du paiement.',
  },
  en: {
    betreff: 'Your order {nummer} has been received – Vincent Hellmann',
    text: 'thank you for your order {nummer}. You will shortly receive the invoice by email — with a QR code you can scan with your banking app. Production starts once the payment has arrived.',
  },
}

/** Kurze Eingangsbestätigung — die eigentliche Rechnung folgt aus dem Büro. */
export async function rechnungskaufBestaetigen(
  payload: Payload,
  bestellung: Bestellung,
  locale: Locale,
): Promise<void> {
  const email = bestellung.customer?.email
  if (!email) return
  const t = EINGANG[locale] ?? EINGANG.de
  await sendMail(payload, {
    to: email,
    subject: t.betreff.replace('{nummer}', bestellung.orderNumber),
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:520px">
        <h1 style="font-size:18px;letter-spacing:2px;text-transform:uppercase">Vincent Hellmann</h1>
        <p>${bestellung.customer?.name ? `${bestellung.customer.name}, ` : ''}${t.text.replace('{nummer}', bestellung.orderNumber)}</p>
      </div>`,
    art: 'bestellung',
  }).catch(() => undefined)
}
