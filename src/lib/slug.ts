import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook } from 'payload'

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
 *
 * Kommt ein Datensatz aus dem Papierkorb zurück, greift genau derselbe Weg:
 * Sein Slug wurde beim Wegwerfen freigegeben (siehe `slugFreigeben`), das Feld
 * ist also leer und wird hier neu vergeben — falls der alte Name inzwischen
 * vergeben ist, eben als `-2`.
 */
export function autoSlug(titleField = 'title'): CollectionBeforeValidateHook {
  return async ({ data, req, collection, originalDoc }) => {
    if (!data) return data
    if (data.slug && String(data.slug).trim() !== '') return data
    // Wer gerade weggeworfen wird, braucht keinen neuen Slug — er verliert ihn
    // im selben Zug wieder (siehe slugFreigeben).
    if (data.deletedAt) return data

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
        // Sicherheitsnetz: Weggeworfenes hat normalerweise gar keinen Slug
        // mehr. Sollte doch einmal einer liegen geblieben sein, wollen wir das
        // hier merken — und nicht erst als Datenbankfehler beim Speichern.
        trash: true,
      })
      if (docs.length === 0) break
      candidate = `${base}-${i}`
    }

    return { ...data, slug: candidate }
  }
}

/**
 * beforeChange-Hook: Gibt den Slug frei, sobald ein Datensatz in den
 * Papierkorb wandert.
 *
 * **Warum überhaupt.** Der Slug ist eindeutig — auch über den Papierkorb
 * hinweg, denn die Datenbank kennt keinen Papierkorb, nur Zeilen. Ohne diese
 * Stelle wäre ein weggeworfener Artikel „gartentisch" für immer ein Hindernis:
 * Legt jemand denselben Artikel neu an, bekäme er wortlos `gartentisch-2` —
 * eine schlechtere Adresse, blockiert von etwas, das niemand mehr sieht. Der
 * Papierkorb soll Fehler auffangen und nicht neue verursachen.
 *
 * Zurückholen bleibt möglich: Beim Wiederherstellen ist das Feld leer, und
 * `autoSlug` vergibt den Namen neu — den alten, wenn er noch frei ist, sonst
 * den nächsten. Die Adresse eines wiederhergestellten Datensatzes kann sich
 * dadurch ändern; das ist der Preis dafür, dass der Name in der Zwischenzeit
 * benutzbar war, und die richtige Reihenfolge: Was steht, geht vor.
 */
export const slugFreigeben: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (!data) return data
  if (data.deletedAt && !originalDoc?.deletedAt) return { ...data, slug: null }
  return data
}
