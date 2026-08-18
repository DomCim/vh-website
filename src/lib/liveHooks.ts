import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { type LiveBereich, liveMelden } from './live'

/**
 * Meldet Änderungen einer Collection an die offenen Büro-Seiten.
 *
 * Bewusst am Datenmodell und nicht in den Formularen: So ist es gleich,
 * woher die Änderung kommt — Büro, Admin-Panel, Shop-Bestellung, Stripe-Rückruf
 * oder der KI-Zugang. Alles landet in derselben Meldung.
 */
export function liveHooks(bereich: LiveBereich): {
  afterChange: CollectionAfterChangeHook[]
  afterDelete: CollectionAfterDeleteHook[]
} {
  const afterChange: CollectionAfterChangeHook = ({ doc, operation }) => {
    liveMelden(bereich, operation === 'create' ? 'neu' : 'geaendert', doc?.id)
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = ({ doc, id }) => {
    liveMelden(bereich, 'geloescht', id)
    return doc
  }

  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}
