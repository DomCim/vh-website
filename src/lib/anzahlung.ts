/**
 * Zahlung in Stufen — wie sich eine Summe auf Anzahlung, Zwischenrechnung
 * und Schlussrechnung verteilt.
 *
 * Das ist wenig Rechnung und viel Sorgfalt. Drei Beträge müssen am Ende
 * exakt die Gesamtsumme ergeben — nicht ungefähr, sondern auf den Cent. Wer
 * dreimal einzeln rundet, verliert oder erfindet einen Cent, und der taucht
 * dann in der Schlussrechnung als Differenz auf, die niemand erklären kann.
 *
 * Deshalb wird nur zweimal gerundet: Anzahlung und Zwischenrechnung. Die
 * Schlussrechnung ist der Rest — was übrig bleibt, bleibt übrig. Sie trägt
 * damit auch die Rundung, und das ist die richtige Stelle: Sie ist die
 * letzte, sie sieht alle Vorgänger, und dort fällt eine Abweichung von einem
 * Cent niemandem auf die Füße.
 */

export type Zahlplan = {
  /** Anteil, der bei Auftragsbestätigung fällig wird */
  anzahlungProzent?: number | null
  /** Anteil, der beim erreichten Meilenstein fällig wird */
  zwischenProzent?: number | null
}

export type Stufen = {
  anzahlung: number
  zwischen: number
  schluss: number
}

/** Auf Cent, ohne die Überraschungen von `toFixed` bei Halbwerten. */
const aufCent = (wert: number) => Math.round((wert + Number.EPSILON) * 100) / 100

/**
 * Wie viel wird wann fällig?
 *
 * Prozentsätze werden geklemmt statt zurückgewiesen: Ein Tippfehler mit 150 %
 * soll keine Rechnung verhindern, sondern zu einer vollen Anzahlung führen.
 * Und wenn Anzahlung und Zwischenrechnung zusammen über hundert kämen, wird
 * die Zwischenrechnung gekürzt — die Anzahlung stand zuerst da und ist die,
 * über die man mit der Kundschaft gesprochen hat.
 */
export function stufenBerechnen(gesamt: number, plan: Zahlplan): Stufen {
  if (!Number.isFinite(gesamt) || gesamt <= 0) {
    return { anzahlung: 0, zwischen: 0, schluss: 0 }
  }

  const klemmen = (wert: unknown) => Math.min(100, Math.max(0, Number(wert) || 0))
  const erst = klemmen(plan.anzahlungProzent)
  const zweit = Math.min(klemmen(plan.zwischenProzent), 100 - erst)

  const anzahlung = aufCent((gesamt * erst) / 100)
  const zwischen = aufCent((gesamt * zweit) / 100)

  // Der Rest — nicht gerechnet, sondern übrig. Damit stimmt die Summe immer.
  return { anzahlung, zwischen, schluss: aufCent(gesamt - anzahlung - zwischen) }
}

/** Gibt es überhaupt Stufen, oder ist es eine ganz normale Rechnung? */
export function inStufen(plan: Zahlplan): boolean {
  return (Number(plan.anzahlungProzent) || 0) > 0 || (Number(plan.zwischenProzent) || 0) > 0
}

export type Vorstufe = {
  /** Rechnungsnummer, wie sie auf dem Papier steht */
  nummer?: string | null
  stufe?: string | null
  datum?: string | Date | null
  netto: number
}

/**
 * Die Abzugszeilen der Schlussrechnung.
 *
 * Rechtlich der heikelste Teil des Ganzen: Eine Schlussrechnung muss die
 * bereits gestellten Anzahlungen **benennen und abziehen**, mit ihrer
 * Umsatzsteuer. Fehlt das, ist dieselbe Steuer zweimal erklärt — einmal auf
 * der Anzahlung, einmal auf der Schlussrechnung —, und beim Finanzamt zählt
 * die höhere. Das fällt beim Steuerberater auf, nicht vorher, und dann sind
 * es Monate rückwirkend.
 *
 * Die Beträge sind bewusst negativ und nicht „Summe minus x": Auf dem Blatt
 * soll jede Vorstufe einzeln stehen, mit Nummer und Datum. Wer die Rechnung
 * prüft — Kundschaft oder Prüfer —, will sie wiederfinden können.
 */
export function abzugsZeilen(vorstufen: Vorstufe[]): {
  bezeichnung: string
  betrag: number
}[] {
  const name: Record<string, string> = {
    anzahlung: 'Anzahlung',
    zwischen: 'Zwischenrechnung',
  }

  /*
   * Datum von Hand statt über `toLocaleDateString`.
   *
   * Das liefert je nach Gebietsdaten der Laufzeit mal `2.3.2026`, mal
   * `02.03.2026` — und auf einer Rechnung soll nicht zufällig stehen, womit
   * der Container gebaut wurde. Gepolstert ist außerdem eindeutig: `2.3.` und
   * `20.3.` sind beim Überfliegen leicht zu verwechseln.
   */
  const tag = (wert: string | Date) => {
    const d = new Date(wert)
    const zwei = (n: number) => String(n).padStart(2, '0')
    return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`
  }

  return vorstufen
    .filter((v) => v.netto > 0)
    .map((v) => {
      const teile = [name[v.stufe ?? ''] ?? 'Bereits berechnet']
      if (v.nummer) teile.push(`Nr. ${v.nummer}`)
      if (v.datum) teile.push(`vom ${tag(v.datum)}`)
      return { bezeichnung: teile.join(' '), betrag: -aufCent(v.netto) }
    })
}
