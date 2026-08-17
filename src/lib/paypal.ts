import type { Payload } from 'payload'

import { getIntegrations } from './settings'

/**
 * PayPal Orders v2 API — server-seitig via Client-Credentials.
 * Konfiguration: Admin → Integrationen → PayPal (Client-ID/Secret, Sandbox).
 */

type PayPalConfig = {
  clientId: string
  clientSecret: string
  baseUrl: string
}

export async function paypalConfig(payload: Payload): Promise<PayPalConfig | null> {
  const { paypal } = await getIntegrations(payload)
  if (!paypal.clientId || !paypal.clientSecret) return null
  return {
    clientId: paypal.clientId,
    clientSecret: paypal.clientSecret,
    baseUrl: paypal.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com',
  }
}

export async function paypalConfigured(payload: Payload): Promise<boolean> {
  return (await paypalConfig(payload)) !== null
}

async function accessToken(cfg: PayPalConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`PayPal-Auth fehlgeschlagen: HTTP ${res.status}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export type PayPalShippingAddress = {
  line1?: string
  line2?: string
  postalCode?: string
  city?: string
  countryCode?: string
}

/** Legt eine PayPal-Order an und liefert Order-ID + Approval-URL zurück */
export async function createPayPalOrder(
  cfg: PayPalConfig,
  opts: {
    amountEUR: number
    orderNumber: string
    returnUrl: string
    cancelUrl: string
    /** 'paypal' = Adresse aus dem PayPal-Konto, 'provided' = mitgegebene Adresse, 'none' = Abholung */
    shippingMode: 'paypal' | 'provided' | 'none'
    providedAddress?: { name: string } & PayPalShippingAddress
  },
): Promise<{ id: string; approveUrl: string }> {
  const token = await accessToken(cfg)
  const shippingPreference =
    opts.shippingMode === 'none'
      ? 'NO_SHIPPING'
      : opts.shippingMode === 'provided'
        ? 'SET_PROVIDED_ADDRESS'
        : 'GET_FROM_FILE'

  const res = await fetch(`${cfg.baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: opts.orderNumber,
          description: `Bestellung ${opts.orderNumber} – Vincent Hellmann`,
          amount: {
            currency_code: 'EUR',
            value: opts.amountEUR.toFixed(2),
          },
          ...(opts.shippingMode === 'provided' && opts.providedAddress
            ? {
                shipping: {
                  name: { full_name: opts.providedAddress.name },
                  address: {
                    address_line_1: opts.providedAddress.line1,
                    address_line_2: opts.providedAddress.line2,
                    postal_code: opts.providedAddress.postalCode,
                    admin_area_2: opts.providedAddress.city,
                    country_code: opts.providedAddress.countryCode || 'DE',
                  },
                },
              }
            : {}),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            shipping_preference: shippingPreference,
            user_action: 'PAY_NOW',
            return_url: opts.returnUrl,
            cancel_url: opts.cancelUrl,
          },
        },
      },
    }),
  })
  const data = (await res.json()) as {
    id?: string
    links?: { rel: string; href: string }[]
    message?: string
  }
  if (!res.ok || !data.id) {
    throw new Error(`PayPal-Order fehlgeschlagen: ${data.message || `HTTP ${res.status}`}`)
  }
  const approveUrl = data.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href
  if (!approveUrl) throw new Error('PayPal-Order ohne Approval-Link')
  return { id: data.id, approveUrl }
}

/** Captured eine genehmigte PayPal-Order; liefert Capture-ID + Lieferadresse aus PayPal */
export async function capturePayPalOrder(
  cfg: PayPalConfig,
  paypalOrderId: string,
): Promise<{
  captureId?: string
  status: string
  shipping?: { name?: string } & PayPalShippingAddress
}> {
  const token = await accessToken(cfg)
  const res = await fetch(`${cfg.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const data = (await res.json()) as {
    status?: string
    purchase_units?: {
      payments?: { captures?: { id: string; status: string }[] }
      shipping?: {
        name?: { full_name?: string }
        address?: {
          address_line_1?: string
          address_line_2?: string
          postal_code?: string
          admin_area_2?: string
          country_code?: string
        }
      }
    }[]
    message?: string
  }
  if (!res.ok) {
    throw new Error(`PayPal-Capture fehlgeschlagen: ${data.message || `HTTP ${res.status}`}`)
  }
  const shipping = data.purchase_units?.[0]?.shipping
  return {
    status: data.status || 'UNKNOWN',
    captureId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
    shipping: shipping
      ? {
          name: shipping.name?.full_name,
          line1: shipping.address?.address_line_1,
          line2: shipping.address?.address_line_2,
          postalCode: shipping.address?.postal_code,
          city: shipping.address?.admin_area_2,
          countryCode: shipping.address?.country_code,
        }
      : undefined,
  }
}
