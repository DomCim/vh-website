/**
 * Leere Hülle des Takts für die Edge-Laufzeit.
 *
 * Dort läuft nichts Zeitgesteuertes — `instrumentation.ts` steigt vorher aus.
 * Übersetzt wird die Instrumentierung trotzdem, und ohne diese Hülle zöge sie
 * Payload und den Benachrichtigungsversand mit in ein Bündel, in dem es keine
 * Node-Bausteine gibt. Eingesetzt wird sie in next.config.mjs.
 */
export async function taktStarten(): Promise<void> {
  // absichtlich nichts
}
