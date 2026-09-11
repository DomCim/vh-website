'use client'

import React, { useEffect, useState } from 'react'

/**
 * Ein Abschnitt eines langen Formulars — zugeklappt, aber nicht verschwiegen.
 *
 * **Das Problem.** Die Auftragsseite war am Handy 6023 Pixel hoch: gut sieben
 * Bildschirmlängen für dreizehn Blöcke, von denen die meisten bei den meisten
 * Aufträgen nie angefasst werden. Wer in der Werkstatt den Ablauf abhaken
 * will, scrollt an „Bestellung des Kunden" und „Bezahlt wird in Stufen"
 * vorbei. Am Rechner war es dasselbe in kürzer.
 *
 * **Warum zugeklappt und nicht auf eigene Seiten verteilt.** Ein Auftrag ist
 * ein Datensatz mit einem „Speichern". Zerlegt in Unterseiten gäbe es vier
 * Speicherknöpfe und vier Wege zu einem halb gespeicherten Auftrag; dazu
 * käme bei jedem Wechsel ein Ladevorgang, den es in der Werkstatt nicht
 * immer gibt. Reiter wären dasselbe Problem in hübsch und stünden außerdem
 * in Konkurrenz zur Leiste unten.
 *
 * **Zugeklappt heißt zusammengefasst, nicht versteckt.** Ein Abschnitt, der
 * nur seinen Titel zeigt, zwingt zum Aufklappen — man muss nachsehen, weil
 * man nicht weiß, ob drin etwas steht. Deshalb trägt jeder Abschnitt hier
 * eine Zeile mit dem, was drinsteht: „3 Positionen · 1.190,00 €" statt bloß
 * „Was gefertigt wird". Damit sieht man auf einem Schirm *mehr* als vorher,
 * nicht weniger.
 *
 * **`<details>` und nicht ein eigenes Auf-und-Zu.** Der Inhalt bleibt im
 * Dokument, auch wenn er nicht zu sehen ist. Das ist hier wichtig: Die
 * Formulare halten ihre Werte in React und schicken beim Speichern alles
 * mit — ein Abschnitt, der beim Zuklappen seinen Inhalt ausbaut, verlöre
 * beim nächsten Aufklappen jedes Feld, das jemand angefasst hat. Dazu kommt,
 * was das Element von Haus aus mitbringt: Tastatur, Vorleser und die Suche
 * des Browsers finden auch, was zugeklappt ist.
 */

/**
 * Gemerkt wird je Formularart, nicht je Datensatz.
 *
 * Wer „Bezahlt wird in Stufen" einmal zuklappt, meint alle Aufträge und
 * nicht nur AU-2026-0004. Der Schlüssel heißt deshalb `auftrag:stufen` und
 * trägt keine Kennung.
 *
 * **`localStorage` und nicht der Merkzettel im Gerätespeicher.** Der ist
 * asynchron; bis die Antwort da ist, hat der Browser den Abschnitt schon
 * einmal falsch gezeichnet, und man sieht es aufklappen oder zuklappen. Es
 * geht hier außerdem nicht um Daten des Betriebs, sondern um eine Vorliebe
 * an genau diesem Gerät — die darf mit dem Browserverlauf verschwinden.
 */
const schluessel = (merk: string) => `buero:abschnitt:${merk}`

function gemerkt(merk: string): boolean | null {
  try {
    const wert = window.localStorage.getItem(schluessel(merk))
    return wert === 'auf' ? true : wert === 'zu' ? false : null
  } catch {
    // Privates Fenster, gesperrte Seitendaten — dann gilt eben die Vorgabe
    return null
  }
}

export function Abschnitt({
  merk,
  titel,
  kurz,
  vorgabe = false,
  children,
}: {
  /** Merkschlüssel je Formularart, z.B. `auftrag:positionen` */
  merk: string
  titel: string
  /**
   * Was im zugeklappten Zustand zu lesen ist — der Inhalt in einer Zeile.
   * Ohne diese Angabe müsste man aufklappen, um zu wissen, ob es sich lohnt.
   */
  kurz?: React.ReactNode
  /**
   * Offen, solange niemand etwas anderes gewählt hat. Die Formulare leiten
   * das aus dem Stand des Vorgangs ab: Am geplanten Auftrag steht der
   * Ablauf offen, am fertigen die Übergabe.
   */
  vorgabe?: boolean
  children: React.ReactNode
}) {
  /*
   * Beim ersten Zeichnen gilt die Vorgabe, und zwar auf dem Server wie im
   * Browser. Das Gemerkte kommt einen Wimpernschlag später dazu: Läse man es
   * schon beim ersten Zeichnen, stünde im Server-HTML etwas anderes als im
   * Browser, und React beschwert sich zu Recht über den Unterschied.
   */
  const [offen, setOffen] = useState(vorgabe)

  useEffect(() => {
    const stand = gemerkt(merk)
    if (stand !== null) setOffen(stand)
  }, [merk])

  const umschalten = (auf: boolean) => {
    setOffen(auf)
    try {
      window.localStorage.setItem(schluessel(merk), auf ? 'auf' : 'zu')
    } catch {
      // Dann eben nur für diesen Besuch
    }
  }

  return (
    <details
      className="buero-abschnitt"
      open={offen}
      onToggle={(e) => umschalten((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="buero-abschnitt-kopf">
        <h2>{titel}</h2>
        {kurz ? <span className="buero-abschnitt-kurz">{kurz}</span> : null}
      </summary>
      <div className="buero-abschnitt-inhalt">{children}</div>
    </details>
  )
}
