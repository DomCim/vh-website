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

const KONTEN = [
  { email: 'vh@vincent-hellmann.com', name: 'Vincent Hellmann', umgebung: 'VH_PASSWORT' },
  { email: 'admin@vincent-hellmann.com', name: 'Verwaltung', umgebung: 'ADMIN_PASSWORT' },
]

/** Lesbares Passwort, das man am Handy noch abtippen kann */
const wuerfeln = () => randomBytes(12).toString('base64url')

async function main() {
  const payload = await getPayload({ config })

  for (const konto of KONTEN) {
    const vorhanden = await payload.find({
      collection: 'users',
      where: { email: { equals: konto.email } },
      limit: 1,
      overrideAccess: true,
    })

    if (vorhanden.docs[0]) {
      const nutzer = vorhanden.docs[0]
      if (nutzer.role !== 'inhaber') {
        await payload.update({
          collection: 'users',
          id: nutzer.id,
          overrideAccess: true,
          data: { role: 'inhaber' },
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

await main()
process.exit(0)
