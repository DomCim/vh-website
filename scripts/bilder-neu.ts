/**
 * Rechnet die Zuschnitte aller vorhandenen Bilder neu.
 *
 * Nötig, wenn sich die Größen in `Media.ts` ändern: Payload legt Zuschnitte
 * beim Hochladen an, nicht rückwirkend. Ohne diesen Lauf hätten alte Bilder
 * weiterhin nur die alten drei Größen im alten Format — und der Browser
 * bekäme für sie kein brauchbares `srcset`.
 *
 * Das Original bleibt unangetastet; es wird nur erneut durch die
 * Bildverarbeitung geschickt.
 *
 * Aufruf:  pnpm bilder-neu
 */
import fs from 'fs'
import path from 'path'

import config from '@payload-config'
import { getPayload } from 'payload'

const payload = await getPayload({ config })
const verzeichnis = process.env.MEDIA_DIR || path.join(process.cwd(), 'media')

const { docs, totalDocs } = await payload.find({
  collection: 'media',
  limit: 1000,
  depth: 0,
  overrideAccess: true,
})

console.log(`${totalDocs} Medien gefunden, Verzeichnis: ${verzeichnis}`)

let neu = 0
let uebersprungen = 0
let fehler = 0

for (const medium of docs) {
  const datei = medium.filename
  if (!datei || !medium.mimeType?.startsWith('image/')) {
    uebersprungen += 1
    continue
  }

  const pfad = path.join(verzeichnis, datei)
  if (!fs.existsSync(pfad)) {
    console.warn(`  fehlt auf der Platte: ${datei}`)
    fehler += 1
    continue
  }

  try {
    const daten = fs.readFileSync(pfad)
    await payload.update({
      collection: 'media',
      id: medium.id,
      overrideAccess: true,
      data: {},
      file: {
        data: daten,
        mimetype: medium.mimeType,
        name: datei,
        size: daten.byteLength,
      },
    })
    neu += 1
    if (neu % 10 === 0) console.log(`  ${neu} Bilder neu berechnet …`)
  } catch (err) {
    fehler += 1
    console.error(`  ${datei}: ${err instanceof Error ? err.message : err}`)
  }
}

console.log(`Fertig: ${neu} neu berechnet, ${uebersprungen} übersprungen, ${fehler} Fehler.`)
process.exit(0)
