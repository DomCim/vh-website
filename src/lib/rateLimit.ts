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

/** Liegt die Adresse in einem privaten Bereich? Dann ist es einer unserer Proxys. */
function eigenerProxy(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase()
    return (
      v6 === '::1' ||
      v6.startsWith('fc') ||
      v6.startsWith('fd') ||
      v6.startsWith('fe8') ||
      v6.startsWith('::ffff:10.') ||
      v6.startsWith('::ffff:127.') ||
      v6.startsWith('::ffff:172.') ||
      v6.startsWith('::ffff:192.168.')
    )
  }
  const teile = ip.split('.').map(Number)
  if (teile.length !== 4) return false
  const [a, b] = teile
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

/**
 * Absender-IP aus den üblichen Proxy-Kopfzeilen.
 *
 * Nicht der **erste** Eintrag in X-Forwarded-For — den schreibt der Absender
 * selbst und kann ihn bei jedem Versuch wechseln, womit das Limit keines
 * wäre. Stattdessen von rechts: Die eigenen Proxys (Nginx Proxy Manager,
 * Traefik — beide mit privaten Adressen) überspringen und den ersten
 * öffentlichen Eintrag nehmen. Das funktioniert hinter null, einem oder zwei
 * eigenen Proxys, ohne dass jemand eine Liste pflegen muss.
 */
export function ipAus(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const kette = forwarded
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    for (let i = kette.length - 1; i >= 0; i--) {
      if (!eigenerProxy(kette[i]!)) return kette[i]!
    }
    // Alles privat (Entwicklung, internes Netz): der letzte Eintrag genügt
    if (kette.length) return kette[kette.length - 1]!
  }
  return req.headers.get('x-real-ip') ?? 'unbekannt'
}
