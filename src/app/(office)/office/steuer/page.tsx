import Link from 'next/link'
import React from 'react'

import { Monatspaket } from '../../../../components/office/Monatspaket'
import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer, datum, euro } from '../../../../lib/office'
import { getIntegrations } from '../../../../lib/settings'
import { steuerbericht } from '../../../../lib/steuerexport'

export const dynamic = 'force-dynamic'

const MONATSNAME = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

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
  const { email } = await getIntegrations(payload)

  /*
   * Ohne Berater- und Mandantennummer wird der Stapel beim Import abgewiesen.
   * Dann gibt es hier keinen Knopf, sondern den Satz, was zu tun ist — eine
   * Datei anzubieten, die nicht angenommen wird, schickt nur jemanden in der
   * Kanzlei auf Fehlersuche.
   */
  const datevBereit = Boolean(email.datevBerater && email.datevMandant)
  const monatJetzt = new Date().getMonth() + 1

  const jahre = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i)

  return (
    <>
      <h1>Steuer-Export {jahr}</h1>
      <p className="buero-unterzeile">
        Alles, was der Steuerberater braucht — Einnahmen, Ausgaben und die Belege dazu.
      </p>

      <div className="buero-reiter">
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

      <h2>Monatspaket für den Steuerberater</h2>
      <Monatspaket kanzlei={email.steuerberaterEmail ?? null} />

      {/*
       * Zwei Formate, dieselben Zahlen — und die Wahl gehört hierher.
       *
       * Die Tabelle liest ein Mensch, den Buchungsstapel liest DATEV. Wer nur
       * die Tabelle abgibt, lässt jemanden in der Kanzlei abtippen, was hier
       * längst sauber steht; wer nur den Stapel abgibt, hat selbst nichts mehr
       * zum Nachsehen. Deshalb steht beides da und nicht eines statt des
       * anderen.
       */}
      <h2>Herunterladen</h2>
      <div className="buero-karte">
        <h3 style={{ marginTop: 0 }}>Für DATEV</h3>
        <p style={{ fontSize: '.9rem', color: 'var(--buero-tinte-leise)' }}>
          Ein Buchungsstapel, den die Kanzlei direkt einliest — mit Konten, Soll und Haben,
          Steuerschlüssel und Belegnummer. Damit muss dort nichts abgetippt werden.
        </p>
        {datevBereit ? (
          <>
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <a className="buero-knopf" href={`/api/office/steuer?jahr=${jahr}&format=datev`}>
                Buchungsstapel {jahr}
              </a>
              {/* Gebucht wird meist monatlich — der laufende Monat ist der häufigste Griff */}
              <a
                className="buero-knopf leise"
                href={`/api/office/steuer?jahr=${jahr}&monat=${monatJetzt}&format=datev`}
              >
                Nur {MONATSNAME[monatJetzt - 1]}
              </a>
            </div>
            <p
              style={{
                fontSize: '.82rem',
                color: 'var(--buero-tinte-leise)',
                marginBottom: 0,
              }}
            >
              Die Konten sind ein Vorschlag nach SKR03. Bitte einmal von der Kanzlei prüfen lassen:
              Die Beträge stimmen in jedem Fall, die Zuordnung hängt am Kontenrahmen.
            </p>
          </>
        ) : (
          <p className="buero-hinweis" style={{ marginBottom: 0 }}>
            <strong>Dafür fehlen noch zwei Nummern.</strong> DATEV nimmt einen Stapel nur an, wenn
            Berater- und Mandantennummer im Kopf stehen — beide kommen von der Kanzlei. Einzutragen
            unter{' '}
            <Link href="/admin/globals/integrations" style={{ textDecoration: 'underline' }}>
              Einstellungen → Integrationen → E-Mail
            </Link>
            . Danach steht der Knopf hier.
          </p>
        )}
      </div>

      <div className="buero-karte" style={{ marginTop: '.8rem' }}>
        <h3 style={{ marginTop: 0 }}>Zum Ansehen</h3>
        <p style={{ fontSize: '.9rem', color: 'var(--buero-tinte-leise)' }}>
          Die Tabelle enthält jede Buchung einzeln mit Datum, Partner, Kategorie, Netto, Steuer und
          Brutto — dazu den Dateinamen des Belegs. Die Belege selbst liegen in der Mediathek.
        </p>
        <a className="buero-knopf leise" href={`/api/office/steuer?jahr=${jahr}`}>
          Buchungen als CSV
        </a>
      </div>
    </>
  )
}
