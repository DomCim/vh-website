import fs from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import type { Payload } from 'payload'

import { dateiName, endungVon } from './dateigrenzen'

/**
 * Große Dateien annehmen, ohne sie in den Arbeitsspeicher zu legen.
 *
 * Der übliche Weg — `req.formData()`, daraus ein `Buffer`, den an Payload —
 * hält die Datei zweimal vollständig im Speicher: einmal beim Einlesen des
 * Formulars, einmal beim Schreiben. Bei 500 MB je Datei und zwei Leuten, die
 * gleichzeitig hochladen, ist der Container weg.
 *
 * Deshalb hier ein anderer Weg:
 *
 * 1. Die Datei kommt **unverpackt** als Rumpf der Anfrage (kein Formular),
 *    Name und Ordner stehen in der Adresszeile.
 * 2. Sie wird stückweise auf die Platte geschrieben — genau dorthin, wo
 *    Payload die Werkstattdateien ohnehin ablegt.
 * 3. Erst danach entsteht der Datensatz, mit `filename`, `mimeType` und
 *    `filesize` von Hand gesetzt.
 *
 * Schritt 3 umgeht Payloads Upload-Verarbeitung bewusst. Die würde die Datei
 * erneut komplett einlesen (`getFileByPath`) — und sie hat hier nichts zu
 * tun: Es sind Zeichnungen und keine Bilder, es werden keine Größen
 * gerechnet, nichts wird umgerechnet. Was Payload sonst noch macht — Hooks,
 * Live-Meldungen, Zugriffsregeln, Löschen der Datei beim Löschen des
 * Datensatzes — läuft unverändert, denn der Datensatz entsteht ganz normal
 * über `payload.create`.
 */

/** Wo die Werkstatt- und Mappendateien liegen — siehe `ProductFiles`. */
export const ABLAGE = path.join(process.cwd(), 'media', 'werkstattdateien')

export class ZuGross extends Error {
  constructor() {
    super('zu-gross')
  }
}

/**
 * Ein Name, unter dem die Datei auf der Platte liegen kann.
 *
 * Mit Zeitstempel: Zwei Auftraggeber nennen ihre Zeichnung beide
 * `zeichnung.pdf`, und die zweite überschriebe sonst die erste. Wie die Datei
 * heißt, steht im Datensatz (`label`) — heruntergeladen wird unter diesem
 * Namen.
 */
export function ablageName(name: string): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}-${dateiName(name) || 'datei'}`
}

/** Grober Typ aus der Endung — gesnifft wird nicht, geliefert wird ohnehin als Anhang. */
export function typVonEndung(name: string, gemeldet?: string | null): string {
  const sauber = (gemeldet ?? '').split(';')[0]!.trim().toLowerCase()
  if (sauber && /^[\w.+-]+\/[\w.+-]+$/.test(sauber) && sauber !== 'application/octet-stream') {
    return sauber.slice(0, 100)
  }
  const nach: Record<string, string> = {
    pdf: 'application/pdf',
    zip: 'application/zip',
    dxf: 'image/vnd.dxf',
    dwg: 'image/vnd.dwg',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    txt: 'text/plain',
    csv: 'text/csv',
  }
  return nach[endungVon(name)] ?? 'application/octet-stream'
}

/**
 * Schreibt den Rumpf der Anfrage in die Ablage und liefert Name und Größe.
 *
 * Wird die Grenze überschritten, bricht der Schreibvorgang mitten im Strom ab
 * und das angefangene Stück wird weggeräumt — sonst bliebe von jedem zu
 * großen Upload ein halbes Bruchstück liegen.
 */
export async function stromAblegen(
  koerper: ReadableStream<Uint8Array> | null,
  name: string,
  maxBytes: number,
): Promise<{ datei: string; bytes: number }> {
  if (!koerper) throw new Error('kein-inhalt')
  await fs.promises.mkdir(ABLAGE, { recursive: true })

  const datei = ablageName(name)
  const ziel = path.join(ABLAGE, datei)
  let bytes = 0

  const zaehler = new Transform({
    transform(stueck, _kodierung, weiter) {
      bytes += stueck.length
      if (bytes > maxBytes) {
        weiter(new ZuGross())
        return
      }
      weiter(null, stueck)
    },
  })

  try {
    await pipeline(
      Readable.fromWeb(koerper as never),
      zaehler,
      fs.createWriteStream(ziel, { flags: 'wx' }),
    )
  } catch (err) {
    await fs.promises.unlink(ziel).catch(() => undefined)
    throw err
  }

  if (bytes === 0) {
    await fs.promises.unlink(ziel).catch(() => undefined)
    throw new Error('kein-inhalt')
  }

  return { datei, bytes }
}

/** Legt die abgelegte Datei wieder weg — für den Fall, dass der Datensatz scheitert. */
export async function ablageAufraeumen(datei: string): Promise<void> {
  await fs.promises.unlink(path.join(ABLAGE, datei)).catch(() => undefined)
}

/**
 * Der Datensatz zur bereits abgelegten Datei.
 *
 * `filename`, `mimeType` und `filesize` werden von Hand gesetzt — siehe oben.
 * Scheitert das Anlegen, verschwindet auch die Datei; ein Rest auf der Platte,
 * zu dem es keinen Eintrag gibt, findet später niemand mehr.
 */
export async function dateiEintragen(
  payload: Payload,
  datei: string,
  bytes: number,
  urspruenglich: string,
  daten: Record<string, unknown>,
): Promise<{ id: number | string; label: string }> {
  try {
    const doc = await payload.create({
      collection: 'product-files',
      overrideAccess: true,
      data: {
        ...daten,
        label: (urspruenglich || datei).slice(0, 200),
        filename: datei,
        mimeType: typVonEndung(urspruenglich),
        filesize: bytes,
      } as never,
    })
    return { id: doc.id, label: doc.label ?? urspruenglich }
  } catch (err) {
    await ablageAufraeumen(datei)
    throw err
  }
}
