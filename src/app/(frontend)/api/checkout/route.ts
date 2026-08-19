import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'

import {
  priceCart,
  nextOrderNumber,
  type CheckoutItemInput,
  type DeliveryMethod,
} from '../../../../lib/checkout'
import { payloadClient } from '../../../../lib/data'
import { isLocale, type Locale } from '../../../../lib/i18n'
import {
  codeAnlegen,
  codeEinloesen,
  sitzungErzeugen,
  sitzungLesen,
  SITZUNGS_COOKIE,
} from '../../../../lib/kundenportal'
import { createPayPalOrder, paypalConfig } from '../../../../lib/paypal'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'
import { sendMail } from '../../../../lib/sendMail'

export const dynamic = 'force-dynamic'

type CheckoutBody = {
  items: CheckoutItemInput[]
  promoCode?: string
  locale?: string
  deliveryMethod?: DeliveryMethod
  customer: {
    name: string
    email: string
    phone?: string
  }
  shippingAddress?: {
    line1?: string
    line2?: string
    postalCode?: string
    city?: string
    country?: string
  }
  note?: string
  consent?: { terms?: boolean; waiver?: boolean }
  /** Sechsstelliger Code aus der Bestätigungs-Mail */
  emailCode?: string
}

/** Das vh-konto-Cookie aus dem Header, ohne next/headers zu bemühen. */
function kontoCookie(req: Request): string | undefined {
  const kopf = req.headers.get('cookie') ?? ''
  for (const teil of kopf.split(';')) {
    const [name, ...rest] = teil.trim().split('=')
    if (name === SITZUNGS_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export async function POST(req: Request) {
  try {
    // Jede Kasse legt eine Bestellung an und ruft PayPal — ohne Bremse ließe
    // sich damit die Nummernreihe zumüllen.
    if (zuVieleAnfragen(`kasse:${ipAus(req)}`, 20, 10 * 60_000)) {
      return NextResponse.json({ error: 'too-many-requests' }, { status: 429 })
    }

    const body = (await req.json()) as CheckoutBody
    const locale: Locale = body.locale && isLocale(body.locale) ? body.locale : 'de'

    const deliveryMethod: DeliveryMethod = body.deliveryMethod === 'pickup' ? 'pickup' : 'shipping'

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'empty-cart' }, { status: 400 })
    }
    if (!body.customer?.name || !body.customer?.email) {
      return NextResponse.json({ error: 'missing-fields' }, { status: 400 })
    }
    const hasProvidedAddress = Boolean(
      body.shippingAddress?.line1 && body.shippingAddress?.postalCode && body.shippingAddress?.city,
    )

    const payload = await payloadClient()

    /*
     * Erst die Adresse, dann die Bestellung.
     *
     * Die Bestätigungsmail, der Zugang zum Kundenportal, die Versandmeldung —
     * alles hängt an dieser einen Adresse. Ein Tippfehler hieße: Der Kunde
     * bekommt nichts davon, und wer die vertippte Adresse wirklich besitzt,
     * könnte sich später im Portal anmelden und eine fremde Bestellung samt
     * Anschrift sehen.
     *
     * Deshalb wird sie bestätigt, bevor eine Bestellung entsteht — mit
     * derselben Code-Maschinerie wie die Portal-Anmeldung. Wer schon eine
     * gültige Portal-Sitzung für genau diese Adresse hat, überspringt den
     * Schritt: Bestätigt ist bestätigt.
     */
    const email = body.customer.email.trim().toLowerCase()
    const schonBestaetigt = sitzungLesen(kontoCookie(req)) === email
    let neueSitzung: ReturnType<typeof sitzungErzeugen> | null = null

    if (!schonBestaetigt) {
      if (!body.emailCode) {
        // Kein Code dabei: einen schicken und die Kasse um die Eingabe bitten.
        // 409, nicht 400 — die Anfrage ist nicht kaputt, es fehlt ein Schritt.
        const code = await codeAnlegen(payload, email)
        await sendMail(payload, {
          to: email,
          subject: `Ihr Bestätigungscode: ${code} – Vincent Hellmann`,
          html: `
            <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:520px">
              <h1 style="font-size:18px;letter-spacing:2px;text-transform:uppercase">Vincent Hellmann</h1>
              <p>Ihr Code, um die Bestellung abzuschließen:</p>
              <p style="font-size:30px;letter-spacing:8px;font-weight:bold;margin:18px 0">${code}</p>
              <p style="color:#666;font-size:13px">Der Code gilt 10 Minuten. Wenn Sie nichts bestellt
              haben, können Sie diese Nachricht einfach löschen — ohne den Code passiert nichts.</p>
            </div>`,
          art: 'zugangscode',
        })
        return NextResponse.json({ error: 'code-noetig' }, { status: 409 })
      }

      const pruefung = await codeEinloesen(payload, email, body.emailCode.replace(/\D/g, ''))
      if (pruefung !== 'ok') {
        return NextResponse.json({ error: `code-${pruefung}` }, { status: 400 })
      }
      // Bestätigt heißt angemeldet: Derselbe Nachweis öffnet das Kundenportal.
      neueSitzung = sitzungErzeugen(email)
    }

    const cart = await priceCart(payload, body.items, body.promoCode, deliveryMethod)
    const orderNumber = await nextOrderNumber(payload)

    // Bestellung als "offen" anlegen — bezahlt wird sie erst per Webhook
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber,
        accessToken: randomUUID(),
        status: 'pending',
        paymentProvider: 'paypal',
        items: cart.lines.map((l) => ({
          product: typeof l.productId === 'string' ? Number(l.productId) : l.productId,
          titleSnapshot: l.titleSnapshot,
          variantTitle: l.variantTitle,
          color: l.color,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        subtotal: cart.subtotal,
        discount: cart.discount,
        shippingTotal: cart.shippingTotal,
        total: cart.total,
        promotionTitle: cart.promotionTitle,
        deliveryMethod,
        customer: {
          name: body.customer.name,
          email,
          phone: body.customer.phone,
        },
        shippingAddress:
          deliveryMethod === 'shipping' && hasProvidedAddress
            ? {
                line1: body.shippingAddress?.line1,
                line2: body.shippingAddress?.line2,
                postalCode: body.shippingAddress?.postalCode,
                city: body.shippingAddress?.city,
                country: body.shippingAddress?.country,
              }
            : undefined,
        customerNote: body.note,
        // Zeitpunkt statt bloßem Haken: „hat zugestimmt" ohne Datum ist im
        // Zweifel nichts wert.
        consent: {
          termsAt: body.consent?.terms ? new Date().toISOString() : undefined,
          waiver: Boolean(body.consent?.waiver),
        },
      },
    })

    const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    // ── PayPal ────────────────────────────────────────────────────────────
    const cfg = await paypalConfig(payload)
    if (!cfg) {
      /*
       * 503, nicht 500: Wiederholen hilft hier nichts, und die Kasse sagt der
       * Kundschaft daraufhin, dass sie uns kurz schreiben soll — statt sie
       * dreimal auf denselben Knopf drücken zu lassen.
       */
      return NextResponse.json({ error: 'zahlung-nicht-eingerichtet' }, { status: 503 })
    }
    // PayPal hängt ?token=<order-id> selbst an die Return-URL an
    const countryToCode: Record<string, string> = {
      deutschland: 'DE', germany: 'DE', allemagne: 'DE',
      frankreich: 'FR', france: 'FR',
      österreich: 'AT', austria: 'AT', autriche: 'AT',
      schweiz: 'CH', switzerland: 'CH', suisse: 'CH',
    }
    const paypalOrder = await createPayPalOrder(cfg, {
      amountEUR: cart.total,
      orderNumber,
      returnUrl: `${serverURL}/${locale}/bestellung/danke`,
      cancelUrl: `${serverURL}/${locale}/kasse?cancelled=1`,
      shippingMode:
        deliveryMethod === 'pickup' ? 'none' : hasProvidedAddress ? 'provided' : 'paypal',
      providedAddress: hasProvidedAddress
        ? {
            name: body.customer.name,
            line1: body.shippingAddress?.line1,
            line2: body.shippingAddress?.line2,
            postalCode: body.shippingAddress?.postalCode,
            city: body.shippingAddress?.city,
            countryCode:
              countryToCode[(body.shippingAddress?.country || '').trim().toLowerCase()] || 'DE',
          }
        : undefined,
    })
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { paypalOrderId: paypalOrder.id },
    })
    const antwort = NextResponse.json({ url: paypalOrder.approveUrl })
    if (neueSitzung) {
      antwort.cookies.set(neueSitzung.name, neueSitzung.wert, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: neueSitzung.maxAge,
      })
    }
    return antwort
  } catch (err) {
    console.error('Checkout fehlgeschlagen:', err)

    /*
     * „Bitte versuchen Sie es erneut" ist die falsche Auskunft, wenn Wiederholen
     * gar nicht helfen kann. Ist die Bezahlung nicht eingerichtet, scheitert
     * jeder weitere Versuch genauso — und die Kundschaft probiert es dreimal,
     * gibt auf und schreibt keine Mail.
     *
     * Was sie sieht, bleibt trotzdem allgemein: Wie der Betrieb seine Zahlungen
     * abwickelt und was davon fehlt, geht Fremde nichts an. Der Grund steht im
     * Protokoll, dort gehört er hin.
     */
    const text = err instanceof Error ? err.message : ''
    if (/nicht konfiguriert|not configured/i.test(text)) {
      return NextResponse.json({ error: 'zahlung-nicht-eingerichtet' }, { status: 503 })
    }

    return NextResponse.json({ error: 'checkout-failed' }, { status: 500 })
  }
}
