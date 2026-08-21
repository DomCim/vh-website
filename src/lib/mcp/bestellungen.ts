import { z } from 'zod'

import { db, fehler, type McpServer, ok } from './helpers'
import { BESTELL_STATUS, BESTELL_UEBERGAENGE, textKarte, werteVon } from '../listen'

type BestellStatus = (typeof BESTELL_STATUS)[number]['value']
const statusEnum = z.enum(werteVon(BESTELL_STATUS) as [BestellStatus, ...BestellStatus[]])

const STATUS_TEXT = textKarte(BESTELL_STATUS)

async function findeBestellung(payload: Awaited<ReturnType<typeof db>>, bestellnummer: string) {
  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: bestellnummer } },
    limit: 1,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

export function registerBestellungen(server: McpServer) {
  // ── Bestellungen ──────────────────────────────────────────────────────────
  server.registerTool(
    'bestellungen_liste',
    {
      description:
        'Listet Bestellungen, optional nach Status gefiltert (pending/paid/inProduction/shipped/cancelled).',
      inputSchema: { status: statusEnum.optional() },
    },
    async ({ status }) => {
      const payload = await db()
      const { docs, totalDocs } = await payload.find({
        collection: 'orders',
        where: status ? { status: { equals: status } } : undefined,
        sort: '-createdAt',
        limit: 50,
        overrideAccess: true,
      })
      return ok({
        anzahl: totalDocs,
        bestellungen: docs.map((o) => ({
          bestellnummer: o.orderNumber,
          status: o.status,
          statusText: STATUS_TEXT[o.status] ?? o.status,
          gesamt: o.total,
          kunde: o.customer?.name,
          email: o.customer?.email,
          datum: o.createdAt,
          positionen: (o.items ?? []).map(
            (i) => `${i.quantity}× ${i.titleSnapshot}${i.variantTitle ? ` (${i.variantTitle})` : ''}`,
          ),
        })),
      })
    },
  )

  server.registerTool(
    'bestellung_lesen',
    {
      description:
        'Liest eine Bestellung vollständig — Positionen, Kunde, Lieferadresse, Zahlungsart, Rabatt und Sendungsverfolgung.',
      inputSchema: { bestellnummer: z.string().describe('z.B. VH-2026-0001') },
    },
    async ({ bestellnummer }) => {
      const payload = await db()
      const o = await findeBestellung(payload, bestellnummer)
      if (!o) return fehler(`Bestellung ${bestellnummer} nicht gefunden`)
      return ok({
        bestellnummer: o.orderNumber,
        status: o.status,
        statusText: STATUS_TEXT[o.status] ?? o.status,
        datum: o.createdAt,
        kunde: {
          name: o.customer?.name,
          email: o.customer?.email,
          telefon: o.customer?.phone ?? null,
        },
        versandart: o.deliveryMethod === 'pickup' ? 'Abholung' : 'Lieferung',
        lieferadresse:
          o.deliveryMethod === 'pickup'
            ? null
            : {
                strasse: o.shippingAddress?.line1 ?? null,
                zusatz: o.shippingAddress?.line2 ?? null,
                plz: o.shippingAddress?.postalCode ?? null,
                ort: o.shippingAddress?.city ?? null,
                land: o.shippingAddress?.country ?? null,
              },
        positionen: (o.items ?? []).map((i) => ({
          bezeichnung: i.titleSnapshot,
          variante: i.variantTitle ?? null,
          farbe: i.color ?? null,
          menge: i.quantity,
          einzelpreis: i.unitPrice,
        })),
        summen: {
          zwischensumme: o.subtotal,
          rabatt: o.discount ?? 0,
          aktion: o.promotionTitle ?? null,
          versand: o.shippingTotal ?? 0,
          gesamt: o.total,
        },
        zahlung: o.paymentProvider,
        voraussichtlichFertig: o.expectedReady ?? null,
        sendungsnummer: o.trackingNumber ?? null,
        trackingLink: o.trackingUrl ?? null,
      })
    },
  )

  server.registerTool(
    'bestellung_in_fertigung',
    {
      description:
        'Meldet dem Kunden, dass sein Stück in Fertigung gegangen ist — mit optionalem voraussichtlichem Fertigstellungstermin. Es gibt keine Serienfertigung, deshalb ist das die längste Wartephase; die Meldung verschickt eine E-Mail.',
      inputSchema: {
        bestellnummer: z.string(),
        voraussichtlichFertig: z
          .string()
          .optional()
          .describe('z.B. "Ende April" oder "KW 18" — erscheint in der E-Mail'),
      },
    },
    async ({ bestellnummer, voraussichtlichFertig }) => {
      const payload = await db()
      const o = await findeBestellung(payload, bestellnummer)
      if (!o) return fehler(`Bestellung ${bestellnummer} nicht gefunden`)
      if (o.status === 'cancelled') {
        return fehler(`Bestellung ${bestellnummer} ist storniert.`)
      }
      // Eine unbezahlte Bestellung geht nicht in Fertigung — die Mail dazu
      // wäre eine Falschmeldung an die Kundschaft.
      if (o.status !== 'paid') {
        return fehler(
          `Bestellung ${bestellnummer} steht auf „${STATUS_TEXT[o.status ?? ''] ?? o.status}" — ` +
            'in Fertigung geht nur, was bezahlt ist. Es wurde nichts geändert.',
        )
      }
      await payload.update({
        collection: 'orders',
        id: o.id,
        overrideAccess: true,
        data: {
          status: 'inProduction',
          ...(voraussichtlichFertig !== undefined && { expectedReady: voraussichtlichFertig }),
        },
      })
      return ok({
        ok: true,
        bestellnummer,
        neuerStatus: 'inProduction',
        voraussichtlichFertig: voraussichtlichFertig ?? o.expectedReady ?? null,
        hinweis:
          'Die E-Mail zur Fertigung wurde angestoßen — ob sie ankam, weiß nur der Mailserver.',
      })
    },
  )

  server.registerTool(
    'bestellung_versenden',
    {
      description:
        'Stellt eine Bestellung auf „Versendet" und trägt dabei die Sendungsnummer ein — beides in einem Schritt, damit die Versand-Mail die Nummer enthält. Dieser Weg ist bestellung_status_setzen vorzuziehen.',
      inputSchema: {
        bestellnummer: z.string(),
        sendungsnummer: z.string().describe('Trackingnummer des Versanddienstleisters'),
        trackingLink: z.string().optional().describe('z.B. der DHL-Link zur Sendungsverfolgung'),
      },
    },
    async ({ bestellnummer, sendungsnummer, trackingLink }) => {
      const payload = await db()
      const o = await findeBestellung(payload, bestellnummer)
      if (!o) return fehler(`Bestellung ${bestellnummer} nicht gefunden`)
      if (o.status === 'shipped') {
        return fehler(`Bestellung ${bestellnummer} ist bereits als versendet erfasst.`)
      }
      await payload.update({
        collection: 'orders',
        id: o.id,
        overrideAccess: true,
        data: {
          status: 'shipped',
          trackingNumber: sendungsnummer,
          ...(trackingLink !== undefined && { trackingUrl: trackingLink }),
        },
      })
      return ok({
        ok: true,
        bestellnummer,
        neuerStatus: 'shipped',
        sendungsnummer,
        // Nicht „wurde verschickt": Die Mail hängt am Hook und läuft asynchron —
        // ob sie ankam, weiß dieses Werkzeug nicht.
        hinweis: 'Versand-Mail mit Sendungsnummer wurde angestoßen.',
      })
    },
  )

  server.registerTool(
    'bestellung_status_setzen',
    {
      description:
        'Setzt den Status einer Bestellung. Für den Versand besser bestellung_versenden nutzen (nimmt die Sendungsnummer mit), für die Fertigung bestellung_in_fertigung.',
      inputSchema: {
        bestellnummer: z.string().describe('z.B. VH-2026-0001'),
        status: statusEnum,
      },
    },
    async ({ bestellnummer, status }) => {
      const payload = await db()
      const o = await findeBestellung(payload, bestellnummer)
      if (!o) return fehler(`Bestellung ${bestellnummer} nicht gefunden`)
      /*
       * Nur erlaubte Übergänge: cancelled → paid oder shipped → pending hat
       * noch nie etwas repariert, aber schon Kundenmails ausgelöst, die nie
       * hätten rausgehen dürfen. Wer wirklich zurück muss, macht das im Büro.
       */
      const erlaubt = BESTELL_UEBERGAENGE[o.status ?? ''] ?? []
      if (o.status !== status && !erlaubt.includes(status)) {
        return fehler(
          `Von „${STATUS_TEXT[o.status ?? ''] ?? o.status}" geht es nicht nach ` +
            `„${STATUS_TEXT[status] ?? status}". ` +
            (erlaubt.length
              ? `Möglich wäre: ${erlaubt.map((s) => STATUS_TEXT[s] ?? s).join(', ')}.`
              : 'Dieser Stand ist endgültig — Änderungen daran macht das Büro.'),
        )
      }
      await payload.update({
        collection: 'orders',
        id: o.id,
        overrideAccess: true,
        data: { status },
      })
      return ok({
        ok: true,
        bestellnummer,
        neuerStatus: status,
        ...(status === 'shipped' && !o.trackingNumber
          ? {
              warnung:
                'Es war keine Sendungsnummer hinterlegt — die Versand-Mail wurde ohne Sendungsverfolgung angestoßen. Künftig bestellung_versenden verwenden.',
            }
          : {}),
      })
    },
  )
}
