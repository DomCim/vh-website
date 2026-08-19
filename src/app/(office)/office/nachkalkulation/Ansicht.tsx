'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { useBestand, useRahmen } from '../../../../lib/buero/bestand'
import { datum, euro } from '../../../../lib/format'
import { nachkalkulation, type KalkAuftrag, type Lagerposten } from '../../../../lib/nachkalkulation'

/**
 * Nachkalkulation: Was ein Stück wirklich gekostet hat.
 *
 * Die Daten lagen alle da — Zeit und Material am Auftrag, die Vorkalkulation
 * am Artikel —, nur nie nebeneinander. Hier stehen sie es: geplant gegen
 * tatsächlich, Auftrag für Auftrag und über die Artikel zusammengefasst.
 *
 * Die Zeile, um die es geht, ist die oberste in der Artikeltabelle: das Stück,
 * das regelmäßig mehr Stunden frisst, als bei seiner Kalkulation angenommen
 * wurde. Einmal ist Pech, dreimal ist der Preis falsch.
 *
 * Geändert wird hier nichts. Ein Preis, der sich von selbst anpasst, weil eine
 * Auswertung das für richtig hielt, ist der Weg zu Preisen, die niemand mehr
 * erklären kann.
 */

const stunden = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`

export function NachkalkulationAnsicht() {
  const suche = useSearchParams()
  const auftraege = useBestand<KalkAuftrag>('auftraege')
  const lager = useBestand<Lagerposten>('inventar')
  const { stundensatz } = useRahmen()

  const jahr = Number(suche.get('jahr')) || new Date().getFullYear()
  const jahre = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i)

  const a = useMemo(
    () => nachkalkulation(auftraege, { stundensatz, lager, jahr }),
    [auftraege, lager, stundensatz, jahr],
  )

  const zeitAbweichung = a.summe.zeitIst - a.summe.zeitGeplant

  return (
    <>
      <h1>Nachkalkulation {jahr}</h1>
      <p className="buero-unterzeile">
        Abgeschlossene Aufträge: was sie eingebracht und was sie gekostet haben. Gerechnet mit{' '}
        {euro(stundensatz)} Werkstattstunde.
      </p>

      <div className="buero-reiter">
        {jahre.map((j) => (
          <Link
            key={j}
            href={`/office/nachkalkulation?jahr=${j}`}
            aria-current={j === jahr ? 'page' : undefined}
          >
            {j}
          </Link>
        ))}
      </div>

      <div className="buero-kacheln" style={{ marginTop: '1rem' }}>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Auftragswert</div>
          <div className="buero-kachel-wert">{euro(a.summe.wert)}</div>
          <div className="buero-kachel-fuss">
            {a.summe.anzahl} abgeschlossene {a.summe.anzahl === 1 ? 'Auftrag' : 'Aufträge'}
          </div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Einsatz</div>
          <div className="buero-kachel-wert">{euro(a.summe.einsatz)}</div>
          <div className="buero-kachel-fuss">Stunden und Material</div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Deckung</div>
          <div className="buero-kachel-wert">{euro(a.summe.deckung)}</div>
          <div className="buero-kachel-fuss">
            {a.summe.wert > 0
              ? `${Math.round((a.summe.deckung / a.summe.wert) * 100)} % vom Auftragswert`
              : 'ohne Auftragswert'}
          </div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Zeit geplant / gebraucht</div>
          <div className="buero-kachel-wert">
            {stunden(a.summe.zeitGeplant)} / {stunden(a.summe.zeitIst)}
          </div>
          <div className="buero-kachel-fuss">
            {zeitAbweichung > 0
              ? `${stunden(zeitAbweichung)} über der Schätzung`
              : zeitAbweichung < 0
                ? `${stunden(-zeitAbweichung)} unter der Schätzung`
                : 'genau getroffen'}
          </div>
        </div>
      </div>

      {(a.summe.ohneZeit > 0 || a.summe.ohneSchaetzung > 0) && (
        <p className="buero-hinweis" style={{ marginTop: '1rem' }}>
          {a.summe.ohneZeit > 0 && (
            <>
              <strong>
                {a.summe.ohneZeit} {a.summe.ohneZeit === 1 ? 'Auftrag' : 'Aufträge'} ohne erfasste
                Zeit.
              </strong>{' '}
              Sie sehen aus wie besonders günstige — die Deckung oben ist damit geschönt.{' '}
            </>
          )}
          {a.summe.ohneSchaetzung > 0 && (
            <>
              {a.summe.ohneSchaetzung}{' '}
              {a.summe.ohneSchaetzung === 1 ? 'Auftrag hat' : 'Aufträge haben'} keine geplante
              Fertigungszeit und fehlen deshalb im Vergleich.
            </>
          )}
        </p>
      )}

      <h2>Artikel, sortiert nach Abweichung</h2>
      <p className="buero-unterzeile">
        Bei Aufträgen über mehrere Positionen verteilt sich die Zeit nach dem Wertanteil — die Uhr
        in der Werkstatt läuft auf den Auftrag, nicht auf die Position.
      </p>
      <div className="buero-liste">
        {a.artikel.length === 0 ? (
          <div className="buero-leer">
            Noch nichts zu vergleichen: Dafür braucht ein abgeschlossener Auftrag beides — eine
            geschätzte Fertigungszeit und erfasste Stunden.
          </div>
        ) : (
          a.artikel.map((z) => {
            const drueber = z.zeitAbweichung > 0
            const deutlich = z.zeitGeplant > 0 && z.zeitAbweichung / z.zeitGeplant >= 0.2
            return (
              <div key={z.name} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{z.name || 'ohne Bezeichnung'}</div>
                  <div className="buero-zeile-neben">
                    {z.auftraege} {z.auftraege === 1 ? 'Auftrag' : 'Aufträge'} ·{' '}
                    {stunden(z.zeitGeplant)} geplant · {stunden(z.zeitIst)} gebraucht ·{' '}
                    {euro(z.deckung)} Deckung
                  </div>
                </div>
                <span
                  className={`buero-marker ${drueber && deutlich ? 'warn' : drueber ? 'offen' : 'gut'}`}
                >
                  {drueber ? `+${stunden(z.zeitAbweichung)}` : stunden(z.zeitAbweichung)}
                </span>
              </div>
            )
          })
        )}
      </div>

      <h2>Die einzelnen Aufträge</h2>
      <div className="buero-liste">
        {a.auftraege.length === 0 ? (
          <div className="buero-leer">In {jahr} wurde noch nichts abgeschlossen.</div>
        ) : (
          a.auftraege.map((b) => (
            <Link key={b.id} href={`/office/auftraege/${b.id}`} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">
                  {b.nummer} · {b.titel}
                </div>
                <div className="buero-zeile-neben">
                  {datum(b.tag)} · {stunden(b.zeitGeplant)} geplant, {stunden(b.zeitIst)} gebraucht ·
                  Material {euro(b.materialkosten)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                <span className="buero-betrag">{euro(b.deckung)}</span>
                <span
                  className={`buero-marker ${
                    b.marge === null ? 'offen' : b.marge < 0 ? 'warn' : b.marge < 20 ? 'offen' : 'gut'
                  }`}
                >
                  {b.marge === null ? 'ohne Wert' : `${b.marge} %`}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
