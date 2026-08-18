/**
 * Spielt die Entwürfe für Widerrufsbelehrung, Muster-Widerrufsformular sowie
 * Versand & Zahlung in die Rechtsseiten ein — in Deutsch, Französisch und
 * Englisch.
 *
 * Geschrieben wird nur, wo noch nichts steht. Mit `--ueberschreiben` werden
 * vorhandene Texte ersetzt (Vorsicht: eigene Fassungen gehen dann verloren).
 *
 * Aufruf:  pnpm rechtstexte
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { rechtstexteEinspielen } from '../src/lib/rechtstexte'

const payload = await getPayload({ config })
const ueberschreiben = process.argv.includes('--ueberschreiben')

const geschrieben = await rechtstexteEinspielen(payload, { ueberschreiben })

if (geschrieben.length === 0) {
  console.log('Es stand überall schon etwas — nichts geändert.')
} else {
  console.log(`Eingespielt: ${geschrieben.join(', ')}`)
  console.log('Bitte im Admin unter Rechtliches durchlesen und anpassen.')
}

process.exit(0)
