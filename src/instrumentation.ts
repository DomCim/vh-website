/**
 * Wird von Next einmal je Serverprozess beim Start aufgerufen.
 *
 * Hier steht bewusst fast nichts: Die eigentliche Arbeit liegt in `takt.ts`,
 * damit sie für die Edge-Laufzeit ausgetauscht werden kann (siehe dort).
 */
export async function register(): Promise<void> {
  // Nur im Node-Prozess des laufenden Servers, nicht in der Edge-Laufzeit
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Beim Bauen wird ebenfalls geladen — da soll nichts loslaufen
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { taktStarten } = await import('./takt')
  await taktStarten()
}
