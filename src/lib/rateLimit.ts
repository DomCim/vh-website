/**
 * Einfache Ratenbegrenzung im Arbeitsspeicher.
 *
 * Reicht für einen einzelnen Container hinter Traefik — es geht darum,
 * Formular-Spam und Mail-Fluten zu bremsen, nicht um Abwehr verteilter
 * Angriffe. Nach einem Neustart ist der Zähler leer.
 */
const eintraege = new Map<string, number[]>()

export function zuVieleAnfragen(schluessel: string, maximum: number, fensterMs: number): boolean {
  const jetzt = Date.now()
  const bisher = (eintraege.get(schluessel) ?? []).filter((t) => jetzt - t < fensterMs)
  if (bisher.length >= maximum) {
    eintraege.set(schluessel, bisher)
    return true
  }
  bisher.push(jetzt)
  eintraege.set(schluessel, bisher)

  // Gelegentlich aufräumen, damit die Map nicht unbegrenzt wächst
  if (eintraege.size > 5000) {
    for (const [k, v] of eintraege) {
      if (!v.some((t) => jetzt - t < fensterMs)) eintraege.delete(k)
    }
  }
  return false
}

/** Absender-IP aus den üblichen Proxy-Kopfzeilen */
export function ipAus(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unbekannt'
}
