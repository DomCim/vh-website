import React from 'react'

import { Rechtstexte } from '../../../../components/office/Rechtstexte'

/**
 * Impressum, AGB, Widerruf & Co. — dort, wo der Betrieb arbeitet.
 *
 * Bisher lagen diese Texte allein im Admin-Panel, also in einer anderen
 * Oberfläche mit anderem Aufbau, und in drei Sprachfassungen, die einzeln
 * umgestellt und einzeln gespeichert werden mussten. Wer im Büro merkt, dass
 * im Impressum noch ein Platzhalter steht, soll ihn dort ersetzen können, wo
 * er es merkt.
 *
 * Ohne Netz geht das nicht — wie bei den Einstellungen und aus demselben
 * Grund: Ein Rechtstext, den man offline ändert, wäre eine Falle. Man ginge
 * davon aus, er stünde draußen.
 */
export default function RechtlichesSeite() {
  return (
    <>
      <h1>Rechtstexte</h1>
      <p className="buero-unterzeile">
        Was auf den Rechtsseiten der Website steht — in allen drei Sprachen. Änderungen sind
        sofort draußen sichtbar.
      </p>
      <Rechtstexte />
    </>
  )
}
