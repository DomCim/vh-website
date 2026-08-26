'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { einsetzen, fehlendePflicht, VORLAGEN, type VorlagenArt } from '../../lib/mailvorlagen'
import { Rueckmeldung } from './Rueckmeldung'
import { Schreibfeld } from './Schreibfeld'

/**
 * Die Texte der automatischen Mails, im Büro bearbeitbar.
 *
 * Bisher stand jeder Satz im Code: „Guten Tag" statt „Hallo" war ein Commit
 * und ein Ausrollen. Für Text, den der Betrieb schreibt, ist das der falsche
 * Weg — hier steht er jetzt, mit demselben Schreibfeld wie im Postfach.
 *
 * **Leer heißt: die eingebaute Fassung gilt.** Wer nichts hinterlegt, bekommt
 * die Mail wie bisher; wer eine Vorlage wieder loswerden will, nimmt den
 * Haken heraus statt den Text zu löschen. So bleibt der Wortlaut erhalten,
 * falls es doch wieder gebraucht wird.
 *
 * Ohne Netz geht das nicht — wie die übrigen Einstellungen. Ein Text, den man
 * offline ändert und der später über eine neuere Fassung läuft, wäre eine
 * Falle.
 */

type Eintrag = {
  art: string
  betreff?: string | null
  inhalt?: string | null
  aktiv?: boolean | null
}

/** Beispielwerte für die Vorschau — damit man sieht, was ankommt. */
const BEISPIEL: Record<string, string> = {
  kunde: 'Stadt Naila',
  name: 'Stadt Naila',
  email: 'bauamt@naila.de',
  telefon: '09282 1234',
  bestellnummer: 'VH-2026-0042',
  auftragsnummer: 'AU-2026-0042',
  nummer: 'RE-2026-0042',
  titel: 'Sitzbank Cortenstahl, 2,00 m',
  betrag: '1.190,00 €',
  einnahmen: '12.480,00 €',
  ausgaben: '3.905,00 €',
  dateien: '18',
  monat: 'August 2026',
  stufe: 'Zahlungserinnerung',
  faelligAm: '15.09.2026',
  faelligWar: '24.08.2026',
  gueltigBis: '30.09.2026',
  fertigBis: '19.09.2026',
  tage: '12',
  /* Blöcke: fertiges HTML, in der Vorschau angedeutet */
  positionen:
    '<table style="width:100%;font-size:13px;border-top:1px solid #ddd;border-bottom:1px solid #ddd"><tr><td style="padding:6px 0">1× Sitzbank Cortenstahl</td><td style="text-align:right">1.190,00 €</td></tr></table>',
  anschrift: 'Stadt Naila<br>Marktplatz 1<br>95119 Naila',
  nachricht:
    '<p style="border-left:3px solid #a5622d;padding-left:12px">Guten Tag, wir bräuchten ein Angebot für zwei Bänke.</p>',
  sendung: '<p><strong>Sendungsnummer:</strong> 00340434123456789012</p>',
  statuslink: '<p style="font-size:13px"><a href="#" style="color:#a5622d">Stand der Bestellung ansehen</a></p>',
  fertigungshinweis: '<p style="color:#666;font-size:13px">Handarbeit — die Fertigung dauert etwa drei Wochen.</p>',
  knopf: '<p><a href="#" style="background:#1d1d1f;color:#fff;padding:12px 22px;text-decoration:none;display:inline-block">Ein paar Sätze schreiben</a></p>',
  hinweise: '<p style="font-size:13px;color:#666">Der Buchungsstapel für DATEV hängt mit an.</p>',
  gruss: '<p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>',
}

export function MailVorlagen() {
  const [gewaehlt, setGewaehlt] = useState<VorlagenArt>(VORLAGEN[0]!.art)
  const [eintraege, setEintraege] = useState<Record<string, Eintrag>>({})
  const [laedt, setLaedt] = useState(true)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [vorschau, setVorschau] = useState(false)

  const beschreibung = VORLAGEN.find((v) => v.art === gewaehlt)!
  const eintrag = eintraege[gewaehlt] ?? { art: gewaehlt, aktiv: true }

  useEffect(() => {
    void (async () => {
      try {
        const antwort = await fetch('/api/office/einstellungen?bereich=integrationen', {
          credentials: 'include',
        })
        const daten = (await antwort.json()) as {
          werte?: { de?: { mailvorlagen?: Eintrag[] } }
        }
        const liste = daten.werte?.de?.mailvorlagen ?? []
        setEintraege(Object.fromEntries(liste.filter((v) => v?.art).map((v) => [v.art, v])))
      } catch {
        setMeldung('Die Vorlagen konnten nicht geladen werden — ohne Netz geht das nicht.')
      } finally {
        setLaedt(false)
      }
    })()
  }, [])

  /*
   * Was fehlt, steht am Feld — nicht erst nach dem Speichern.
   *
   * Ein Pflicht-Platzhalter, der gelöscht wurde, macht die Mail unbrauchbar:
   * eine Versandmail ohne Sendungsnummer, eine Rechnungsmail ohne Betrag. Der
   * Server weist die Vorlage dann ab und verschickt die eingebaute Fassung —
   * das soll man vorher wissen und nicht daraus schließen, dass die Mail
   * anders aussieht als gedacht.
   */
  const fehlt = useMemo(
    () => (eintrag.inhalt ? fehlendePflicht(gewaehlt, eintrag.inhalt) : []),
    [eintrag.inhalt, gewaehlt],
  )

  const setzen = (teil: Partial<Eintrag>) =>
    setEintraege((v) => ({ ...v, [gewaehlt]: { ...eintrag, ...teil, art: gewaehlt } }))

  async function speichern() {
    setLaeuft(true)
    setMeldung(null)
    try {
      // Nur, was auch Inhalt hat: Ein leerer Eintrag je Mail wäre Ballast im
      // Datensatz und würde beim Lesen wie eine gesetzte Vorlage aussehen.
      const liste = Object.values(eintraege).filter((v) => v.inhalt?.trim() || v.betreff?.trim())
      const antwort = await fetch('/api/office/einstellungen', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bereich: 'integrationen', werte: { de: { mailvorlagen: liste } } }),
      })
      if (!antwort.ok) throw new Error(String(antwort.status))
      setMeldung(
        fehlt.length
          ? `Gespeichert — aber ${fehlt.map((f) => `{{${f}}}`).join(', ')} fehlt noch. Solange geht die eingebaute Fassung hinaus.`
          : 'Gespeichert. Die nächste Mail dieser Art nimmt den neuen Text.',
      )
    } catch {
      setMeldung('Speichern fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  if (laedt) return <div className="buero-leer">wird geholt …</div>

  return (
    <>
      <h2>Mail-Vorlagen</h2>
      <p className="buero-unterzeile">
        Die Texte der automatischen Mails. Was hier leer bleibt, geht wie bisher hinaus — Briefkopf,
        Corten-Strich und Pflichtangaben kommen immer automatisch dazu.
      </p>

      {/* Die Auswahl als Liste und nicht als Aufklappfeld: Sechzehn Mails sind
          zu viele für ein Menü, und am Handy trifft man eine Zeile besser als
          einen Eintrag in einer Liste, die sich über den halben Schirm legt. */}
      <label className="buero-feld">
        <span>Welche Mail</span>
        <select value={gewaehlt} onChange={(e) => setGewaehlt(e.target.value as VorlagenArt)}>
          {VORLAGEN.map((v) => (
            <option key={v.art} value={v.art}>
              {v.titel}
              {eintraege[v.art]?.inhalt?.trim() ? ' — geändert' : ''}
              {v.anKundschaft ? '' : ' (intern)'}
            </option>
          ))}
        </select>
      </label>

      <p className="buero-unterzeile" style={{ marginTop: '-.4rem' }}>
        {beschreibung.anlass}
      </p>

      <label className="buero-feld">
        <span>Betreff</span>
        <input
          value={eintrag.betreff ?? ''}
          disabled={laeuft}
          onChange={(e) => setzen({ betreff: e.target.value })}
          placeholder="leer = der eingebaute Betreff"
        />
      </label>

      <label className="buero-feld">
        <span>Text der Mail</span>
      </label>
      <Schreibfeld
        wert={eintrag.inhalt ?? ''}
        aendern={(html) => setzen({ inhalt: html })}
        platzhalter="Guten Tag {{kunde}}, …"
      />

      {fehlt.length > 0 && (
        <p className="buero-hinweis warn" style={{ marginTop: '.8rem' }}>
          <strong>
            {fehlt.length === 1 ? 'Ein Platzhalter fehlt' : `${fehlt.length} Platzhalter fehlen`}:{' '}
            {fehlt.map((f) => `{{${f}}}`).join(', ')}.
          </strong>{' '}
          Ohne ihn wäre die Mail unvollständig — solange geht die eingebaute Fassung hinaus. Unten
          antippen fügt ihn ein.
        </p>
      )}

      <h3 style={{ marginTop: '1.4rem' }}>Platzhalter</h3>
      <p className="buero-unterzeile" style={{ marginTop: '-.4rem' }}>
        Antippen kopiert ihn — im Text an die Stelle einfügen, an die er gehört.
      </p>
      <div className="buero-liste">
        {beschreibung.platzhalter.map((p) => (
          <button
            key={p.name}
            type="button"
            className="buero-zeile"
            style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`{{${p.name}}}`)
                .then(() => setMeldung(`{{${p.name}}} kopiert.`))
                .catch(() => setMeldung(`Bitte {{${p.name}}} von Hand tippen.`))
            }}
          >
            <div className="buero-zeile-haupt">
              <div className="buero-zeile-titel">
                {`{{${p.name}}}`}
                {p.pflicht ? ' · nötig' : ''}
              </div>
              <div className="buero-zeile-neben">{p.erklaerung}</div>
            </div>
            {p.block && <span className="buero-marker">eigene Zeile</span>}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1.2rem' }}>
        <button
          type="button"
          className="buero-knopf leise"
          onClick={() => setVorschau((v) => !v)}
        >
          {vorschau ? 'Vorschau zu' : 'Vorschau ansehen'}
        </button>
        <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.88rem' }}>
          <input
            type="checkbox"
            checked={eintrag.aktiv !== false}
            disabled={laeuft}
            onChange={(e) => setzen({ aktiv: e.target.checked })}
          />
          Diese Vorlage benutzen
        </label>
      </div>

      {vorschau && (
        <div className="buero-karte" style={{ marginTop: '.8rem', background: '#fff' }}>
          <p className="buero-unterzeile" style={{ marginTop: 0 }}>
            Mit Beispieldaten — so kommt die Mail an. Briefkopf und Fußzeile fehlen hier.
          </p>
          <div
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: 14,
              lineHeight: 1.55,
              color: '#1d1d1f',
            }}
            // Der Text kommt aus dem eigenen Schreibfeld und geht durch
            // dieselbe Reinigung wie jede Mail — hier steht er nur zur Ansicht.
            dangerouslySetInnerHTML={{
              __html: einsetzen(eintrag.inhalt || '<p><em>Noch kein Text.</em></p>', BEISPIEL),
            }}
          />
        </div>
      )}

      <Rueckmeldung text={meldung} />

      <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void speichern()}>
        {laeuft ? 'wird gespeichert …' : 'Vorlagen speichern'}
      </button>
    </>
  )
}
