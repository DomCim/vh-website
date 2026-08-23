import React from 'react'

import { Statistikreiter } from '../../../../../components/office/Statistikreiter'
import { besucheLesen, besuchszugang, type Besuch, type Besuchsliste } from '../../../../../lib/besuche'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'
import { dauerText, istZeitraum, ZEITRAEUME, type Zeitraum } from '../../../../../lib/statistik'

export const dynamic = 'force-dynamic'

/**
 * Einzelne Besuche — woher jemand kam und was er sich angesehen hat.
 *
 * Die Seite nebenan zeigt Summen: wie viele kamen, welche Seiten oben stehen,
 * aus welchem Land. Das beantwortet die Frage nach dem Betrieb, aber nicht
 * die, die man sich beim Zusehen stellt: Der eine, der gestern Abend über
 * Google kam — hat der die Gartenbank angesehen und dann aufgehört, oder ist
 * er über drei Seiten bis zur Anfrage gegangen?
 *
 * Beides zusammen ergibt erst ein Bild. Deshalb steht es hier und nicht in
 * der Übersicht: Es ist eine andere Frage, es dauert länger (die Ereignisse
 * werden einzeln gelesen), und wenn der Zugang dorthin fehlt, sollen davon
 * nicht die Zahlen mit ausfallen.
 *
 * Wer hier steht, ist trotzdem niemand: Die Kennung ist Plausibles
 * Sitzungsnummer und hält einen halben Tag. Kein Name, keine Adresse, kein
 * Cookie — nur ein Weg über die Seite.
 */

const uhrzeit = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
})

export default async function BesucheSeite({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string }>
}) {
  await bueroBenutzer('website.pflegen')
  const { zeitraum: gewuenscht } = await searchParams
  // Sieben Tage als Vorgabe, wenn niemand etwas anderes sagt: Einzelne Wege
  // sieht man sich an, solange man noch weiß, was in der Zeit war — ein Jahr
  // davon liest niemand. Kommt man von der Zusammenfassung, bringt der Reiter
  // deren Zeitraum mit, und der gilt dann.
  const zeitraum: Zeitraum = istZeitraum(gewuenscht) ? gewuenscht : '7t'

  const payload = await payloadClient()
  const zugang = await besuchszugang(payload)

  let liste: Besuchsliste | null = null
  let fehler: string | null = null
  if (zugang) {
    const seit = new Date(Date.now() - ZEITRAEUME[zeitraum].tage * 24 * 60 * 60 * 1000)
    try {
      liste = await besucheLesen(zugang, seit)
    } catch (err) {
      fehler = err instanceof Error ? err.message : String(err)
      payload.logger.warn({ err }, 'Einzelne Besuche konnten nicht gelesen werden')
    }
  }

  return (
    <>
      {/*
        * „Statistik" und nicht „Einzelne Besuche": Es sind zwei Ansichten auf
        * dieselbe Sache, und die Überschrift ist am Handy zugleich der Titel
        * in der Kopfleiste. Welche Ansicht offen ist, sagt der Reiter darunter.
        */}
      <h1>Statistik</h1>
      <p className="buero-unterzeile">
        Woher jemand kam und was er sich der Reihe nach angesehen hat.
      </p>

      <Statistikreiter ansicht="besuche" zeitraum={zeitraum} />

      {!zugang ? (
        <div className="buero-hinweis warn" style={{ marginTop: '1rem' }}>
          <strong>Noch nicht eingerichtet.</strong> Einzelne Wege stehen nicht in der Auswertung,
          sondern in Plausibles Ereignis-Datenbank. Deren Adresse gehört in die Website-Verwaltung
          unter Integrationen → Besucherzählung; dazu muss der Container ins Netz der Statistik
          dürfen (im Statistik-Stack beim Dienst <code>plausible_events_db</code> das Netz{' '}
          <code>website</code> ergänzen).
        </div>
      ) : fehler ? (
        <div className="buero-hinweis warn" style={{ marginTop: '1rem' }}>
          <strong>Die Ereignis-Datenbank antwortet nicht.</strong> {fehler}
        </div>
      ) : liste && liste.besuche.length === 0 ? (
        <p className="buero-leer" style={{ marginTop: '1rem' }}>
          In diesem Zeitraum war niemand da.
        </p>
      ) : liste ? (
        <>
          <div className="buero-besuche">
            {liste.besuche.map((b) => (
              <Besuchskarte key={`${b.kennung}-${b.beginn}`} besuch={b} />
            ))}
          </div>
          {liste.angeschnitten ? (
            <p className="buero-leer" style={{ marginTop: '1rem' }}>
              Es wurden die letzten {liste.zeilen} Aufrufe gelesen — bei älteren Besuchen kann der
              Anfang des Weges fehlen. Für einen vollständigen Blick einen kürzeren Zeitraum wählen.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  )
}

function Besuchskarte({ besuch }: { besuch: Besuch }) {
  const merkmale = [besuch.land, besuch.geraet, besuch.browser].filter(Boolean)
  return (
    <div className="buero-karte buero-besuch">
      <div className="buero-besuch-kopf">
        <span className="buero-besuch-zeit">{uhrzeit.format(new Date(besuch.beginn * 1000))}</span>
        {/* „von Direkt" wäre kein Satz — ohne Verweis heißt es schlicht direkt:
            eingetippt, aus einem Lesezeichen oder aus einer App heraus. */}
        <span className="buero-besuch-herkunft">
          {besuch.herkunft === 'Direkt' ? 'Direkt' : `von ${besuch.herkunft}`}
        </span>
        <span className="buero-besuch-rest">
          {besuch.schritte.length === 1 ? 'eine Seite' : `${besuch.schritte.length} Seiten`}
          {besuch.dauer > 0 ? ` · ${dauerText(besuch.dauer)}` : null}
          {merkmale.length ? ` · ${merkmale.join(' · ')}` : null}
        </span>
      </div>
      {/*
        * Der Weg als Kette: Was zuerst kam, steht links. Am Handy bricht sie
        * um, statt seitlich aus dem Bild zu laufen — die Reihenfolge liest
        * man dann zeilenweise weiter, wie einen Satz.
        */}
      <ol className="buero-besuch-weg">
        {besuch.schritte.map((s, i) => (
          <li key={i}>
            <span className="buero-besuch-seite">{s.art ? `${s.art}: ${s.pfad}` : s.pfad}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
