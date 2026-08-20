'use client'

import { useParams } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'

import { Fussleiste } from '../../../../../components/office/Fussleiste'
import { useAbgleich, useBestand, useDatensatz } from '../../../../../lib/buero/bestand'
import { datum } from '../../../../../lib/format'
import { auswahlSenden, lesbareGroesse, type Uploadstand } from '../../../../../lib/hochladen'

/**
 * Eine Übergabemappe im Ganzen.
 *
 * Drei Dinge stehen hier zusammen, weil sie im Alltag zusammengehören:
 *
 * **Der Zugang.** Link und Passwort entstehen zusammen; das Passwort steht
 * genau einmal da — zum Weitersagen am Telefon, falls die Mail nicht ankommt.
 * Danach ist es weg, gespeichert ist nur ein Abdruck. Wer es später noch
 * braucht, erzeugt einen neuen Zugang auf dieselbe Mappe.
 *
 * **Die Ordner.** Vorbereitet vom Büro, damit der Auftraggeber sieht, was
 * erwartet wird — „Zeichnungen", „Stückliste", „Freigaben".
 *
 * **Beide Richtungen.** Was hereinkommt, ist mit „vom Auftraggeber"
 * gekennzeichnet. Was hinausgeht — Fertigungszeichnung zur Freigabe,
 * Prüfprotokoll —, wird ausdrücklich freigegeben; ohne das Häkchen liegt eine
 * Hausdatei in der Mappe und bleibt drinnen.
 */

type Mappe = {
  id: number | string
  title?: string | null
  email?: string | null
  note?: string | null
  geschlossen?: boolean | null
  folders?: { name?: string | null }[] | null
  contact?: number | { id: number } | null
  anfrage?: number | { id: number } | null
  angebot?: number | { id: number } | null
  auftrag?: number | { id: number } | null
  zugaenge?:
    | {
        token?: string | null
        erzeugtAm?: string | null
        gueltigBis?: string | null
        anEmail?: string | null
        zuletztGenutzt?: string | null
        zurueckgezogen?: boolean | null
      }[]
    | null
}

type Datei = {
  id: number | string
  mappe?: number | { id: number } | null
  folder?: string | null
  label?: string | null
  filename?: string | null
  filesize?: number | null
  herkunft?: string | null
  freigabe?: boolean | null
  note?: string | null
  createdAt?: string | null
}

const bezug = (wert: unknown) =>
  typeof wert === 'object' && wert ? String((wert as { id?: number }).id ?? '') : String(wert ?? '')

/** Die Ordner, die im Blechbau fast immer gebraucht werden */
const VORSCHLAEGE = ['Zeichnungen', 'Stückliste', 'Freigaben', 'Fotos']

export function MappeAnsicht() {
  const { id } = useParams<{ id: string }>()
  const mappe = useDatensatz<Mappe>('mappen', id)
  const alleDateien = useBestand<Datei>('werkstattdateien')
  const { bereit } = useAbgleich()

  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [neuerOrdner, setNeuerOrdner] = useState('')
  const [anAdresse, setAnAdresse] = useState('')
  const [frisch, setFrisch] = useState<{ url: string; passwort: string; gueltigBis: string; verschickt: boolean } | null>(null)
  const [staende, setStaende] = useState<Uploadstand[]>([])

  const dateien = useMemo(
    () => alleDateien.filter((d) => bezug(d.mappe) === String(id)),
    [alleDateien, id],
  )

  const ordner = useMemo(
    () => (mappe?.folders ?? []).map((o) => String(o.name ?? '')).filter(Boolean),
    [mappe],
  )

  if (!mappe) {
    return (
      <>
        <h1>Übergabemappe</h1>
        <div className="buero-leer">
          {bereit ? 'Diese Mappe gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  async function rufen(koerper: Record<string, unknown>): Promise<Record<string, any> | null> {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/uebergabe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...koerper }),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung(
          daten.error === 'gibt-es-schon'
            ? 'Diesen Ordner gibt es hier schon.'
            : daten.error === 'nicht-leer'
              ? 'In dem Ordner liegen noch Dateien — erst leeren, dann löschen.'
              : 'Das hat nicht geklappt.',
        )
        return null
      }
      return daten
    } catch {
      setMeldung('Dafür braucht es Netz.')
      return null
    } finally {
      setLaeuft(false)
    }
  }

  async function hochladen(auswahl: File[], inOrdner: string, freigeben: boolean) {
    if (auswahl.length === 0) return
    setLaeuft(true)
    setMeldung(null)
    try {
      const { fehler } = await auswahlSenden(
        auswahl,
        (d) =>
          `/api/office/uebergabe/datei?mappe=${id}&name=${encodeURIComponent(d.name)}` +
          `&ordner=${encodeURIComponent(inOrdner)}&freigabe=${freigeben ? '1' : '0'}`,
        setStaende,
      )
      if (fehler > 0) setMeldung('Nicht alles ist durchgegangen — siehe Liste.')
    } finally {
      setLaeuft(false)
    }
  }

  const zugaenge = mappe.zugaenge ?? []
  const jetzt = Date.now()
  const gueltige = zugaenge.filter(
    (z) => !z.zurueckgezogen && z.gueltigBis && new Date(z.gueltigBis).getTime() > jetzt,
  )

  return (
    <>
      <h1>{mappe.title || 'Übergabemappe'}</h1>
      <p className="buero-unterzeile">
        {dateien.length} {dateien.length === 1 ? 'Datei' : 'Dateien'}
        {mappe.email ? ` · ${mappe.email}` : ''}
        {mappe.geschlossen ? ' · geschlossen' : ''}
      </p>

      {meldung && <p className="buero-hinweis">{meldung}</p>}

      {/* ── Zugang ───────────────────────────────────────────────────────── */}
      <h2>Zugang</h2>
      {frisch && (
        <div className="buero-karte" style={{ marginBottom: '.8rem' }}>
          <p style={{ margin: '0 0 .4rem' }}>
            <strong>Passwort: </strong>
            <span style={{ fontSize: '1.3rem', letterSpacing: '.18em', fontWeight: 700 }}>
              {frisch.passwort}
            </span>
          </p>
          <p className="buero-unterzeile" style={{ wordBreak: 'break-all' }}>
            {frisch.url}
          </p>
          <p className="buero-unterzeile">
            Gültig bis {datum(frisch.gueltigBis)} ·{' '}
            {frisch.verschickt ? 'per E-Mail verschickt' : 'nicht verschickt — bitte durchsagen'}
          </p>
          {/* Das Passwort steht nur dieses eine Mal da — gespeichert ist ein
              Abdruck. Wer es später braucht, erzeugt einen neuen Zugang. */}
          <p className="buero-unterzeile">
            Notieren oder weitersagen: Danach steht es nirgends mehr.
          </p>
        </div>
      )}

      <div className="buero-karte">
        <label className="buero-feld">
          <span>Link schicken an</span>
          <input
            type="email"
            value={anAdresse}
            placeholder={mappe.email ?? 'name@firma.fr'}
            onChange={(e) => setAnAdresse(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={laeuft}
          onClick={async () => {
            const daten = await rufen({ aktion: 'link', an: anAdresse || undefined })
            if (daten) {
              setFrisch({
                url: daten.url,
                passwort: daten.passwort,
                gueltigBis: daten.gueltigBis,
                verschickt: Boolean(daten.verschickt),
              })
              setAnAdresse('')
            }
          }}
        >
          Link und Passwort erzeugen
        </button>

        {zugaenge.length > 0 && (
          <div style={{ marginTop: '.9rem' }}>
            <p className="buero-unterzeile" style={{ marginBottom: '.3rem' }}>
              {gueltige.length} von {zugaenge.length} gültig
            </p>
            <div className="buero-liste">
              {[...zugaenge].reverse().map((z) => {
                const abgelaufen = !z.gueltigBis || new Date(z.gueltigBis).getTime() <= jetzt
                return (
                  <div key={z.token} className="buero-zeile">
                    <div className="buero-zeile-haupt">
                      <div className="buero-zeile-titel">{z.anEmail || 'ohne Adresse'}</div>
                      <div className="buero-zeile-neben">
                        {datum(z.erzeugtAm)} → {datum(z.gueltigBis)}
                        {z.zuletztGenutzt ? ` · zuletzt geöffnet ${datum(z.zuletztGenutzt)}` : ' · noch nicht geöffnet'}
                      </div>
                    </div>
                    {z.zurueckgezogen || abgelaufen ? (
                      <span className="buero-marker">
                        {z.zurueckgezogen ? 'Zurückgezogen' : 'Abgelaufen'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="buero-knopf stumm schmal"
                        disabled={laeuft}
                        onClick={() => void rufen({ aktion: 'zurueckziehen', token: z.token })}
                      >
                        Zurückziehen
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Ordner und Dateien ───────────────────────────────────────────── */}
      <h2>Unterlagen</h2>
      {ordner.map((name) => (
        <Ordnerblock
          key={name}
          name={name}
          dateien={dateien.filter((d) => d.folder === name)}
          laeuft={laeuft}
          rufen={rufen}
          hochladen={hochladen}
        />
      ))}
      <Ordnerblock
        name=""
        dateien={dateien.filter((d) => !d.folder)}
        laeuft={laeuft}
        rufen={rufen}
        hochladen={hochladen}
      />

      {staende.length > 0 && (
        <div className="buero-liste" style={{ marginTop: '.8rem' }}>
          {staende.map((s) => (
            <div key={s.schluessel} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{s.name}</div>
                <div className="buero-zeile-neben">
                  {s.stand === 'fertig'
                    ? 'übertragen'
                    : s.stand === 'fehler'
                      ? (s.fehler ?? 'nicht übertragen')
                      : s.stand === 'laeuft'
                        ? `${Math.round((s.getan / Math.max(1, s.bytes)) * 100)} % von ${lesbareGroesse(s.bytes)}`
                        : 'wartet'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="buero-karte" style={{ marginTop: '.8rem' }}>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="buero-feld" style={{ margin: 0, flex: '1 1 12rem' }}>
            <span>Neuer Ordner</span>
            <input
              value={neuerOrdner}
              placeholder="z.B. Zeichnungen"
              onChange={(e) => setNeuerOrdner(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="buero-knopf leise"
            disabled={laeuft || !neuerOrdner.trim()}
            onClick={async () => {
              if (await rufen({ aktion: 'ordner-anlegen', name: neuerOrdner })) setNeuerOrdner('')
            }}
          >
            Anlegen
          </button>
        </div>
        {VORSCHLAEGE.filter((v) => !ordner.includes(v)).length > 0 && (
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
            {VORSCHLAEGE.filter((v) => !ordner.includes(v)).map((v) => (
              <button
                key={v}
                type="button"
                className="buero-knopf leise schmal"
                disabled={laeuft}
                onClick={() => void rufen({ aktion: 'ordner-anlegen', name: v })}
              >
                + {v}
              </button>
            ))}
          </div>
        )}
      </div>

      <Fussleiste hinweis={mappe.geschlossen ? 'Nimmt nichts mehr entgegen' : undefined}>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={laeuft}
          onClick={() => void rufen({ aktion: 'aendern', geschlossen: !mappe.geschlossen })}
        >
          {mappe.geschlossen ? 'Wieder öffnen' : 'Mappe schließen'}
        </button>
      </Fussleiste>
    </>
  )
}

/**
 * Ein Ordner der Mappe.
 *
 * Steht außerhalb der Ansicht, damit React ihn beim Neuzeichnen nicht samt
 * Auswahlfeld abbaut — während eines Uploads zeichnet die
 * Fortschrittsanzeige oft.
 */
function Ordnerblock({
  name,
  dateien,
  laeuft,
  rufen,
  hochladen,
}: {
  name: string
  dateien: Datei[]
  laeuft: boolean
  rufen: (koerper: Record<string, unknown>) => Promise<Record<string, any> | null>
  hochladen: (auswahl: File[], ordner: string, freigeben: boolean) => Promise<void>
}) {
  const feld = useRef<HTMLInputElement>(null)
  const [freigeben, setFreigeben] = useState(true)
  const [umbenennen, setUmbenennen] = useState(false)
  const [neuerName, setNeuerName] = useState(name)

  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '.6rem',
          marginBottom: '.4rem',
          flexWrap: 'wrap',
        }}
      >
        {umbenennen ? (
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
            <input
              className="buero-fach-wahl"
              value={neuerName}
              autoFocus
              onChange={(e) => setNeuerName(e.target.value)}
            />
            <button
              type="button"
              className="buero-knopf leise schmal"
              disabled={laeuft}
              onClick={async () => {
                if (await rufen({ aktion: 'ordner-umbenennen', name, neuerName }))
                  setUmbenennen(false)
              }}
            >
              Übernehmen
            </button>
            <button
              type="button"
              className="buero-knopf stumm schmal"
              onClick={() => setUmbenennen(false)}
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 650 }}>
            {name || 'Ohne Ordner'}{' '}
            <span style={{ fontWeight: 400, color: 'var(--buero-tinte-leise)', fontSize: '.8rem' }}>
              · {dateien.length} {dateien.length === 1 ? 'Datei' : 'Dateien'}
            </span>
          </h3>
        )}
        {name && !umbenennen && (
          <div style={{ display: 'flex', gap: '.3rem' }}>
            <button
              type="button"
              className="buero-knopf stumm schmal"
              onClick={() => {
                setNeuerName(name)
                setUmbenennen(true)
              }}
            >
              Umbenennen
            </button>
            {dateien.length === 0 && (
              <button
                type="button"
                className="buero-knopf stumm schmal"
                disabled={laeuft}
                onClick={() => void rufen({ aktion: 'ordner-loeschen', name })}
              >
                Ordner löschen
              </button>
            )}
          </div>
        )}
      </div>

      {dateien.length > 0 ? (
        <div className="buero-liste">
          {dateien.map((d) => {
            const vomKunden = d.herkunft === 'kunde'
            return (
              <div key={d.id} className={`buero-zeile ${vomKunden ? 'ist-offen' : ''}`}>
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{d.label || d.filename || 'Datei'}</div>
                  <div className="buero-zeile-neben">
                    {vomKunden ? 'vom Auftraggeber' : d.freigabe ? 'freigegeben' : 'nur im Haus'}
                    {d.filesize ? ` · ${lesbareGroesse(d.filesize)}` : ''} · {datum(d.createdAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                  <a className="buero-knopf leise schmal" href={`/api/office/werkstattdatei/${d.id}`}>
                    Laden
                  </a>
                  {/* Beim Kunden hochgeladene Dateien sieht er ohnehin — ein
                      Freigabeknopf daran wäre eine Handlung ohne Wirkung */}
                  {!vomKunden && (
                    <button
                      type="button"
                      className="buero-knopf stumm schmal"
                      disabled={laeuft}
                      onClick={() =>
                        void rufen({
                          aktion: 'datei-freigeben',
                          datei: d.id,
                          freigabe: !d.freigabe,
                        })
                      }
                    >
                      {d.freigabe ? 'Zurückhalten' : 'Freigeben'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="buero-knopf stumm schmal"
                    disabled={laeuft}
                    onClick={() => {
                      if (confirm(`„${d.label || d.filename}“ löschen?`))
                        void rufen({ aktion: 'datei-loeschen', datei: d.id })
                    }}
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="buero-leer" style={{ padding: '1rem' }}>
          Noch nichts abgelegt.
        </div>
      )}

      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '.5rem' }}>
        <input
          ref={feld}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const auswahl = Array.from(e.target.files ?? [])
            e.target.value = ''
            void hochladen(auswahl, name, freigeben)
          }}
        />
        <button
          type="button"
          className="buero-knopf leise schmal"
          disabled={laeuft}
          onClick={() => feld.current?.click()}
        >
          Dateien ablegen
        </button>
        <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center', fontSize: '.85rem' }}>
          <input
            type="checkbox"
            checked={freigeben}
            onChange={(e) => setFreigeben(e.target.checked)}
          />
          für den Auftraggeber sichtbar
        </label>
      </div>
    </div>
  )
}
