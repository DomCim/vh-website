import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { abholLinkGueltig, steuerpaket } from '../../../../lib/steuerpaket'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Die Abholstelle für das Monatspaket des Steuerberaters.
 *
 * Ohne Konto und ohne Passwort: Die Kanzlei bekommt einen Link, dessen
 * Signatur Monat und Ablaufzeit festnagelt (siehe lib/steuerpaket). Ein
 * abgelaufener oder veränderter Link läuft ins Leere — mit einer Antwort,
 * die ein Mensch versteht, denn hier klickt kein Büro-Konto, sondern die
 * Kanzlei. Das Paket entsteht beim Abholen frisch; gespeichert wird nichts.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const jahr = Number(url.searchParams.get('jahr'))
  const monat = Number(url.searchParams.get('monat'))
  const bis = Number(url.searchParams.get('bis'))
  const sig = url.searchParams.get('sig') ?? ''

  const passt =
    Number.isInteger(jahr) &&
    jahr >= 2020 &&
    jahr <= 2100 &&
    Number.isInteger(monat) &&
    monat >= 1 &&
    monat <= 12 &&
    abholLinkGueltig(jahr, monat, bis, sig)
  if (!passt) {
    return new NextResponse(
      'Dieser Abhol-Link ist abgelaufen oder ungültig. Bitte lassen Sie sich einen neuen zuschicken.',
      { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  }

  try {
    const payload = await payloadClient()
    const paket = await steuerpaket(payload, jahr, monat)
    return new NextResponse(new Uint8Array(paket.zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${paket.dateiname}"`,
        // Ein Paket mit Belegen hat in keinem Zwischenspeicher etwas verloren
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Steuerpaket-Abholung fehlgeschlagen:', err)
    return new NextResponse('Die Zusammenstellung ist fehlgeschlagen — bitte später erneut.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
