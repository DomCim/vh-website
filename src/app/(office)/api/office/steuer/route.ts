import { alsDatev, alsWindows1252, datevDateiname } from '../../../../../lib/datev'
import { payloadClient } from '../../../../../lib/data'
import { getIntegrations } from '../../../../../lib/settings'
import { alsCsv, steuerbericht } from '../../../../../lib/steuerexport'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Steuer-Export für den Steuerberater — in zwei Formaten.
 *
 * `?format=datev` liefert einen Buchungsstapel, den DATEV direkt einliest.
 * Ohne Angabe kommt die Tabelle wie bisher: Dieselben Zahlen, aber für ein
 * Augenpaar gemacht.
 *
 * Beide bleiben, und das ist Absicht. Nicht jede Kanzlei importiert, und für
 * einen Blick ins Jahr ist die Tabelle das bessere Blatt — wer sie durch die
 * DATEV-Datei ersetzt, nimmt etwas weg, statt etwas dazuzugeben.
 */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'zahlen.sehen'))) {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const suche = new URL(req.url).searchParams
  const jahr = Number(suche.get('jahr')) || new Date().getFullYear()

  /*
   * Ein Monat, wenn einer genannt ist.
   *
   * DATEV wird meist monatlich gebucht, nicht im Jahresblock: Wer im Februar
   * den Januar abgibt, will den Januar und nicht das halbe Vorjahr mit.
   */
  const monatRoh = Number(suche.get('monat'))
  const monat = Number.isInteger(monatRoh) && monatRoh >= 1 && monatRoh <= 12 ? monatRoh : undefined

  const bericht = await steuerbericht(payload, jahr, monat)

  if (suche.get('format') === 'datev') {
    const { email } = await getIntegrations(payload)
    if (!email.datevBerater || !email.datevMandant) {
      /*
       * Lieber eine klare Auskunft als eine Datei, die beim Import
       * abgewiesen wird. Ohne die zwei Nummern im Kopf nimmt DATEV den
       * Stapel nicht an, und der Steuerberater sucht den Fehler bei sich.
       */
      return new Response(
        'Für den DATEV-Export fehlen die Berater- und die Mandantennummer. ' +
          'Beide stehen unter Einstellungen → Integrationen → E-Mail und kommen von der Kanzlei.',
        { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      )
    }

    // Zeitstempel JJJJMMTTHHMMSSFFF, wie der Kopf ihn verlangt
    const jetzt = new Date()
    const zwei = (n: number) => String(n).padStart(2, '0')
    const erzeugt =
      `${jetzt.getFullYear()}${zwei(jetzt.getMonth() + 1)}${zwei(jetzt.getDate())}` +
      `${zwei(jetzt.getHours())}${zwei(jetzt.getMinutes())}${zwei(jetzt.getSeconds())}` +
      String(jetzt.getMilliseconds()).padStart(3, '0')

    const inhalt = alsDatev(
      bericht,
      {
        berater: email.datevBerater,
        mandant: email.datevMandant,
        bezeichnung: monat ? `Buchungen ${zwei(monat)}/${jahr}` : `Buchungen ${jahr}`,
      },
      erzeugt,
    )

    return new Response(new Uint8Array(alsWindows1252(inhalt)), {
      headers: {
        // Windows-1252 gehört in den Kopf, sonst rät der Browser UTF-8
        'Content-Type': 'text/csv; charset=windows-1252',
        'Content-Disposition': `attachment; filename="${datevDateiname(jahr, monat)}"`,
      },
    })
  }

  const zeitraum = monat ? `${jahr}-${String(monat).padStart(2, '0')}` : String(jahr)
  return new Response(alsCsv(bericht), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vh-buchungen-${zeitraum}.csv"`,
    },
  })
}
