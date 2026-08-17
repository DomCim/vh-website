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

// Dominante Farben pro Bild nur einmal berechnen (Key: Datei + Änderungsdatum)
const cache = new Map<string, HeroTints | null>()

async function stripTint(file: string, top: number): Promise<HeroTint> {
  // stats() rechnet immer auf dem Original, daher den Streifen erst
  // in einen Buffer rendern
  const strip = await sharp(file)
    .resize(64, 64, { fit: 'fill' })
    .extract({ left: 0, top, width: 64, height: 16 })
    .toBuffer()
  const { dominant } = await sharp(strip).stats()
  const { r, g, b } = dominant
  // Relative Luminanz entscheidet, ob weiße oder dunkle Schrift lesbar ist
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return { color: `rgba(${r}, ${g}, ${b}, 0.93)`, dark: luminance < 0.6 }
}

/**
 * Ermittelt die dominanten Randfarben eines Medien-Dokuments (für die
 * Header-Überblendung und die Ausstrahlung unter dem Hero). Nutzt das
 * kleine Thumbnail, damit die Analyse schnell bleibt.
 */
export async function heroTintFor(media: unknown): Promise<HeroTints | null> {
  if (!media || typeof media !== 'object') return null
  const m = media as {
    filename?: string | null
    updatedAt?: string | null
    mimeType?: string | null
    sizes?: Record<string, { filename?: string | null } | undefined>
  }
  if (m.mimeType && !m.mimeType.startsWith('image/')) return null
  const filename = m.sizes?.thumbnail?.filename || m.filename
  if (!filename) return null

  const key = `${filename}:${m.updatedAt ?? ''}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  let tints: HeroTints | null = null
  try {
    const file = path.resolve(process.cwd(), 'media', filename)
    if (fs.existsSync(file)) {
      const [top, bottom] = await Promise.all([stripTint(file, 0), stripTint(file, 48)])
      tints = { top, bottom }
    }
  } catch {
    tints = null
  }
  cache.set(key, tints)
  return tints
}
