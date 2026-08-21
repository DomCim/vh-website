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

  if (!rechnungen.length) return null

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
            <Link key={r.id} href={`/office/rechnungen/${r.id}`} className="buero-zeile">
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

      {meldung && <p className="buero-hinweis">{meldung}</p>}
    </div>
  )
}
