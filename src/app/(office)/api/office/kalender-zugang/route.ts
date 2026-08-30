import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import {
  abonnementAdresse,
  caldavAdresse,
  neuerSchluessel,
} from '../../../../../lib/kalender/zugang'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Der eigene Kalender-Zugang — anzeigen, anlegen, zurückziehen.
 *
 * Immer nur der eigene. Es gibt hier bewusst keinen Weg, den Schlüssel eines
 * anderen zu sehen: Er ist so viel wert wie ein Passwort (siehe
 * `lib/kalender/zugang.ts`), und wer den eines Kollegen kennt, sieht dessen
 * Kalender, ohne dass es irgendwo auffiele. Auch `benutzer.verwalten` öffnet
 * das nicht — wer jemandem den Zugang nehmen will, zieht ihn zurück, statt
 * ihn zu lesen.
 */

const basis = () =>
  (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

/** Was der Angemeldete über seinen Zugang erfährt. */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  /*
   * Frisch aus der Datenbank holen: Das Feld ist vor der Schnittstelle
   * verborgen (`access.read: () => false` in `Users.ts`), steht also im
   * angemeldeten Benutzer nicht drin.
   */
  const konto = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    depth: 0,
  })

  const schluessel = (konto as Record<string, any>).kalenderSchluessel as string | undefined

  return NextResponse.json({
    eingerichtet: Boolean(schluessel),
    abonnement: schluessel ? abonnementAdresse(basis(), schluessel) : null,
    caldav: schluessel ? caldavAdresse(basis(), schluessel) : null,
    benutzername: konto.email ?? '',
    schluessel: schluessel ?? null,
  })
}

/**
 * Einen Zugang einrichten oder erneuern.
 *
 * Erneuern und Einrichten sind derselbe Vorgang: Ein neuer Schlüssel macht
 * den alten augenblicklich wertlos. Das ist der Weg, wenn ein Telefon
 * abhandenkommt — danach muss jedes Gerät neu eingerichtet werden, und genau
 * das ist der Sinn.
 */
export async function POST(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  const schluessel = neuerSchluessel()
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { kalenderSchluessel: schluessel },
  })

  return NextResponse.json({
    eingerichtet: true,
    abonnement: abonnementAdresse(basis(), schluessel),
    caldav: caldavAdresse(basis(), schluessel),
    benutzername: user.email ?? '',
    schluessel,
  })
}

/** Den Zugang zurückziehen. Abonnierte Geräte bekommen danach nichts mehr. */
export async function DELETE(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { kalenderSchluessel: null },
  })

  return NextResponse.json({ eingerichtet: false })
}
