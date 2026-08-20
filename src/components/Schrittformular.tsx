'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Ein langes Formular in Schritten.
 *
 * Zwanzig Felder untereinander sind am Telefon eine Rolle ohne Ende: Man
 * scrollt, verliert die Übersicht, und der Knopf zum Abschicken liegt so weit
 * unten, dass niemand weiß, wie viel noch kommt. Am Rechner passt zwar alles
 * auf den Schirm, aber „alles auf einmal" ist keine Ordnung — es ist eine
 * Wand.
 *
 * **Eine Mechanik für beide Welten.** Shop und Büro sehen verschieden aus,
 * verhalten sich aber gleich. Zwei getrennte Fassungen liefen unweigerlich
 * auseinander — die eine bekäme eine Verbesserung, die andere nicht. Deshalb
 * steht die Logik hier einmal, und `stil` entscheidet nur über die Klassen.
 *
 * **Alle Schritte bleiben im Dokument.** Sie werden versteckt, nicht
 * abgebaut. Das ist keine Bequemlichkeit: Die Formulare lesen ihre Werte beim
 * Abschicken über `FormData` aus dem Formular. Ein abgebauter Schritt wäre
 * auch aus `FormData` verschwunden — und die Bestellung ginge ohne Anschrift
 * raus, ohne dass jemand etwas merkt.
 *
 * **Geprüft wird beim Weitergehen, nicht erst am Ende.** Ein Fehler, den man
 * fünf Schritte später erfährt, ist eine Zumutung. Geprüft wird mit dem, was
 * der Browser ohnehin kann (`required`, `type="email"`, `pattern`) — samt
 * seiner eigenen, übersetzten Meldung am richtigen Feld. Was HTML nicht
 * ausdrücken kann, trägt der Schritt in `pruefen` nach; so hängt die
 * E-Mail-Bestätigung an der Kasse als Tor zwischen zwei Schritten.
 */

export type Schritt = {
  /** Kurzer Name, dient auch als React-Schlüssel */
  schluessel: string
  /** Steht in der Leiste oben */
  titel: string
  inhalt: React.ReactNode
  /**
   * Prüfung über das hinaus, was HTML kann. Ein Text heißt „so nicht" und
   * steht dann unter dem Schritt; `null` heißt „weiter".
   */
  pruefen?: () => Promise<string | null> | string | null
  /**
   * Schritte, die gerade nicht gebraucht werden — bei Abholung ist keine
   * Lieferanschrift nötig. Sie verschwinden auch aus der Zählung: „Schritt 2
   * von 4" soll stimmen und keine Lücken haben.
   */
  entfaellt?: boolean
}

type Eigenschaften = {
  schritte: Schritt[]
  /** Wie es aussehen soll — die Logik ist dieselbe */
  stil: 'shop' | 'buero'
  /** Steht im letzten Schritt statt „Weiter" — meist der Absendeknopf */
  abschluss: React.ReactNode
  weiterText?: string
  zurueckText?: string
  /** Wird nach jedem Wechsel gerufen — etwa zum Hochscrollen */
  beiWechsel?: (index: number) => void
  /**
   * Von außen zu einem Schritt springen.
   *
   * Gebraucht, wenn erst beim Abschicken herauskommt, dass weiter vorn etwas
   * fehlt — an der Kasse etwa, wenn die Bestätigung der E-Mail-Adresse
   * zwischenzeitlich abgelaufen ist. Ohne das stünde der Mensch im letzten
   * Schritt vor einer Meldung über ein Feld, das er von dort aus nicht sieht.
   *
   * `nr` ist ein Zähler und kein Wert: Zweimal zum selben Schritt springen
   * muss zweimal wirken.
   */
  sprung?: { schluessel: string; nr: number }
}

/** Sieht man das Feld gerade? Versteckte darf man nicht anspringen. */
function sichtbarImBild(feld: HTMLElement): boolean {
  if (typeof feld.checkVisibility === 'function') return feld.checkVisibility()
  return feld.offsetParent !== null
}

/**
 * Was der Browser an diesem Bereich auszusetzen hat — das erste Feld, das
 * nicht passt.
 *
 * Versteckte und abgeschaltete Felder zählen nicht mit: Ein Feld, das gerade
 * gar nicht angezeigt wird (etwa die Anschrift bei Abholung), darf den Weg
 * nicht versperren — und ließe sich auch nicht anspringen. Genau daran
 * scheitern Formulare sonst stumm: Der Browser weigert sich abzuschicken und
 * schreibt „not focusable" in eine Konsole, die niemand offen hat.
 */
function ersterFehler(bereich: HTMLElement): HTMLInputElement | null {
  const felder = bereich.querySelectorAll<HTMLInputElement>('input, select, textarea')
  for (const feld of felder) {
    if (feld.disabled || feld.type === 'hidden') continue
    if (feld.checkValidity()) continue
    if (!sichtbarImBild(feld)) continue
    return feld
  }
  return null
}

export function Schrittformular({
  schritte,
  stil,
  abschluss,
  weiterText = 'Weiter',
  zurueckText = 'Zurück',
  beiWechsel,
  sprung,
}: Eigenschaften) {
  const sichtbar = schritte.filter((s) => !s.entfaellt)
  const [jetzt, setJetzt] = useState(0)
  /** Wie weit man schon war — nur dorthin darf man springen */
  const [erreicht, setErreicht] = useState(0)
  const [fehler, setFehler] = useState<string | null>(null)
  const [prueft, setPrueft] = useState(false)
  const behaelter = useRef<HTMLDivElement>(null)

  /*
   * Fällt ein Schritt weg, während man dahinter steht — etwa weil jemand von
   * Lieferung auf Abholung umstellt —, rutscht die Nummerierung. Ohne das
   * stünde man auf einem Schritt, den es nicht mehr gibt.
   */
  useEffect(() => {
    if (jetzt > sichtbar.length - 1) setJetzt(Math.max(sichtbar.length - 1, 0))
  }, [sichtbar.length, jetzt])

  const wechseln = useCallback(
    (ziel: number) => {
      setJetzt(ziel)
      setErreicht((e) => Math.max(e, ziel))
      setFehler(null)
      beiWechsel?.(ziel)
    },
    [beiWechsel],
  )

  useEffect(() => {
    if (!sprung) return
    const ziel = sichtbar.findIndex((s) => s.schluessel === sprung.schluessel)
    if (ziel >= 0) wechseln(ziel)
    // Absichtlich nur am Zähler hängen: Der Sprung soll genau dann geschehen,
    // wenn ihn jemand auslöst — nicht bei jedem Neuzeichnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprung?.nr])

  const bereichVon = useCallback(
    (schluessel: string) =>
      behaelter.current?.querySelector<HTMLElement>(`[data-schritt="${schluessel}"]`) ?? null,
    [],
  )

  /*
   * Das Formular prüft nicht mehr selbst — diese Komponente tut es.
   *
   * Sonst gäbe es zwei Instanzen mit derselben Zuständigkeit: Der Browser
   * prüfte beim Abschicken alles auf einmal, auch die versteckten Schritte,
   * und bliebe an einem Feld hängen, das er nicht anspringen kann. Ergebnis
   * wäre ein Knopf, der nichts tut und nichts sagt. Jetzt hängt hier ein
   * Wächter davor, der zuerst zum richtigen Schritt springt.
   */
  useEffect(() => {
    const formular = behaelter.current?.closest('form')
    if (!formular) return
    const vorher = formular.noValidate
    formular.noValidate = true

    const wache = (e: Event) => {
      for (let i = 0; i < sichtbar.length; i++) {
        const bereich = bereichVon(sichtbar[i].schluessel)
        if (!bereich) continue
        // Beim Prüfen muss der Schritt kurz sichtbar sein, sonst zählt er als
        // versteckt und wird übersprungen
        const wieder = bereich.hidden
        bereich.hidden = false
        const kaputt = ersterFehler(bereich)
        bereich.hidden = wieder
        if (kaputt) {
          e.preventDefault()
          e.stopPropagation()
          wechseln(i)
          // Erst nach dem Wechsel anspringen — vorher steht das Feld noch im
          // versteckten Teil und lässt sich weder anzeigen noch fokussieren
          setTimeout(() => {
            kaputt.reportValidity()
            kaputt.focus()
          }, 0)
          return
        }
      }
    }

    formular.addEventListener('submit', wache, true)
    return () => {
      formular.removeEventListener('submit', wache, true)
      formular.noValidate = vorher
    }
  }, [sichtbar, bereichVon, wechseln])

  async function weiter() {
    const bereich = bereichVon(sichtbar[jetzt]?.schluessel ?? '')
    if (bereich) {
      const kaputt = ersterFehler(bereich)
      if (kaputt) {
        // Der Browser sagt es selbst, in der Sprache des Geräts und genau am
        // Feld — besser als jeder Satz, den wir hier hinschreiben könnten
        kaputt.reportValidity()
        kaputt.focus()
        return
      }
    }

    const eigene = sichtbar[jetzt]?.pruefen
    if (eigene) {
      setPrueft(true)
      try {
        const sagt = await eigene()
        if (sagt) {
          setFehler(sagt)
          return
        }
      } finally {
        setPrueft(false)
      }
    }

    wechseln(Math.min(jetzt + 1, sichtbar.length - 1))
  }

  const k = stil === 'buero' ? BUERO : SHOP
  const letzter = jetzt >= sichtbar.length - 1

  return (
    <div ref={behaelter}>
      <ol className={k.leiste} aria-label="Schritte">
        {sichtbar.map((s, i) => {
          const erledigt = i < jetzt
          const hier = i === jetzt
          return (
            <li key={s.schluessel} className={k.punkt}>
              <button
                type="button"
                /*
                 * Zurück darf man immer, nach vorn nur bis dahin, wo man
                 * schon war. Sonst überspränge ein Klick in der Leiste genau
                 * die Prüfung, für die es die Schritte gibt.
                 */
                disabled={i > erreicht}
                aria-current={hier ? 'step' : undefined}
                className={[k.marke, hier ? k.markeHier : '', erledigt ? k.markeFertig : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => i <= erreicht && wechseln(i)}
              >
                <span className={k.nummer} aria-hidden="true">
                  {erledigt ? '✓' : i + 1}
                </span>
                <span className={k.markeText}>{s.titel}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Am Telefon ist in der Leiste kein Platz für Wörter — dort steht der
          Name des Schrittes hier, und der Fortschritt gleich dazu. */}
      <p className={k.zaehler} aria-live="polite">
        Schritt {jetzt + 1} von {sichtbar.length}
        {sichtbar[jetzt] ? ` — ${sichtbar[jetzt].titel}` : ''}
      </p>

      {schritte.map((s) => {
        const index = sichtbar.findIndex((x) => x.schluessel === s.schluessel)
        return (
          <fieldset
            key={s.schluessel}
            data-schritt={s.schluessel}
            className={k.feld}
            /*
             * Immer dieselbe Hülle, egal ob der Schritt gerade zählt.
             *
             * Ein Schritt, der mal als `fieldset` und mal als `div` erschiene,
             * würde bei jedem Wechsel neu gebaut — und nähme dabei mit, was
             * schon eingetippt war. Wer von Lieferung auf Abholung und zurück
             * stellt, fände seine Anschrift gelöscht.
             *
             * `disabled` erledigt zwei Dinge auf einmal: Abgeschaltete Felder
             * werden nicht mitgeschickt und nicht geprüft. Genau das soll ein
             * Schritt sein, den es gerade nicht gibt.
             */
            disabled={s.entfaellt}
            hidden={s.entfaellt || index !== jetzt}
          >
            {s.inhalt}
          </fieldset>
        )
      })}

      {fehler && (
        <p className={k.fehler} role="alert">
          {fehler}
        </p>
      )}

      <div className={k.knoepfe}>
        {jetzt > 0 && (
          <button type="button" className={k.zurueck} onClick={() => wechseln(jetzt - 1)}>
            {zurueckText}
          </button>
        )}
        {letzter ? (
          abschluss
        ) : (
          <button type="button" className={k.weiter} disabled={prueft} onClick={() => void weiter()}>
            {prueft ? '…' : weiterText}
          </button>
        )}
      </div>
    </div>
  )
}

/*
 * Die Klassen — der einzige Unterschied zwischen Shop und Büro.
 *
 * Das Büro bringt keine Tailwind-Grundregeln mit, sein Aussehen steht in
 * `office.css`. Der Shop nimmt dieselben Bausteine wie der Rest der Seite.
 *
 * `min-w-0` beim Feld ist kein Zierrat: Ein `fieldset` hat von Haus aus
 * `min-width: min-content` und sprengt damit jedes Raster, in dem etwas
 * Breites steht — eine lange Zeile, eine Tabelle, ein Bild.
 */
const SHOP = {
  leiste: 'border-line mb-4 flex flex-wrap gap-x-1 gap-y-2 border-b pb-3',
  punkt: 'flex items-center',
  marke:
    'text-ink-soft tracking-nav flex items-center gap-2 px-2 py-1 text-xs uppercase disabled:opacity-40',
  markeHier: 'text-ink font-semibold',
  markeFertig: 'text-ink',
  nummer:
    'border-line flex h-5 w-5 items-center justify-center rounded-full border text-[10px] leading-none',
  markeText: 'hidden sm:inline',
  zaehler: 'text-ink-soft mb-5 text-xs sm:hidden',
  feld: 'm-0 min-w-0 border-0 p-0',
  fehler: 'text-accent mt-4 text-sm',
  knoepfe: 'mt-8 flex flex-wrap items-center gap-3',
  zurueck: 'border-line text-ink border px-5 py-3 text-sm',
  weiter: 'bg-ink text-paper tracking-nav px-6 py-3 text-sm uppercase disabled:opacity-60',
}

const BUERO = {
  leiste: 'buero-schrittleiste',
  punkt: '',
  marke: 'buero-schrittmarke',
  markeHier: 'ist-hier',
  markeFertig: 'ist-fertig',
  nummer: 'buero-schrittnummer',
  markeText: 'buero-schritttext',
  zaehler: 'buero-schrittzaehler',
  feld: 'buero-schrittfeld',
  fehler: 'buero-hinweis warn',
  knoepfe: 'buero-schrittknoepfe',
  zurueck: 'buero-knopf leise',
  weiter: 'buero-knopf',
}
