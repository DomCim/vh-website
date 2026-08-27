import type { Field } from 'payload'

/**
 * Der Ablauf eines Stücks — was wann und von wem gemacht wird.
 *
 * **Was bisher fehlte.** An der Variante hingen drei Listen nebeneinander:
 * Material, Arbeitszeit, Dienstleister. Darin stand, *dass* verzinkt wird —
 * nicht, dass erst zugeschnitten, dann geschweißt, dann verzinkt, dann
 * beschichtet und zuletzt montiert wird. Wer das Stück in die Hand nahm,
 * musste wissen, was als Nächstes kommt; aufgeschrieben war es nirgends.
 *
 * **Warum das mehr ist als Ordnung.** Fremdleistungen haben Vorlaufzeiten.
 * Verzinken dauert fünf Tage, in denen die Werkstatt nichts tut und die Uhr
 * trotzdem läuft. Ein Auftrag mit zwanzig Stunden Arbeit braucht damit drei
 * Wochen — die Wochenauslastung rechnet heute nur die zwanzig Stunden und sagt
 * einen Termin zu, den niemand halten kann.
 *
 * **Warum zweimal dieselbe Struktur.** Ein Ablauf gehört an zwei Stellen:
 *
 *  - an die **Artikelvariante**, als Vorlage — was bei diesem Stück immer so
 *    geht, und zwar bei jedem Mal;
 *  - an den **Auftrag**, als das, was diesmal wirklich passiert — auch bei
 *    Lohnfertigung und Maßanfertigung, wo es gar keine Variante gibt.
 *
 * Deshalb steht die Struktur hier einmal und wird an beiden Stellen eingesetzt.
 * Zwei Fassungen liefen auseinander, sobald jemand ein Feld ergänzt.
 *
 * **Warum kopiert und nicht verwiesen.** Beim Anlegen eines Auftrags aus einer
 * Variante wandert deren Plan als Abschrift in den Auftrag. Ein Verweis wäre
 * kürzer und wäre falsch: Am Auftrag wird abgehakt, was erledigt ist, und die
 * Vorlage darf sich später ändern, ohne die Geschichte eines abgeschlossenen
 * Auftrags umzuschreiben.
 *
 * **Intern.** Nichts davon geht auf ein Papier für die Kundschaft. Dass ein
 * Dienstleister im Spiel ist und welcher, ist eine Sache des Betriebs.
 */

/** Die Schritte selbst — `mitStand` fügt hinzu, was nur am Auftrag zählt */
export function arbeitsschritte(mitStand: boolean): Field[] {
  return [
    {
      name: 'was',
      label: 'Schritt',
      type: 'text',
      required: true,
      admin: { description: 'z.B. „Zuschnitt", „Schweißen", „Verzinken", „Montage"' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'art',
          label: 'Wer',
          type: 'select',
          required: true,
          defaultValue: 'eigen',
          options: [
            { label: 'Eigene Arbeit', value: 'eigen' },
            { label: 'Dienstleister', value: 'fremd' },
          ],
        },
        {
          /*
           * Nur bei eigener Arbeit gefragt: Bei einer Fremdleistung ist die
           * eigene Zeit null, und eine Null in einem Feld, das „Minuten"
           * heißt, liest sich wie „noch nicht geschätzt".
           */
          name: 'minuten',
          label: 'Dauer (Minuten)',
          type: 'number',
          min: 0,
          admin: { condition: (_: unknown, geschwister: { art?: string }) => geschwister?.art !== 'fremd' },
        },
      ],
    },
    {
      type: 'row',
      admin: { condition: (_: unknown, geschwister: { art?: string }) => geschwister?.art === 'fremd' },
      fields: [
        {
          name: 'dienstleister',
          label: 'Betrieb',
          type: 'relationship',
          relationTo: 'contacts',
        },
        { name: 'kosten', label: 'Kosten netto (EUR)', type: 'number', min: 0 },
        {
          name: 'vorlaufTage',
          label: 'Vorlauf (Tage)',
          type: 'number',
          min: 0,
          admin: {
            description:
              'Wie lange das Stück außer Haus ist. Zählt beim Termin mit, auch wenn dabei ' +
              'keine eigene Arbeit anfällt.',
          },
        },
      ],
    },
    ...(mitStand
      ? ([
          {
            type: 'row',
            fields: [
              {
                name: 'stand',
                label: 'Stand',
                type: 'select',
                defaultValue: 'offen',
                options: [
                  { label: 'Offen', value: 'offen' },
                  { label: 'Läuft', value: 'laeuft' },
                  { label: 'Erledigt', value: 'erledigt' },
                ],
              },
              {
                name: 'erledigtAm',
                label: 'Erledigt am',
                type: 'date',
                admin: {
                  condition: (_: unknown, g: { stand?: string }) => g?.stand === 'erledigt',
                },
              },
            ],
          },
          /*
           * Die Reise eines Fremd-Schritts — vier Zeitstempel, kein vierter
           * Stand-Wert.
           *
           * „Draußen" ist kein eigener Zustand: Ein Fremd-Schritt mit Stand
           * „läuft" **ist** außer Haus. Ein vierter Wert liefe durch jede
           * Stelle, die den Stand kennt, und beim Zurückspringen wäre unklar,
           * was gilt. Zeitstempel sind dagegen Fakten: Sie überschreiben
           * einander nicht, sie tragen die Überfälligkeitsrechnung
           * (`rausAm + vorlaufTage < heute` und kein `zurueckAm`) und die
           * Anzeige „seit 3 Tagen beim Verzinker".
           *
           * Zwei Paare, zwei Schreiber: `rausAm`/`zurueckAm` bucht das Büro,
           * `angekommenAm`/`fertigGemeldetAm` meldet der Betrieb selbst über
           * den Scan der Laufmarke. Keiner fasst die Felder des anderen an —
           * zusammen erzählen sie die Reise.
           */
          {
            type: 'row',
            admin: { condition: (_: unknown, g: { art?: string }) => g?.art === 'fremd' },
            fields: [
              { name: 'rausAm', label: 'Raus am', type: 'date' },
              { name: 'zurueckAm', label: 'Zurück am', type: 'date' },
            ],
          },
          {
            type: 'row',
            admin: { condition: (_: unknown, g: { art?: string }) => g?.art === 'fremd' },
            fields: [
              {
                name: 'angekommenAm',
                label: 'Beim Betrieb angekommen am',
                type: 'date',
                admin: { readOnly: true },
              },
              {
                name: 'fertigGemeldetAm',
                label: 'Vom Betrieb fertiggemeldet am',
                type: 'date',
                admin: { readOnly: true },
              },
            ],
          },
        ] as Field[])
      : []),
    { name: 'notiz', label: 'Bemerkung', type: 'text' },
  ]
}

/** Das ganze Feld, fertig zum Einsetzen */
export function arbeitsplanFeld(mitStand: boolean, beschreibung: string): Field {
  return {
    name: 'arbeitsplan',
    label: 'Ablauf',
    type: 'array',
    labels: { singular: 'Schritt', plural: 'Ablauf' },
    admin: {
      description: beschreibung,
      // Gepflegt wird das im Büro, nicht in der Website-Verwaltung
      hidden: true,
    },
    fields: arbeitsschritte(mitStand),
  }
}

export type Arbeitsschritt = {
  was?: string | null
  art?: 'eigen' | 'fremd' | null
  minuten?: number | null
  dienstleister?: unknown
  kosten?: number | null
  vorlaufTage?: number | null
  stand?: 'offen' | 'laeuft' | 'erledigt' | null
  erledigtAm?: string | null
  /** Vom Büro gebucht: wann das Teil zum Betrieb raus und wieder zurück ist */
  rausAm?: string | null
  zurueckAm?: string | null
  /** Vom Betrieb selbst gemeldet, über den Scan der Laufmarke */
  angekommenAm?: string | null
  fertigGemeldetAm?: string | null
  notiz?: string | null
}

/**
 * Ist dieses Teil gerade außer Haus überfällig?
 *
 * Überfällig heißt: rausgebucht, nicht zurück, und die zugesagten Vorlauftage
 * sind um. Ohne `vorlaufTage` gibt es keine Zusage — dann kann auch nichts
 * überfällig sein; eine Meldung ohne Maßstab wäre nur Lärm.
 */
export function draussenUeberfaellig(
  schritt: Arbeitsschritt,
  jetzt: Date = new Date(),
): boolean {
  if (schritt.art !== 'fremd' || !schritt.rausAm || schritt.zurueckAm) return false
  const tage = Number(schritt.vorlaufTage) || 0
  if (tage <= 0) return false
  const frist = new Date(schritt.rausAm)
  frist.setDate(frist.getDate() + tage)
  return jetzt.getTime() > frist.getTime()
}

/**
 * Der Schritt, der gerade dran ist.
 *
 * „Läuft" schlägt „offen": Ist etwas angefangen, ist das die Antwort auf „was
 * passiert damit gerade?" — auch wenn davor noch ein offener Schritt steht,
 * den jemand übersprungen hat. Sonst zeigte die Werkstatt auf einen Schritt,
 * an dem niemand arbeitet.
 */
export function naechsterSchritt(plan: Arbeitsschritt[] | null | undefined): {
  index: number
  schritt: Arbeitsschritt
} | null {
  const schritte = plan ?? []
  const laufend = schritte.findIndex((s) => s.stand === 'laeuft')
  const index = laufend >= 0 ? laufend : schritte.findIndex((s) => (s.stand ?? 'offen') !== 'erledigt')
  return index >= 0 ? { index, schritt: schritte[index] } : null
}

/** Wie weit das Stück ist — für eine Zeile im Büro, nicht für eine Statistik */
export function planStand(plan: Arbeitsschritt[] | null | undefined): {
  erledigt: number
  gesamt: number
  fertig: boolean
} {
  const schritte = plan ?? []
  const erledigt = schritte.filter((s) => s.stand === 'erledigt').length
  return { erledigt, gesamt: schritte.length, fertig: schritte.length > 0 && erledigt === schritte.length }
}

/**
 * Wie viele Tage der Ablauf mindestens braucht.
 *
 * Eigene Arbeit zählt als Zeit, Fremdleistung als Wartezeit — und beides
 * addiert sich, weil ein Stück nicht gleichzeitig in der Werkstatt und beim
 * Verzinker liegen kann. Das ist bewusst grob: Es soll eine Terminzusage
 * verhindern, die von vornherein nicht zu halten ist, und keine Feinplanung
 * ersetzen.
 */
export function mindestDauerTage(
  plan: Arbeitsschritt[] | null | undefined,
  stundenProTag = 8,
): number {
  const schritte = plan ?? []
  const eigeneMinuten = schritte
    .filter((s) => s.art !== 'fremd')
    .reduce((summe, s) => summe + (Number(s.minuten) || 0), 0)
  const fremdTage = schritte
    .filter((s) => s.art === 'fremd')
    .reduce((summe, s) => summe + (Number(s.vorlaufTage) || 0), 0)
  return Math.ceil(eigeneMinuten / (stundenProTag * 60)) + fremdTage
}
