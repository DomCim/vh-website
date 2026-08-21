import type { Where } from 'payload'
import { z } from 'zod'

import { tageSeit } from '../zahlungsstand'
import { db, fehler, ok, type McpServer } from './helpers'

/**
 * Werkzeuge für das Büro — bisher gab es nur welche für den Shop.
 *
 * Die übrigen Werkzeuge pflegen die Website: Artikel, Bilder, Texte, News.
 * Der Betrieb selbst — Aufträge, Rechnungen, Material, Partner — war von
 * außen nicht ansprechbar, obwohl dort die Arbeit liegt.
 *
 * **Was hier lesend ist, ist wirklich lesend.** Die Namen enden auf `_liste`
 * oder `_lesen`, damit sie beim Nur-Lese-Schlüssel sichtbar bleiben und ohne
 * Leitplanken-Freigabe funktionieren (siehe `helpers.ts`). Genau dafür ist die
 * Konvention da: „Was kostet mich der Monat?" soll man fragen können, ohne
 * vorher irgendetwas freizuschalten.
 *
 * **Was hier schreibt, schreibt Entwürfe.** Ein Partner ist ein Stammdatensatz
 * und harmlos; eine Stückliste ebenso. Angebots- und Rechnungsentwürfe haben
 * keine Nummer und verschicken nichts — Nummer und Versand gibt es nur im
 * Büro, von einem Menschen. Das ist keine Vorsicht um der Vorsicht willen:
 * Eine Rechnung ist ein Rechtsdokument, und die Leitplanken sagen dazu
 * „Sag es, tu es nicht."
 */

const euro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

export function registerBuero(server: McpServer) {
  // ── Was offen ist ─────────────────────────────────────────────────────────
  server.registerTool(
    'offene_posten_liste',
    {
      description:
        'Gestellte, aber nicht bezahlte Rechnungen — überfällige zuerst, mit Tagen seit ' +
        'Fälligkeit. Beantwortet „wer schuldet mir noch was?".',
      inputSchema: {
        nurUeberfaellig: z
          .boolean()
          .optional()
          .describe('true = nur, was die Frist schon überschritten hat'),
      },
    },
    async ({ nurUeberfaellig }) => {
      const payload = await db()
      const { docs } = await payload.find({
        collection: 'outgoing-invoices',
        // Gegenrechnungen eines Stornos stehen auch auf „gestellt" —
        // aus denen ist aber nichts zu zahlen, also gehören sie nicht hierher.
        where: { and: [{ status: { equals: 'gestellt' } }, { stornoVon: { exists: false } }] },
        limit: 200,
        depth: 0,
        overrideAccess: true,
        sort: 'dueDate',
      })

      const posten = docs
        .map((r: Record<string, any>) => {
          const summe = (r.items ?? []).reduce(
            (s: number, p: Record<string, any>) =>
              s + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0),
            0,
          )
          /*
           * Ohne Fälligkeitsdatum ist nichts überfällig — nicht „sofort".
           * Andersherum stünde eine frisch gestellte Rechnung ohne Frist
           * ganz oben in der Mahnliste.
           */
          const tage = r.dueDate ? tageSeit(r.dueDate) : 0
          return {
            nummer: r.invoiceNumber,
            kunde: r.customerName ?? null,
            betrag_netto: euro(summe),
            gestellt_am: r.issueDate ?? null,
            faellig_am: r.dueDate ?? null,
            tage_ueberfaellig: tage > 0 ? tage : 0,
          }
        })
        .filter((p) => (nurUeberfaellig ? p.tage_ueberfaellig > 0 : true))
        .sort((a, b) => b.tage_ueberfaellig - a.tage_ueberfaellig)

      return ok({
        anzahl: posten.length,
        davon_ueberfaellig: posten.filter((p) => p.tage_ueberfaellig > 0).length,
        posten,
      })
    },
  )

  // ── Was in der Werkstatt liegt ────────────────────────────────────────────
  server.registerTool(
    'auftraege_liste',
    {
      description:
        'Aufträge mit Status, Kunde, Termin und gebuchter Zeit. Ohne Angabe: alles, was ' +
        'noch nicht geliefert oder abgebrochen ist.',
      inputSchema: {
        status: z
          .enum(['geplant', 'inFertigung', 'fertig', 'geliefert', 'abgebrochen', 'offen'])
          .optional()
          .describe("'offen' (Standard) = geplant und in Fertigung"),
      },
    },
    async ({ status }) => {
      const payload = await db()
      const gewaehlt = status ?? 'offen'
      const where: Where =
        gewaehlt === 'offen'
          ? { status: { in: ['geplant', 'inFertigung'] } }
          : { status: { equals: gewaehlt } }

      const { docs } = await payload.find({
        collection: 'jobs',
        where,
        limit: 200,
        depth: 1,
        overrideAccess: true,
        sort: 'dueDate',
      })

      return ok({
        anzahl: docs.length,
        auftraege: docs.map((a: Record<string, any>) => ({
          nummer: a.jobNumber,
          bezeichnung: a.title ?? null,
          kunde: typeof a.customer === 'object' ? a.customer?.name : (a.customerName ?? null),
          status: a.status,
          start: a.startDate ?? null,
          fertig_bis: a.dueDate ?? null,
          // Leer heißt „noch nicht geschätzt" — dann fehlt der Auftrag in der
          // Wochenauslastung, und das ist eine Auskunft wert
          geschaetzte_stunden: a.plannedHours ?? null,
          gebuchte_minuten: (a.zeiten ?? []).reduce(
            (s: number, z: Record<string, any>) => s + (Number(z.minuten) || 0),
            0,
          ),
        })),
      })
    },
  )

  // ── Was knapp wird ────────────────────────────────────────────────────────
  server.registerTool(
    'material_liste',
    {
      description:
        'Lagerbestand. Standardmäßig nur, was unter dem Mindestbestand liegt — die Frage ' +
        'ist fast immer „was muss ich nachbestellen?".',
      inputSchema: {
        alles: z.boolean().optional().describe('true = der ganze Bestand, nicht nur das Knappe'),
        suche: z.string().optional().describe('Suchbegriff im Namen'),
      },
    },
    async ({ alles, suche }) => {
      const payload = await db()
      const { docs } = await payload.find({
        collection: 'inventory-items',
        ...(suche ? { where: { name: { contains: suche } } } : {}),
        limit: 500,
        depth: 0,
        overrideAccess: true,
        sort: 'name',
      })

      const posten = docs
        .map((m: Record<string, any>) => {
          const bestand = Number(m.quantity) || 0
          const mindest = Number(m.minQuantity) || 0
          return {
            name: m.name,
            bestand,
            einheit: m.unit ?? null,
            mindestbestand: mindest || null,
            knapp: mindest > 0 && bestand <= mindest,
            lagerort: m.location ?? null,
            // Was ohne Preis dasteht, taucht in keiner Nachkalkulation auf
            wert_je_einheit: m.unitValue ? euro(Number(m.unitValue)) : null,
          }
        })
        .filter((m) => (alles ? true : m.knapp))

      return ok({ anzahl: posten.length, posten })
    },
  )

  // ── Wer beteiligt ist ─────────────────────────────────────────────────────
  server.registerTool(
    'partner_liste',
    {
      description: 'Lieferanten, Kunden und Dienstleister — mit Anschrift und Kontakt.',
      inputSchema: {
        art: z
          .enum(['lieferant', 'kunde', 'dienstleister', 'beides'])
          .optional()
          .describe('Ohne Angabe: alle'),
        suche: z.string().optional().describe('Suchbegriff im Namen'),
      },
    },
    async ({ art, suche }) => {
      const payload = await db()
      const und: Where[] = []
      // „beides" ist eine eigene Art und zugleich in jeder enthalten — sonst
      // fehlte der Betrieb, der liefert *und* kauft, in beiden Listen
      if (art && art !== 'beides') und.push({ role: { in: [art, 'beides'] } })
      else if (art) und.push({ role: { equals: 'beides' } })
      if (suche) und.push({ name: { contains: suche } })

      const { docs } = await payload.find({
        collection: 'contacts',
        ...(und.length ? { where: { and: und } } : {}),
        limit: 300,
        depth: 0,
        overrideAccess: true,
        sort: 'name',
      })

      return ok({
        anzahl: docs.length,
        partner: docs.map((p: Record<string, any>) => ({
          id: p.id,
          name: p.name,
          art: p.role,
          email: p.email ?? null,
          telefon: p.phone ?? null,
          ort: [p.postalCode, p.city].filter(Boolean).join(' ') || null,
          land: p.country ?? null,
          tva: p.vatId ?? null,
          siret: p.siret ?? null,
        })),
      })
    },
  )

  server.registerTool(
    'partner_anlegen',
    {
      description:
        'Legt einen Lieferanten, Kunden oder Dienstleister an. Ein vorhandener Name wird ' +
        'nicht doppelt angelegt — dann kommt der bestehende zurück.',
      inputSchema: {
        name: z.string().describe('Firma oder Name'),
        art: z
          .enum(['lieferant', 'kunde', 'dienstleister', 'beides'])
          .describe("'beides' für Betriebe, die liefern und kaufen"),
        email: z.string().optional(),
        telefon: z.string().optional(),
        strasse: z.string().optional(),
        plz: z.string().optional(),
        ort: z.string().optional(),
        land: z.string().optional().describe('z.B. „Frankreich" oder „Deutschland"'),
        tva: z.string().optional().describe('USt-IdNr. / TVA — bei Geschäftskunden wichtig'),
        siret: z.string().optional().describe('Nur bei französischen Betrieben'),
        notiz: z.string().optional(),
      },
    },
    async (e) => {
      const payload = await db()
      const name = e.name.trim()
      if (!name) return fehler('Ohne Namen geht es nicht')

      /*
       * Doppelte Partner sind lästiger, als sie klingen: Rechnungen und
       * Belege hängen daran, und hinterher liegt die halbe Geschichte am
       * einen und die andere Hälfte am anderen.
       */
      const { docs } = await payload.find({
        collection: 'contacts',
        where: { name: { equals: name } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (docs.length) {
        return ok({
          schon_vorhanden: true,
          id: docs[0].id,
          name: (docs[0] as Record<string, any>).name,
          hinweis: 'Unter diesem Namen gibt es bereits einen Partner — nichts angelegt.',
        })
      }

      const doc = await payload.create({
        collection: 'contacts',
        overrideAccess: true,
        data: {
          name,
          role: e.art,
          ...(e.email && { email: e.email }),
          ...(e.telefon && { phone: e.telefon }),
          ...(e.strasse && { line1: e.strasse }),
          ...(e.plz && { postalCode: e.plz }),
          ...(e.ort && { city: e.ort }),
          ...(e.land && { country: e.land }),
          ...(e.tva && { vatId: e.tva }),
          ...(e.siret && { siret: e.siret }),
          ...(e.notiz && { notes: e.notiz }),
        } as never,
      })

      return ok({ ok: true, id: doc.id, name })
    },
  )

  // ── Stückliste an der Variante ────────────────────────────────────────────
  server.registerTool(
    'stueckliste_setzen',
    {
      description:
        'Setzt die Stückliste einer Artikelvariante — die Liste wird vollständig ersetzt. ' +
        'Vorher produkt_lesen aufrufen, um zu sehen, was bisher drinsteht. Leere Liste ' +
        'heißt: Es gilt wieder die Grundliste am Artikel.',
      inputSchema: {
        artikelSlug: z.string().describe('Slug des Artikels'),
        variante: z.string().describe('Titel der Variante, z.B. „Klein" oder „60 cm"'),
        posten: z
          .array(
            z.object({
              material: z.string().describe('Name des Inventarpostens, genau wie im Lager'),
              menge: z.number().min(0).describe('Menge je Stück'),
              bemerkung: z.string().optional(),
            }),
          )
          .describe('Die vollständige neue Stückliste'),
        arbeitszeitMinuten: z
          .number()
          .min(0)
          .optional()
          .describe('Arbeitszeit dieser Variante. Leer lassen heißt: Zeit vom Artikel gilt.'),
      },
    },
    async ({ artikelSlug, variante, posten, arbeitszeitMinuten }) => {
      const payload = await db()
      const { docs } = await payload.find({
        collection: 'products',
        where: { slug: { equals: artikelSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const artikel = docs[0] as Record<string, any> | undefined
      if (!artikel) return fehler(`Artikel „${artikelSlug}" nicht gefunden`)

      const varianten: Record<string, any>[] = artikel.variants ?? []
      const index = varianten.findIndex(
        (v) => String(v.title ?? '').toLowerCase() === variante.trim().toLowerCase(),
      )
      if (index < 0) {
        return fehler(
          `Variante „${variante}" gibt es nicht. Vorhanden: ` +
            (varianten.map((v) => v.title).join(', ') || '— keine —'),
        )
      }

      /*
       * Material wird über den Namen gesucht, nicht über eine ID: Wer eine
       * Stückliste diktiert, sagt „zwei Meter Vierkantrohr 40×40" und nicht
       * „Posten 137". Findet sich der Name nicht, wird nichts geraten — ein
       * falsch zugeordneter Posten verfälscht später jede Nachkalkulation.
       */
      const zugeordnet: { item: number | string; quantity: number; note?: string }[] = []
      const fehlend: string[] = []
      for (const p of posten) {
        const treffer = await payload.find({
          collection: 'inventory-items',
          where: { name: { equals: p.material } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (!treffer.docs.length) fehlend.push(p.material)
        else zugeordnet.push({ item: treffer.docs[0].id, quantity: p.menge, note: p.bemerkung })
      }
      if (fehlend.length) {
        return fehler(
          `Diese Posten gibt es im Lager nicht: ${fehlend.join(', ')}. ` +
            'Mit material_liste nachsehen, wie sie dort genau heißen — es wurde nichts geändert.',
        )
      }

      const neu = varianten.map((v, i) =>
        i === index
          ? {
              ...v,
              billOfMaterials: zugeordnet,
              ...(arbeitszeitMinuten !== undefined && { productionMinutes: arbeitszeitMinuten }),
            }
          : v,
      )

      await payload.update({
        collection: 'products',
        id: artikel.id,
        overrideAccess: true,
        data: { variants: neu } as never,
      })

      return ok({
        ok: true,
        artikel: artikel.slug,
        variante: varianten[index].title,
        posten: zugeordnet.length,
        arbeitszeit_minuten: arbeitszeitMinuten ?? null,
      })
    },
  )

  server.registerTool(
    'partner_aendern',
    {
      description:
        'Ändert einen Geschäftspartner — nur die angegebenen Felder, alles andere bleibt. ' +
        'Die ID kommt aus partner_liste.',
      inputSchema: {
        id: z.number().describe('Partner-ID aus partner_liste'),
        name: z.string().optional(),
        art: z.enum(['lieferant', 'kunde', 'dienstleister', 'beides']).optional(),
        email: z.string().optional(),
        telefon: z.string().optional(),
        strasse: z.string().optional(),
        plz: z.string().optional(),
        ort: z.string().optional(),
        land: z.string().optional(),
        tva: z.string().optional(),
        siret: z.string().optional(),
        mailSprache: z
          .enum(['de', 'fr', 'en'])
          .optional()
          .describe('Sprache der Statusmails an diesen Partner'),
        notiz: z.string().optional(),
      },
    },
    async (e) => {
      const payload = await db()
      const vorhanden = await payload
        .findByID({ collection: 'contacts', id: e.id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!vorhanden) return fehler(`Partner ${e.id} nicht gefunden — siehe partner_liste.`)

      await payload.update({
        collection: 'contacts',
        id: e.id,
        overrideAccess: true,
        data: {
          ...(e.name !== undefined && { name: e.name }),
          ...(e.art !== undefined && { role: e.art }),
          ...(e.email !== undefined && { email: e.email }),
          ...(e.telefon !== undefined && { phone: e.telefon }),
          ...(e.strasse !== undefined && { line1: e.strasse }),
          ...(e.plz !== undefined && { postalCode: e.plz }),
          ...(e.ort !== undefined && { city: e.ort }),
          ...(e.land !== undefined && { country: e.land }),
          ...(e.tva !== undefined && { vatId: e.tva }),
          ...(e.siret !== undefined && { siret: e.siret }),
          ...(e.mailSprache !== undefined && { sprache: e.mailSprache }),
          ...(e.notiz !== undefined && { notes: e.notiz }),
        } as never,
      })

      return ok({ ok: true, id: e.id })
    },
  )

  // ── Wiedervorlagen ────────────────────────────────────────────────────────
  server.registerTool(
    'wiedervorlagen_liste',
    {
      description: 'Was auf Wiedervorlage liegt — Offenes zuerst, nach Fälligkeit sortiert.',
      inputSchema: {
        auchErledigte: z.boolean().optional().describe('true = erledigte mit anzeigen'),
      },
    },
    async ({ auchErledigte }) => {
      const payload = await db()
      const { docs } = await payload.find({
        collection: 'follow-ups',
        ...(auchErledigte ? {} : { where: { done: { not_equals: true } } }),
        limit: 200,
        depth: 0,
        overrideAccess: true,
        sort: 'dueDate',
      })
      return ok({
        anzahl: docs.length,
        wiedervorlagen: docs.map((w: Record<string, any>) => ({
          id: w.id,
          titel: w.title,
          faelligAm: w.dueDate ?? null,
          erledigt: Boolean(w.done),
          notiz: w.note ?? null,
          partnerId: w.contact ?? null,
        })),
      })
    },
  )

  server.registerTool(
    'wiedervorlage_anlegen',
    {
      description:
        'Legt eine Wiedervorlage an — „am 3. September beim Kunden nachfragen". Erscheint ' +
        'im Büro unter Wiedervorlagen und zählt an der Navigation mit.',
      inputSchema: {
        titel: z.string().describe('Was ist zu tun?'),
        faelligAm: z.string().describe('ISO-Datum, z.B. 2026-09-03'),
        notiz: z.string().optional(),
        partnerId: z.number().optional().describe('Partner-ID aus partner_liste'),
      },
    },
    async ({ titel, faelligAm, notiz, partnerId }) => {
      if (!Number.isFinite(Date.parse(faelligAm))) {
        return fehler(`„${faelligAm}" ist kein lesbares Datum — bitte als ISO-Datum angeben.`)
      }
      const payload = await db()
      const doc = await payload.create({
        collection: 'follow-ups',
        overrideAccess: true,
        data: {
          title: titel.trim(),
          dueDate: faelligAm,
          done: false,
          ...(notiz && { note: notiz }),
          ...(partnerId && { contact: partnerId }),
        } as never,
      })
      return ok({ ok: true, id: doc.id, faelligAm })
    },
  )

  /*
   * Entwürfe für Angebot und Rechnung — angekündigt im Kopf dieser Datei,
   * hier sind sie. Beide legen ausschließlich Entwürfe an: keine Nummer
   * (die vergibt der Nummernkreis erst beim Versenden bzw. Festschreiben im
   * Büro), kein Versand, kein Statusparameter. Der Weg zum Kunden führt
   * bewusst über einen Menschen.
   */
  const positionSchema = z.object({
    beschreibung: z.string(),
    menge: z.number().positive().default(1),
    einzelpreisNetto: z.number().describe('Netto in EUR'),
    einheit: z.string().optional().describe('Standard: Stück'),
    steuersatz: z.number().optional().describe('Prozent; Standard 20'),
  })

  server.registerTool(
    'angebot_entwurf_anlegen',
    {
      description:
        'Legt einen Angebotsentwurf an — ohne Nummer, ohne Versand; beides passiert im Büro. ' +
        'Der Kunde kommt bevorzugt als partnerId aus partner_liste, dann stimmen Anschrift ' +
        'und spätere Zuordnung.',
      inputSchema: {
        titel: z.string().optional().describe('z.B. „Sitzbänke Rathausplatz"'),
        partnerId: z.number().optional().describe('Partner-ID aus partner_liste'),
        kundenName: z.string().optional().describe('Nur, wenn es den Partner (noch) nicht gibt'),
        positionen: z.array(positionSchema).min(1),
        notiz: z.string().optional().describe('Hinweis auf dem Angebot'),
      },
    },
    async ({ titel, partnerId, kundenName, positionen, notiz }) => {
      const payload = await db()
      const partner = partnerId
        ? await payload
            .findByID({ collection: 'contacts', id: partnerId, depth: 0, overrideAccess: true })
            .catch(() => null)
        : null
      if (partnerId && !partner) {
        return fehler(`Partner ${partnerId} nicht gefunden — siehe partner_liste.`)
      }
      const name = partner?.name ?? kundenName?.trim()
      if (!name) return fehler('Ohne Kunden geht es nicht — partnerId oder kundenName angeben.')

      const anschrift = partner
        ? [partner.line1, [partner.postalCode, partner.city].filter(Boolean).join(' '), partner.country]
            .filter(Boolean)
            .join('\n')
        : undefined

      const doc = await payload.create({
        collection: 'quotes',
        overrideAccess: true,
        data: {
          status: 'entwurf',
          title: titel,
          customer: partner?.id,
          customerName: name,
          customerAddress: anschrift,
          issueDate: new Date().toISOString(),
          validUntil: new Date(Date.now() + 30 * 86400_000).toISOString(),
          items: positionen.map((p) => ({
            description: p.beschreibung,
            quantity: p.menge,
            unit: p.einheit ?? 'Stück',
            unitPrice: p.einzelpreisNetto,
            vatRate: p.steuersatz ?? 20,
          })),
          ...(notiz && { note: notiz }),
        } as never,
      })
      return ok({
        ok: true,
        id: doc.id,
        hinweis:
          'Entwurf ohne Nummer angelegt — versendet und nummeriert wird im Büro unter Angebote.',
      })
    },
  )

  server.registerTool(
    'rechnung_entwurf_anlegen',
    {
      description:
        'Legt einen Rechnungsentwurf an — ohne Nummer, ohne Versand; festgeschrieben und ' +
        'verschickt wird im Büro. Für Rechnungen zu einem Angebot besser den Weg über das ' +
        'Büro nehmen, dort wandern die Positionen automatisch mit.',
      inputSchema: {
        partnerId: z.number().optional().describe('Partner-ID aus partner_liste'),
        kundenName: z.string().optional().describe('Nur, wenn es den Partner (noch) nicht gibt'),
        positionen: z.array(positionSchema).min(1),
        notiz: z.string().optional().describe('Hinweis auf der Rechnung'),
      },
    },
    async ({ partnerId, kundenName, positionen, notiz }) => {
      const payload = await db()
      const partner = partnerId
        ? await payload
            .findByID({ collection: 'contacts', id: partnerId, depth: 0, overrideAccess: true })
            .catch(() => null)
        : null
      if (partnerId && !partner) {
        return fehler(`Partner ${partnerId} nicht gefunden — siehe partner_liste.`)
      }
      const name = partner?.name ?? kundenName?.trim()
      if (!name) return fehler('Ohne Kunden geht es nicht — partnerId oder kundenName angeben.')

      const anschrift = partner
        ? [partner.line1, [partner.postalCode, partner.city].filter(Boolean).join(' '), partner.country]
            .filter(Boolean)
            .join('\n')
        : undefined

      const doc = await payload.create({
        collection: 'outgoing-invoices',
        overrideAccess: true,
        data: {
          status: 'entwurf',
          customer: partner?.id,
          customerName: name,
          customerAddress: anschrift,
          ...(partner?.siret && { customerSiret: partner.siret }),
          ...(partner?.vatId && { customerVatId: partner.vatId }),
          items: positionen.map((p) => ({
            description: p.beschreibung,
            quantity: p.menge,
            unit: p.einheit ?? 'Stück',
            unitPrice: p.einzelpreisNetto,
            vatRate: p.steuersatz ?? 20,
          })),
          ...(notiz && { note: notiz }),
        } as never,
      })
      return ok({
        ok: true,
        id: doc.id,
        hinweis:
          'Entwurf ohne Nummer angelegt — geprüft, festgeschrieben und verschickt wird im ' +
          'Büro unter Rechnungen.',
      })
    },
  )
}
