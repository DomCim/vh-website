import path from 'node:path'

import type { Payload } from 'payload'

/**
 * Das Bild zu einem Artikel — als Pfad auf der Platte, für die PDFs.
 *
 * Auf einer Auftragsbestätigung oder einem Lieferschein steht sonst eine
 * Textzeile, und in der Werkstatt fragt jemand nach, welches Teil gemeint
 * ist. Ein daumennagelgroßes Bild beantwortet das, bevor die Frage entsteht.
 *
 * Genommen wird eine **kleine** Fassung, wenn es sie gibt: Ein 4000-Pixel-Foto
 * in einer PDF-Zeile von 34 Punkten macht das Dokument um Megabyte schwerer,
 * ohne dass man mehr erkennt. Die Originaldatei ist der Rückfallweg für
 * Bilder, die vor der Größenstaffelung hochgeladen wurden.
 *
 * Nichts hiervon darf ein Dokument verhindern: Fehlt das Bild, fehlt die
 * Datei oder ist der Verweis kaputt, kommt `null` zurück und das PDF entsteht
 * wie bisher. Eine Rechnung, die an einem Vorschaubild scheitert, wäre der
 * schlechteste Tausch von allen.
 */

const MEDIEN = process.env.MEDIA_DIR || path.join(process.cwd(), 'media')

type Fassung = { filename?: string | null; mimeType?: string | null }
type Bild = Fassung & {
  sizes?: Record<string, Fassung | undefined> | null
}

/**
 * PDFKit kennt nur PNG und JPEG.
 *
 * Das ist der Grund, warum hier nicht einfach die kleinste Fassung genommen
 * wird: Die Größenstaffelung der Mediathek liefert WebP — gut für die
 * Website, für ein PDF unbrauchbar. `doc.image()` wirft dann, der Auffangblock
 * schluckt es, und im Dokument fehlt das Bild, ohne dass jemand etwas merkt.
 *
 * Genommen wird deshalb die kleinste Fassung, die PDFKit auch lesen kann —
 * in aller Regel ist das die hochgeladene Originaldatei.
 */
const LESBAR = /^image\/(png|jpe?g)$/

function ausMedium(medium: Bild | null | undefined): string | null {
  if (!medium) return null

  const fassungen: Fassung[] = [
    // Kleine zuerst: Ein 4000-Pixel-Foto in einer Zeile von 30 Punkten macht
    // das Dokument um Megabyte schwerer, ohne dass man mehr erkennt.
    medium.sizes?.klein,
    medium.sizes?.thumbnail,
    medium.sizes?.card,
    medium,
  ].filter(Boolean) as Fassung[]

  const passend = fassungen.find((f) => f.filename && LESBAR.test(f.mimeType ?? ''))
  return passend?.filename ? path.join(MEDIEN, passend.filename) : null
}

/**
 * Der Pfad zu einem Bild aus der Mediathek — für ein Foto, das aufs Papier soll.
 *
 * Dasselbe wie `artikelBildPfad`, nur einen Schritt kürzer: Dort steckt das
 * Bild in einem Artikel, hier ist der Verweis schon das Bild. Gebraucht wird
 * das für die Übergabefotos am Lieferschein.
 *
 * Die Fassungswahl bleibt dieselbe und ist der eigentliche Grund, das hier
 * nicht selbst zu schreiben: kleine Fassung vor Original, und nur PNG oder
 * JPEG, weil PDFKit sonst wirft und das Bild stillschweigend fehlt.
 */
export async function medienBildPfad(payload: Payload, bezug: unknown): Promise<string | null> {
  try {
    if (!bezug) return null
    if (typeof bezug === 'object') {
      const medium = bezug as Bild & { id?: number | string }
      // Ein Verweis ohne Tiefe bringt nur die Kennung mit
      if (medium.filename || medium.sizes) return ausMedium(medium)
      if (!medium.id) return null
      bezug = medium.id
    }
    const geladen = (await payload.findByID({
      collection: 'media',
      id: bezug as number,
      depth: 0,
      overrideAccess: true,
    })) as Bild
    return ausMedium(geladen)
  } catch (err) {
    payload.logger.warn({ err }, 'Bild für ein Dokument nicht gefunden')
    return null
  }
}

/**
 * Der Bildpfad zu einem Artikelverweis.
 *
 * `bezug` ist, was in einer Position steht: eine Kennung, der geladene
 * Artikel oder nichts.
 */
export async function artikelBildPfad(
  payload: Payload,
  bezug: unknown,
): Promise<string | null> {
  try {
    if (!bezug) return null

    let artikel: { images?: unknown[] | null } | null = null

    if (typeof bezug === 'object') {
      artikel = bezug as { images?: unknown[] | null }
      // Ein Verweis ohne Tiefe bringt nur die Kennung mit
      if (!artikel.images) {
        const id = (bezug as { id?: number | string }).id
        if (!id) return null
        artikel = (await payload.findByID({
          collection: 'products',
          id,
          depth: 1,
          overrideAccess: true,
        })) as { images?: unknown[] | null }
      }
    } else {
      artikel = (await payload.findByID({
        collection: 'products',
        id: bezug as number,
        depth: 1,
        overrideAccess: true,
      })) as { images?: unknown[] | null }
    }

    // `images` ist ein Upload-Feld mit `hasMany`: je nach Tiefe stehen dort
    // die Mediendatensätze oder nur ihre Kennungen.
    const erstes = artikel?.images?.[0]
    if (!erstes) return null

    if (typeof erstes === 'number' || typeof erstes === 'string') {
      const geladen = (await payload.findByID({
        collection: 'media',
        id: erstes,
        depth: 0,
        overrideAccess: true,
      })) as Bild
      return ausMedium(geladen)
    }
    return ausMedium(erstes as Bild)
  } catch (err) {
    // Siehe oben: ein fehlendes Bild hält kein Dokument auf — aber es soll
    // auffindbar sein, wenn es fehlt.
    payload.logger.warn({ err }, 'Artikelbild für ein Dokument nicht gefunden')
    return null
  }
}
