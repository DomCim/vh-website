'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { auswahlSenden, lesbareGroesse, type Uploadstand } from '../../lib/hochladen'
import { Dateiknopf } from '../office/Dateiknopf'
import { useDateiablage } from '../../lib/buero/dateiablage'
import type { Dictionary } from '../../lib/i18n'

/**
 * Die Übergabemappe, wie der Auftraggeber sie sieht.
 *
 * Erst das Passwort, dann der Ordner. Danach zwei Richtungen in einer
 * Ansicht: Was er ablegt, und was für ihn bereitliegt.
 *
 * **Warum beides in einer Liste und nicht in zwei Spalten.** Es ist derselbe
 * Vorgang. „Ihre Zeichnung liegt in Ordner A, unsere Fertigungszeichnung in
 * Ordner B" ist am Telefon eine Erklärung zu viel; nebeneinander im selben
 * Ordner, mit einem Wort dahinter, wer sie hingelegt hat, versteht es jeder
 * ohne Erklärung.
 *
 * **Warum die Ordner auch dann stehen, wenn sie leer sind.** Vincent bereitet
 * „Zeichnungen", „Stückliste", „Freigaben" vor. Ein leerer Ordner ist damit
 * eine Ansage, was erwartet wird — und nicht eine Lücke.
 */

type Datei = {
  id: number | string
  ordner: string
  name: string
  groesse: number
  vonUns: boolean
  bemerkung: string | null
  am: string | null
}

type Bild = {
  titel: string
  geschlossen: boolean
  ordner: string[]
  dateien: Datei[]
}

const eingabe =
  'border-line focus:border-ink w-full border bg-paper px-4 py-3 text-sm outline-none transition-colors'
const knopf =
  'bg-ink tracking-nav hover:bg-bronze cursor-pointer px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors disabled:opacity-50'
const knopfLeise =
  'border-line hover:border-ink tracking-nav cursor-pointer border px-4 py-2 text-xs font-semibold uppercase transition-colors disabled:opacity-50'


/** Eine Zeile in der Liste — Name, Herkunft, Größe, Download. */
function Dateizeile({
  d,
  token,
  labels,
}: {
  d: Datei
  token: string
  labels: Dictionary['handover']
}) {
  return (
    <li className="border-line flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-ink truncate text-sm">{d.name}</div>
        <div className="text-ink-soft text-xs">
          {d.vonUns ? labels.fromUs : labels.fromYou}
          {d.groesse ? ` · ${lesbareGroesse(d.groesse)}` : ''}
          {d.bemerkung ? ` · ${d.bemerkung}` : ''}
        </div>
      </div>
      <a className={knopfLeise} href={`/api/uebergabe/${token}/datei/${d.id}`}>
        {labels.download}
      </a>
    </li>
  )
}

/**
 * Ein Ordner mit allem, was darin liegt.
 *
 * Steht bewusst außerhalb der Ansicht: Eine Komponente, die im Rumpf einer
 * anderen entsteht, ist bei jedem Neuzeichnen eine neue — React baut sie samt
 * Auswahlfeld jedes Mal ab und wieder auf, und während eines Uploads zeichnet
 * die Fortschrittsanzeige oft.
 */
function Ordnerblock({
  name,
  dateien,
  token,
  labels,
  offen,
  laeuft,
  hochladen,
}: {
  name: string
  dateien: Datei[]
  token: string
  labels: Dictionary['handover']
  offen: boolean
  laeuft: boolean
  hochladen: (dateien: File[], ordner: string) => void
}) {

  /*
   * Ziehen und Einfügen zusätzlich zum Knopf (siehe lib/buero/dateiablage.ts).
   * Der ganze Abschnitt nimmt an, nicht nur der Knopf: Wer eine Zeichnung auf
   * „Freigaben" zieht, meint diesen Ordner — und genau das passiert dann auch,
   * weil jeder Ordnerblock seine eigene Ablage ist.
   */
  const ablageBereich = useRef<HTMLElement>(null)
  const ablage = useDateiablage(ablageBereich, (d) => hochladen(d, name), offen && !laeuft)

  return (
    <section
      ref={ablageBereich}
      className={`mt-10 border border-dashed p-3 transition-colors ${
        ablage.drueber ? 'border-bronze bg-bronze/5' : 'border-transparent'
      }`}
    >
      <h2 className="tracking-nav text-ink rule-bronze-sm mb-4 text-sm font-semibold uppercase">
        {name || labels.noFolder}
      </h2>
      {dateien.length === 0 ? (
        <p className="text-ink-soft text-sm">{labels.empty}</p>
      ) : (
        <ul className="border-line border-t">
          {dateien.map((d) => (
            <Dateizeile key={d.id} d={d} token={token} labels={labels} />
          ))}
        </ul>
      )}
      {offen && (
        <div className="mt-4">
          {/* `multiple`: Wer zehn Zeichnungen hat, wählt sie einmal aus und
              nicht zehnmal. Hinausgeschickt werden sie danach nacheinander. */}
          <Dateiknopf
            text={labels.choose}
            klasse={knopfLeise}
            mehrere
            gesperrt={laeuft}
            nimm={(dateien) => hochladen([...dateien], name)}
          />
        </div>
      )}
    </section>
  )
}

export function Uebergabemappe({
  token,
  labels,
}: {
  token: string
  labels: Dictionary['handover']
}) {
  const [bild, setBild] = useState<Bild | null>(null)
  const [passwort, setPasswort] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [staende, setStaende] = useState<Uploadstand[]>([])
  const [neuerOrdner, setNeuerOrdner] = useState('')

  /*
   * Beim Aufruf still versuchen, ob die Sitzung noch steht.
   *
   * Wer den Link am Vormittag geöffnet hat und mittags nachliefert, soll
   * nicht wieder nach dem Passwort gefragt werden — das Cookie gilt so lange
   * wie der Zugang.
   */
  useEffect(() => {
    let abgebrochen = false
    void fetch(`/api/uebergabe/${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((daten) => {
        if (!abgebrochen && daten) setBild(daten as Bild)
      })
      .catch(() => undefined)
    return () => {
      abgebrochen = true
    }
  }, [token])

  const neuLaden = useCallback(async () => {
    const res = await fetch(`/api/uebergabe/${token}`)
    if (res.ok) setBild((await res.json()) as Bild)
  }, [token])

  async function anmelden(e: React.FormEvent) {
    e.preventDefault()
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch(`/api/uebergabe/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'anmelden', passwort }),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung(daten.error === 'zu-viele-versuche' ? labels.tooMany : labels.denied)
        return
      }
      setBild(daten as Bild)
      setPasswort('')
    } catch {
      setMeldung(labels.error)
    } finally {
      setLaeuft(false)
    }
  }

  async function hochladen(dateien: File[], ordner: string) {
    if (dateien.length === 0) return
    setMeldung(null)
    setLaeuft(true)
    try {
      await auswahlSenden(
        dateien,
        (d) =>
          `/api/uebergabe/${token}/datei?name=${encodeURIComponent(d.name)}&ordner=${encodeURIComponent(ordner)}`,
        setStaende,
      )
      await neuLaden()
    } finally {
      setLaeuft(false)
    }
  }

  async function ordnerAnlegen() {
    const name = neuerOrdner.trim()
    if (!name) return
    setLaeuft(true)
    try {
      const res = await fetch(`/api/uebergabe/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'ordner-anlegen', name }),
      })
      if (res.ok) {
        setNeuerOrdner('')
        await neuLaden()
      } else {
        setMeldung(labels.error)
      }
    } finally {
      setLaeuft(false)
    }
  }

  // ── Noch nicht angemeldet ───────────────────────────────────────────────
  if (!bild) {
    return (
      <form onSubmit={anmelden} className="max-w-md space-y-4">
        <p className="text-ink-soft text-sm leading-relaxed">{labels.intro}</p>
        <input
          type="password"
          required
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          placeholder={labels.password}
          autoComplete="one-time-code"
          // Passwörter aus dem Brief kommen in Großbuchstaben — die Tastatur
          // am Handy soll nicht dazwischenfunken
          autoCapitalize="characters"
          spellCheck={false}
          className={`${eingabe} tracking-[0.3em] uppercase`}
        />
        <button type="submit" disabled={laeuft} className={knopf}>
          {laeuft ? labels.opening : labels.open}
        </button>
        {meldung && <p className="text-ink-soft text-sm">{meldung}</p>}
      </form>
    )
  }

  const ordnerListe = [...bild.ordner]
  // „Ohne Ordner" nur zeigen, wenn dort auch etwas liegt — ein leeres Fach
  // mit diesem Namen sieht aus wie ein Fehler
  const ohneOrdner = bild.dateien.filter((d) => !d.ordner)

  return (
    <div>
      <p className="text-ink-soft text-sm leading-relaxed">{labels.intro}</p>
      {bild.geschlossen && <p className="text-ink mt-4 text-sm">{labels.closed}</p>}

      {ordnerListe.map((name) => (
        <Ordnerblock
          key={name}
          name={name}
          dateien={bild.dateien.filter((d) => d.ordner === name)}
          token={token}
          labels={labels}
          offen={!bild.geschlossen}
          laeuft={laeuft}
          hochladen={(auswahl, ordner) => void hochladen(auswahl, ordner)}
        />
      ))}
      {(ohneOrdner.length > 0 || ordnerListe.length === 0) && (
        <Ordnerblock
          name=""
          dateien={ohneOrdner}
          token={token}
          labels={labels}
          offen={!bild.geschlossen}
          laeuft={laeuft}
          hochladen={(auswahl, ordner) => void hochladen(auswahl, ordner)}
        />
      )}

      {staende.length > 0 && (
        <ul className="border-line mt-8 border-t">
          {staende.map((s) => (
            <li key={s.schluessel} className="border-line border-b py-3 last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-ink truncate text-sm">{s.name}</span>
                <span className="text-ink-soft text-xs">
                  {s.stand === 'fertig'
                    ? labels.uploaded
                    : s.stand === 'fehler'
                      ? (s.fehler ?? labels.failed)
                      : s.stand === 'laeuft'
                        ? `${labels.uploading} ${Math.round((s.getan / Math.max(1, s.bytes)) * 100)} %`
                        : lesbareGroesse(s.bytes)}
                </span>
              </div>
              {/* Ein Balken statt nur einer Zahl: Bei 300 MB ist eine Anzeige
                  ohne sichtbare Bewegung von einer hängenden nicht zu
                  unterscheiden */}
              <div className="bg-line mt-2 h-1 w-full">
                <div
                  className={s.stand === 'fehler' ? 'h-1 bg-bronze' : 'h-1 bg-ink'}
                  style={{
                    width: `${s.stand === 'fertig' ? 100 : Math.round((s.getan / Math.max(1, s.bytes)) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!bild.geschlossen && (
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <input
            value={neuerOrdner}
            onChange={(e) => setNeuerOrdner(e.target.value)}
            placeholder={labels.newFolder}
            className={`${eingabe} max-w-xs`}
          />
          <button
            type="button"
            disabled={laeuft || !neuerOrdner.trim()}
            className={knopfLeise}
            onClick={() => void ordnerAnlegen()}
          >
            {labels.add}
          </button>
        </div>
      )}

      <p className="text-ink-soft mt-6 text-xs leading-relaxed">
        {labels.chooseHint} {labels.kinds}
      </p>
      {meldung && <p className="text-ink-soft mt-4 text-sm">{meldung}</p>}
    </div>
  )
}
