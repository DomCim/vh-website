/**
 * Der Corten-Strich — die Handschrift des Hauses, an einer Stelle.
 *
 * Unter jeder Überschrift der Website läuft ein bronzener Strich nach rechts
 * aus. Er steht auch auf Angeboten und Rechnungen, in Mails und seit dem
 * Schreibfeld auch dort, wo jemand ihn von Hand setzt.
 *
 * **Warum eine eigene Datei.** Er stand bisher in `mail.ts`. Die liest
 * inzwischen das Logo von der Platte und ist damit nichts, was ein Browser
 * laden kann — `mailhtml.ts` steckt aber im Bündel des Büros und braucht
 * denselben Strich. Zwei Fassungen wären zwei Handschriften; nach dem ersten
 * Nachbessern sähe die Mail anders aus als das Angebot.
 */

/** Corten-Ton der Website */
export const BRONZE = '#a5622d'

/**
 * Corten-Strich unter einer Überschrift — dieselbe Form wie auf der Website:
 * 112 × 3 px bei großen, 40 × 2 px bei kleinen Überschriften, nach rechts
 * auslaufend.
 *
 * Der Verlauf liegt als `background-image` über einer einfarbigen Fläche:
 * Outlook kann keine Verläufe und zeigt dann den vollen Strich — richtig
 * aussehen tut es in beiden Fällen.
 */
export function cortenStrich(gross = false): string {
  const breite = gross ? 112 : 40
  const hoehe = gross ? 3 : 2
  const oben = gross ? 12 : 7
  const unten = gross ? 20 : 12
  return `<div style="width:${breite}px;height:${hoehe}px;border-radius:9999px;background-color:${BRONZE};background-image:linear-gradient(to right,${BRONZE} 0%,${BRONZE} 30%,rgba(165,98,45,0) 100%);margin:${oben}px 0 ${unten}px"></div>`
}
