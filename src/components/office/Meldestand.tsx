import React from 'react'
import { Rueckmeldung } from './Rueckmeldung'

/**
 * Was die Kundschaft schon erfahren hat.
 *
 * **Warum das sichtbar sein muss.** Der Auftrag meldet von selbst — in
 * Fertigung, fertig, geliefert. Das ist bequem und hat einen Haken: Man weiß
 * nicht mehr, ob es geklappt hat. Ohne Anzeige sieht „keine Adresse hinterlegt,
 * also nichts verschickt" genauso aus wie „ist informiert", und man erfährt den
 * Unterschied erst, wenn jemand anruft und fragt, wo sein Tor bleibt.
 *
 * Deshalb steht hier, was raus ist — und ausdrücklich auch, was **nicht** raus
 * ist und warum. Die Anmerkung kommt vom Auslöser selbst (`auftragsmeldung.ts`)
 * und ist die einzige Stelle, an der „bitte anrufen" auftaucht.
 */

const NAMEN: Record<string, string> = {
  inFertigung: 'in Fertigung',
  fertig: 'fertig',
  geliefert: 'geliefert',
}

function datum(wert?: string | null): string | null {
  if (!wert) return null
  const d = new Date(wert)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('de-DE')
}

export function Meldestand({
  gemeldet,
}: {
  gemeldet?: {
    inFertigung?: string | null
    fertig?: string | null
    geliefert?: string | null
    hinweis?: string | null
  }
}) {
  const zeilen = (['inFertigung', 'fertig', 'geliefert'] as const)
    .map((k) => ({ was: NAMEN[k], wann: datum(gemeldet?.[k]) }))
    .filter((z) => z.wann)

  const hinweis = gemeldet?.hinweis?.trim()
  if (!zeilen.length && !hinweis) {
    return (
      <p className="buero-unterzeile">
        Noch nichts gemeldet. Sobald der Status wechselt, geht die Nachricht von selbst raus.
      </p>
    )
  }

  return (
    <div className="buero-meldestand">
      {zeilen.map((z) => (
        <div key={z.was} className="buero-unterzeile">
          <span className="buero-marker gut">gemeldet</span> {z.was} · {z.wann}
        </div>
      ))}
      {/*
        * Die Anmerkung steht bewusst hervorgehoben: Sie ist entweder ein
        * Hindernis („keine E-Mail") oder eine Einschränkung („ohne
        * Sendungsnummer"). Beides will man sehen, ohne danach zu suchen.
        */}
      <Rueckmeldung text={hinweis} />
    </div>
  )
}
