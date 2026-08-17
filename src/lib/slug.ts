import type { CollectionBeforeValidateHook } from 'payload'

/** URL-tauglicher Slug aus einem Titel (ä→ae, Sonderzeichen→Bindestrich) */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * beforeValidate-Hook: Erzeugt den Slug automatisch aus dem Titel, wenn das
 * Feld leer gelassen wird. Bei Kollision wird -2, -3, … angehängt.
 * Der Slug bleibt manuell überschreibbar.
 */
export function autoSlug(titleField = 'title'): CollectionBeforeValidateHook {
  return async ({ data, req, collection, originalDoc }) => {
    if (!data) return data
    if (data.slug && String(data.slug).trim() !== '') return data

    const title = data[titleField] ?? originalDoc?.[titleField]
    if (!title || typeof title !== 'string') return data

    const base = slugify(title) || 'eintrag'
    let candidate = base
    for (let i = 2; i <= 50; i++) {
      const { docs } = await req.payload.find({
        collection: collection!.slug as never,
        where: {
          and: [
            { slug: { equals: candidate } },
            ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (docs.length === 0) break
      candidate = `${base}-${i}`
    }

    return { ...data, slug: candidate }
  }
}
