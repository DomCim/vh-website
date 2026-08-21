/**
 * Klartext fürs Schreibfeld aufbereiten — im Browser wie am Server nutzbar.
 *
 * Zwei kleine Übersetzer, die vorher als Kopien in den Komponenten lagen:
 * Signaturen und Textvorschläge kommen teils als Klartext (Altbestand,
 * Server-Vorschläge), das Schreibfeld spricht aber HTML. Die Regeln stehen
 * hier einmal, damit Postfach, Versandfenster und Newsletter dieselben sind.
 */

const escapen = (z: string) =>
  z.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Die Signatur fürs Schreibfeld. Aus den Einstellungen kommt sie inzwischen
 * gestaltet (HTML); ältere Einträge sind Klartext mit Zeilenumbrüchen —
 * beide Fassungen bleiben gültig.
 *
 * `mitAbstand` stellt zwei leere Absätze davor: Der Zeiger steht beim Öffnen
 * oben, und man soll lostippen können, ohne sich erst Platz zu schaffen.
 */
export function signaturAlsHtml(signatur?: string | null, mitAbstand = true): string {
  const sauber = (signatur ?? '').trim()
  if (!sauber) return ''
  const abstand = mitAbstand ? '<p><br></p><p><br></p>' : ''
  if (sauber.includes('<')) return `${abstand}${sauber}`
  const zeilen = sauber.split('\n').map(escapen).join('<br>')
  return `${abstand}<p style="color: #666666">${zeilen}</p>`
}

/** Klartext mit Leerzeilen-Absätzen zu HTML-Absätzen — für Vorschläge vom Server */
export function textAlsAbsaetze(text?: string | null): string {
  const sauber = (text ?? '').trim()
  if (!sauber) return ''
  return sauber
    .split(/\n\s*\n/)
    .map((absatz) => `<p>${escapen(absatz.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
