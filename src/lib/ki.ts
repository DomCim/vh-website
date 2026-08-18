import Anthropic from '@anthropic-ai/sdk'
import type { Payload } from 'payload'

import { AUSGABEN_KATEGORIEN } from '../collections/Expenses'
import { getIntegrations } from './settings'

/**
 * KI-Funktionen der Verwaltung: Belege auslesen, Texte vorschlagen, übersetzen.
 *
 * Der Schlüssel wird im Admin unter Integrationen gepflegt (Rückfall:
 * ANTHROPIC_API_KEY). Ohne Schlüssel liefern alle Funktionen null — die
 * Oberfläche blendet die Knöpfe dann einfach aus.
 *
 * Alle Ergebnisse sind Vorschläge. Gebucht oder veröffentlicht wird nichts
 * automatisch: Ein falsch gelesener Beleg in der Buchhaltung wäre teurer als
 * die halbe Minute, die das Nachsehen kostet.
 */

export type KiZugang = { client: Anthropic; model: string }

export async function kiZugang(payload: Payload): Promise<KiZugang | null> {
  const { anthropic } = await getIntegrations(payload)
  if (!anthropic.apiKey) return null
  return { client: new Anthropic({ apiKey: anthropic.apiKey }), model: anthropic.model }
}

/** Erster Textblock einer Antwort */
function textAus(antwort: Anthropic.Message): string {
  return antwort.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

/** Eingaben des erzwungenen Werkzeugaufrufs */
function werkzeugEingabe<T>(antwort: Anthropic.Message, name: string): T | null {
  const block = antwort.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === name,
  )
  return block ? (block.input as T) : null
}

// ── Belege auslesen ─────────────────────────────────────────────────────────

export type BelegDaten = {
  lieferant: string | null
  rechnungsnummer: string | null
  rechnungsdatum: string | null
  netto: number | null
  steuersatz: number | null
  steuer: number | null
  brutto: number | null
  kategorie: string
  bezeichnung: string | null
  sicherheit: number
  hinweis: string | null
}

const BELEG_WERKZEUG: Anthropic.Tool = {
  name: 'beleg_erfassen',
  description: 'Trägt die Daten des gelesenen Belegs ein.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      lieferant: { type: ['string', 'null'], description: 'Name des Ausstellers' },
      rechnungsnummer: { type: ['string', 'null'] },
      rechnungsdatum: {
        type: ['string', 'null'],
        description: 'Datum der Rechnung im Format JJJJ-MM-TT',
      },
      netto: { type: ['number', 'null'], description: 'Nettobetrag in Euro' },
      steuersatz: { type: ['number', 'null'], description: 'Steuersatz in Prozent, z.B. 20' },
      steuer: { type: ['number', 'null'], description: 'Steuerbetrag in Euro' },
      brutto: { type: ['number', 'null'], description: 'Bruttobetrag in Euro' },
      kategorie: {
        type: 'string',
        enum: AUSGABEN_KATEGORIEN.map((k) => k.value),
        description: 'Passendste Ausgaben-Kategorie',
      },
      bezeichnung: {
        type: ['string', 'null'],
        description: 'Kurze Bezeichnung, woraus die Ausgabe bestand',
      },
      sicherheit: {
        type: 'number',
        description: 'Wie sicher die Angaben sind, von 0 bis 100',
      },
      hinweis: {
        type: ['string', 'null'],
        description: 'Auffälligkeiten, unleserliche Stellen oder Zweifel',
      },
    },
    required: [
      'lieferant',
      'rechnungsnummer',
      'rechnungsdatum',
      'netto',
      'steuersatz',
      'steuer',
      'brutto',
      'kategorie',
      'bezeichnung',
      'sicherheit',
      'hinweis',
    ],
    additionalProperties: false,
  },
}

const BELEG_ANWEISUNG = [
  'Du liest Belege für eine französische Metallwerkstatt (SAS) aus.',
  '',
  'Regeln:',
  '- Gib nur wieder, was wirklich auf dem Beleg steht. Rate nichts dazu.',
  '- Was nicht lesbar ist, bleibt null — ein leeres Feld ist besser als ein falscher Wert.',
  '- Beträge als Zahl ohne Währungszeichen, Punkt als Dezimaltrennzeichen.',
  '- Datum immer als JJJJ-MM-TT.',
  '- Übliche Steuersätze in Frankreich sind 20, 10, 5,5 und 2,1 Prozent.',
  '- Ist nur der Bruttobetrag zu sehen, lass Netto und Steuer leer.',
  '- Bei der Sicherheit ehrlich sein: Ein schlechtes Foto ist keine 95.',
].join('\n')

/**
 * Liest einen Beleg aus. `mimetype` entscheidet, ob er als Bild oder als PDF
 * übergeben wird — beides versteht das Modell direkt.
 */
export async function belegAuslesen(
  zugang: KiZugang,
  datei: { daten: Buffer; mimetype: string },
  bekannteLieferanten: string[] = [],
): Promise<BelegDaten | null> {
  const istPdf = datei.mimetype === 'application/pdf'
  const base64 = datei.daten.toString('base64')

  const inhalt: Anthropic.ContentBlockParam[] = [
    istPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: datei.mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: base64,
          },
        },
    {
      type: 'text',
      text: bekannteLieferanten.length
        ? `Lies diesen Beleg aus. Bereits bekannte Lieferanten, bitte gleiche Schreibweise verwenden, falls einer davon passt: ${bekannteLieferanten.join(', ')}.`
        : 'Lies diesen Beleg aus.',
    },
  ]

  const antwort = await zugang.client.messages.create({
    model: zugang.model,
    max_tokens: 4000,
    system: BELEG_ANWEISUNG,
    tools: [BELEG_WERKZEUG],
    tool_choice: { type: 'tool', name: 'beleg_erfassen' },
    messages: [{ role: 'user', content: inhalt }],
  })

  return werkzeugEingabe<BelegDaten>(antwort, 'beleg_erfassen')
}

// ── Texte und Übersetzungen ─────────────────────────────────────────────────

const STIL = [
  'Du schreibst für die Website einer Metallwerkstatt in Frankreich.',
  'Vincent Hellmann fertigt Möbel, Leuchten und Objekte aus Stahl — jedes Stück einzeln,',
  'es gibt keine Serienfertigung.',
  '',
  'Ton: sachlich, handwerklich, ohne Werbefloskeln. Keine Superlative, kein "einzigartig",',
  'kein "hochwertig". Konkrete Angaben statt Adjektive. Kurze Sätze.',
  'Nichts erfinden — keine Maße, Preise, Auszeichnungen oder Referenzen, die nicht vorgegeben sind.',
  '',
  'Gib ausschließlich den fertigen Text zurück, ohne Vorrede und ohne Anführungszeichen.',
].join('\n')

export type TextAufgabe = {
  art: 'news' | 'produktbeschreibung' | 'kurzbeschreibung' | 'referenz' | 'frei'
  vorgabe: string
  vorhandenerText?: string | null
}

export async function textVorschlagen(
  zugang: KiZugang,
  aufgabe: TextAufgabe,
): Promise<string | null> {
  const anleitung: Record<TextAufgabe['art'], string> = {
    news: 'Schreibe einen kurzen Beitrag für die News-Seite, 3 bis 5 Absätze.',
    produktbeschreibung:
      'Schreibe eine Produktbeschreibung, 2 bis 4 Absätze: Material, Bauweise, Verwendung, Pflege.',
    kurzbeschreibung: 'Schreibe eine Kurzbeschreibung von höchstens 200 Zeichen.',
    referenz:
      'Schreibe die Beschreibung eines abgeschlossenen Projekts: Aufgabe, Umsetzung, Besonderheit.',
    frei: 'Schreibe den gewünschten Text.',
  }

  const antwort = await zugang.client.messages.create({
    model: zugang.model,
    max_tokens: 4000,
    system: STIL,
    messages: [
      {
        role: 'user',
        content: [
          anleitung[aufgabe.art],
          '',
          `Vorgabe: ${aufgabe.vorgabe}`,
          aufgabe.vorhandenerText ? `\nBisheriger Text als Grundlage:\n${aufgabe.vorhandenerText}` : '',
        ].join('\n'),
      },
    ],
  })

  return textAus(antwort) || null
}

export async function uebersetzen(
  zugang: KiZugang,
  text: string,
  ziel: 'fr' | 'en',
): Promise<string | null> {
  const sprache = ziel === 'fr' ? 'Französisch' : 'Englisch'
  const antwort = await zugang.client.messages.create({
    model: zugang.model,
    max_tokens: 8000,
    system: [
      `Du übersetzt Website-Texte einer französischen Metallwerkstatt ins ${sprache}.`,
      'Fachbegriffe des Metallbaus korrekt übertragen (Cortenstahl, pulverbeschichtet, RAL-Farben).',
      'Ton und Absatzstruktur des Originals beibehalten, nichts hinzufügen und nichts weglassen.',
      'Gib ausschließlich die Übersetzung zurück.',
    ].join('\n'),
    messages: [{ role: 'user', content: text }],
  })

  return textAus(antwort) || null
}
