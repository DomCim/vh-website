import { textZuRichText } from './richtextText'

/**
 * Wandelt lesbaren Text in Payload-Richtext um.
 *
 * Früher konnte das hier nur Absätze. Seit die Rechtstexte im Büro und die
 * Artikelbeschreibungen über die KI-Schnittstelle geschrieben werden, ist das
 * zu wenig: Eine per Assistent übersetzte Beschreibung wurde zur Textwüste, wo
 * die deutsche Zwischenüberschriften und eine Aufzählung hatte.
 *
 * Die Umsetzung steht jetzt in `lib/richtextText.ts` und versteht dazu
 * `## Überschrift`, `### Kleinere`, `- Punkt` und `**fett**`. Für einen Text
 * ohne diese Zeichen ändert sich nichts — er wird zu Absätzen wie bisher.
 */
export function richText(text: string) {
  return textZuRichText(text)
}
