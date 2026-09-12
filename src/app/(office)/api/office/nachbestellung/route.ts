import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { briefbogen } from '../../../../../lib/mail'
import { nachrichtSenden, postfachFinden } from '../../../../../lib/postfach'
import { sendMail } from '../../../../../lib/sendMail'
import { firmenAngaben } from '../../../../../lib/settings'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Nachbestellen — Anfrage, Vermerk und was danach mit der Bestellung passiert.
 *
 * **Was sich hier geändert hat.** Früher setzte diese Strecke nur ein Datum
 * an jeden Inventarposten (`reorderedAt`) und war fertig. Damit war die
 * bestellte Menge weg, eine Anfrage galt sofort als Bestellung, es gab keinen
 * Beleg, und eine Teillieferung hob den Riegel gegen die Doppelbestellung
 * aus. Jetzt entsteht ein richtiger Vorgang: eine Lieferantenbestellung mit
 * Nummer, Zeilen, Mengen und Stand (siehe `collections/SupplierOrders.ts`).
 *
 * Vier Handgriffe, und jeder entspricht dem, was im Betrieb wirklich
 * passiert:
 *
 *  - `senden` — Anfrage per Mail raus, Bestellung entsteht als `angefragt`.
 *    Preis und Termin stehen noch aus.
 *  - `vermerken` — **ohne Mail**. Für alles, was woanders bestellt wird:
 *    Amazon, Telefon, Portal, Laden. Die Bestellung entsteht gleich als
 *    `bestellt`, und wo bestellt wurde, steht als Text daran — dafür muss
 *    niemand Amazon als Geschäftspartner anlegen.
 *  - `bestellen` — aus der Anfrage wird eine Bestellung, wenn der Lieferant
 *    geantwortet hat. Zugesagter Termin und Preise wandern mit hinein.
 *  - `stornieren` — kommt doch nicht. Die Posten stehen wieder zum Bestellen.
 *
 * **Etwas Neues bestellen, das es im Lager noch nicht gibt.** Bisher musste
 * man es erst im Inventar anlegen, ihm einen Mindestbestand geben und warten,
 * bis es darunter rutscht — nur damit es überhaupt auf dieser Seite auftaucht.
 * Das ist der Weg rückwärts. Jetzt genügen Name, Menge und Einheit: Der
 * Posten entsteht mit Bestand 0 und wird beim Wareneingang gefüllt. Ein
 * Mindestbestand kann später dazu, muss aber nicht — nicht alles, was man
 * einmal kauft, gehört dauerhaft bevorratet.
 *
 * Verschickt wird bevorzugt über ein Postfach — dann liegt die Anfrage als
 * Kopie in „Gesendet", und die Antwort des Lieferanten landet dort, wo sie
 * gelesen wird. Ohne Postfach geht sie über den normalen Mailweg hinaus,
 * statt den Versand zu blockieren.
 */

type Zeile = { item: number | string; menge: number; preis?: number | null }

/** Etwas, das es im Inventar noch nicht gibt. */
type NeuerPosten = {
  name: string
  menge: number
  einheit?: string
  artikelnummer?: string
  preis?: number | null
}

export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'inventar.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      aktion?: 'senden' | 'vermerken' | 'bestellen' | 'stornieren'
      an?: string
      betreff?: string
      text?: string
      fach?: string
      /** Bei `senden` und `vermerken`: was bestellt wird */
      zeilen?: Zeile[]
      /** Dasselbe für Dinge, die es im Inventar noch nicht gibt */
      neu?: NeuerPosten[]
      lieferant?: number | string | null
      /** Freier Text — „Amazon", „Baumarkt", oder der Name des Lieferanten */
      wo?: string
      /** Bei `bestellen` und `stornieren`: welche Bestellung */
      bestellung?: number | string
      zugesagtAm?: string | null
      notiz?: string
    }

    const jetzt = new Date().toISOString()

    /**
     * Für alles Neue erst einen Inventarposten anlegen.
     *
     * Mit Bestand 0 und ohne Mindestbestand: Der Bestand kommt mit der
     * Lieferung, und ob das Stück dauerhaft bevorratet werden soll, ist eine
     * zweite Frage — die beantwortet man später am Posten, wenn man es weiß.
     */
    const neueAnlegen = async (): Promise<Zeile[]> => {
      const erzeugt: Zeile[] = []
      for (const n of b.neu ?? []) {
        const name = String(n?.name ?? '').trim()
        const menge = Number(n?.menge) || 0
        if (!name || menge <= 0) continue
        const posten = await payload.create({
          collection: 'inventory-items',
          overrideAccess: true,
          data: {
            name,
            type: 'material',
            quantity: 0,
            unit: (n.einheit ?? '').trim() || 'Stück',
            supplier: b.lieferant == null ? undefined : Number(b.lieferant),
            supplierRef: (n.artikelnummer ?? '').trim() || undefined,
          },
        })
        erzeugt.push({ item: posten.id, menge, preis: n.preis ?? null })
      }
      return erzeugt
    }

    /** Eine Bestellung anlegen — der gemeinsame Teil von `senden` und `vermerken`. */
    const anlegen = async (stand: 'angefragt' | 'bestellt') => {
      const zeilen = [
        ...(b.zeilen ?? []).filter((z) => z?.item && (z.menge ?? 0) > 0),
        ...(await neueAnlegen()),
      ]
      if (!zeilen.length) return null
      return payload.create({
        collection: 'supplier-orders',
        overrideAccess: true,
        data: {
          status: stand,
          supplier: b.lieferant == null ? undefined : Number(b.lieferant),
          supplierName: (b.wo ?? '').trim() || undefined,
          requestedAt: stand === 'angefragt' ? jetzt : undefined,
          orderedAt: stand === 'bestellt' ? jetzt : undefined,
          note: (b.notiz ?? '').trim() || undefined,
          lines: zeilen.map((z) => ({
            item: Number(z.item),
            quantity: z.menge,
            deliveredQuantity: 0,
            price: z.preis ?? undefined,
          })),
        },
      })
    }

    if (b.aktion === 'stornieren') {
      if (!b.bestellung) return NextResponse.json({ error: 'keine-bestellung' }, { status: 400 })
      await payload.update({
        collection: 'supplier-orders',
        id: b.bestellung,
        overrideAccess: true,
        data: { status: 'storniert' },
      })
      return NextResponse.json({ ok: true })
    }

    if (b.aktion === 'bestellen') {
      if (!b.bestellung) return NextResponse.json({ error: 'keine-bestellung' }, { status: 400 })
      const vorher = await payload.findByID({
        collection: 'supplier-orders',
        id: b.bestellung,
        depth: 0,
        overrideAccess: true,
      })
      /*
       * Preise kommen zeilenweise mit, wenn der Lieferant sie genannt hat.
       * Fehlt eine, bleibt die alte stehen — ein leeres Feld soll keinen
       * schon eingetragenen Preis löschen.
       */
      const preise = new Map((b.zeilen ?? []).map((z) => [String(z.item), z.preis]))
      await payload.update({
        collection: 'supplier-orders',
        id: b.bestellung,
        overrideAccess: true,
        data: {
          status: 'bestellt',
          orderedAt: jetzt,
          expectedAt: b.zugesagtAm || undefined,
          ...(b.notiz !== undefined ? { note: b.notiz } : {}),
          lines: (vorher.lines ?? []).map((z) => {
            const neu = preise.get(String((z as { item?: unknown }).item))
            return neu == null ? z : { ...z, price: neu }
          }),
        },
      })
      return NextResponse.json({ ok: true })
    }

    if (b.aktion === 'vermerken') {
      const bestellung = await anlegen('bestellt')
      if (!bestellung) return NextResponse.json({ error: 'keine-posten' }, { status: 400 })
      return NextResponse.json({ ok: true, bestellung: bestellung.orderNumber })
    }

    // ── Anfrage per Mail ──────────────────────────────────────────────────
    const an = String(b.an ?? '').trim()
    if (!an) return NextResponse.json({ error: 'keine-adresse' }, { status: 400 })

    const betreff = String(b.betreff ?? '').trim() || 'Bestellanfrage'
    const text = String(b.text ?? '').trim()
    if (!text) return NextResponse.json({ error: 'kein-text' }, { status: 400 })

    const bestellung = await anlegen('angefragt')
    if (!bestellung) return NextResponse.json({ error: 'keine-posten' }, { status: 400 })

    const angaben = firmenAngaben(
      await payload.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null),
    )
    const html = briefbogen(
      text
        .split(/\n{2,}/)
        .map((absatz) => `<p style="white-space:pre-line">${absatz}</p>`)
        .join(''),
      angaben,
    )

    const fach = await postfachFinden(payload, b.fach)
    if (fach) {
      await nachrichtSenden(payload, fach, { an, betreff, text })
    } else {
      await sendMail(payload, { to: an, subject: betreff, html, art: 'sonstiges' })
    }

    return NextResponse.json({
      ok: true,
      an,
      bestellung: bestellung.orderNumber,
      ueberPostfach: Boolean(fach),
    })
  } catch (err) {
    console.error('Nachbestellung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
