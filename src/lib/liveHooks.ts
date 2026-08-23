import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from 'payload'

import { type LiveBereich, istBereich } from './bereiche'
import { liveMelden } from './live'

/**
 * Grabstein anlegen. Das Postfach führt keine eigene Sammlung, dort gibt es
 * nichts zu merken.
 */
async function grabsteinSetzen(payload: Payload, bereich: LiveBereich, id: string | number) {
  if (!istBereich(bereich)) return
  try {
    await payload.create({
      collection: 'deletions',
      overrideAccess: true,
      data: { bereich, datensatz: String(id) },
    })
  } catch (err) {
    // Ein fehlender Grabstein darf das Löschen nicht verhindern — die
    // Folge ist nur, dass ein lange abwesendes Gerät den Datensatz noch
    // sieht, bis es seinen Bestand neu holt.
    payload.logger.warn({ err }, `Grabstein für ${bereich}/${id} nicht angelegt`)
  }
}

/**
 * Grabstein wieder wegnehmen, wenn ein Datensatz aus dem Papierkorb zurückkommt.
 *
 * Ohne das käme er zwar in der Datenbank zurück, aber jedes Gerät, das den
 * Grabstein schon geholt hat, hätte ihn örtlich gelöscht und erführe nie vom
 * Gegenteil — der Datensatz wäre auf dem Handy für immer weg, obwohl er im
 * Büro wieder steht.
 */
async function grabsteinWegnehmen(payload: Payload, bereich: LiveBereich, id: string | number) {
  if (!istBereich(bereich)) return
  try {
    await payload.delete({
      collection: 'deletions',
      overrideAccess: true,
      where: { and: [{ bereich: { equals: bereich } }, { datensatz: { equals: String(id) } }] },
    })
  } catch (err) {
    payload.logger.warn({ err }, `Grabstein für ${bereich}/${id} nicht entfernt`)
  }
}

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
 *
 * **Wegwerfen zählt als Löschen.** Seit es den Papierkorb gibt, verschwindet
 * ein Datensatz meist nicht mehr aus der Tabelle, sondern bekommt nur ein
 * `deletedAt` — für Payload ist das eine ganz gewöhnliche Änderung. Für das
 * Gerät draußen ist es aber dasselbe wie eine Löschung, und ohne Grabstein
 * bliebe der weggeworfene Auftrag auf jedem Handy für immer stehen.
 */
export function liveHooks(bereich: LiveBereich): {
  afterChange: CollectionAfterChangeHook[]
  afterDelete: CollectionAfterDeleteHook[]
} {
  const afterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    const weg = Boolean(doc?.deletedAt)
    const warWeg = Boolean(previousDoc?.deletedAt)

    if (weg && !warWeg) {
      liveMelden(req.payload, bereich, 'geloescht', doc?.id)
      await grabsteinSetzen(req.payload, bereich, doc.id)
      return doc
    }

    if (!weg && warWeg) await grabsteinWegnehmen(req.payload, bereich, doc.id)

    liveMelden(req.payload, bereich, operation === 'create' ? 'neu' : 'geaendert', doc?.id)
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook = async ({ doc, id, req }) => {
    liveMelden(req.payload, bereich, 'geloescht', id)
    await grabsteinSetzen(req.payload, bereich, id)
    return doc
  }

  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}
