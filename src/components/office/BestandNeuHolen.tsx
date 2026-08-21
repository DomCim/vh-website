'use client'

import React, { useState } from 'react'

import { bestandNeuHolen } from '../../lib/buero/bestand'

/**
 * Die Notbremse: alles noch einmal holen.
 *
 * **Wofür.** Das Büro führt seinen Bestand im Gerät mit und lässt sich vom
 * Server nur das Neue nachschicken. Fehlt darin einmal etwas, fällt es von
 * selbst nicht wieder auf — die nächste Frage lautet ja „was ist seit meinem
 * Stand passiert?", und was älter ist als der Stand, kommt nie mehr mit.
 *
 * Genau das ist passiert: Ein Rechnungsentwurf entstand in einer noch offenen
 * Transaktion, der Abgleich fragte im selben Augenblick, bekam ihn nicht und
 * merkte sich trotzdem den neuen Zeitpunkt. Die Ursache ist behoben (siehe
 * `neuerStand` in lib/bereiche.ts), und die Geräte drehen ihre Stände einmalig
 * zurück. Dieser Knopf bleibt trotzdem: Wer weiß, dass etwas fehlt, soll es
 * holen können, ohne sich abzumelden.
 *
 * **Was er nicht tut.** Abmelden. Das Gerüst für den Betrieb ohne Netz bleibt
 * liegen — es geht hier um die Daten, nicht um den Zugang.
 */
export function BestandNeuHolen() {
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState(false)

  const holen = async () => {
    setLaeuft(true)
    setFertig(false)
    try {
      await bestandNeuHolen()
      setFertig(true)
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="buero-karte">
      <h2>Bestand neu holen</h2>
      <p className="buero-unterzeile">
        Wirft die Daten in diesem Gerät weg und holt sie vollständig neu. Braucht Netz und ein paar
        Sekunden. Sinnvoll, wenn etwas fehlt, von dem Sie wissen, dass es da sein müsste — angemeldet
        bleiben Sie.
      </p>
      <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void holen()}>
        {laeuft ? 'Wird geholt …' : 'Bestand neu holen'}
      </button>
      {fertig && (
        <p className="buero-unterzeile" role="status">
          Alles neu geholt.
        </p>
      )}
    </div>
  )
}
