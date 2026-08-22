import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

/**
 * Der Schlüssel im Quelltext und die Datei unter `public/` müssen
 * übereinstimmen — Dateiname wie Inhalt.
 *
 * Warum das eine eigene Prüfung wert ist: Stimmt es nicht überein, geht die
 * Meldung trotzdem hinaus und der Dienst nimmt sie an. Erst danach holt er
 * die Datei, findet einen anderen Wert und verwirft alles — still. Es gibt
 * keine Fehlermeldung, keine rote Ampel, nichts im Protokoll außer einem
 * „angenommen". Man merkt es erst daran, dass neue Seiten wochenlang nicht
 * auftauchen, und dann sucht man an der falschen Stelle.
 */
test('Der IndexNow-Schlüssel liegt als Datei unter der eigenen Adresse', () => {
  const quelle = fs.readFileSync(path.join(process.cwd(), 'src/lib/indexnow.ts'), 'utf8')
  const treffer = quelle.match(/export const INDEXNOW_SCHLUESSEL = '([^']+)'/)
  expect(treffer, 'INDEXNOW_SCHLUESSEL steht nicht mehr in lib/indexnow.ts').not.toBeNull()

  const schluessel = treffer![1]
  // Der Dienst verlangt 8 bis 128 Zeichen aus Ziffern, Buchstaben und Bindestrich
  expect(schluessel).toMatch(/^[a-zA-Z0-9-]{8,128}$/)

  const datei = path.join(process.cwd(), 'public', `${schluessel}.txt`)
  expect(fs.existsSync(datei), `public/${schluessel}.txt fehlt`).toBe(true)
  expect(fs.readFileSync(datei, 'utf8').trim()).toBe(schluessel)
})
