import type { CollectionSlug, Payload } from 'payload'

/**
 * Etwas erst tun, wenn der Datensatz wirklich draußen sichtbar ist.
 *
 * **Das Problem.** Payload-Hooks laufen *in* der Transaktion, die den Vorgang
 * schreibt. Wer von dort meldet, meldet etwas, das es für jede andere
 * Verbindung noch gar nicht gibt: Der Push ging aufs Handy, das Live-Signal an
 * alle offenen Seiten — und der Abgleich, den beides auslöste, fand nichts.
 * Schlimmer noch: Er merkte sich einen Stand, der jünger war als der Datensatz
 * selbst, und damit war der für dieses Gerät dauerhaft verloren. Genau so
 * verschwand ein fertiger Rechnungsentwurf.
 *
 * **Der Weg.** Statt auf ein Signal zu warten, das es in Payload nicht gibt,
 * wird schlicht nachgesehen — mit einer Abfrage **ohne** `req`, also über eine
 * eigene Verbindung, die nur Festgeschriebenes sieht. Ist die Zeile da, ist die
 * Transaktion durch.
 *
 * **Bewusst nicht abgewartet.** Wer hier `await` schreibt, wartet im Hook auf
 * die eigene Transaktion und hängt bis zur Zeitüberschreitung. Der Aufrufer
 * ruft und geht weiter.
 *
 * Rollt die Transaktion zurück, gibt die Schleife nach ein paar Sekunden auf —
 * und es geht **keine** Meldung über einen Entwurf hinaus, den es nicht gibt.
 * Das ist der richtige Ausgang, nicht der Fehlerfall.
 */
export function nachCommit(
  payload: Payload,
  collection: CollectionSlug,
  id: number | string,
  aufgabe: () => void | Promise<unknown>,
  { versuche = 20, abstand = 150 }: { versuche?: number; abstand?: number } = {},
): void {
  const warten = (ms: number) => new Promise((fertig) => setTimeout(fertig, ms))

  void (async () => {
    for (let versuch = 0; versuch < versuche; versuch += 1) {
      const da = await payload
        .findByID({ collection, id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (da) {
        try {
          await aufgabe()
        } catch (err) {
          payload.logger.warn({ err }, `Nach dem Festschreiben von ${collection}/${id} gestolpert`)
        }
        return
      }
      await warten(abstand)
    }
    payload.logger.warn(
      `${collection}/${id} wurde nicht festgeschrieben — es geht keine Meldung hinaus`,
    )
  })()
}
