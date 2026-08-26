import { NextResponse } from 'next/server'

import { alsDatev, alsWindows1252, datevDateiname } from '../../../../../../lib/datev'
import { payloadClient } from '../../../../../../lib/data'
import { sendMail } from '../../../../../../lib/sendMail'
import { getIntegrations } from '../../../../../../lib/settings'
import { alsCsv } from '../../../../../../lib/steuerexport'
import { ABHOL_TAGE, abholLink, steuerpaket } from '../../../../../../lib/steuerpaket'
import { darf } from '../../../../../../lib/wache'

export const dynamic = 'force-dynamic'
// Ein Monat voller Beleg-Scans und frisch gerenderter Rechnungen braucht Zeit
export const maxDuration = 300

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/*
 * Größer schicken wir nicht als Anhang: Viele Postfächer weisen ab etwa
 * 25 MB ab, und eine abgewiesene Mail an die Kanzlei fällt niemandem auf,
 * bis der Steuerberater mahnt. Darüber geht stattdessen ein signierter
 * Abhol-Link hinaus — die Buchungsliste fährt als kleiner Anhang trotzdem
 * mit, damit die Zahlen sofort da sind.
 */
const MAIL_GRENZE = 18 * 1024 * 1024

async function pruefen(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'zahlen.sehen'))) return null
  return payload
}

function zeitraumAus(jahrRoh: unknown, monatRoh: unknown): { jahr: number; monat: number } | null {
  const jahr = Number(jahrRoh)
  const monat = Number(monatRoh)
  if (!Number.isInteger(jahr) || jahr < 2020 || jahr > 2100) return null
  if (!Number.isInteger(monat) || monat < 1 || monat > 12) return null
  return { jahr, monat }
}

/** Das Monatspaket herunterladen — ZIP mit Buchungsliste, Belegen, Rechnungen */
export async function GET(req: Request) {
  const payload = await pruefen(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const url = new URL(req.url)
  const zeitraum = zeitraumAus(url.searchParams.get('jahr'), url.searchParams.get('monat'))
  if (!zeitraum) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

  try {
    const paket = await steuerpaket(payload, zeitraum.jahr, zeitraum.monat)
    return new NextResponse(new Uint8Array(paket.zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${paket.dateiname}"`,
      },
    })
  } catch (err) {
    console.error('Monatspaket fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

/** Das Monatspaket an die Kanzlei mailen */
export async function POST(req: Request) {
  const payload = await pruefen(req)
  if (!payload) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  try {
    const b = (await req.json()) as { jahr?: number; monat?: number }
    const zeitraum = zeitraumAus(b.jahr, b.monat)
    if (!zeitraum) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

    const { email } = await getIntegrations(payload)
    const an = email.steuerberaterEmail?.trim()
    if (!an) return NextResponse.json({ error: 'keine-kanzlei' }, { status: 409 })

    const paket = await steuerpaket(payload, zeitraum.jahr, zeitraum.monat)
    const alsLink = paket.zip.length > MAIL_GRENZE

    const monatsname = `${MONATE[zeitraum.monat - 1]} ${zeitraum.jahr}`
    const euro = (n: number) =>
      new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
    const hinweisScans = paket.ohneScan
      ? `<p>Hinweis: Zu ${paket.ohneScan} Ausgabe${paket.ohneScan === 1 ? '' : 'n'} liegt kein Beleg-Scan vor — diese fehlen im Paket.</p>`
      : ''
    const mm = String(zeitraum.monat).padStart(2, '0')

    /*
     * Der Buchungsstapel fährt mit — wenn die zwei Nummern da sind.
     *
     * Er wiegt ein paar Kilobyte und erspart der Kanzlei das Abtippen: Die
     * Buchungsliste kann dort nur ein Mensch lesen, diese Datei liest DATEV
     * selbst ein. Beides mitzuschicken kostet nichts und lässt der Kanzlei
     * die Wahl.
     *
     * Fehlen Berater- oder Mandantennummer, bleibt die Datei weg statt
     * unbrauchbar mitzufahren — eine abgewiesene Importdatei schickt nur
     * jemanden auf Fehlersuche. Im Büro steht dann auf /office/steuer, was zu
     * tun ist.
     */
    const jetzt = new Date()
    const zwei = (n: number) => String(n).padStart(2, '0')
    const datevAnhang =
      email.datevBerater && email.datevMandant
        ? [
            {
              filename: datevDateiname(zeitraum.jahr, zeitraum.monat),
              content: alsWindows1252(
                alsDatev(
                  paket.bericht,
                  {
                    berater: email.datevBerater,
                    mandant: email.datevMandant,
                    bezeichnung: `Buchungen ${mm}/${zeitraum.jahr}`,
                  },
                  `${jetzt.getFullYear()}${zwei(jetzt.getMonth() + 1)}${zwei(jetzt.getDate())}` +
                    `${zwei(jetzt.getHours())}${zwei(jetzt.getMinutes())}${zwei(jetzt.getSeconds())}` +
                    String(jetzt.getMilliseconds()).padStart(3, '0'),
                ),
              ),
              contentType: 'text/csv',
            },
          ]
        : []

    let rumpf: string
    let anhaenge: { filename: string; content: Buffer; contentType?: string }[]
    if (alsLink) {
      const { url, bis } = abholLink(zeitraum.jahr, zeitraum.monat)
      rumpf =
        `<p>die Unterlagen für ${monatsname} sind diesmal zu umfangreich für einen Anhang ` +
        `(${Math.round(paket.zip.length / 1024 / 1024)} MB). Sie können das Paket hier abholen:</p>` +
        `<p><a href="${url}">${url}</a></p>` +
        `<p>Der Link ist bis zum ${bis.toLocaleDateString('de-DE')} gültig (${ABHOL_TAGE} Tage) und ` +
        `liefert eine ZIP-Datei mit den Scans der Ausgabenbelege und den Ausgangsrechnungen als PDF. ` +
        `Die Buchungsliste hängt dieser Mail bereits als CSV an.</p>`
      anhaenge = [
        {
          filename: `buchungen-${zeitraum.jahr}-${mm}.csv`,
          content: Buffer.from(alsCsv(paket.bericht), 'utf8'),
          contentType: 'text/csv',
        },
        ...datevAnhang,
      ]
    } else {
      rumpf =
        `<p>anbei die Unterlagen für ${monatsname}: die Buchungsliste als CSV, ` +
        `die Scans der Ausgabenbelege und die Ausgangsrechnungen als PDF.</p>`
      anhaenge = [
        { filename: paket.dateiname, content: paket.zip, contentType: 'application/zip' },
        ...datevAnhang,
      ]
    }

    /*
     * Und die Kanzlei soll wissen, dass die Datei dabei ist.
     *
     * Ein Anhang, den niemand erwartet, wird übersehen — und dann tippt dort
     * doch jemand ab, was gleich daneben zum Einlesen liegt.
     */
    if (datevAnhang.length) {
      rumpf +=
        `<p>Neu dabei: <strong>${datevAnhang[0]!.filename}</strong> — ein Buchungsstapel im ` +
        `DATEV-Format (EXTF), der sich direkt importieren lässt. Die Konten sind nach SKR03 ` +
        `vorbelegt; bitte prüfen Sie die Zuordnung einmal gegen Ihren Kontenrahmen und sagen Sie ` +
        `uns Bescheid, wenn etwas anders laufen soll.</p>`
    }

    await sendMail(payload, {
      to: an,
      subject: `Monatsunterlagen ${monatsname}`,
      html:
        `<p>Guten Tag,</p>` +
        rumpf +
        `<p>Einnahmen ${euro(paket.bericht.einnahmen)} · Ausgaben ${euro(paket.bericht.ausgaben)} · ` +
        `${paket.dateien} ${paket.dateien === 1 ? 'Datei' : 'Dateien'} im Paket.</p>` +
        hinweisScans +
        `<p>Diese Mail kommt direkt aus dem Bürosystem — Rückfragen bitte an die gewohnte Adresse.</p>`,
      attachments: anhaenge,
      art: 'sonstiges',
    })

    return NextResponse.json({
      ok: true,
      an,
      dateien: paket.dateien,
      ohneScan: paket.ohneScan,
      alsLink,
    })
  } catch (err) {
    console.error('Monatspaket-Versand fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
