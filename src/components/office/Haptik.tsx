'use client'

import { useEffect } from 'react'

/**
 * Ein kurzes Rütteln, wenn man etwas gedrückt hat.
 *
 * **Warum ein einziger Horcher statt Code an vierzig Knöpfen.** Das Büro hat
 * Knöpfe in fast jeder Datei. Jeden einzeln anzufassen hieße, den nächsten zu
 * vergessen — und zwar den, den jemand nächste Woche schreibt. Hier hängt ein
 * Horcher am Dokument, sieht sich an, worauf getippt wurde, und entscheidet
 * daraus. Neue Knöpfe sind von selbst dabei, solange sie die üblichen Klassen
 * tragen.
 *
 * **Wo es wirkt und wo nicht.** Gebraucht wird die Vibrations-API. Android und
 * Chromium können sie; WebKit — also jedes iPhone, egal welcher Browser —
 * bisher nicht. Dort bleibt es still. Das ist kein Fehler in diesem Code und
 * lässt sich von hier aus auch nicht umgehen: Ohne die API gibt es am iPhone
 * schlicht keinen Weg, aus einer Website heraus den Vibrationsmotor
 * anzusprechen. Ausgenommen ein Sonderfall, den Apple für Schalter geöffnet
 * hat — für gewöhnliche Knöpfe hilft er nicht.
 *
 * Deshalb ist das hier eine Zugabe und keine Zusicherung: Wo sie da ist, wird
 * sie genutzt; wo nicht, ändert sich nichts. Nichts im Büro hängt davon ab.
 *
 * **Wer nicht will, bekommt nichts.** Wer im Betriebssystem „Bewegung
 * reduzieren" eingestellt hat, meint auch das hier.
 */

/**
 * Wie lange gerüttelt wird, in Millisekunden.
 *
 * Kurz. Sehr kurz. Ein Rütteln, das man bemerkt, statt eines, das man spürt —
 * fünfzig Mal am Tag soll es nicht nerven. Die Zahlen sind an dem
 * ausgerichtet, was Betriebssysteme selbst für Berührungen verwenden.
 */
const TIPPEN = 8
/** Wegnehmen darf sich schwerer anfühlen als Auswählen */
const GEWICHTIG = [12, 40, 12]

/** Trägt das Element (oder eines darüber) eine dieser Klassen? */
function trifft(ziel: EventTarget | null, klassen: string[]): HTMLElement | null {
  if (!(ziel instanceof Element)) return null
  const treffer = ziel.closest(klassen.map((k) => `.${k}`).join(','))
  return treffer instanceof HTMLElement ? treffer : null
}

/** Knöpfe, Zeilen und Reiter — alles, was sich wie ein Knopf anfühlt */
const ANTIPPBAR = [
  'buero-knopf',
  'buero-symbolknopf',
  'buero-zeile-knopf',
  'buero-ordner',
  'buero-tab',
  'buero-blatt-punkte',
  'schritte-marke',
  'buero-ruecken',
]

export function Haptik() {
  useEffect(() => {
    /*
     * Alles in einer Bedingung: Fehlt die API, wird der Horcher gar nicht
     * erst angehängt. Ein Horcher, der bei jedem Tippen nachrechnet, um dann
     * nichts zu tun, ist verschwendete Rechenzeit auf einem Gerät, das an der
     * Steckdose sparen soll.
     */
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const beiTipp = (e: PointerEvent) => {
      // Nur echte Berührungen und Mausklicks — kein Nachhall von Tastatur
      // oder von Klicks, die Code selbst auslöst
      if (!e.isTrusted) return

      const treffer = trifft(e.target, ANTIPPBAR)
      if (!treffer) return
      if (treffer instanceof HTMLButtonElement && treffer.disabled) return

      /*
       * `gefahr` trägt im Büro, was etwas wegnimmt — Löschen, Entfernen,
       * Stornieren. Das darf sich anders anfühlen als „weiter": Der Finger
       * merkt dann selbst, dass er gerade an einer anderen Sorte Knopf war.
       */
      const schwer = treffer.classList.contains('gefahr')
      try {
        navigator.vibrate(schwer ? GEWICHTIG : TIPPEN)
      } catch {
        // Manche Browser werfen, wenn die Seite gerade nicht im Vordergrund
        // ist. Ein Rütteln ist nichts, wofür man eine Fehlermeldung zeigt.
      }
    }

    /*
     * `pointerdown` und nicht `click`: Das Gefühl gehört an den Moment der
     * Berührung. Bei `click` käme es erst, wenn der Finger wieder weg ist —
     * dann wirkt es wie eine Verzögerung statt wie eine Antwort.
     */
    document.addEventListener('pointerdown', beiTipp)
    return () => document.removeEventListener('pointerdown', beiTipp)
  }, [])

  return null
}
