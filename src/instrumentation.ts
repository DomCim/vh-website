/**
 * Der eigene Takt des Servers.
 *
 * Zeitgesteuertes — nächtliche Sicherung, Erinnerung an fällige Belege,
 * Angebote nachfassen, Aufräumen, Blick ins Postfach — braucht jemanden, der
 * regelmäßig nachsieht. Naheliegend wäre ein Cron von außen; nur läuft dieser
 * Server ohnehin durch. Ein zweiter Container, der ihm alle paar Minuten auf
 * die Schulter tippt, wäre ein bewegliches Teil mehr, das ausfallen kann —
 * und eine Zeile in einer Anleitung, die jemand überliest, bis das Backup
 * fehlt.
 *
 * Deshalb zählt der Server selbst mit. `register()` ruft Next einmal je
 * Serverprozess beim Start auf; danach schlägt hier jede Minute das Herz.
 *
 * Wie oft tatsächlich gearbeitet wird — und ob überhaupt —, steht im Admin
 * unter Integrationen → Takt und wird bei jedem Schlag neu gelesen: Eine
 * Änderung greift binnen einer Minute, ohne Neustart und ohne
 * Umgebungsvariable, die beim automatischen Ausrollen ohnehin niemand setzt. Ob eine Aufgabe dran ist, entscheidet ihr
 * letzter Lauf in der Datenbank — nicht ein Zähler im Speicher, der bei
 * jedem Neustart von vorn begänne.
 */

/** Herzschlag. Nicht die Arbeitsfrequenz — nur der Blick auf die Uhr. */
const SCHLAG_MS = 60_000

export async function register(): Promise<void> {
  // Nur im Node-Prozess des laufenden Servers, nicht in der Edge-Laufzeit
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Beim Bauen wird ebenfalls geladen — da soll nichts loslaufen
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { payloadClient } = await import('./lib/data')
  const { istFaellig, postfachPruefen, takteinstellungen, wartungslauf } = await import(
    './lib/wartung'
  )

  /**
   * Zwei Läufe dürfen sich nicht überholen: Eine Sicherung kann Minuten
   * dauern, und in der Zeit soll der nächste Schlag nicht dieselbe Arbeit
   * noch einmal anwerfen.
   */
  let laeuftWartung = false
  let laeuftPostfach = false

  const schlag = async () => {
    const payload = await payloadClient()
    const takt = await takteinstellungen(payload)
    if (!takt.aktiv) return

    if (!laeuftPostfach && (await istFaellig(payload, 'postfach', takt.postfachMinuten))) {
      laeuftPostfach = true
      void postfachPruefen(payload)
        .catch((err) => payload.logger.error({ err }, 'Postfach-Blick fehlgeschlagen'))
        .finally(() => {
          laeuftPostfach = false
        })
    }

    if (!laeuftWartung && (await istFaellig(payload, 'wartung', takt.intervalMinuten))) {
      laeuftWartung = true
      void wartungslauf(payload)
        .catch((err) => payload.logger.error({ err }, 'Wartungslauf fehlgeschlagen'))
        .finally(() => {
          laeuftWartung = false
        })
    }
  }

  const uhr = setInterval(() => {
    void schlag().catch((err) => console.error('Takt fehlgeschlagen:', err))
  }, SCHLAG_MS)
  // Der Takt soll den Prozess nicht am Beenden hindern
  uhr.unref?.()

  console.log('Eigener Takt läuft — Einstellungen im Admin unter Integrationen → Takt.')
}
