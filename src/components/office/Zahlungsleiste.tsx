'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { stufenBerechnen, type Zahlplan } from '../../lib/anzahlung'
import { useBestand, useRahmen } from '../../lib/buero/bestand'
import { absenden } from '../../lib/buero/warteschlange'
import { datum, euro } from '../../lib/format'
import { RECHNUNG_STUFEN, textKarte } from '../../lib/listen'
import {
  eingegangen,
  istOffenerPosten,
  offenerBetrag,
  terminVerschiebung,
  zahlungsstand,
  type StufenRechnung,
} from '../../lib/zahlungsstand'
import { Rueckmeldung } from './Rueckmeldung'

/**
 * Was das Geld für diesen Auftrag bedeutet.
 *
 * Der Zusammenhang, den sonst niemand zieht: Wird nicht gezahlt, wird nicht
 * gearbeitet — und damit verschiebt sich die Lieferung. Das steht hier als
 * Satz, nicht als Automatik. Ein zugesagtes Datum, das sich still ändert, ist
 * schlimmer als eines, das sich sichtbar ändert: Der Kunde hat den alten
 * Termin im Kalender, und erfahren muss er es von einem Menschen.
 *
 * Deshalb ein Knopf und keine Regel. Er trägt den neuen Termin ein; anrufen
 * muss Vincent trotzdem.
 *
 * Gerechnet wird aus dem Bestand im Gerät — die Rechnungen liegen ohnehin
 * dort. Damit steht die Leiste auch in der Werkstatt ohne Netz.
 */

type Rechnung = {
  id: number | string
  invoiceNumber?: string | null
  auftrag?: unknown
  stufe?: string | null
  status?: string | null
  dueDate?: string | null
  netTotal?: number | null
  total?: number | null
  stornoVon?: unknown
}

// In der Leiste heißt „vollstaendig" schlicht „Rechnung" — der lange Titel gehört ins Formular.
const bezeichnung: Record<string, string> = {
  ...textKarte(RECHNUNG_STUFEN),
  vollstaendig: 'Rechnung',
}

/** Tage auf ein Datum draufrechnen, ohne die Uhrzeit anzufassen. */
function spaeter(tag: string, tage: number): string {
  const d = new Date(tag)
  d.setDate(d.getDate() + tage)
  return d.toISOString().slice(0, 10)
}

export function Zahlungsleiste({
  auftragId,
  auftragswert,
  zahlplan,
  fertigBis,
}: {
  auftragId: number | string
  auftragswert: number
  zahlplan?: Zahlplan | null
  fertigBis?: string | null
}) {
  const alle = useBestand<Rechnung>('rechnungen')
  const { platzFreigebenNachTagen } = useRahmen()
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const rechnungen = useMemo(
    () =>
      alle.filter((r) => {
        const id = typeof r.auftrag === 'object' ? (r.auftrag as { id?: number })?.id : r.auftrag
        return String(id ?? '') === String(auftragId)
      }),
    [alle, auftragId],
  )

  const stand = useMemo(
    () =>
      zahlungsstand(
        rechnungen.map(
          (r): StufenRechnung => ({
            stufe: r.stufe,
            status: r.status,
            dueDate: r.dueDate,
            netto: r.netTotal,
            nummer: r.invoiceNumber,
          }),
        ),
        platzFreigebenNachTagen,
      ),
    [rechnungen, platzFreigebenNachTagen],
  )

  const stufen = stufenBerechnen(auftragswert, zahlplan ?? {})
  const da = eingegangen(
    rechnungen.map((r) => ({ status: r.status, netto: r.netTotal })),
  )
  const fehlt = offenerBetrag(
    stufen,
    rechnungen.map((r) => ({ status: r.status, netto: r.netTotal })),
  )
  const verschiebung = terminVerschiebung(stand)
  const neuerTermin = fertigBis && verschiebung > 0 ? spaeter(fertigBis, verschiebung) : null

  async function terminVerschieben() {
    if (!neuerTermin) return
    setLaeuft(true)
    try {
      await absenden({
        pfad: '/api/office/auftrag',
        bereich: 'auftraege',
        // Schmaler Weg — ein voller Datensatz von hier aus löschte die Positionen
        koerper: { aktion: 'termin', id: auftragId, dueDate: neuerTermin },
      })
      setMeldung(`Fertigstellung steht jetzt auf ${datum(neuerTermin)}. Sag der Kundschaft Bescheid.`)
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  /**
   * Rechnung aus diesem Auftrag anlegen.
   *
   * Der Knopf hängt an der Rechnung, nicht am Klick: Er ist da, solange es
   * keine Rechnung gibt, und verschwindet erst, wenn eine im Bestand steht.
   * Das ist der Unterschied, der zählt — verschwände er schon beim Drücken,
   * stünde der Auftrag ohne Weg da, sobald das Anlegen scheitert. Und ohne
   * Netz scheitert es nicht einmal, es dauert nur: `absenden` legt die Sache
   * in die Warteschlange, die Rechnung entsteht später am Server, und bis
   * dahin muss der Knopf erreichbar bleiben.
   */
  async function rechnungAnlegen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/auftrag',
        bereich: 'auftraege',
        koerper: { aktion: 'rechnung', id: auftragId },
      })
      setMeldung(
        sofort
          ? 'Rechnungsentwurf liegt bereit — er steht gleich in der Liste. Verschickt wird von Hand.'
          : 'Gemerkt — der Entwurf entsteht, sobald wieder Netz da ist.',
      )
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  /*
   * Noch keine Rechnung — und genau hier fehlte bisher alles.
   *
   * Die Karte verschwand vollständig, solange es keine Rechnung gab. Damit
   * war der Ort, an dem man eine anlegt, ausgerechnet in dem Moment
   * unsichtbar, in dem man ihn braucht: Am Auftrag stand alles beisammen,
   * aber der Weg zur Rechnung führte übers Abtippen im Rechnungsformular.
   *
   * Statt der Zahlen steht hier deshalb der Knopf. Alles darunter —
   * eingegangen, ausstehend, überfällig, Terminverschiebung — hätte ohne eine
   * einzige Rechnung nichts zu sagen.
   */
  if (!rechnungen.length) {
    return (
      <div className="buero-karte">
        <h2>Zahlung</h2>
        <p className="buero-unterzeile">
          Für diesen Auftrag gibt es noch keine Rechnung.
          {auftragswert > 0 ? ` Der Auftrag steht bei ${euro(auftragswert)} netto.` : ''}
        </p>
        {auftragswert > 0 ? (
          <button
            type="button"
            className="buero-knopf"
            onClick={rechnungAnlegen}
            disabled={laeuft}
          >
            Rechnung aus dem Auftrag erstellen
          </button>
        ) : (
          /* Ohne Positionen mit Preis gibt es nichts zu berechnen — dann ist
             am Auftrag noch etwas zu tun, und ein Knopf, der nur scheitern
             kann, hilft dabei nicht. */
          <p className="buero-hinweis">
            Sobald die Positionen mit Preisen am Auftrag stehen, lässt sich die Rechnung von hier
            aus anlegen.
          </p>
        )}
        <Rueckmeldung text={meldung} />
      </div>
    )
  }

  return (
    <div className="buero-karte">
      <h2>Zahlung</h2>
      <p className="buero-unterzeile">
        {euro(da)} eingegangen{fehlt > 0 ? ` · ${euro(fehlt)} stehen noch aus` : ' · alles bezahlt'}
      </p>

      <div className="buero-liste">
        {rechnungen.map((r) => {
          const spaet =
            istOffenerPosten(r) && r.dueDate && new Date(r.dueDate).getTime() < Date.now()
          return (
            /*
             * Rot bei überfällig, bronze bei offen. Eine bezahlte Rechnung
             * bleibt farblos: Am Zahlplan eines Auftrags sind am Ende alle
             * bezahlt, und grün auf allen sagt dann nichts mehr.
             */
            <Link
              key={r.id}
              href={`/office/rechnungen/${r.id}`}
              className={`buero-zeile ${
                spaet ? 'ist-warn' : istOffenerPosten(r) ? 'ist-offen' : ''
              }`}
            >
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">
                  {bezeichnung[r.stufe ?? ''] ?? 'Rechnung'}
                  {r.invoiceNumber ? ` · ${r.invoiceNumber}` : ' · Entwurf'}
                </div>
                <div className="buero-zeile-neben">
                  {euro(r.total ?? 0)}
                  {r.dueDate ? ` · fällig ${datum(r.dueDate)}` : ''}
                </div>
              </div>
              <span
                className={`buero-marker ${spaet ? 'warn' : r.status === 'bezahlt' ? 'gut' : 'offen'}`}
              >
                {spaet ? 'überfällig' : r.status === 'bezahlt' ? 'bezahlt' : (r.status ?? '')}
              </span>
            </Link>
          )
        })}
      </div>

      {stand.wartet && (
        <div className="buero-hinweis">
          <strong>
            {bezeichnung[stand.offeneStufe ?? ''] ?? 'Zahlung'} seit {stand.tageUeberfaellig}{' '}
            {stand.tageUeberfaellig === 1 ? 'Tag' : 'Tagen'} überfällig.
          </strong>{' '}
          {stand.nurErinnern
            ? 'Vor der Anzahlung ist nichts geleistet — hier wird erinnert, nicht gemahnt.'
            : 'An der Rechnung führt ein Knopf zur nächsten Mahnstufe.'}
          {fertigBis && verschiebung > 0 && (
            <>
              {' '}
              Solange nicht gezahlt wird, wird auch nicht gearbeitet: Die Fertigstellung
              verschiebt sich um {verschiebung} {verschiebung === 1 ? 'Tag' : 'Tage'} auf{' '}
              {neuerTermin ? datum(neuerTermin) : ''}.
            </>
          )}
        </div>
      )}

      {stand.platzFrage && (
        <div className="buero-hinweis">
          Die Anzahlung steht seit {stand.tageUeberfaellig} Tagen aus. Bleibt der Werkstattplatz
          für diesen Auftrag reserviert, oder geht er an den nächsten?
        </div>
      )}

      {neuerTermin && (
        <button
          type="button"
          className="buero-knopf leise"
          onClick={terminVerschieben}
          disabled={laeuft}
        >
          Fertigstellung auf {datum(neuerTermin)} setzen
        </button>
      )}

      <Rueckmeldung text={meldung} />
    </div>
  )
}
