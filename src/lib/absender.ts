import type { Field, Payload, PayloadRequest } from 'payload'

import type { CompanyInfo } from './mail'
import { firmenAngaben } from './settings'

/**
 * Die eigenen Firmenangaben, wie sie zum Zeitpunkt des Festschreibens galten.
 *
 * **Warum das überhaupt sein muss.** Anschrift, Rechtsform, USt-IdNr, SIRET,
 * IBAN und Zahlungsziel standen bis hierher nur an einer Stelle: in den
 * Einstellungen. Jedes Blatt holte sie sich beim Bauen von dort — und weil
 * jedes Blatt beim Anschauen neu gebaut wird, trug eine drei Jahre alte
 * Rechnung heute die Bankverbindung von heute. Auf dem Papier, im GiroCode
 * und in der eingebetteten Factur-X-XML.
 *
 * Zieht der Betrieb um, wechselt die Bank oder ändert sich die Rechtsform,
 * dann gilt das ab dann. Was auf einem festgeschriebenen Beleg steht, ist
 * dagegen eine Aussage über einen Tag in der Vergangenheit und darf sich
 * nicht mehr bewegen.
 *
 * **Warum ein einziges JSON-Feld und keine fünfzehn Spalten.** Es ist eine
 * Abschrift, kein Formular: Niemand bearbeitet sie einzeln, niemand sucht
 * danach. Kommt in den Einstellungen eine Angabe dazu, ist sie ohne
 * Wanderung des Schemas mit im Abzug — und die Sammlungen, die eine Abschrift
 * führen, brauchen dafür je genau eine Spalte.
 */
export type Absender = CompanyInfo

/** Die Firmenangaben von jetzt — beim Festschreiben einmal abzuschreiben. */
export async function absenderAbschrift(
  payload: Payload,
  req?: PayloadRequest,
): Promise<Absender> {
  const settings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    ...(req ? { req } : {}),
  })
  return firmenAngaben(settings)
}

/**
 * Der Absender eines Belegs: die Abschrift, sonst die heutigen Einstellungen.
 *
 * Der Rückfall gilt Belegen aus der Zeit vor dieser Umstellung. Für sie ist
 * nicht mehr feststellbar, was damals auf dem Blatt stand; das Heutige ist
 * dann das einzig Verfügbare — und genau das, was sie ohnehin schon die ganze
 * Zeit zeigen.
 */
export async function absenderVon(
  payload: Payload,
  abschrift: unknown,
): Promise<Absender> {
  if (abschrift && typeof abschrift === 'object' && !Array.isArray(abschrift)) {
    return abschrift as Absender
  }
  return absenderAbschrift(payload)
}

/**
 * Das Feld für die Abschrift — gleich in Rechnung, Angebot und Auftrag.
 *
 * Eine Funktion und keine Konstante: Payload arbeitet die Feldbeschreibungen
 * beim Hochfahren um und schreibt dabei in sie hinein. Ein und dasselbe Objekt
 * in drei Sammlungen wäre dreimal dasselbe Stück Papier.
 */
export function absenderFeld(): Field {
  return {
    name: 'absender',
    label: 'Firmenangaben beim Festschreiben',
    type: 'json',
    admin: {
      readOnly: true,
      description:
        'Abschrift der eigenen Anschrift, Steuernummern und Bankverbindung zu dem Zeitpunkt, ' +
        'an dem der Beleg festgeschrieben wurde. Der Beleg wird daraus gezeichnet und ändert ' +
        'sich deshalb nicht mehr, wenn die Einstellungen sich ändern.',
    },
  }
}

/** Das Feld mit dem Namen der abgelegten PDF-Datei — siehe `lib/belegablage.ts`. */
export function ablageFeld(beschreibung: string): Field {
  return {
    name: 'pdfAblage',
    label: 'Abgelegtes PDF',
    type: 'text',
    admin: { readOnly: true, description: beschreibung },
  }
}
