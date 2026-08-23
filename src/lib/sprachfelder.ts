import type { FeldBeschreibung } from './felderLesen'

/**
 * Was es je Sprache gibt — die Regeln an einer Stelle.
 *
 * **Warum das eine eigene Datei ist.** Dieselbe Frage wird an drei Orten
 * gestellt: Das Formular im Büro entscheidet daran, ob es eine Sprachwahl
 * zeigt; die Übersicht zeigt daran, welche Sprachen schon gepflegt sind; und
 * die Schreibroute entscheidet daran, was in eine fremde Sprachfassung
 * überhaupt hineindarf. Drei Antworten auf dieselbe Frage laufen auseinander,
 * sobald jemand ein Feld ergänzt — hier tun sie es nicht, und prüfen lässt es
 * sich ohne Formular und ohne Datenbank.
 *
 * **Und warum die Frage überhaupt so wichtig ist.** Was es nur einmal gibt —
 * Anschrift, Bankverbindung, Stundensatz, Zugangsdaten — würde beim Speichern
 * einer französischen Fassung mit dem überschrieben, was gerade im Formular
 * steht. Und dort steht bei einer Übersetzung womöglich nichts.
 */

/**
 * Gibt es an diesem Feld überhaupt etwas zu übersetzen?
 *
 * Eine Gruppe zählt mit, wenn wenigstens ein Feld darin übersetzbar ist (die
 * SEO-Standardtexte etwa stecken in einer Gruppe, die selbst keine ist). Eine
 * übersetzte Liste zählt ganz: Ihre Einträge gibt es je Sprache, und damit
 * auch alles, was in ihnen steht.
 */
export function hatUebersetzbares(feld: FeldBeschreibung): boolean {
  if (feld.uebersetzt) return true
  return (feld.felder ?? []).some(hatUebersetzbares)
}

/**
 * Nur die übersetzbaren Teile eines Wertes.
 *
 * Gebraucht für die Anzeige, welche Sprachen schon gepflegt sind: Ohne diesen
 * Schnitt sähe eine Gruppe wie „Handarbeit & Fertigung" in jeder Sprache
 * gefüllt aus, sobald irgendein nicht übersetzbares Feld darin steht — und die
 * Anzeige wäre wertlos, weil sie nie etwas zu tun meldet.
 */
export function uebersetzbarerTeil(feld: FeldBeschreibung, wert: unknown): unknown {
  if (feld.uebersetzt) return wert
  if (!feld.felder || !wert || typeof wert !== 'object') return undefined

  const raus: Record<string, unknown> = {}
  for (const unter of feld.felder) {
    const teil = uebersetzbarerTeil(unter, (wert as Record<string, unknown>)[unter.name])
    if (teil !== undefined) raus[unter.name] = teil
  }
  return Object.keys(raus).length ? raus : undefined
}

/**
 * Aus einem Satz Werte alles herausfiltern, was **nicht** je Sprache existiert.
 *
 * Das ist die Sicherung beim Schreiben: Was hier durchfällt, kann eine fremde
 * Sprachfassung nicht kaputt machen. Gruppen werden aufgemacht statt
 * abgewiesen, weil in ihnen übersetzbare Felder stecken können.
 */
export function nurUebersetzbares(
  felder: FeldBeschreibung[],
  werte: Record<string, unknown>,
): Record<string, unknown> {
  const raus: Record<string, unknown> = {}
  for (const feld of felder) {
    if (!(feld.name in werte)) continue
    if (feld.uebersetzt) {
      raus[feld.name] = werte[feld.name]
      continue
    }
    if (feld.art === 'gruppe' && feld.felder) {
      const inneres = werte[feld.name]
      if (inneres && typeof inneres === 'object') {
        const gefiltert = nurUebersetzbares(feld.felder, inneres as Record<string, unknown>)
        if (Object.keys(gefiltert).length) raus[feld.name] = gefiltert
      }
    }
  }
  return raus
}
