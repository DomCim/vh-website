'use client'

import React, { useMemo, useState, useRef } from 'react'

import { useBestand } from '../../lib/buero/bestand'
import { useDarf } from '../../lib/buero/rechte'
import { absenden } from '../../lib/buero/warteschlange'
import { Rueckmeldung } from './Rueckmeldung'
import { useDateiablage } from '../../lib/buero/dateiablage'

/**
 * Die Bauunterlagen einer Artikelvariante — in Ordnern.
 *
 * Was in der Werkstatt gebraucht wird, liegt sonst in einem Ordner auf einem
 * Rechner, den nur einer kennt: Laserdatei, Fräsprogramm,
 * Zusammenbauzeichnung, NC-Code. Hier hängt es an der Variante, die es
 * betrifft — und wandert damit automatisch mit, wenn aus einer Bestellung ein
 * Auftrag wird.
 *
 * **Warum an der Variante und nicht am Artikel.** Ein Kübel in 100 × 50 hat
 * eine andere Laserdatei als derselbe in 60 × 30. Liegen beide zusammen, wird
 * irgendwann das falsche Blech geschnitten, und das merkt man am Schrott.
 * Ohne eigene Dateien zeigt eine Variante die des Artikels — wie bei der
 * Stückliste ist „nichts hinterlegt" keine Aussage, sondern ein Verweis auf
 * die Grundlage.
 *
 * **Warum echte Ordner und keine bloßen Kennzeichen.** Wer eine Serie
 * vorbereitet, legt erst die Struktur an und füllt sie danach. Ein Ordner
 * muss deshalb auch leer bestehen bleiben; er steht am Artikel, nicht an der
 * Datei.
 *
 * **Weitergeben an den Zulieferer.** Was hier liegt, geht bei Fremdfertigung
 * hinaus — die DXF zum Laserschneider, die Zeichnung zum Beschichter.
 * Ankreuzen, Adresse, abschicken: Es entsteht dabei keine zweite Fassung der
 * Zeichnung, sondern nur ein Abhol-Link auf diese hier (`lib/weitergabe.ts`).
 * Wer den Auftrag nicht führt, sieht die Kästchen nicht.
 */

export type Werkstattdatei = {
  id: number | string
  product?: number | { id: number } | null
  variantId?: string | null
  folder?: string | null
  label?: string | null
  filename?: string | null
  filesize?: number | null
  note?: string | null
  updatedAt?: string | null
}

type ProduktMitOrdnern = {
  id: number | string
  fileFolders?: { variantId?: string | null; name?: string | null }[] | null
}

/** Die Ordner, die man in einer Metallwerkstatt fast immer anlegt */
const VORSCHLAEGE = ['Fräsen', 'Laser', 'Zusammenbau', 'NC']

const groesse = (bytes?: number | null) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const bezug = (wert: unknown) =>
  typeof wert === 'object' && wert ? String((wert as { id?: number }).id ?? '') : String(wert ?? '')

/**
 * Was Zeile und Ordnerblock von der Ansicht brauchen.
 *
 * Gebündelt, weil beide dieselben sechs Angaben durchreichen und eine
 * Aufzählung an drei Stellen sonst dreimal gepflegt werden müsste.
 */
type Werkzeug = {
  darfAendern: boolean
  laeuft: string | null
  rufen: (schluessel: string, koerper: Record<string, unknown>, fehler?: string) => Promise<boolean>
  auswaehlbar: (d: Werkstattdatei) => boolean
  auswahl: string[]
  setAuswahl: React.Dispatch<React.SetStateAction<string[]>>
}

function Zeile({
  d,
  geerbt,
  werk,
}: {
  d: Werkstattdatei
  geerbt?: boolean
  werk: Werkzeug
}) {
  const { darfAendern, laeuft, rufen, auswaehlbar, auswahl, setAuswahl } = werk
  return (
    <div className="buero-zeile">
      {auswaehlbar(d) && (
        <input
          type="checkbox"
          aria-label={`${d.label || d.filename || 'Datei'} weitergeben`}
          checked={auswahl.includes(String(d.id))}
          onChange={(e) =>
            setAuswahl((bisher) =>
              e.target.checked
                ? [...bisher, String(d.id)]
                : bisher.filter((k) => k !== String(d.id)),
            )
          }
          style={{ marginRight: '.6rem' }}
        />
      )}
      <div className="buero-zeile-haupt">
        <div className="buero-zeile-titel">{d.label || d.filename || 'Datei'}</div>
        <div className="buero-zeile-neben">
          {groesse(d.filesize)}
          {d.note ? ` · ${d.note}` : ''}
          {geerbt ? ' · von der Grundlage' : ''}
          {/* Ohne Kennung ist die Datei noch in der Warteschlange */}
          {typeof d.id === 'string' && d.id.startsWith('warte') ? ' · geht raus, sobald Netz da ist' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
        <a className="buero-knopf leise schmal" href={`/api/office/werkstattdatei/${d.id}`}>
          Laden
        </a>
        {darfAendern && !geerbt && (
          <button
            type="button"
            className="buero-knopf stumm schmal"
            disabled={laeuft !== null}
            onClick={() => {
              if (confirm(`„${d.label || d.filename}“ löschen?`)) {
                void rufen(`del-${d.id}`, { aktion: 'datei-loeschen', id: d.id })
              }
            }}
          >
            Entfernen
          </button>
        )}
      </div>
    </div>
  )
}

function Ordnerblock({
  name,
  dateien,
  umbenennen,
  setUmbenennen,
  neuerName,
  setNeuerName,
  hochladen,
  werk,
}: {
  name: string
  dateien: Werkstattdatei[]
  umbenennen: string | null
  setUmbenennen: (n: string | null) => void
  neuerName: string
  setNeuerName: (n: string) => void
  hochladen: (datei: File, inOrdner: string) => void
  werk: Werkzeug
}) {
  const { darfAendern, laeuft, rufen } = werk
    const drin = dateien.filter((d) => d.folder === name)

  /*
   * Jeder Ordner nimmt selbst an — wer eine DXF auf „Laser" zieht, meint
   * diesen Ordner. Deshalb steht der Block hier oben und nicht mehr im Rumpf
   * der Ansicht: Eine Komponente, die dort entsteht, ist bei jedem Zeichnen
   * eine neue, und ein laufendes Ziehen ginge dabei jedes Mal verloren.
   */
  const ablageBereich = useRef<HTMLLabelElement>(null)
  const ablage = useDateiablage(
    ablageBereich,
    (d) => {
      if (d[0]) hochladen(d[0], name)
    },
    darfAendern && laeuft === null,
  )
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
          {umbenennen === name ? (
            <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="buero-fach-wahl"
                value={neuerName}
                autoFocus
                onChange={(e) => setNeuerName(e.target.value)}
              />
              <button
                type="button"
                className="buero-knopf leise schmal"
                disabled={laeuft !== null}
                onClick={async () => {
                  if (
                    await rufen(`ren-${name}`, {
                      aktion: 'ordner-umbenennen',
                      name,
                      neuerName,
                    })
                  )
                    setUmbenennen(null)
                }}
              >
                Übernehmen
              </button>
              <button
                type="button"
                className="buero-knopf stumm schmal"
                onClick={() => setUmbenennen(null)}
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 650 }}>
              {name}{' '}
              <span style={{ fontWeight: 400, color: 'var(--buero-tinte-leise)', fontSize: '.8rem' }}>
                · {drin.length} {drin.length === 1 ? 'Datei' : 'Dateien'}
              </span>
            </h3>
          )}

          {darfAendern && umbenennen !== name && (
            <div style={{ display: 'flex', gap: '.3rem' }}>
              <button
                type="button"
                className="buero-knopf stumm schmal"
                onClick={() => {
                  setUmbenennen(name)
                  setNeuerName(name)
                }}
              >
                Umbenennen
              </button>
              {drin.length === 0 && (
                <button
                  type="button"
                  className="buero-knopf stumm schmal"
                  disabled={laeuft !== null}
                  onClick={() => void rufen(`del-${name}`, { aktion: 'ordner-loeschen', name })}
                >
                  Ordner löschen
                </button>
              )}
            </div>
          )}
        </div>

        {drin.length > 0 ? (
          <div className="buero-liste">
            {drin.map((d) => (
              <Zeile key={d.id} d={d} werk={werk} />
            ))}
          </div>
        ) : (
          <div className="buero-leer" style={{ padding: '1rem' }}>
            Noch nichts abgelegt.
          </div>
        )}

        {darfAendern && (
          <label
            ref={ablageBereich}
            className={`buero-feld buero-ablage${ablage.drueber ? ' ist-drueber' : ''}`}
            style={{ marginTop: '.5rem' }}
          >
            <span>Datei in „{name}“ ablegen</span>
            <input
              type="file"
              disabled={laeuft !== null}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void hochladen(f, name)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
    )
}

export function Werkstattdateien({
  produktId,
  variantId,
  variantTitle,
  darfAendern,
}: {
  produktId: number | string
  /** '' ist die Grundlage — dieselbe Lesart wie bei der Stückliste */
  variantId: string
  variantTitle?: string
  darfAendern: boolean
}) {
  const alleDateien = useBestand<Werkstattdatei>('werkstattdateien')
  const artikel = useBestand<ProduktMitOrdnern>('artikel')

  const darfWeitergeben = useDarf()('auftraege.bearbeiten')

  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [auswahl, setAuswahl] = useState<string[]>([])
  const [anAdresse, setAnAdresse] = useState('')
  const [notiz, setNotiz] = useState('')
  const [versand, setVersand] = useState<{
    links: { id: number | string; name: string; url: string }[]
    bis: string
    verschickt: boolean
  } | null>(null)
  const [neuerOrdner, setNeuerOrdner] = useState('')
  const [umbenennen, setUmbenennen] = useState<string | null>(null)
  const [neuerName, setNeuerName] = useState('')

  const ordner = useMemo(() => {
    const produkt = artikel.find((p) => String(p.id) === String(produktId))
    return (produkt?.fileFolders ?? [])
      .filter((o) => String(o.variantId ?? '') === variantId)
      .map((o) => String(o.name ?? ''))
      .filter(Boolean)
  }, [artikel, produktId, variantId])

  const dateien = useMemo(
    () =>
      alleDateien.filter(
        (d) => bezug(d.product) === String(produktId) && String(d.variantId ?? '') === variantId,
      ),
    [alleDateien, produktId, variantId],
  )

  /*
   * Ohne eigene Dateien zeigt eine Variante die der Grundlage — sonst stünde
   * dort „nichts hinterlegt", obwohl die Zeichnung einen Klick weiter liegt.
   */
  const vonDerGrundlage = useMemo(
    () =>
      variantId && dateien.length === 0
        ? alleDateien.filter((d) => bezug(d.product) === String(produktId) && !d.variantId)
        : [],
    [alleDateien, dateien.length, produktId, variantId],
  )

  const ohneOrdner = dateien.filter((d) => !d.folder)
  const offeneVorschlaege = VORSCHLAEGE.filter((v) => !ordner.includes(v))

  async function rufen(schluessel: string, koerper: Record<string, unknown>, fehler?: string) {
    setLaeuft(schluessel)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/werkstattdatei', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: produktId, variantId, ...koerper }),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung(
          daten.error === 'gibt-es-schon'
            ? 'Diesen Ordner gibt es hier schon.'
            : daten.error === 'nicht-leer'
              ? 'In dem Ordner liegen noch Dateien — erst leeren, dann löschen.'
              : (fehler ?? 'Das hat nicht geklappt.'),
        )
        return false
      }
      return true
    } catch {
      setMeldung('Das hat nicht geklappt — dafür braucht es Netz.')
      return false
    } finally {
      setLaeuft(null)
    }
  }

  async function hochladen(datei: File, inOrdner: string) {
    setLaeuft(`upload-${inOrdner}`)
    setMeldung(null)
    try {
      await absenden({
        pfad: '/api/office/werkstattdatei',
        bereich: 'werkstattdateien',
        koerper: {
          product: produktId,
          variantId,
          variantTitle: variantTitle ?? '',
          folder: inOrdner,
        },
        datei: { name: datei.name, blob: datei },
        // Damit die Datei sofort in der Liste steht, auch ohne Netz
        vorschau: {
          product: Number(produktId),
          variantId: variantId || null,
          folder: inOrdner || null,
          label: datei.name,
          filesize: datei.size,
        },
      })
    } catch {
      setMeldung('Die Datei ließ sich nicht hochladen.')
    } finally {
      setLaeuft(null)
    }
  }

  /*
   * Dateien, die noch in der Warteschlange stehen, haben keine Kennung beim
   * Server — ein Link darauf zeigte ins Leere. Sie lassen sich deshalb nicht
   * ankreuzen; sobald sie durch sind, stehen sie mit Kennung da.
   */
  const auswaehlbar = (d: Werkstattdatei) =>
    darfWeitergeben && !(typeof d.id === 'string' && d.id.startsWith('warte'))

  /* Was die beiden Bausteine oben brauchen — an einer Stelle zusammengestellt */
  const werk: Werkzeug = { darfAendern, laeuft, rufen, auswaehlbar, auswahl, setAuswahl }

  async function weitergeben() {
    if (auswahl.length === 0) return
    setLaeuft('weitergabe')
    setMeldung(null)
    try {
      const res = await fetch('/api/office/weitergabe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateien: auswahl,
          an: anAdresse.trim() || undefined,
          notiz: notiz.trim() || undefined,
        }),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung(
          daten.error === 'nicht-erlaubt'
            ? 'Dafür fehlt das Recht, Aufträge zu bearbeiten.'
            : daten.error === 'zu-viele'
              ? 'Das sind zu viele Dateien für eine Nachricht.'
              : 'Das hat nicht geklappt.',
        )
        return
      }
      setVersand({ links: daten.links, bis: daten.bis, verschickt: Boolean(daten.verschickt) })
      setAuswahl([])
      setNotiz('')
      setAnAdresse('')
    } catch {
      setMeldung('Das hat nicht geklappt — dafür braucht es Netz.')
    } finally {
      setLaeuft(null)
    }
  }

  /*
   * Ziehen und Einfügen für die Ablage ohne Ordner (siehe
   * lib/buero/dateiablage.ts). Die Ordner haben je eine eigene — welche etwas
   * bekommt, entscheidet dort, wo die Maus steht.
   */
  const ablageBereich = useRef<HTMLLabelElement>(null)
  const ablage = useDateiablage(
    ablageBereich,
    (d: File[]) => {
      if (d[0]) void hochladen(d[0], '')
    },
    laeuft === null,
  )

  return (
    <>
      <h2>Werkstattdateien{variantTitle ? ` · ${variantTitle}` : ''}</h2>
      <p className="buero-unterzeile">
        Laserdatei, Fräsprogramm, Zusammenbauzeichnung, NC-Code — was zum Bauen gebraucht wird,
        liegt hier an der Variante und lässt sich in der Werkstatt herunterladen.
      </p>

      <Rueckmeldung text={meldung} />

      {vonDerGrundlage.length > 0 && (
        <>
          <p className="buero-unterzeile">
            Diese Variante hat keine eigenen Dateien — gezeigt werden die der Grundlage. Wer hier
            etwas ablegt, legt es für diese Variante ab.
          </p>
          <div className="buero-liste" style={{ marginBottom: '1.1rem' }}>
            {vonDerGrundlage.map((d) => (
              <Zeile key={d.id} d={d} geerbt werk={werk} />
            ))}
          </div>
        </>
      )}

      {ordner.map((name) => (
        <Ordnerblock
          key={name}
          name={name}
          dateien={dateien}
          umbenennen={umbenennen}
          setUmbenennen={setUmbenennen}
          neuerName={neuerName}
          setNeuerName={setNeuerName}
          hochladen={(f, o) => void hochladen(f, o)}
          werk={werk}
        />
      ))}

      {ohneOrdner.length > 0 && (
        <div style={{ marginBottom: '1.1rem' }}>
          <h3 style={{ margin: '0 0 .4rem', fontSize: '.95rem', fontWeight: 650 }}>Ohne Ordner</h3>
          <div className="buero-liste">
            {ohneOrdner.map((d) => (
              <Zeile key={d.id} d={d} werk={werk} />
            ))}
          </div>
        </div>
      )}

      {ordner.length === 0 && ohneOrdner.length === 0 && vonDerGrundlage.length === 0 && (
        <div className="buero-leer">Noch keine Ordner. Fang mit einem der Vorschläge an.</div>
      )}

      {/* ── An einen Zulieferer schicken ──────────────────────────────────
          Steht unter den Dateien und nicht in einem eigenen Fenster: Man
          kreuzt an, was man ohnehin gerade ansieht. */}
      {versand && (
        <div className="buero-karte" style={{ marginTop: '.6rem' }}>
          <p style={{ margin: '0 0 .4rem' }}>
            <strong>
              {versand.verschickt
                ? 'Verschickt.'
                : 'Links erzeugt — die Mail ging nicht hinaus.'}
            </strong>{' '}
            Gültig bis {new Date(versand.bis).toLocaleDateString('de-DE')}.
          </p>
          {/* Auch bei verschickter Mail: Wer sie selbst weiterreichen will,
              braucht die Adresse hier und nicht im Postausgang */}
          <div className="buero-liste">
            {versand.links.map((l) => (
              <div key={l.id} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{l.name}</div>
                  <div className="buero-zeile-neben" style={{ wordBreak: 'break-all' }}>
                    {l.url}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="buero-knopf stumm schmal"
            style={{ marginTop: '.6rem' }}
            onClick={() => setVersand(null)}
          >
            Schließen
          </button>
        </div>
      )}

      {auswahl.length > 0 && (
        <div className="buero-karte" style={{ marginTop: '.6rem' }}>
          <p className="buero-unterzeile" style={{ marginTop: 0 }}>
            {auswahl.length} {auswahl.length === 1 ? 'Datei' : 'Dateien'} ausgewählt. Der Empfänger
            bekommt je Datei einen Abhol-Link, vierzehn Tage gültig und ohne Passwort — und beim
            Öffnen immer den Stand von jetzt.
          </p>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="buero-feld" style={{ margin: 0, flex: '1 1 12rem' }}>
              <span>Schicken an</span>
              <input
                type="email"
                value={anAdresse}
                placeholder="zuschnitt@laserbetrieb.fr"
                onChange={(e) => setAnAdresse(e.target.value)}
              />
            </label>
            <label className="buero-feld" style={{ margin: 0, flex: '1 1 12rem' }}>
              <span>Notiz in der Mail</span>
              <input
                value={notiz}
                placeholder="z.B. 3 mm Edelstahl, 12 Stück"
                onChange={(e) => setNotiz(e.target.value)}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft !== null}
              onClick={() => void weitergeben()}
            >
              {anAdresse.trim() ? 'Schicken' : 'Nur Links erzeugen'}
            </button>
            <button
              type="button"
              className="buero-knopf stumm"
              disabled={laeuft !== null}
              onClick={() => setAuswahl([])}
            >
              Auswahl aufheben
            </button>
          </div>
        </div>
      )}

      {darfAendern && (
        <div className="buero-karte" style={{ marginTop: '.6rem' }}>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="buero-feld" style={{ margin: 0, flex: '1 1 12rem' }}>
              <span>Neuer Ordner</span>
              <input
                value={neuerOrdner}
                placeholder="z.B. Fräsen"
                onChange={(e) => setNeuerOrdner(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft !== null || !neuerOrdner.trim()}
              onClick={async () => {
                if (await rufen('neu', { aktion: 'ordner-anlegen', name: neuerOrdner }))
                  setNeuerOrdner('')
              }}
            >
              Anlegen
            </button>
          </div>

          {offeneVorschlaege.length > 0 && (
            <div style={{ marginTop: '.7rem' }}>
              <p className="buero-unterzeile" style={{ marginBottom: '.4rem' }}>
                Häufig gebraucht:
              </p>
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                {offeneVorschlaege.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="buero-knopf leise schmal"
                    disabled={laeuft !== null}
                    onClick={() => void rufen(`vor-${v}`, { aktion: 'ordner-anlegen', name: v })}
                  >
                    + {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label
            ref={ablageBereich}
            className={`buero-feld buero-ablage${ablage.drueber ? ' ist-drueber' : ''}`}
            style={{ marginTop: '1rem', marginBottom: 0 }}
          >
            <span>Datei ohne Ordner ablegen</span>
            <input
              type="file"
              disabled={laeuft !== null}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void hochladen(f, '')
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}
    </>
  )
}
