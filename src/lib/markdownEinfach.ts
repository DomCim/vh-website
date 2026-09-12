/**
 * Ein sehr kleiner Markdown-Leser — für Papiere, die im Quelltext liegen.
 *
 * **Warum keine Bibliothek.** Gebraucht wird genau das, was in der
 * Verfahrensdokumentation vorkommt: Überschriften, Absätze, Aufzählungen,
 * Tabellen, ein Zitatblock, `**fett**`, Backticks und Trennlinien. Ein
 * vollständiger Markdown-Umsetzer kann dreißigmal so viel, wiegt ein
 * Vielfaches und bringt eine Abhängigkeit mit, die gepflegt werden will —
 * für eine einzige Seite im Büro.
 *
 * Dieselbe Überlegung wie bei den Neuerungen: Was der Umsetzer nicht kennt,
 * steht als Zeichen mitten im Satz. Wer das Papier erweitert, sieht das
 * sofort — und dann gehört die Regel hier dazu, nicht eine Bibliothek.
 *
 * Bewusst **keine** Verweise (`[text](url)`) und **kein** HTML im Text: Beides
 * bräuchte eine Entschärfung, und beides kommt in diesem Papier nicht vor.
 */

export type Stueck =
  | { art: 'ueberschrift'; ebene: 1 | 2 | 3; text: string }
  | { art: 'absatz'; text: string }
  | { art: 'liste'; nummeriert: boolean; punkte: string[] }
  | { art: 'tabelle'; kopf: string[]; zeilen: string[][] }
  | { art: 'zitat'; zeilen: string[] }
  | { art: 'linie' }

/** Eine Tabellenzeile in ihre Zellen zerlegen. */
const zellen = (zeile: string): string[] =>
  zeile
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((z) => z.trim())

/** Ist das die Trennzeile einer Tabelle (`|---|---|`)? */
const istTrenner = (zeile: string): boolean => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(zeile)

export function markdownLesen(text: string): Stueck[] {
  const zeilen = text.replace(/\r\n/g, '\n').split('\n')
  const stuecke: Stueck[] = []
  let i = 0

  while (i < zeilen.length) {
    const zeile = zeilen[i]

    // Leerzeile
    if (!zeile.trim()) {
      i += 1
      continue
    }

    // Trennlinie
    if (/^-{3,}\s*$/.test(zeile)) {
      stuecke.push({ art: 'linie' })
      i += 1
      continue
    }

    // Überschrift
    const ueber = /^(#{1,3})\s+(.*)$/.exec(zeile)
    if (ueber) {
      stuecke.push({
        art: 'ueberschrift',
        ebene: ueber[1].length as 1 | 2 | 3,
        text: ueber[2].trim(),
      })
      i += 1
      continue
    }

    // Tabelle: Kopfzeile, Trenner, dann Zeilen bis zur ersten, die keine ist
    if (zeile.includes('|') && istTrenner(zeilen[i + 1] ?? '')) {
      const kopf = zellen(zeile)
      const reihen: string[][] = []
      i += 2
      while (i < zeilen.length && zeilen[i].includes('|')) {
        reihen.push(zellen(zeilen[i]))
        i += 1
      }
      stuecke.push({ art: 'tabelle', kopf, zeilen: reihen })
      continue
    }

    // Zitat
    if (zeile.startsWith('>')) {
      const inhalt: string[] = []
      while (i < zeilen.length && zeilen[i].startsWith('>')) {
        inhalt.push(zeilen[i].replace(/^>\s?/, ''))
        i += 1
      }
      stuecke.push({ art: 'zitat', zeilen: [inhalt.join(' ').trim()] })
      continue
    }

    // Aufzählung, mit oder ohne Nummern. Folgezeilen mit Einzug gehören dazu.
    const punktMuster = /^(\s*)([-*]|\d+\.)\s+(.*)$/
    if (punktMuster.test(zeile)) {
      const nummeriert = /^\s*\d+\./.test(zeile)
      const punkte: string[] = []
      while (i < zeilen.length) {
        const treffer = punktMuster.exec(zeilen[i])
        if (treffer) {
          punkte.push(treffer[3].trim())
          i += 1
          continue
        }
        // Eingerückte Fortsetzung des letzten Punktes
        if (punkte.length && /^\s{2,}\S/.test(zeilen[i])) {
          punkte[punkte.length - 1] += ' ' + zeilen[i].trim()
          i += 1
          continue
        }
        break
      }
      stuecke.push({ art: 'liste', nummeriert, punkte })
      continue
    }

    // Absatz: alles bis zur nächsten Leerzeile oder zum nächsten Blockanfang
    const absatz: string[] = []
    while (i < zeilen.length && zeilen[i].trim()) {
      const z = zeilen[i]
      if (/^(#{1,3}\s|>|-{3,}\s*$)/.test(z) || punktMuster.test(z)) break
      if (z.includes('|') && istTrenner(zeilen[i + 1] ?? '')) break
      absatz.push(z.trim())
      i += 1
    }
    if (absatz.length) stuecke.push({ art: 'absatz', text: absatz.join(' ') })
  }

  return stuecke
}

/**
 * Die Auszeichnung **innerhalb** einer Zeile, zerlegt in Stücke.
 *
 * Nur `**fett**` und Backticks — mehr steht im Papier nicht, und mehr soll
 * auch niemand hineinschreiben, ohne die Regel hier zu ergänzen.
 */
export type Teil = { text: string; fett?: boolean; code?: boolean }

export function zeileZerlegen(text: string): Teil[] {
  const teile: Teil[] = []
  const muster = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let zuletzt = 0
  for (const treffer of text.matchAll(muster)) {
    const start = treffer.index ?? 0
    if (start > zuletzt) teile.push({ text: text.slice(zuletzt, start) })
    const roh = treffer[0]
    if (roh.startsWith('**')) teile.push({ text: roh.slice(2, -2), fett: true })
    else teile.push({ text: roh.slice(1, -1), code: true })
    zuletzt = start + roh.length
  }
  if (zuletzt < text.length) teile.push({ text: text.slice(zuletzt) })
  return teile
}
