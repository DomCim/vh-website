import type { Access } from 'payload'

import { hatRecht } from '../lib/rechte'

/** Öffentlich lesbar (Website-Inhalte) */
export const anyone: Access = () => true

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
