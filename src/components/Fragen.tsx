import React from "react";

/*
 * Die häufigen Fragen — an mehr als einer Stelle.
 *
 * Sie standen zuerst nur unter „Maßanfertigung", weil sie dort entstanden
 * sind. Nur handelt kaum eine davon von einer Maßanfertigung: Wie lange die
 * Fertigung dauert, welche Farben es gibt, ob Cortenstahl durchrostet, was
 * der Versand kostet, ob man abholen kann — das sind Fragen an den Betrieb,
 * nicht an eine einzelne Seite. Wer sie hatte, musste sie ausgerechnet dort
 * suchen, wo er sie am wenigsten vermutet.
 *
 * Deshalb ein eigenes Bauteil: Dieselbe Liste trägt jetzt die eigene Seite,
 * den Anriss auf der Startseite und den Abschnitt unter der Maßanfertigung.
 * Gepflegt wird sie weiter an einer Stelle — im Büro unter Einstellungen.
 */

export type Frage = { frage?: string | null; antwort?: string | null };

/** Nur die Einträge, die wirklich beides haben — halbe Fragen helfen niemandem */
export function gueltigeFragen(fragen?: Frage[] | null): { frage: string; antwort: string }[] {
  return (fragen ?? [])
    .filter((f): f is { frage: string; antwort: string } => Boolean(f.frage && f.antwort))
    .map((f) => ({ frage: f.frage, antwort: f.antwort }));
}

export function Fragen({
  fragen,
  offenAb = -1,
}: {
  fragen: { frage: string; antwort: string }[];
  /**
   * Ab welcher Stelle die Fragen zugeklappt bleiben. `0` klappt alle auf,
   * `-1` keine. Auf der Startseite steht der Anriss offen da — dort will man
   * sehen, dass es Antworten gibt, nicht erst klicken müssen.
   */
  offenAb?: number;
}) {
  return (
    <div className="space-y-2">
      {fragen.map((f, i) => (
        /* Aufklappbar statt untereinander: Zehn Fragen am Stück liest niemand,
           und die eine, die man hat, findet man so schneller. `details` kann
           das ohne eine Zeile JavaScript — und es funktioniert auch, wenn
           gerade nichts geladen wurde. */
        <details
          key={i}
          open={offenAb >= 0 && i >= offenAb}
          className="border-line border-b pb-2"
        >
          <summary className="text-ink cursor-pointer py-2 text-sm font-semibold">
            {f.frage}
          </summary>
          <p className="text-ink-soft pb-2 text-sm leading-relaxed whitespace-pre-line">
            {f.antwort}
          </p>
        </details>
      ))}
    </div>
  );
}
