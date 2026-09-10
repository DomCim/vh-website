'use client'

import { useMemo } from 'react'

import type { Arbeitsschritt } from '../arbeitsplan'
import { useBestand } from './bestand'

/**
 * Schon einmal benutzte Ablaufschritte — als Vorschlag beim Tippen.
 *
 * **Warum das nötig war.** Ein Ablauf entsteht Schritt für Schritt von Hand,
 * und dieselben Schritte kommen immer wieder: „PC - Konstruktion", „Zuschnitt
 * Laser", „Verzinken". Jedes Mal wurden nicht nur der Name neu getippt,
 * sondern auch die Minuten, der Dienstleister, seine Kosten und die
 * Vorlauftage — Angaben, die beim selben Schritt fast immer dieselben sind.
 * Wer sie abtippt, tippt sich irgendwann eine Zahl falsch, und in der
 * Auslastung steht sie dann als Zusage.
 *
 * **Woher die Vorschläge kommen.** Aus dem Bestand im Gerät: aus allen
 * Aufträgen und aus den Abläufen, die an Artikeln als Vorlage hängen. Damit
 * braucht es keine Abfrage — die Liste steht auch ohne Netz, und im Büro ist
 * das der Normalfall und nicht die Ausnahme.
 *
 * **Der jüngste Gebrauch gewinnt.** Kommt derselbe Schritt mehrfach vor,
 * zählt der zuletzt angelegte Auftrag: Ändert sich der Preis eines
 * Dienstleisters, will man den neuen vorgeschlagen bekommen und nicht den von
 * vorletztem Jahr. Sortiert wird trotzdem alphabetisch — eine Liste, deren
 * Reihenfolge sich heimlich ändert, findet niemand wieder.
 */

type MitAblauf = {
  id?: number | string
  createdAt?: string | null
  updatedAt?: string | null
  arbeitsplan?: Arbeitsschritt[] | null
}

/** Ein Vorschlag ist ein Schritt ohne Stand — der gehört zum Auftrag, nicht zur Vorlage. */
export type Vorschlag = Pick<
  Arbeitsschritt,
  'was' | 'art' | 'minuten' | 'dienstleister' | 'kosten' | 'vorlaufTage'
>

/** Wann dieser Datensatz zuletzt angefasst wurde — für „der jüngste gewinnt". */
function zeitpunkt(d: MitAblauf): number {
  const roh = d.updatedAt ?? d.createdAt
  const t = roh ? new Date(roh).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

export function vorschlaegeAus(quellen: MitAblauf[]): Vorschlag[] {
  const nach = new Map<string, { zeit: number; vorschlag: Vorschlag }>()

  for (const quelle of quellen) {
    const zeit = zeitpunkt(quelle)
    for (const schritt of quelle.arbeitsplan ?? []) {
      const was = schritt?.was?.trim()
      if (!was) continue
      // Groß- und Kleinschreibung trennt sonst „Verzinken" von „verzinken";
      // angezeigt wird die Schreibweise des jüngsten Gebrauchs.
      const schluessel = was.toLocaleLowerCase('de')
      const vorhanden = nach.get(schluessel)
      if (vorhanden && vorhanden.zeit >= zeit) continue
      nach.set(schluessel, {
        zeit,
        vorschlag: {
          was,
          art: schritt.art ?? 'eigen',
          minuten: schritt.minuten ?? null,
          dienstleister: schritt.dienstleister ?? null,
          kosten: schritt.kosten ?? null,
          vorlaufTage: schritt.vorlaufTage ?? null,
        },
      })
    }
  }

  return [...nach.values()]
    .map((e) => e.vorschlag)
    .sort((a, b) => (a.was ?? '').localeCompare(b.was ?? '', 'de'))
}

/**
 * Was ein Schritt an Angaben trägt, die jemand getippt haben muss.
 *
 * Ein Vorschlag füllt nur einen **unberührten** Schritt. Wer schon Minuten
 * oder einen Dienstleister eingetragen hat und dann den Namen vervollständigt,
 * will seine Zahlen behalten — eine Vorlage, die getippte Werte überschreibt,
 * ist schlimmer als gar keine.
 */
export function unberuehrt(schritt: Arbeitsschritt): boolean {
  return (
    schritt.minuten == null &&
    schritt.kosten == null &&
    schritt.vorlaufTage == null &&
    !schritt.dienstleister &&
    !schritt.notiz?.trim()
  )
}

/** Die Vorschläge aus dem Bestand im Gerät — Aufträge und Artikelvorlagen. */
export function useAblaufVorschlaege(): Vorschlag[] {
  const auftraege = useBestand<MitAblauf>('auftraege')
  const artikel = useBestand<MitAblauf>('artikel')
  return useMemo(() => vorschlaegeAus([...auftraege, ...artikel]), [auftraege, artikel])
}
