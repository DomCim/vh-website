'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { useBestand } from '../../lib/buero/bestand'
import { anschriftAus } from '../../lib/kundenabschrift'

/**
 * Name und Anschrift des Kunden — solange nichts gestellt ist, folgen sie dem
 * Geschäftspartner.
 *
 * **Der Vorgang, der das ausgelöst hat.** Ein Kunde schreibt: „Bitte die
 * Rechnungsadresse ändern auf Majer GmbH & Co. KG, Albert-Schweitzer-Str. 59."
 * Vincent trägt es beim Partner nach — und der Rechnungsentwurf merkt davon
 * nichts. Er trug eine Abschrift, die beim Anlegen entstanden war. Daneben
 * stand weiterhin der alte Name, und auf dem Papier landete der.
 *
 * **Warum es überhaupt eine Abschrift gibt.** Was auf einem gestellten Beleg
 * steht, gehört zu dem Tag, an dem er entstand. Zieht der Kunde um, darf die
 * Rechnung von letztem Jahr sich nicht mitbewegen — sie liegt in seiner
 * Buchhaltung. Dieselbe Überlegung wie beim Absender.
 *
 * **Der Fehler war, das schon für den Entwurf zu tun.** Ein Entwurf ist noch
 * nichts; da ist nichts einzufrieren. Deshalb:
 *
 *  - **Entwurf mit Partner** — Name und Anschrift folgen ihm. Wird der Partner
 *    geändert, ändert sich der Entwurf mit.
 *  - **Abweichend** — auf ausdrücklichen Klick. Für „z.Hd. Buchhaltung" oder
 *    eine andere Firmierung. Sichtbar, nicht heimlich.
 *  - **Gestellt** — eingefroren, wie bisher. Hier fasst niemand mehr etwas an.
 *  - **Ohne Partner** — freier Text wie bisher.
 *
 * Weicht der gespeicherte Wert beim Öffnen vom Partner ab, fängt die Anzeige
 * im abweichenden Zustand an: Ein bestehender Entwurf soll sich nicht
 * überraschend selbst umschreiben, während jemand draufsieht.
 */

type Partner = {
  id: number | string
  name?: string | null
  ansprechpartner?: string | null
  line1?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  vatId?: string | null
  siret?: string | null
}

export type Kundenangaben = {
  customerName?: string | null
  customerAddress?: string | null
  customerSiret?: string | null
  customerVatId?: string | null
}

/** Was der Partner für die Papiere hergibt. */
export function angabenAus(p: Partner): Kundenangaben {
  return {
    customerName: p.name ?? '',
    customerAddress: anschriftAus(p),
    customerSiret: p.siret ?? '',
    customerVatId: p.vatId ?? '',
  }
}

const gleich = (a: Kundenangaben, b: Kundenangaben) =>
  (a.customerName ?? '') === (b.customerName ?? '') &&
  (a.customerAddress ?? '') === (b.customerAddress ?? '')

export function KundenAngaben({
  partnerId,
  werte,
  aendern,
  gesperrt = false,
  /**
   * Welcher Teil hier gezeichnet wird. Das Rechnungsformular führt den Namen
   * oben bei der Partnerwahl und die Anschrift weiter unten — dazwischen
   * liegen Datum und Fälligkeit. Der Hinweis über eine Abweichung hängt am
   * letzten gezeichneten Teil, damit er genau einmal erscheint.
   *
   */
  teil = 'beides',
  /**
   * Welche Felder dieses Formular überhaupt führt — davon hängt ab, was
   * übernommen wird, nicht was zu sehen ist. Der Auftrag kennt nur den Namen;
   * ihm eine Anschrift zuzuschieben, die er nirgends speichert, wäre ein
   * stiller Fehlschlag.
   */
  fuehrt = 'alles',
}: {
  partnerId: number | string | null | undefined
  werte: Kundenangaben
  aendern: (teil: Kundenangaben) => void
  gesperrt?: boolean
  teil?: 'beides' | 'name' | 'anschrift'
  fuehrt?: 'alles' | 'name'
}) {
  const partner = useBestand<Partner>('partner')
  const gewaehlt = useMemo(
    () => (partnerId ? partner.find((p) => String(p.id) === String(partnerId)) : undefined),
    [partner, partnerId],
  )
  const vomPartner = gewaehlt ? angabenAus(gewaehlt) : null

  const nurName = fuehrt === 'name'
  /** Was dieses Formular vom Partner übernehmen kann. */
  const uebernehmen = (von: Kundenangaben) =>
    nurName ? { customerName: von.customerName } : von

  const [abweichend, setAbweichend] = useState(
    () =>
      Boolean(
        vomPartner &&
          werte.customerName?.trim() &&
          (nurName
            ? (werte.customerName ?? '') !== (vomPartner.customerName ?? '')
            : !gleich(werte, vomPartner)),
      ),
  )

  /*
   * Der Abgleich läuft in einem Effekt und nicht beim Zeichnen: Ein Formular,
   * das während des Zeichnens seinen eigenen Zustand ändert, dreht sich im
   * Kreis. Losgetreten wird er nur, wenn sich wirklich etwas unterscheidet.
   */
  useEffect(() => {
    if (gesperrt || abweichend || !vomPartner) return
    const stimmt = nurName
      ? (werte.customerName ?? '') === (vomPartner.customerName ?? '')
      : gleich(werte, vomPartner)
    if (stimmt) return
    aendern(uebernehmen(vomPartner))
    // `aendern` ist bei jedem Zeichnen neu — es gehört deshalb nicht hinein.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesperrt, abweichend, vomPartner?.customerName, vomPartner?.customerAddress, werte.customerName, werte.customerAddress])

  const folgt = Boolean(vomPartner) && !abweichend && !gesperrt

  return (
    <>
      {teil !== 'anschrift' && (
      <label className="buero-feld">
        <span>Kunde</span>
        <input
          value={werte.customerName ?? ''}
          disabled={gesperrt || folgt}
          onChange={(e) => aendern({ customerName: e.target.value })}
          placeholder="z.B. Stadt Naila"
        />
      </label>
      )}

      {teil !== 'name' && (
        <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
          <span>Rechnungsanschrift</span>
          <textarea
            rows={3}
            value={werte.customerAddress ?? ''}
            disabled={gesperrt || folgt}
            onChange={(e) => aendern({ customerAddress: e.target.value })}
          />
        </label>
      )}

      {!gesperrt && gewaehlt && (teil === 'beides' || teil === 'anschrift' || nurName) && (
        <div style={{ gridColumn: '1 / -1', marginTop: '-.4rem' }}>
          {folgt ? (
            <p className="buero-unterzeile" style={{ margin: 0 }}>
              Folgt dem Geschäftspartner — wird er geändert, ändert sich der Entwurf mit.{' '}
              <button
                type="button"
                className="buero-knopf leise schmal"
                onClick={() => setAbweichend(true)}
              >
                Abweichenden Namen eintragen
              </button>
            </p>
          ) : (
            <div className="buero-hinweis" style={{ marginBottom: '.4rem' }}>
              <strong>Weicht vom Geschäftspartner ab.</strong> Dort steht{' '}
              „{vomPartner?.customerName}&ldquo;. Auf dem Papier steht, was hier im Feld steht.{' '}
              <button
                type="button"
                className="buero-knopf leise schmal"
                onClick={() => {
                  setAbweichend(false)
                  if (vomPartner) aendern(uebernehmen(vomPartner))
                }}
              >
                Vom Partner übernehmen
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
