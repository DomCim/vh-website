import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../../lib/data'
import { bueroBenutzer } from '../../../../lib/office'
import {
  auswertung,
  dauerText,
  istZeitraum,
  statistikzugang,
  type Auswertung,
  type Reihe,
  ZEITRAEUME,
  type Zeitraum,
} from '../../../../lib/statistik'

export const dynamic = 'force-dynamic'

/**
 * Wer war auf der Website — und was hat er sich angesehen.
 *
 * Die Zahlen liegen in der eigenen Statistik nebenan und werden hier gelesen.
 * Sie steht bewusst nur im internen Netz: Wer sie sehen will, meldet sich im
 * Büro an. Ein zweiter Zugang mit zweitem Passwort, den man einmal einrichtet
 * und dann vergisst, wäre die schlechtere Lösung — auch für die Sicherheit.
 *
 * Diese Seite ist die einzige im Büro, die ohne Netz nichts zeigen kann: Sie
 * fragt live nach. Das ist in Ordnung — eine Besucherzahl braucht niemand in
 * der Werkstatt, und für alles, was man dort braucht, gibt es den Bestand im
 * Gerät.
 */

const zahlText = (wert: number) => new Intl.NumberFormat('de-DE').format(Math.round(wert))

/** Eine Nachkommastelle, mit Komma — „3.7" liest sich hier wie ein Tippfehler */
const kommaText = (wert: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    wert,
  )

export default async function StatistikSeite({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string }>
}) {
  await bueroBenutzer('website.pflegen')
  const { zeitraum: gewuenscht } = await searchParams
  const zeitraum: Zeitraum = istZeitraum(gewuenscht) ? gewuenscht : '30t'

  const payload = await payloadClient()
  const zugang = await statistikzugang(payload)

  let daten: Auswertung | null = null
  let fehler: string | null = null
  if (zugang) {
    try {
      daten = await auswertung(zugang, zeitraum, new Date())
    } catch (err) {
      fehler = err instanceof Error ? err.message : String(err)
      payload.logger.warn({ err }, 'Statistik konnte nicht gelesen werden')
    }
  }

  return (
    <>
      <h1>Statistik</h1>
      <p className="buero-unterzeile">
        Besuche auf vincent-hellmann.com — gezählt ohne Cookies, auf dem eigenen Server.
      </p>

      <div className="buero-reiter">
        {(Object.keys(ZEITRAEUME) as Zeitraum[]).map((z) => (
          <Link
            key={z}
            href={`/office/statistik?zeitraum=${z}`}
            aria-current={z === zeitraum ? 'page' : undefined}
          >
            {ZEITRAEUME[z].label}
          </Link>
        ))}
      </div>

      {!zugang ? (
        <div className="buero-hinweis warn" style={{ marginTop: '1rem' }}>
          <strong>Noch nicht eingerichtet.</strong> Adresse, Seitenname und Schlüssel stehen in der
          Website-Verwaltung unter Integrationen → Besucherzählung. Gezählt wird davon unabhängig,
          sobald der Haken in den Website-Einstellungen gesetzt ist — hier fehlt nur der Zugang zum
          Lesen der Zahlen.
        </div>
      ) : fehler ? (
        <div className="buero-hinweis warn" style={{ marginTop: '1rem' }}>
          <strong>Die Statistik antwortet nicht.</strong> {fehler}
        </div>
      ) : daten ? (
        <Zahlen daten={daten} />
      ) : null}
    </>
  )
}

function Zahlen({ daten }: { daten: Auswertung }) {
  return (
    <>
      <div className="buero-kacheln" style={{ marginTop: '1rem' }}>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Besucher</div>
          <div className="buero-kachel-wert">{zahlText(daten.kennzahlen.besucher)}</div>
          <div className="buero-kachel-fuss">
            {daten.von} bis {daten.bis}
          </div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Seitenaufrufe</div>
          <div className="buero-kachel-wert">{zahlText(daten.kennzahlen.aufrufe)}</div>
          <div className="buero-kachel-fuss">
            {daten.kennzahlen.besucher
              ? `${kommaText(daten.kennzahlen.aufrufe / daten.kennzahlen.besucher)} je Besucher`
              : '—'}
          </div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Verweildauer</div>
          <div className="buero-kachel-wert">{dauerText(daten.kennzahlen.dauer)}</div>
          <div className="buero-kachel-fuss">im Schnitt je Besuch</div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Nur eine Seite</div>
          <div className="buero-kachel-wert">{Math.round(daten.kennzahlen.absprung)} %</div>
          {/* „Absprungrate" sagt außerhalb der Marketingwelt niemandem etwas —
              gemeint ist: angesehen und wieder weg, ohne weiterzuklicken. */}
          <div className="buero-kachel-fuss">angesehen und wieder weg</div>
        </div>
      </div>

      <Verlauf tage={daten.verlauf} />

      <div className="buero-statistik-spalten">
        <Liste titel="Meistbesuchte Seiten" reihen={daten.seiten} />
        <Liste titel="Woher sie kommen" reihen={daten.quellen} />
        <Liste titel="Aus welchem Land" reihen={daten.laender} />
        <Liste titel="Womit sie lesen" reihen={daten.geraete} />
      </div>
    </>
  )
}

/**
 * Der Verlauf als Balken.
 *
 * Bewusst ohne Diagramm-Bibliothek: Ein paar `div` mit Höhe in Prozent tun
 * dasselbe, kosten kein zusätzliches Paket im Browser und funktionieren auch
 * dann, wenn das Büro gerade schmal ist.
 */
function Verlauf({ tage }: { tage: { tag: string; besucher: number }[] }) {
  if (!tage.length) return null
  const hoechst = Math.max(...tage.map((t) => t.besucher), 1)

  return (
    <div className="buero-karte" style={{ marginTop: '1rem' }}>
      <div className="buero-kachel-titel">Verlauf</div>
      <div className="buero-verlauf" role="img" aria-label={verlaufBeschreibung(tage)}>
        {tage.map((t) => (
          <div
            key={t.tag}
            className="buero-verlauf-balken"
            /*
             * Ein Tag ohne Besuch bekommt keinen Balken. Wo einer war, bleibt
             * mindestens ein Strich stehen — sonst verschwindet der einzelne
             * Besucher neben einem Tag mit dreihundert, und der Verlauf sähe
             * aus, als wäre gar nichts gewesen.
             */
            style={{
              height: t.besucher ? `${Math.max((t.besucher / hoechst) * 100, 3)}%` : '0',
            }}
            title={`${t.tag}: ${zahlText(t.besucher)}`}
          />
        ))}
      </div>
      <div className="buero-verlauf-achse">
        <span>{tage[0]?.tag}</span>
        <span>Höchstwert {zahlText(hoechst)}</span>
        <span>{tage[tage.length - 1]?.tag}</span>
      </div>
    </div>
  )
}

/*
 * Balken sind für einen Screenreader nichts. Deshalb steht daneben in einem
 * Satz, was zu sehen ist — nicht Tag für Tag, das läse niemand vor.
 */
function verlaufBeschreibung(tage: { tag: string; besucher: number }[]): string {
  const summe = tage.reduce((s, t) => s + t.besucher, 0)
  const beste = tage.reduce((a, b) => (b.besucher > a.besucher ? b : a), tage[0])
  return `Verlauf über ${tage.length} Tage, insgesamt ${zahlText(summe)} Besucher. Stärkster Tag: ${beste.tag} mit ${zahlText(beste.besucher)}.`
}

function Liste({ titel, reihen }: { titel: string; reihen: Reihe[] }) {
  const hoechst = Math.max(...reihen.map((r) => r.besucher), 1)
  return (
    <div className="buero-karte">
      <div className="buero-kachel-titel">{titel}</div>
      {reihen.length === 0 ? (
        <p className="buero-leer">Noch nichts gezählt.</p>
      ) : (
        <div className="buero-statistik-liste">
          {reihen.map((r) => (
            <div key={r.name} className="buero-statistik-zeile">
              {/* Der Balken liegt hinter dem Text, nicht daneben: So bleibt der
                  Name lesbar, auch wenn er lang ist und die Spalte schmal. */}
              <span
                className="buero-statistik-balken"
                style={{ width: `${(r.besucher / hoechst) * 100}%` }}
                aria-hidden="true"
              />
              <span className="buero-statistik-name">{r.name}</span>
              <span className="buero-statistik-wert">{zahlText(r.besucher)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
