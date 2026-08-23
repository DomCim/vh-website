import type { Payload } from 'payload'

import type { Bereich } from './bereiche'
import { BEREICHE } from './bereiche'

/**
 * Wegwerfen statt löschen — der Papierkorb des Hauses.
 *
 * **Warum es das gibt.** Ein Backup ist das Werkzeug für „der Server ist hin".
 * Für „einer hat sich verklickt" ist es das falsche: Es dreht die Zeit für
 * alle zurück, um einen Datensatz zu retten — der Artikel kommt wieder, und
 * jede Bestellung seit dem Backup ist weg. Billiger, schneller und genauer
 * ist, gar nicht erst zu löschen.
 *
 * **Für den Bedienenden bleibt es „Löschen".** Der Knopf heißt so, der
 * Datensatz ist sofort aus jeder Liste verschwunden, und niemand muss
 * zwischen „archivieren" und „löschen" wählen. Sobald man das täte, zögerte
 * man an jedem Knopf. Zurückholen kann es, wer in die Website-Verwaltung
 * kommt — dort steht der Papierkorb.
 *
 * **Warum nicht einfach `payload.delete`.** Payloads Papierkorb (`trash: true`)
 * wirkt beim Abfragen und im Verwaltungs-Panel, aber `delete` löscht
 * weiterhin hart. Ohne diese Stelle hätte das Haus einen Papierkorb, an dem
 * die eigenen Knöpfe vorbeilöschen — das Schlechteste von beidem: die
 * Sicherheit versprochen, nicht gehalten.
 *
 * Endgültig gelöscht wird nur von Hand in der Verwaltung. Eine Automatik, die
 * den Papierkorb nach Wochen leert, führte genau den Verlust wieder ein, den
 * er abschaffen soll — und bei einer Löschanfrage nach DSGVO muss ohnehin ein
 * Mensch entscheiden.
 */
export async function wegwerfen(
  payload: Payload,
  bereich: Bereich,
  id: string | number,
): Promise<void> {
  await payload.update({
    collection: BEREICHE[bereich],
    id,
    overrideAccess: true,
    data: { deletedAt: new Date().toISOString() } as never,
  })
}

/**
 * Dasselbe für Sammlungen, die kein Bereich des Büros sind.
 *
 * Der Bereich ist der Regelfall — daran hängen Live-Meldung und Grabstein.
 * Website-Inhalte wie Kategorien oder Referenzen laufen nicht über den
 * Abgleich, brauchen aber denselben Papierkorb.
 */
export async function wegwerfenIn(
  payload: Payload,
  sammlung: Parameters<Payload['update']>[0]['collection'],
  id: string | number,
): Promise<void> {
  await payload.update({
    collection: sammlung,
    id,
    overrideAccess: true,
    data: { deletedAt: new Date().toISOString() } as never,
  })
}
