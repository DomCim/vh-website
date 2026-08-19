/**
 * Legt die Büro-Zugänge an.
 *
 * Aufruf:  pnpm benutzer
 *
 * Wird zweimal aufgerufen, passiert beim zweiten Mal nichts Schlimmes:
 * Vorhandene Konten werden nicht überschrieben, nur die Rolle wird auf
 * „Inhaber" gehoben, falls sie fehlte.
 *
 * Passwörter kommen aus den Umgebungsvariablen VH_PASSWORT und ADMIN_PASSWORT.
 * Fehlt eine, wird ein Passwort gewürfelt und einmal ausgegeben — es steht
 * nirgends sonst, also mitschreiben und danach im Konto ändern.
 */
import config from '@payload-config'
import { randomBytes } from 'crypto'
import { getPayload } from 'payload'

import { EINGEBAUTE_ROLLEN } from '../src/collections/Roles'

const KONTEN = [
  { email: 'vh@vincent-hellmann.com', name: 'Vincent Hellmann', umgebung: 'VH_PASSWORT' },
  { email: 'admin@vincent-hellmann.com', name: 'Verwaltung', umgebung: 'ADMIN_PASSWORT' },
]

/** Lesbares Passwort, das man am Handy noch abtippen kann */
const wuerfeln = () => randomBytes(12).toString('base64url')

async function main() {
  const payload = await getPayload({ config })

  /*
   * Erst dafür sorgen, dass es die eingebauten Rollen gibt.
   *
   * Die Migration legt sie an, aber dieses Skript läuft auch auf Datenbanken,
   * die auf anderen Wegen entstanden sind — und ein Konto ohne Rolle darf
   * nichts. Wer den Zugang anlegt und sich dann nicht anmelden kann, hält es
   * für einen Fehler beim Passwort und sucht an der falschen Stelle.
   */
  const rollen = new Map<string, number>()
  for (const vorlage of EINGEBAUTE_ROLLEN) {
    const da = await payload.find({
      collection: 'roles',
      where: { schluessel: { equals: vorlage.schluessel } },
      limit: 1,
      overrideAccess: true,
    })
    const rolle =
      da.docs[0] ?? (await payload.create({ collection: 'roles', overrideAccess: true, data: vorlage }))
    rollen.set(vorlage.schluessel, rolle.id as number)
  }

  for (const konto of KONTEN) {
    const vorhanden = await payload.find({
      collection: 'users',
      where: { email: { equals: konto.email } },
      limit: 1,
      overrideAccess: true,
    })

    if (vorhanden.docs[0]) {
      const nutzer = vorhanden.docs[0]
      const fehlt = nutzer.role !== 'inhaber' || !nutzer.rolle
      if (fehlt) {
        await payload.update({
          collection: 'users',
          id: nutzer.id,
          overrideAccess: true,
          data: { role: 'inhaber', rolle: rollen.get('inhaber') },
        })
        console.log(`${konto.email}: vorhanden, Rolle auf Inhaber gesetzt`)
      } else {
        console.log(`${konto.email}: vorhanden, nichts zu tun`)
      }
      continue
    }

    const gesetzt = process.env[konto.umgebung]
    const passwort = gesetzt || wuerfeln()

    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: konto.email,
        password: passwort,
        name: konto.name,
        role: 'inhaber',
        rolle: rollen.get('inhaber'),
      },
    })

    console.log(`${konto.email}: angelegt`)
    if (!gesetzt) {
      console.log(`   Passwort: ${passwort}`)
      console.log('   (wird nur hier ausgegeben — nach der ersten Anmeldung ändern)')
    }
  }

  console.log('\nBeide Konten haben die Inhaberrolle: Website-Verwaltung und Büro unter /office.')
  console.log('Zwei-Faktor bitte gleich im Admin unter „Mein Konto" einrichten.')
}

/*
 * Scheitert etwas, soll es laut scheitern.
 *
 * Ohne diesen Rahmen endete das Skript still — der Aufrufer sah einen
 * Erfolg, die Zugänge fehlten trotzdem, und der Fehler tauchte erst viel
 * später als abgewiesene Anmeldung wieder auf.
 */
try {
  await main()
} catch (err) {
  console.error('Zugänge konnten nicht angelegt werden:', err)
  process.exitCode = 1
}

// Ausgaben auf eine Pipe schreibt Node verzögert; erst leeren, dann beenden
await new Promise<void>((fertig) => process.stdout.write('', () => fertig()))
process.exit(process.exitCode ?? 0)
