import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../lib/data'
import { sendMail } from '../../../../../../lib/sendMail'
import { getIntegrations } from '../../../../../../lib/settings'
import { steuerpaket } from '../../../../../../lib/steuerpaket'
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
 * Größer schicken wir nicht per Mail: Viele Postfächer weisen ab etwa 25 MB
 * ab, und eine abgewiesene Mail an die Kanzlei fällt niemandem auf, bis der
 * Steuerberater mahnt. Darüber gibt es das Paket nur als Download.
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
    if (paket.zip.length > MAIL_GRENZE) {
      return NextResponse.json(
        { error: 'zu-gross', groesse: paket.zip.length },
        { status: 413 },
      )
    }

    const monatsname = `${MONATE[zeitraum.monat - 1]} ${zeitraum.jahr}`
    const euro = (n: number) =>
      new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
    const hinweisScans = paket.ohneScan
      ? `<p>Hinweis: Zu ${paket.ohneScan} Ausgabe${paket.ohneScan === 1 ? '' : 'n'} liegt kein Beleg-Scan vor — diese fehlen im Anhang.</p>`
      : ''

    await sendMail(payload, {
      to: an,
      subject: `Monatsunterlagen ${monatsname}`,
      html:
        `<p>Guten Tag,</p>` +
        `<p>anbei die Unterlagen für ${monatsname}: die Buchungsliste als CSV, ` +
        `die Scans der Ausgabenbelege und die Ausgangsrechnungen als PDF.</p>` +
        `<p>Einnahmen ${euro(paket.bericht.einnahmen)} · Ausgaben ${euro(paket.bericht.ausgaben)} · ` +
        `${paket.dateien} ${paket.dateien === 1 ? 'Datei' : 'Dateien'} im Anhang.</p>` +
        hinweisScans +
        `<p>Diese Mail kommt direkt aus dem Bürosystem — Rückfragen bitte an die gewohnte Adresse.</p>`,
      attachments: [
        { filename: paket.dateiname, content: paket.zip, contentType: 'application/zip' },
      ],
      art: 'sonstiges',
    })

    return NextResponse.json({
      ok: true,
      an,
      dateien: paket.dateien,
      ohneScan: paket.ohneScan,
    })
  } catch (err) {
    console.error('Monatspaket-Versand fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
