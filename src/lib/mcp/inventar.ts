import type { Where } from 'payload'
import { z } from 'zod'

import { bewegung } from '../bestandsbewegung'
import { db, fehler, ok, type McpServer } from './helpers'

/**
 * Das Lager von außen — lesen, anlegen, buchen.
 *
 * **Warum es diese Werkzeuge gibt.** Das Inventar war das einzige Stück
 * Betrieb, das der Assistent nur ansehen durfte. Für den Alltag reicht das
 * Büro; für die erstmalige Übernahme reicht es nicht. Wer eine gewachsene
 * Liste — Schrauben, Bleche, Farben — in den Betrieb holt, will sie einmal
 * ansagen und nicht zweihundertmal ein Formular ausfüllen. Genau dafür ist
 * der Assistent da, und danach nie wieder: Gepflegt wird im Büro.
 *
 * **Warum Bestand nur gebucht und nie gesetzt wird.** Der Verlauf am Posten
 * beantwortet die Frage „warum sind aus 50 plötzlich 48 geworden?" — und er
 * taugt nur, solange **jede** Änderung dort landet. Genau das war hier schon
 * einmal kaputt: Inventurabschluss und Bearbeiten-Formular setzten die Zahl
 * wortlos, und wer nachrechnete, fand Löcher an den Stellen, an denen am
 * meisten korrigiert wird (siehe `lib/bestandsbewegung.ts`). Ein
 * `material_aendern`, das `bestand` entgegennimmt, risse dasselbe Loch wieder
 * auf — nur diesmal von außen, wo niemand mehr nachsehen kann. Deshalb kennt
 * das Ändern die Menge gar nicht; dafür gibt es `bestand_buchen`, und das
 * verlangt eine Veränderung und einen Grund.
 *
 * **Warum der Lieferant über den Namen kommt und nicht angelegt wird.** Ein
 * Tippfehler im Namen brächte sonst stillschweigend einen zweiten Händler in
 * die Kartei, und aufgefallen wäre es erst bei der nächsten Bestellanfrage.
 * Unbekannte Namen werden deshalb abgewiesen und aufgezählt — anlegen kann
 * man sie mit `partner_anlegen`, ausdrücklich und einzeln.
 */

const ARTEN = ['material', 'werkzeug', 'maschine', 'fertigware', 'sonstiges'] as const

const euro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

/** Wer im Verlauf steht, wenn über den Assistenten gebucht wurde */
const URHEBER = 'KI-Assistent'

type Posten = Record<string, any>

/** Die kurze Fassung eines Postens — das, was in einer Liste zählt */
function kurz(m: Posten) {
  const bestand = Number(m.quantity) || 0
  const mindest = Number(m.minQuantity) || 0
  return {
    id: m.id,
    name: m.name,
    art: m.type ?? null,
    bestand,
    einheit: m.unit ?? null,
    mindestbestand: mindest || null,
    knapp: mindest > 0 && bestand <= mindest,
    lagerort: m.location ?? null,
    // Was ohne Preis dasteht, taucht in keiner Nachkalkulation auf
    wert_je_einheit: m.unitValue ? euro(Number(m.unitValue)) : null,
  }
}

/**
 * Einen Lieferanten über seinen Namen finden.
 *
 * Gibt `undefined` zurück, wenn nichts gesucht wurde, und `null`, wenn gesucht
 * und nichts gefunden wurde — der Aufrufer unterscheidet daran „nicht
 * angegeben" von „gibt es nicht".
 */
async function lieferantFinden(
  payload: Awaited<ReturnType<typeof db>>,
  name?: string,
): Promise<number | null | undefined> {
  const gesucht = name?.trim()
  if (!gesucht) return undefined
  const { docs } = await payload.find({
    collection: 'contacts',
    where: { name: { equals: gesucht } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (docs[0]?.id as number) ?? null
}

export function registerInventar(server: McpServer) {
  // ── Was da ist ────────────────────────────────────────────────────────────
  server.registerTool(
    'material_liste',
    {
      description:
        'Lagerbestand. Standardmäßig nur, was unter dem Mindestbestand liegt — die Frage ' +
        'ist fast immer „was muss ich nachbestellen?".',
      inputSchema: {
        alles: z.boolean().optional().describe('true = der ganze Bestand, nicht nur das Knappe'),
        suche: z.string().optional().describe('Suchbegriff im Namen'),
        art: z
          .enum(ARTEN)
          .optional()
          .describe('Nur eine Art: material, werkzeug, maschine, fertigware, sonstiges'),
      },
    },
    async ({ alles, suche, art }) => {
      const payload = await db()
      const bedingungen: Where[] = []
      if (suche) bedingungen.push({ name: { contains: suche } })
      if (art) bedingungen.push({ type: { equals: art } })

      const { docs } = await payload.find({
        collection: 'inventory-items',
        ...(bedingungen.length ? { where: { and: bedingungen } } : {}),
        limit: 500,
        depth: 0,
        overrideAccess: true,
        sort: 'name',
      })

      const posten = docs.map(kurz).filter((m) => (alles ? true : m.knapp))
      return ok({ anzahl: posten.length, posten })
    },
  )

  server.registerTool(
    'material_lesen',
    {
      description:
        'Ein Posten vollständig — mit Lieferant, Anschaffung und dem Bestandsverlauf. ' +
        'Vor dem Buchen oder Ändern aufrufen.',
      inputSchema: {
        id: z.number().describe('Kennung des Postens (siehe material_liste)'),
      },
    },
    async ({ id }) => {
      const payload = await db()
      const m = (await payload
        .findByID({ collection: 'inventory-items', id, depth: 1, overrideAccess: true })
        .catch(() => null)) as Posten | null
      if (!m) return fehler(`Einen Posten mit der Kennung ${id} gibt es nicht.`)

      return ok({
        ...kurz(m),
        nachbestellmenge: m.orderQuantity ?? null,
        artikelnummer_beim_lieferanten: m.supplierRef ?? null,
        lieferant: m.supplier?.name ?? null,
        angeschafft_am: m.purchaseDate ?? null,
        anschaffungswert: m.purchaseValue ? euro(Number(m.purchaseValue)) : null,
        zugehoeriges_produkt: m.product?.title ?? null,
        notiz: m.notes ?? null,
        // Absteigend: Die Frage ist „was war zuletzt?", nicht „was war 2019?"
        verlauf: [...(m.movements ?? [])].reverse().slice(0, 50).map((b: Posten) => ({
          wann: b.day ?? null,
          veraenderung: b.delta ?? null,
          bestand_danach: b.rest ?? null,
          grund: b.reason ?? null,
          von: b.who ?? null,
        })),
      })
    },
  )

  // ── Anlegen und ändern ────────────────────────────────────────────────────
  server.registerTool(
    'material_anlegen',
    {
      description:
        'Einen neuen Posten ins Lager aufnehmen. Gedacht für die erstmalige Übernahme einer ' +
        'vorhandenen Liste — im Alltag wird im Büro erfasst. Ein Anfangsbestand landet als ' +
        'erste Zeile im Verlauf.',
      inputSchema: {
        name: z.string().describe('Bezeichnung, z.B. „Sechskantschraube M8 × 40, verzinkt"'),
        art: z
          .enum(ARTEN)
          .optional()
          .describe('Standard: material. Werkzeug und Maschine tauchen nicht im Materialwert auf.'),
        bestand: z.number().optional().describe('Anfangsbestand; Standard 0'),
        einheit: z.string().optional().describe('Standard „Stück"; sonst z.B. „m", „kg", „Liter"'),
        mindestbestand: z
          .number()
          .optional()
          .describe('Darunter meldet sich das Büro. Weglassen heißt: keine Meldung.'),
        nachbestellmenge: z
          .number()
          .optional()
          .describe('Übliche Bestellmenge, z.B. eine ganze Rolle'),
        artikelnummer: z.string().optional().describe('Artikelnummer beim Lieferanten'),
        wert_je_einheit: z.number().optional().describe('Netto in EUR — ohne ihn keine Nachkalkulation'),
        lagerort: z.string().optional(),
        lieferant: z
          .string()
          .optional()
          .describe('Name genau wie in der Partnerkartei. Unbekannte Namen werden abgewiesen.'),
        angeschafft_am: z.string().optional().describe('JJJJ-MM-TT — sinnvoll bei Werkzeug und Maschine'),
        anschaffungswert: z.number().optional().describe('Netto in EUR, für die Abschreibung'),
        notiz: z.string().optional(),
      },
    },
    async (e) => {
      const payload = await db()
      const name = e.name?.trim()
      if (!name) return fehler('Ohne Bezeichnung geht es nicht.')

      const lieferant = await lieferantFinden(payload, e.lieferant)
      if (lieferant === null) {
        return fehler(
          `Einen Geschäftspartner „${e.lieferant}" gibt es nicht. Entweder den Namen genau so ` +
            'schreiben, wie er in der Kartei steht (partner_liste), oder ihn zuerst mit ' +
            'partner_anlegen aufnehmen.',
        )
      }

      const menge = Number(e.bestand) || 0
      const doc = await payload.create({
        collection: 'inventory-items',
        overrideAccess: true,
        data: {
          name,
          type: e.art ?? 'material',
          unit: e.einheit?.trim() || 'Stück',
          ...(e.mindestbestand !== undefined && { minQuantity: e.mindestbestand }),
          ...(e.nachbestellmenge !== undefined && { orderQuantity: e.nachbestellmenge }),
          ...(e.artikelnummer && { supplierRef: e.artikelnummer }),
          ...(e.wert_je_einheit !== undefined && { unitValue: e.wert_je_einheit }),
          ...(e.lagerort && { location: e.lagerort }),
          ...(lieferant !== undefined && { supplier: lieferant }),
          ...(e.angeschafft_am && { purchaseDate: e.angeschafft_am }),
          ...(e.anschaffungswert !== undefined && { purchaseValue: e.anschaffungswert }),
          ...(e.notiz && { notes: e.notiz }),
          /*
           * Der Anfangsbestand geht denselben Weg wie jede spätere Änderung.
           * Ihn still ins Feld zu schreiben hieße, den Verlauf mit einer Zahl
           * beginnen zu lassen, die niemand erklärt.
           */
          ...(menge !== 0
            ? bewegung({ quantity: 0, movements: [] }, menge, 'Anfangsbestand', URHEBER)
            : { quantity: 0 }),
        },
      })

      return ok({ angelegt: true, id: doc.id, name })
    },
  )

  server.registerTool(
    'material_aendern',
    {
      description:
        'Stammdaten eines Postens ändern. Nur die angegebenen Felder werden angefasst. ' +
        'Den Bestand kann dieses Werkzeug ausdrücklich nicht — dafür gibt es bestand_buchen.',
      inputSchema: {
        id: z.number().describe('Kennung des Postens'),
        name: z.string().optional(),
        art: z.enum(ARTEN).optional(),
        einheit: z.string().optional(),
        mindestbestand: z.number().nullable().optional().describe('null entfernt die Meldung'),
        nachbestellmenge: z.number().nullable().optional(),
        artikelnummer: z.string().optional(),
        wert_je_einheit: z.number().optional(),
        lagerort: z.string().optional(),
        lieferant: z.string().optional().describe('Name aus der Partnerkartei'),
        angeschafft_am: z.string().optional().describe('JJJJ-MM-TT'),
        anschaffungswert: z.number().optional(),
        notiz: z.string().optional(),
      },
    },
    async (e) => {
      const payload = await db()
      const vorher = (await payload
        .findByID({ collection: 'inventory-items', id: e.id, depth: 0, overrideAccess: true })
        .catch(() => null)) as Posten | null
      if (!vorher) return fehler(`Einen Posten mit der Kennung ${e.id} gibt es nicht.`)

      const lieferant = await lieferantFinden(payload, e.lieferant)
      if (lieferant === null) {
        return fehler(
          `Einen Geschäftspartner „${e.lieferant}" gibt es nicht — erst mit partner_anlegen aufnehmen.`,
        )
      }

      const doc = await payload.update({
        collection: 'inventory-items',
        id: e.id,
        overrideAccess: true,
        data: {
          ...(e.name !== undefined && { name: e.name }),
          ...(e.art !== undefined && { type: e.art }),
          ...(e.einheit !== undefined && { unit: e.einheit }),
          ...(e.mindestbestand !== undefined && { minQuantity: e.mindestbestand }),
          ...(e.nachbestellmenge !== undefined && { orderQuantity: e.nachbestellmenge }),
          ...(e.artikelnummer !== undefined && { supplierRef: e.artikelnummer }),
          ...(e.wert_je_einheit !== undefined && { unitValue: e.wert_je_einheit }),
          ...(e.lagerort !== undefined && { location: e.lagerort }),
          ...(lieferant !== undefined && { supplier: lieferant }),
          ...(e.angeschafft_am !== undefined && { purchaseDate: e.angeschafft_am }),
          ...(e.anschaffungswert !== undefined && { purchaseValue: e.anschaffungswert }),
          ...(e.notiz !== undefined && { notes: e.notiz }),
        },
      })

      return ok({ geaendert: true, id: doc.id, name: doc.name })
    },
  )

  // ── Bestand ───────────────────────────────────────────────────────────────
  server.registerTool(
    'bestand_buchen',
    {
      description:
        'Bestand eines Postens verändern — mit Grund, und als Zeile im Verlauf. Angegeben wird ' +
        'die Veränderung, nicht der neue Stand: „2 Meter verbraucht" ist -2, ein Wareneingang ' +
        'von 500 Schrauben ist +500. Wer den Stand nur zählen war, rechnet die Differenz zum ' +
        'aktuellen Bestand (material_lesen) aus und bucht die.',
      inputSchema: {
        id: z.number().describe('Kennung des Postens'),
        veraenderung: z
          .number()
          .describe('Negativ ist ein Abgang, positiv ein Zugang. Null ist keine Buchung.'),
        grund: z
          .string()
          .describe('Warum — z.B. „Wareneingang Lieferschein 4711" oder „Verschnitt Auftrag 23"'),
      },
    },
    async ({ id, veraenderung, grund }) => {
      const payload = await db()
      if (!Number.isFinite(veraenderung) || veraenderung === 0) {
        return fehler('Eine Buchung braucht eine Veränderung ungleich null.')
      }
      if (!grund?.trim()) {
        return fehler(
          'Eine Buchung ohne Grund ist genau das Loch, das der Verlauf stopfen soll — bitte ' +
            'angeben, warum sich der Bestand ändert.',
        )
      }

      const posten = (await payload
        .findByID({ collection: 'inventory-items', id, depth: 0, overrideAccess: true })
        .catch(() => null)) as Posten | null
      if (!posten) return fehler(`Einen Posten mit der Kennung ${id} gibt es nicht.`)

      const buchung = bewegung(posten, veraenderung, grund, URHEBER)
      await payload.update({
        collection: 'inventory-items',
        id,
        overrideAccess: true,
        data: buchung,
      })

      return ok({
        gebucht: true,
        name: posten.name,
        veraenderung,
        bestand: buchung.quantity,
        einheit: posten.unit ?? null,
        /*
         * Ein rechnerisch negativer Bestand bleibt stehen und wird gemeldet.
         * Ihn bei null zu kappen sähe ordentlich aus und verschwiege genau die
         * Information, um die es geht: Hier stimmt etwas nicht.
         */
        ...(buchung.quantity < 0 && {
          hinweis: 'Der Bestand steht jetzt im Minus — da fehlt vermutlich ein Wareneingang.',
        }),
      })
    },
  )
}
