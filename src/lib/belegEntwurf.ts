import type { BelegDaten } from './ki'
import { AUSGABEN_KATEGORIEN } from './listen'

type Kategorie = (typeof AUSGABEN_KATEGORIEN)[number]['value']

/** Nur was die Liste kennt — die KI ist ans Schema gebunden, aber Gürtel und Hosenträger. */
function alsKategorie(wert: string | null | undefined): Kategorie {
  const bekannt = AUSGABEN_KATEGORIEN.find((k) => k.value === wert)
  return bekannt ? bekannt.value : 'sonstiges'
}

/**
 * Aus einem ausgelesenen Beleg wird ein Beleg-Entwurf — die Abbildung, die
 * entscheidet, was ins Büro kommt und was nicht.
 *
 * Bewusst eine eigene, reine Datei: Hier steckt die einzige Regel-Entscheidung
 * des automatischen Postfach-Belegs, und die soll prüfbar sein, ohne ein
 * IMAP-Postfach oder ein KI-Modell zu starten.
 *
 * **Ohne Bruttobetrag kein Entwurf.** Auf info@ kommen auch Zeichnungen,
 * Angebote von Kunden und Werbe-PDFs an — die KI liest pflichtgemäß aus, was
 * sie sieht, aber ein „Beleg" ohne Betrag ist keiner. Lieber eine echte
 * Rechnung übersehen (die Mail bleibt ja ungelesen im Postfach liegen) als
 * das Büro mit Müll-Entwürfen fluten, die Vincent einzeln wegwerfen muss.
 */

export type MailQuelle = {
  von: string
  vonAdresse: string
  betreff: string
  /** ISO-Datum der Mail — Rückfall fürs Pflichtfeld Rechnungsdatum */
  datum: string | null
  /** Eindeutige Kennung (Message-ID + Dateiname) gegen Doppel-Anlage */
  kennung: string
}

export type BelegEntwurf = {
  title: string
  supplierName: string
  invoiceNumber?: string
  invoiceDate: string
  dueDate?: string
  netAmount?: number
  vatRate?: number
  vatAmount?: number
  grossAmount: number
  category: Kategorie
  paid: false
  quelleMail: string
  extraction: { status: 'ungeprueft'; confidence: number; note: string }
}

export function belegEntwurf(
  daten: BelegDaten | null,
  quelle: MailQuelle,
  heute: string,
): BelegEntwurf | null {
  if (!daten) return null
  if (typeof daten.brutto !== 'number' || daten.brutto <= 0) return null

  /*
   * Das Rechnungsdatum ist Pflicht am Beleg. Steht keines auf dem Papier,
   * ist das Mail-Datum die beste Wahrheit, die es gibt — eine Rechnung
   * kommt selten lange nach ihrem Ausstellen an.
   */
  const rechnungsdatum = daten.rechnungsdatum || quelle.datum?.slice(0, 10) || heute

  const herkunft = `Aus dem Postfach: ${quelle.von || quelle.vonAdresse} — „${quelle.betreff}"`

  return {
    title: daten.bezeichnung || quelle.betreff || daten.lieferant || 'Beleg aus dem Postfach',
    supplierName: daten.lieferant || quelle.von || quelle.vonAdresse,
    invoiceNumber: daten.rechnungsnummer || undefined,
    invoiceDate: rechnungsdatum,
    dueDate: daten.faelligkeit || undefined,
    netAmount: daten.netto ?? undefined,
    vatRate: daten.steuersatz ?? undefined,
    vatAmount: daten.steuer ?? undefined,
    grossAmount: daten.brutto,
    category: alsKategorie(daten.kategorie),
    // Ein Entwurf ist nie bezahlt — sonst schwiege die Zahlungserinnerung
    paid: false,
    quelleMail: quelle.kennung,
    extraction: {
      // „Ungeprüft" ist der Riegel: So erscheint der Entwurf mit Markierung
      // in der Belegliste und zählt erst nach Vincents Bestätigung als echt
      status: 'ungeprueft',
      confidence: daten.sicherheit ?? 0,
      note: daten.hinweis ? `${daten.hinweis}\n${herkunft}` : herkunft,
    },
  }
}
