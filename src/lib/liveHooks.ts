import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { type LiveBereich, istBereich } from './bereiche'
import { liveMelden } from './live'

/**
 * Meldet Änderungen einer Collection an die offenen Büro-Seiten — und hält
 * Löschungen für später fest.
 *
 * Bewusst am Datenmodell und nicht in den Formularen: So ist es gleich,
 * woher die Änderung kommt — Büro, Admin-Panel, Shop-Bestellung, PayPal-Rückkehr
 * oder der KI-Zugang. Alles landet in derselben Meldung.
 *
 * Die Live-Meldung erreicht nur, wer gerade verbunden ist. Ein Gerät, das
 * über Nacht aus war, holt sich seinen Rückstand später über den Abgleich —
 * und findet Gelöschtes nur, wenn beim Löschen ein Grabstein liegen blieb
 * (siehe collections/Deletions.ts).
 */
export function liveHooks(bereich: LiveBereich): {
  afterChange: CollectionAfterChangeHook[]
  afterDelete: CollectionAfterDeleteHook[]
} {
  const afterChange: CollectionAfterChangeHook = ({ doc, operation, req }) => {
    liveMelden(req.payload, bereich, operation === 'create' ? 'neu' : 'geaendert', doc?.id)
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = async ({ doc, id, req }) => {
    liveMelden(req.payload, bereich, 'geloescht', id)

    // Das Postfach führt keine eigene Sammlung, dort gibt es nichts zu merken
    if (istBereich(bereich)) {
      try {
        await req.payload.create({
          collection: 'deletions',
          overrideAccess: true,
          data: { bereich, datensatz: String(id) },
        })
      } catch (err) {
        // Ein fehlender Grabstein darf das Löschen nicht verhindern — die
        // Folge ist nur, dass ein lange abwesendes Gerät den Datensatz noch
        // sieht, bis es seinen Bestand neu holt.
        req.payload.logger.warn({ err }, `Grabstein für ${bereich}/${id} nicht angelegt`)
      }
    }

    return doc
  }

  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}
