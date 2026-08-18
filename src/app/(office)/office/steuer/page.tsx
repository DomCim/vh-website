import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum, euro } from '../../../../lib/office'
import { steuerbericht } from '../../../../lib/steuerexport'

export const dynamic = 'force-dynamic'

export default async function SteuerSeite({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>
}) {
  await bueroBenutzer()
  const { jahr: gewaehlt } = await searchParams
  const jahr = Number(gewaehlt) || new Date().getFullYear()
  const payload = await payloadClient()
  const b = await steuerbericht(payload, jahr)

  const jahre = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i)

  return (
    <>
      <h1>Steuer-Export {jahr}</h1>
      <p className="buero-unterzeile">
        Alles, was der Steuerberater braucht — Einnahmen, Ausgaben und die Belege dazu.
      </p>

      <div className="buero-nav" style={{ borderRadius: 10, border: '1px solid var(--buero-linie)' }}>
        {jahre.map((j) => (
          <Link key={j} href={`/office/steuer?jahr=${j}`} aria-current={j === jahr ? 'page' : undefined}>
            {j}
          </Link>
        ))}
      </div>

      <div className="buero-kacheln" style={{ marginTop: '1rem' }}>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Einnahmen</div>
          <div className="buero-kachel-wert">{euro(b.einnahmen)}</div>
          <div className="buero-kachel-fuss">davon Steuer {euro(b.steuerEinnahmen)}</div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Ausgaben</div>
          <div className="buero-kachel-wert">{euro(b.ausgaben)}</div>
          <div className="buero-kachel-fuss">davon Steuer {euro(b.steuerAusgaben)}</div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Ergebnis</div>
          <div className="buero-kachel-wert">{euro(b.ergebnis)}</div>
          <div className="buero-kachel-fuss">{b.zeilen.length} Buchungen</div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Inventur</div>
          <div className="buero-kachel-wert">
            {b.inventurWert === null ? '—' : euro(b.inventurWert)}
          </div>
          <div className="buero-kachel-fuss">
            {b.inventurStichtag ? `Stichtag ${datum(b.inventurStichtag)}` : 'keine abgeschlossene Inventur'}
          </div>
        </div>
      </div>

      {b.ohneBeleg > 0 && (
        <p className="buero-hinweis" style={{ marginTop: '1rem' }}>
          <strong>{b.ohneBeleg} Ausgaben ohne hinterlegten Beleg.</strong> Ohne Beleg wird die
          Buchung in der Regel nicht anerkannt —{' '}
          <Link href="/office/belege?filter=ohne-beleg" style={{ textDecoration: 'underline' }}>
            jetzt nachtragen
          </Link>
          .
        </p>
      )}
      {b.inventurWert === null && (
        <p className="buero-hinweis">
          Für {jahr} gibt es noch keine abgeschlossene Inventur. Den Bestand zum Stichtag braucht der
          Jahresabschluss —{' '}
          <Link href="/office/inventur" style={{ textDecoration: 'underline' }}>
            Inventur anlegen
          </Link>
          .
        </p>
      )}

      <h2>Ausgaben nach Kategorie</h2>
      <div className="buero-liste">
        {b.ausgabenNachKategorie.length === 0 ? (
          <div className="buero-leer">Keine Ausgaben erfasst.</div>
        ) : (
          b.ausgabenNachKategorie.map((k) => (
            <div key={k.kategorie} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{k.kategorie}</div>
                <div className="buero-zeile-neben">{k.anzahl} Belege</div>
              </div>
              <span className="buero-betrag">{euro(k.summe)}</span>
            </div>
          ))
        )}
      </div>

      <h2>Herunterladen</h2>
      <div className="buero-karte">
        <p style={{ marginTop: 0, fontSize: '.9rem', color: 'var(--buero-tinte-leise)' }}>
          Die Tabelle enthält jede Buchung einzeln mit Datum, Partner, Kategorie, Netto, Steuer und
          Brutto — dazu den Dateinamen des Belegs. Die Belege selbst liegen in der Mediathek.
        </p>
        <a className="buero-knopf" href={`/api/office/steuer?jahr=${jahr}`}>
          Buchungen als CSV
        </a>
      </div>
    </>
  )
}
