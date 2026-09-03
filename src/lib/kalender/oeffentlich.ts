import type { Payload } from 'payload'

import type { Locale } from '../i18n'
import { alsHtml, alsText, inSprache, merkmaleLesen } from './merkmale'

/**
 * Die Termine, die nach außen gehören.
 *
 * Ein Termin wird öffentlich, indem in seiner Notiz `#öffentlich` steht —
 * mehr braucht es nicht, und das kann Vincent vom Telefon aus (siehe
 * `merkmale.ts`). Die Vorgabe ist damit „privat": Wer nichts hinschreibt oder
 * sich vertippt, dessen Werkstatttermin steht nicht im Netz. Andersherum
 * wäre der Fehler teuer.
 *
 * Was hier gefiltert wird, ist bewusst nicht in der Datenbank abfragbar: Das
 * Flag steckt in einem Textfeld. Bei der Zahl an Terminen, um die es in
 * diesem Betrieb geht, ist das ohne Belang — es sind ein paar Dutzend im
 * Jahr, nicht Zehntausende. Sollte das je knapp werden, gehört das Flag in
 * ein eigenes Feld, das beim Speichern aus der Notiz gefüllt wird.
 */

export type OeffentlicherTermin = {
  id: number | string
  beginn: string
  ende: string | null
  ganztaegig: boolean
  abgesagt: boolean
  titel: string
  /** Schon ausgezeichnet — `**fett**` und `*kursiv*` sind HTML geworden. */
  beschreibungHtml: string | null
  /** Derselbe Text ohne Auszeichnung — für die strukturierten Daten */
  beschreibungText: string | null
  ort: string | null
  link: string | null
  bild: string | null
}

/**
 * Wie lange ein Termin nach seinem Ende noch stehen bleibt.
 *
 * Bis zum Ende des Tages, nicht bis zur Uhrzeit: Ein Markt, der um 16 Uhr
 * schließt, soll um 17 Uhr nicht schon verschwunden sein — wer nachsieht, wo
 * Vincent heute war, sucht ihn noch am selben Abend.
 */
function nochAktuell(beginn: Date, ende: Date | null): boolean {
  const schluss = new Date(ende ?? beginn)
  schluss.setHours(23, 59, 59, 999)
  return schluss.getTime() >= Date.now()
}

/**
 * Die kommenden öffentlichen Termine, fertig zum Anzeigen.
 *
 * Abgesagte kommen mit. Ein Termin, der einfach verschwindet, lässt jeden im
 * Ungewissen, der schon hinfahren wollte — „abgesagt" ist eine Auskunft,
 * nichts zu finden ist keine.
 */
export async function oeffentlicheTermine(
  payload: Payload,
  sprache: Locale,
  grenze = 50,
): Promise<OeffentlicherTermin[]> {
  const treffer = await payload.find({
    collection: 'appointments',
    overrideAccess: true,
    // Großzügig geholt, weil erst die Notiz entscheidet — gefiltert wird hier
    limit: 500,
    depth: 0,
    sort: 'start',
    where: { start: { greater_than_equal: new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString() } },
  })

  const termine: OeffentlicherTermin[] = []

  for (const doc of treffer.docs as Record<string, any>[]) {
    const merkmale = merkmaleLesen(doc.notiz)
    if (!merkmale.oeffentlich) continue

    const beginn = new Date(doc.start)
    const ende = doc.ende ? new Date(doc.ende) : null
    if (!nochAktuell(beginn, ende)) continue

    const beschreibung = inSprache(merkmale.beschreibung, sprache)

    termine.push({
      id: doc.id,
      beginn: doc.start,
      ende: doc.ende ?? null,
      ganztaegig: Boolean(doc.ganztaegig),
      abgesagt: merkmale.abgesagt,
      /*
       * Der Titel nach außen darf ein anderer sein als der interne. „Nancy
       * Aufbau 6:00" ist eine Arbeitsnotiz, „Messe Nancy — Stand 14" ist das,
       * was jemand draußen lesen soll.
       */
      titel: inSprache(merkmale.titel, sprache) ?? String(doc.title ?? 'Termin'),
      beschreibungHtml: beschreibung ? alsHtml(beschreibung) : null,
      beschreibungText: beschreibung ? alsText(beschreibung) : null,
      ort: inSprache(merkmale.ort, sprache) ?? (doc.ort ? String(doc.ort) : null),
      /*
       * Nur http und https. Ein `javascript:`-Verweis in einem Feld, das über
       * CalDAV von einem Telefon kam, hätte auf der Website nichts verloren.
       */
      link: merkmale.link && /^https?:\/\//i.test(merkmale.link) ? merkmale.link : null,
      bild: merkmale.bild ?? null,
    })

    if (termine.length >= grenze) break
  }

  return termine
}
