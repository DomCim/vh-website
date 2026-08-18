import { z } from 'zod'

import { bestaetigen, bestaetigungNoetig, db, fehler, type McpServer, ok, sprache } from './helpers'

const MAX_BYTES = 20 * 1024 * 1024
const ERLAUBT = /^(image\/|video\/mp4$|video\/webm$)/

/** Wo überall ein Bild verwendet wird — vor dem Löschen geprüft */
async function fundstellen(payload: Awaited<ReturnType<typeof db>>, id: number) {
  const treffer: string[] = []
  const suchen = async (
    collection: 'products' | 'projects' | 'news' | 'categories' | 'inquiries',
    feld: string,
    beschriftung: string,
  ) => {
    const { docs } = await payload.find({
      collection,
      where: { [feld]: { equals: id } },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    })
    for (const d of docs) {
      treffer.push(`${beschriftung}: ${(d as { title?: string; name?: string }).title ?? (d as { name?: string }).name ?? d.id}`)
    }
  }
  await suchen('products', 'images', 'Produkt')
  await suchen('projects', 'images', 'Referenz')
  await suchen('news', 'coverImage', 'News-Beitrag')
  await suchen('categories', 'image', 'Kategorie')
  await suchen('inquiries', 'attachments', 'Anfrage')
  return treffer
}

export function registerMedien(server: McpServer) {
  // ── Medien ────────────────────────────────────────────────────────────────
  server.registerTool(
    'medien_liste',
    {
      description:
        'Listet hochgeladene Bilder mit ID und Dateiname — die IDs braucht man für produkt_anlegen, referenz_anlegen und news_verfassen.',
      inputSchema: {
        suche: z.string().optional().describe('Filter im Dateinamen oder Alt-Text'),
        sprache,
      },
    },
    async ({ suche, sprache: locale }) => {
      const payload = await db()
      const { docs, totalDocs } = await payload.find({
        collection: 'media',
        where: suche
          ? { or: [{ filename: { contains: suche } }, { alt: { contains: suche } }] }
          : undefined,
        limit: 100,
        locale,
      })
      return ok({
        anzahl: totalDocs,
        medien: docs.map((m) => ({ id: m.id, datei: m.filename, alt: m.alt ?? null })),
      })
    },
  )

  server.registerTool(
    'bild_hochladen',
    {
      description:
        'Lädt ein Bild oder Video in die Mediathek — entweder von einer URL oder als Base64-Daten. Liefert die Media-ID für produkt_anlegen, referenz_anlegen und news_verfassen zurück. Die Zuschnitte (thumbnail/card/large) entstehen automatisch.',
      inputSchema: {
        dateiname: z.string().describe('z.B. sitzbank-naila.jpg — die Endung bestimmt das Format'),
        url: z.string().optional().describe('öffentlich erreichbare Bild-URL'),
        datenBase64: z.string().optional().describe('Alternative zur URL: die Datei als Base64'),
        altText: z
          .string()
          .optional()
          .describe('Alternativtext für Barrierefreiheit und Suchmaschinen — bitte immer setzen'),
      },
    },
    async ({ dateiname, url, datenBase64, altText }) => {
      if (!url && !datenBase64) return fehler('Entweder url oder datenBase64 angeben.')
      const payload = await db()

      let daten: Buffer
      let mimetype: string
      if (url) {
        let antwort: Response
        try {
          antwort = await fetch(url)
        } catch {
          return fehler(`Die URL ${url} war nicht erreichbar.`)
        }
        if (!antwort.ok) return fehler(`Die URL antwortete mit Status ${antwort.status}.`)
        mimetype = antwort.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/octet-stream'
        daten = Buffer.from(await antwort.arrayBuffer())
      } else {
        daten = Buffer.from(datenBase64!.replace(/^data:[^;]+;base64,/, ''), 'base64')
        const endung = dateiname.split('.').pop()?.toLowerCase() ?? ''
        mimetype =
          { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm' }[
            endung
          ] ?? 'application/octet-stream'
      }

      if (!ERLAUBT.test(mimetype)) {
        return fehler(`Dateityp ${mimetype} ist nicht erlaubt (nur Bilder, MP4 und WebM).`)
      }
      if (daten.byteLength > MAX_BYTES) {
        return fehler(
          `Die Datei ist ${Math.round(daten.byteLength / 1024 / 1024)} MB groß — erlaubt sind höchstens 20 MB.`,
        )
      }

      const doc = await payload.create({
        collection: 'media',
        locale: 'de',
        data: { alt: altText },
        file: { data: daten, mimetype, name: dateiname, size: daten.byteLength },
      })
      return ok({
        ok: true,
        id: doc.id,
        datei: doc.filename,
        groesseKB: Math.round(daten.byteLength / 1024),
        ...(altText ? {} : { hinweis: 'Ohne Alt-Text — bitte mit bild_aendern nachtragen.' }),
      })
    },
  )

  server.registerTool(
    'bild_aendern',
    {
      description:
        'Ändert den Alternativtext eines Bildes. Mit sprache=fr/en wird die jeweilige Sprachfassung gesetzt.',
      inputSchema: { id: z.number(), altText: z.string(), sprache },
    },
    async ({ id, altText, sprache: locale }) => {
      const payload = await db()
      const m = await payload.findByID({ collection: 'media', id, depth: 0 }).catch(() => null)
      if (!m) return fehler(`Bild ${id} nicht gefunden`)
      await payload.update({ collection: 'media', id, locale, data: { alt: altText } })
      return ok({ ok: true, id, sprache: locale })
    },
  )

  server.registerTool(
    'bild_loeschen',
    {
      description:
        'Löscht ein Bild aus der Mediathek — nur, wenn es nirgends mehr verwendet wird. Ohne bestaetigen=true nur Vorschau.',
      inputSchema: { id: z.number(), bestaetigen },
    },
    async ({ id, bestaetigen: jetzt }) => {
      const payload = await db()
      const m = await payload.findByID({ collection: 'media', id, depth: 0 }).catch(() => null)
      if (!m) return fehler(`Bild ${id} nicht gefunden`)
      const verwendet = await fundstellen(payload, id)
      if (verwendet.length) {
        return ok({
          fehler: 'Das Bild wird noch verwendet und wurde nicht gelöscht.',
          verwendetIn: verwendet,
        })
      }
      if (!jetzt) return bestaetigungNoetig({ id, datei: m.filename, verwendetIn: [] })
      await payload.delete({ collection: 'media', id })
      return ok({ ok: true, geloescht: m.filename })
    },
  )
}
