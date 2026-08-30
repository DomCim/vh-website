import { payloadClient } from '../../../../../lib/data'
import { alsKalender } from '../../../../../lib/kalender/ical'
import { alleTermine } from '../../../../../lib/kalender/quellen'
import { kontoZuSchluessel } from '../../../../../lib/kalender/zugang'
import { bereichErlaubt } from '../../../../../lib/bereiche'
import { rechteFuer } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Der Kalender zum Abonnieren — als iCalendar-Datei.
 *
 * Hier holt sich das iPhone alle halbe Stunde den Stand ab. Es meldet sich
 * nicht an, es schickt kein Cookie: Der Schlüssel in der Adresse ist der
 * ganze Nachweis (siehe lib/kalender/zugang.ts).
 *
 * Die Endung `.ics` steckt bewusst im Pfad. Manche Kalender-Programme sehen
 * sich die Adresse an, bevor sie die Antwort ansehen, und lehnen ab, was nicht
 * danach aussieht — auch wenn der Inhaltstyp stimmt.
 *
 * Lesend, immer. Was hier herauskommt, ist eine Aussicht auf das Büro; ein
 * Termin, den jemand am Telefon anlegt, kommt über CalDAV zurück und nicht
 * über diesen Weg — Abonnements sind einseitig, das ist keine Einstellung,
 * sondern das Wesen des Formats.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ schluessel: string }> }) {
  const { schluessel } = await ctx.params
  // Die Endung gehört zur Adresse, nicht zum Schlüssel
  const roh = schluessel.replace(/\.ics$/i, '')

  const payload = await payloadClient()
  const konto = await kontoZuSchluessel(payload, roh)

  /*
   * Ein falscher Schlüssel bekommt 404, nicht 401.
   *
   * Bei 401 fragt die Kalender-App am iPhone nach Benutzername und Passwort —
   * ein Fenster, in das niemand etwas eintragen kann, weil es hier keine
   * Anmeldung gibt. Der Nutzer stünde vor einem Dialog ohne Ausweg.
   */
  if (!konto) {
    return new Response('Nicht gefunden', { status: 404 })
  }

  const basis = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

  /*
   * Der Schlüssel ersetzt die Anmeldung, hebt aber die Rechte nicht auf.
   * Wer im Büro keine Aufträge sehen darf, bekommt sie auch hier nicht.
   */
  const rechte = await rechteFuer(payload, konto)
  if (!bereichErlaubt('termine', rechte)) {
    return new Response('Nicht gefunden', { status: 404 })
  }

  const termine = await alleTermine(payload, basis)
  const datei = alsKalender('Vincent Hellmann', termine)

  return new Response(datei, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="vincent-hellmann.ics"',
      // Nichts zwischenspeichern: Ein Termin, der vor einer Minute verschoben
      // wurde, soll beim nächsten Abruf verschoben sein und nicht in einer
      // halben Stunde.
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
