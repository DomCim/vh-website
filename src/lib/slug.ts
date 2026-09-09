import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
} from 'payload'

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
/**
 * Die Sprache, in der gerade geschrieben wird.
 *
 * Seit die Adresse übersetzbar ist, gilt jede Prüfung auf Eindeutigkeit nur
 * innerhalb einer Sprachfassung — der Index in der Datenbank lautet
 * `(slug, _locale)`. Wer das vergisst, vergleicht die französische Adresse
 * mit der deutschen und hängt ein `-2` an, wo gar keine Kollision ist.
 */
function spracheAus(req: { locale?: string | null } | undefined): string {
  const l = req?.locale
  return l && l !== 'all' ? l : 'de'
}

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
        // Nur in dieser Sprachfassung — siehe `spracheAus`
        locale: spracheAus(req) as never,
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

/**
 * Gibt den Slug in **allen** Sprachfassungen frei, wenn etwas weggeworfen wird.
 *
 * `slugFreigeben` räumt nur die Fassung ab, in der gerade gespeichert wird —
 * mehr sieht ein beforeChange-Hook nicht. Seit die Adresse übersetzbar ist,
 * reicht das nicht: Ein weggeworfener Artikel, dessen französische Adresse
 * stehen bleibt, blockiert den Namen für den nächsten, und `autoSlug` hängt
 * dort wortlos ein `-2` an — genau der Fall, den die Freigabe verhindern soll.
 *
 * Der Vermerk im `context` verhindert, dass die Aufräumschreibungen sich
 * selbst noch einmal auslösen.
 */
export function slugFreigebenAlleSprachen(sprachen: readonly string[]): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, req, collection, context }) => {
    if (context?.slugFreigabe) return doc
    if (!doc?.deletedAt || previousDoc?.deletedAt) return doc

    for (const sprache of sprachen) {
      await req.payload
        .update({
          collection: collection!.slug as never,
          id: doc.id,
          locale: sprache as never,
          overrideAccess: true,
          context: { slugFreigabe: true },
          data: { slug: null } as never,
          req,
        })
        .catch(() => undefined)
    }
    return doc
  }
}

/**
 * Hält fest, unter welcher Adresse ein Stück einmal zu finden war.
 *
 * **Warum das sein muss.** Eine Adresse ist ein Versprechen: Sie steht in
 * Lesezeichen, in Mails, im Index von Google. Wird sie geändert — und genau
 * das passiert jetzt reihenweise, wenn die französische Fassung eigene
 * Adressen bekommt —, läuft jeder alte Link ins Leere, solange niemand eine
 * Umleitung pflegt.
 *
 * Deshalb schreibt dieser Haken jede abgelegte Adresse mit. Die Artikelseite
 * sieht dort nach, wenn sie unter der gerufenen Adresse nichts findet, und
 * leitet dauerhaft auf die heutige weiter. Niemand muss daran denken.
 *
 * Er hängt an der Sammlung und nicht am Werkzeug: So greift er auch, wenn
 * jemand im Admin umbenennt.
 */
export function adresseMerken(bereich: string): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, req }) => {
    // Der Weggeworfene verliert seine Adresse absichtlich — das ist kein Umzug
    if (!doc || doc.deletedAt) return doc

    const sprache = spracheAus(req)
    /*
     * Beide Felder können umziehen: der Slug (im Admin, selten) und die
     * Adresse dieser Sprache (der Normalfall, sobald übersetzt wird). Was
     * vorher galt, wird gemerkt — egal welches der beiden es war.
     */
    const alteAdressen = [previousDoc?.slug, previousDoc?.adresse].filter(
      (a): a is string => typeof a === 'string' && a.trim() !== '',
    )
    const gelten = new Set(
      [doc.slug, doc.adresse].filter((a): a is string => typeof a === 'string' && a.trim() !== ''),
    )

    for (const alteAdresse of alteAdressen) {
      if (gelten.has(alteAdresse)) continue
      await req.payload
        .create({
          collection: 'address-history',
          overrideAccess: true,
          data: {
            bereich,
            dokument: Number(doc.id),
            sprache,
            adresse: alteAdresse,
            seit: new Date().toISOString(),
          } as never,
          req,
        })
        .catch((err) => {
          // Ein fehlender Eintrag im Verlauf darf das Umbenennen nicht aufhalten
          req.payload.logger.warn(
            { err },
            `Adressverlauf für ${bereich}/${doc.id} nicht geschrieben`,
          )
        })
    }
    return doc
  }
}
