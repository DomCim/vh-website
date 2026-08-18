import type { Access } from 'payload'

/** Öffentlich lesbar (Website-Inhalte) */
export const anyone: Access = () => true

/** Nur eingeloggte Backend-Benutzer */
export const admins: Access = ({ req: { user } }) => Boolean(user)

/**
 * Büro-Bereich: Belege, Rechnungen, Inventar und der Steuer-Export.
 * Das sind Geschäftszahlen — sie gehen nur die Inhaberrolle etwas an, nicht
 * jeden, der Inhalte pflegen darf.
 */
export const office: Access = ({ req: { user } }) =>
  Boolean(user && (user as { role?: string }).role === 'inhaber')
