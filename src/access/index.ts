import type { Access } from 'payload'

import { hatRecht } from '../lib/rechte'

/** Öffentlich lesbar (Website-Inhalte) */
export const anyone: Access = () => true

/**
 * Öffentlich lesbar — außer dem, was als intern markiert ist.
 *
 * Für Artikel: Eine Lohnarbeits-Vorlage („CNC-Fräsen für Firma X") ist ein
 * Artikel wie jeder andere, geht aber niemanden draußen etwas an. Wer kein
 * Büro-Konto hat, bekommt über die REST-Schnittstelle nur die öffentlichen —
 * als Filterbedingung, nicht als Verbot, damit die Website weiter ohne
 * Anmeldung lesen kann.
 *
 * Das ist die unterste Verteidigungslinie. Die Website fragt über die
 * Local-API, und die läuft an Zugriffsregeln vorbei (`overrideAccess` ist
 * dort die Vorgabe) — deshalb filtern die öffentlichen Abfragen in
 * `lib/data.ts` und Nachbarn **zusätzlich** selbst. Doppelt genäht, mit
 * Absicht: Eine vergessene Stelle gibt dann höchstens eine leere Liste her,
 * keinen internen Artikel.
 */
export const anyoneAusserIntern: Access = ({ req: { user } }) => {
  if (hatRecht(user, 'buero.oeffnen')) return true
  return { intern: { not_equals: true } }
}

/** Nur eingeloggte Backend-Benutzer */
export const admins: Access = ({ req: { user } }) => Boolean(user)

/**
 * Büro-Bereich: Belege, Rechnungen, Inventar und der Steuer-Export.
 * Das sind Geschäftszahlen — sie gehen nicht jeden etwas an, der Inhalte
 * pflegen darf.
 *
 * Geprüft wird ohne Nachladen der Rolle: Zugriffsregeln laufen bei jeder
 * einzelnen Abfrage, und eine zusätzliche Abfrage je Abfrage wäre teuer.
 * `hatRecht` kommt damit zurecht — es erkennt die Inhaberrolle auch an der
 * bereits geladenen Beziehung und am alten Auswahlfeld.
 */
export const office: Access = ({ req: { user } }) => hatRecht(user, 'buero.oeffnen')
