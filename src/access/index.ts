import type { Access } from 'payload'

/** Öffentlich lesbar (Website-Inhalte) */
export const anyone: Access = () => true

/** Nur eingeloggte Backend-Benutzer */
export const admins: Access = ({ req: { user } }) => Boolean(user)
