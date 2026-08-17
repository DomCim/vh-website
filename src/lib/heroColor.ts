import fs from 'fs'
import path from 'path'

import sharp from 'sharp'

export type HeroTint = {
  color: string
  dark: boolean
}

export type HeroTints = {
  /** Farbe des oberen Bildrands — dort stößt das Bild an den Header */
  top: HeroTint
  /** Farbe des unteren Bildrands — dort strahlt das Bild auf die Seite ab */
  bottom: HeroTint
}

// Kantenfarben pro Bild nur einmal berechnen (Key: Datei + Änderungsdatum)
const cache = new Map<string, HeroTints | null>()

const EDGE_ROWS = 10

/**
 * Durchschnittsfarbe der obersten bzw. untersten ~10 Pixelzeilen des
 * Originalbilds — die echte Kantenfarbe, an die Header bzw. Ausstrahlung
 * nahtlos anschließen sollen.
 */
async function edgeTint(file: string, edge: 'top' | 'bottom'): Promise<HeroTint> {
  const { width, height } = await sharp(file).metadata()
  const w = width ?? 0
  const h = height ?? 0
  const rows = Math.max(1, Math.min(EDGE_ROWS, h))
  const strip = await sharp(file)
    .extract({ left: 0, top: edge === 'top' ? 0 : h - rows, width: w, height: rows })
    .toBuffer()
  const { channels } = await sharp(strip).stats()
  // Unten liegt im Hero ein schwarzer Verlauf (60 %) über dem Bild —
  // sichtbar ist also Kantenfarbe × 0,4. Die Ausstrahlung soll an das
  // anschließen, was man tatsächlich sieht.
  const factor = edge === 'bottom' ? 0.4 : 1
  const [r, g, b] = channels.map((c) => Math.round(c.mean * factor))
  // Relative Luminanz entscheidet, ob weiße oder dunkle Schrift lesbar ist
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return { color: `rgba(${r}, ${g}, ${b}, 0.95)`, dark: luminance < 0.6 }
}

/**
 * Ermittelt die Randfarben eines Medien-Dokuments (für die
 * Header-Überblendung und die Ausstrahlung unter dem Hero).
 * Bewusst das Original statt eines Thumbnails: verkleinerte Größen
 * können beschnitten sein und hätten andere Kanten.
 */
export async function heroTintFor(media: unknown): Promise<HeroTints | null> {
  if (!media || typeof media !== 'object') return null
  const m = media as {
    filename?: string | null
    updatedAt?: string | null
    mimeType?: string | null
  }
  if (m.mimeType && !m.mimeType.startsWith('image/')) return null
  const filename = m.filename
  if (!filename) return null

  const key = `${filename}:${m.updatedAt ?? ''}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  let tints: HeroTints | null = null
  try {
    const file = path.resolve(process.cwd(), 'media', filename)
    if (fs.existsSync(file)) {
      const [top, bottom] = await Promise.all([edgeTint(file, 'top'), edgeTint(file, 'bottom')])
      tints = { top, bottom }
    }
  } catch {
    tints = null
  }
  cache.set(key, tints)
  return tints
}
