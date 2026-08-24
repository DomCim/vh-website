import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'

import {
  priceCart,
  nextOrderNumber,
  wareImKorb,
  type CheckoutItemInput,
  type DeliveryMethod,
} from '../../../../lib/checkout'
import { landName } from '../../../../lib/versand'
import { payloadClient } from '../../../../lib/data'
import { isLocale, type Locale } from '../../../../lib/i18n'
import {
  codeAnlegen,
  codeEinloesen,
  sitzungAusAnfrage,
  sitzungErzeugen,
} from '../../../../lib/kundenportal'
import { zugangscodeEmail, type CompanyInfo } from '../../../../lib/mail'
import { createPayPalOrder, paypalConfig } from '../../../../lib/paypal'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'
import { rechnungskaufAnlegen, rechnungskaufBestaetigen } from '../../../../lib/rechnungskauf'
import { sendMail } from '../../../../lib/sendMail'
import { firmenAngaben } from '../../../../lib/settings'

export const dynamic = 'force-dynamic'

type CheckoutBody = {
  items: CheckoutItemInput[]
  promoCode?: string
  locale?: string
  deliveryMethod?: DeliveryMethod
  paymentMethod?: 'paypal' | 'rechnung'
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
  consent?: { terms?: boolean; waiver?: boolean; sofortigeLieferung?: boolean }
  /** Sechsstelliger Code aus der Bestätigungs-Mail */
  emailCode?: string
}

/**
 * Firmierung, SIRET und TVA-Nummer für den Fuß der Mail.
 *
 * In Frankreich gehören sie unter jede geschäftliche E-Mail. Fehlen die
 * Einstellungen, geht der Code trotzdem raus — ohne ihn steht die Kasse.
 */
async function firmaLesen(
  payload: Awaited<ReturnType<typeof payloadClient>>,
): Promise<CompanyInfo | undefined> {
  try {
    return firmenAngaben(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
  } catch {
    return undefined
  }
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
    const paymentMethod = body.paymentMethod === 'rechnung' ? 'rechnung' : 'paypal'
    const hasProvidedAddress = Boolean(
      body.shippingAddress?.line1 && body.shippingAddress?.postalCode && body.shippingAddress?.city,
    )
    const payload = await payloadClient()

    /*
     * Was für Ware im Korb liegt, entscheidet über die nächsten zwei Fragen —
     * deshalb steht es vor ihnen und nicht erst beim Rechnen.
     */
    const { hatDigitales, nurDigital } = await wareImKorb(payload, body.items)

    // Bei PayPal kommt die Lieferadresse notfalls aus dem PayPal-Konto —
    // bei Rechnung gibt es diese Quelle nicht, da muss sie hier stehen.
    // Bei einem Korb voller Dateien wird nichts verschickt, also entfällt sie.
    if (
      paymentMethod === 'rechnung' &&
      deliveryMethod === 'shipping' &&
      !nurDigital &&
      !hasProvidedAddress
    ) {
      return NextResponse.json({ error: 'missing-address' }, { status: 400 })
    }

    /*
     * Digitale Inhalte werden sofort bereitgestellt, und damit erlischt das
     * Widerrufsrecht. Das darf nicht im Kleingedruckten stehen: Der Kunde
     * muss es ausdrücklich verlangen, sonst entsteht hier gar keine
     * Bestellung. Ohne diesen Nachweis wäre der Verkauf im Streitfall
     * rückabzuwickeln — bei einer Datei, die längst heruntergeladen ist.
     */
    if (hatDigitales && !body.consent?.sofortigeLieferung) {
      return NextResponse.json({ error: 'missing-digital-consent' }, { status: 400 })
    }

    /*
     * Dateien gibt es nur gegen Geld — also nicht auf Rechnung.
     *
     * Der Kauf auf Rechnung ist für das gebaut, was er ist: Projektgeschäft.
     * Es entsteht ein Fertigungsauftrag mit Anzahlung, Zwischen- und
     * Schlussrechnung, und geliefert wird nach Zahlungseingang. An einem
     * Bauplan ist nichts zu fertigen, und die Kette aus Teilrechnungen wäre
     * Papier ohne Gegenstand.
     *
     * Der handfeste Grund steht daneben: Eine Datei lässt sich nicht
     * zurückholen. „In Fertigung" gibt sie frei — bei einem Stück Stahl ist
     * das richtig, bei einer Datei bedeutet der Status nichts, und ein
     * unbedachter Klick im Büro hätte sie ohne Geld ausgeliefert. Diese
     * Schranke schließt die Möglichkeit, statt sich auf Umsicht zu verlassen.
     */
    if (hatDigitales && paymentMethod !== 'paypal') {
      return NextResponse.json({ error: 'digital-nur-paypal' }, { status: 400 })
    }


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
    const schonBestaetigt = sitzungAusAnfrage(req) === email
    let neueSitzung: ReturnType<typeof sitzungErzeugen> | null = null

    if (!schonBestaetigt) {
      if (!body.emailCode) {
        // Kein Code dabei: einen schicken und die Kasse um die Eingabe bitten.
        // 409, nicht 400 — die Anfrage ist nicht kaputt, es fehlt ein Schritt.
        const code = await codeAnlegen(payload, email)
        await sendMail(payload, {
          to: email,
          ...zugangscodeEmail(code, 'bestellung', locale, await firmaLesen(payload)),
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

    /*
     * Das Land geht mit in die Rechnung — es entscheidet über den Aufschlag.
     *
     * Nur beim Versand echter Ware: Bei Abholung und bei reinen Dateien gibt
     * es keine Anschrift, und `priceCart` fragt dann auch keine Zone ab.
     * Liegt das Land außerhalb der Zonen, wirft `priceCart` — das fängt der
     * Rahmen unten ab und die Kasse sagt es dem Kunden.
     */
    const lieferland =
      deliveryMethod === 'shipping' && !nurDigital ? body.shippingAddress?.country : undefined
    const cart = await priceCart(payload, body.items, body.promoCode, deliveryMethod, lieferland)
    const orderNumber = await nextOrderNumber(payload)

    // Bestellung als "offen" anlegen — bezahlt wird sie erst per Webhook
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber,
        accessToken: randomUUID(),
        status: 'pending',
        paymentProvider: paymentMethod,
        items: cart.lines.map((l) => ({
          product: typeof l.productId === 'string' ? Number(l.productId) : l.productId,
          titleSnapshot: l.titleSnapshot,
          variantId: l.variantId,
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
          deliveryMethod === 'shipping' && !nurDigital && hasProvidedAddress
            ? {
                line1: body.shippingAddress?.line1,
                line2: body.shippingAddress?.line2,
                postalCode: body.shippingAddress?.postalCode,
                city: body.shippingAddress?.city,
                /*
                 * Die Kasse schickt die Kennung; der lesbare Name entsteht
                 * hier, in der Sprache des Kunden. Kommt doch einmal ein
                 * ausgeschriebener Name herein — etwa aus einem alten
                 * Formular im Zwischenspeicher —, bleibt er stehen, statt
                 * durch ein Kürzel ersetzt zu werden.
                 */
                country: lieferland ? landName(lieferland, locale) : body.shippingAddress?.country,
                countryCode: lieferland?.trim().toUpperCase(),
              }
            : undefined,
        customerNote: body.note,
        // Zeitpunkt statt bloßem Haken: „hat zugestimmt" ohne Datum ist im
        // Zweifel nichts wert.
        consent: {
          termsAt: body.consent?.terms ? new Date().toISOString() : undefined,
          waiver: Boolean(body.consent?.waiver),
          digitalAt: hatDigitales ? new Date().toISOString() : undefined,
        },
      },
    })

    const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    // ── Kauf auf Rechnung ─────────────────────────────────────────────────
    //
    // Ist fast Projektgeschäft — jedes Stück entsteht ohnehin einzeln. Es
    // entsteht sofort der Fertigungsauftrag mit dem Zahlplan vom Artikel,
    // die Anzahlungsrechnung liegt dem Büro als Entwurf vor, und der Kunde
    // landet auf seiner Bestellseite statt bei einem Zahlungsdienst.
    if (paymentMethod === 'rechnung') {
      await rechnungskaufAnlegen(payload, order)
      await rechnungskaufBestaetigen(payload, order, locale)

      const antwort = NextResponse.json({
        url: `${serverURL}/${locale}/bestellung/${order.accessToken}`,
      })
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
    }

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
            /*
             * Die Kennung kommt jetzt aus der Kasse und muss nicht mehr aus
             * dem Ländernamen erraten werden. Die frühere Übersetzungstabelle
             * fiel bei allem, was sie nicht kannte, auf „DE" zurück — eine
             * Bestellung nach Belgien meldete PayPal damit als deutsche.
             */
            countryCode: (lieferland || 'FR').trim().toUpperCase(),
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

    /*
     * Ein Land außerhalb der Zonen ist kein Fehler der Anwendung.
     *
     * Über die Kasse ist es kaum zu erreichen — sie bietet nur an, wohin
     * geliefert wird. Erreichbar ist es trotzdem: Wer das Formular offen hat,
     * während ein Land aus einer Zone genommen wird, schickt beim Abschicken
     * noch das alte. „Bitte versuchen Sie es erneut" wäre dort die falsche
     * Auskunft — Wiederholen hilft nicht, ein anderes Land schon.
     */
    if (/Dorthin wird nicht geliefert/.test(text)) {
      return NextResponse.json({ error: 'land-nicht-lieferbar' }, { status: 400 })
    }

    return NextResponse.json({ error: 'checkout-failed' }, { status: 500 })
  }
}
