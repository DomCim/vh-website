'use client'

import { useSearchParams } from 'next/navigation'
import React, { Suspense } from 'react'

import { InventarFormular, werteAusPosten } from '../../../../../components/office/InventarFormular'
import { useAbgleich, useDatensatz } from '../../../../../lib/buero/bestand'
import { naechsterPosten } from '../../../../../lib/inventarerfassung'

/**
 * Neuer Posten — leer, oder nach dem Muster eines vorhandenen.
 *
 * `?vorlage=<id>` kommt vom Knopf „Duplizieren" an einem Posten. Übernommen
 * wird dann genau das, was auch „Speichern & nächster Posten" stehen lässt
 * (siehe `lib/inventarerfassung.ts`): Wer aus „Schraube M8 × 40" die „M8 × 50"
 * macht, will Regal, Händler und Mindestbestand mitnehmen und den Bestand
 * nicht — der ist noch nicht gezählt. Und weil die Bezeichnung mitkommt,
 * steht so lange „Gibt es schon" darunter, bis sie geändert ist.
 *
 * Die Lieferantenliste holt sich das Feld inzwischen selbst aus dem Bestand im
 * Gerät — hier stand sie nur herum und musste in beiden Seiten gleich gepflegt
 * werden.
 */
export default function NeuerPostenSeite() {
  return (
    <Suspense fallback={null}>
      <NeuerPosten />
    </Suspense>
  )
}

type Posten = { id: number | string; name?: string | null; [feld: string]: unknown }

function NeuerPosten() {
  const vorlageId = useSearchParams().get('vorlage') ?? undefined
  const vorlage = useDatensatz<Posten>('inventar', vorlageId)
  const { bereit } = useAbgleich()

  // Das Formular liest seine Anfangswerte genau einmal. Solange der Bestand
  // noch aus dem Gerät kommt, darf es deshalb nicht leer aufgehen.
  if (vorlageId && !vorlage && !bereit) {
    return (
      <>
        <h1>Neuer Posten</h1>
        <div className="buero-leer">wird geholt …</div>
      </>
    )
  }

  return (
    <>
      <h1>Neuer Posten</h1>
      <p className="buero-unterzeile">
        {vorlage
          ? `Nach dem Muster von „${vorlage.name ?? ''}“ — Bezeichnung ändern, Bestand eintragen, speichern.`
          : 'Material, Werkzeug oder Maschine — alles, was im Haus ist.'}
      </p>
      {vorlage ? (
        <InventarFormular key={String(vorlage.id)} werte={naechsterPosten(werteAusPosten(vorlage))} vorlage />
      ) : (
        <InventarFormular werte={{}} />
      )}
    </>
  )
}
