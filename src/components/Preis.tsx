import React from "react";

import { mitRabatt, type Preisaktion } from "../lib/aktionspreis";
import { formatPrice, type Locale } from "../lib/i18n";

/*
 * Der Preis — und was eine Aktion aus ihm macht.
 *
 * Es gibt zwei Stellen, an denen ein Preis im Schaufenster steht: die Kachel
 * in der Übersicht und die Artikelseite. Beide sollen dasselbe zeigen, sonst
 * heißt es an der einen Stelle 1.990 € und an der anderen 1.194 €, und der
 * Kunde weiß nicht, welcher Zahl er glauben soll. Deshalb eine Darstellung,
 * zwei Größen — und nicht zweimal dieselbe Rechnung in zwei Bauteilen.
 *
 * Der alte Preis bleibt stehen, durchgestrichen. Das ist keine Zierde: Ohne
 * ihn ist ein Rabatt eine Behauptung. Und er trägt `<s>` statt einer
 * Linie aus dem Stilblatt, damit auch eine Vorlesehilfe ihn als
 * „gestrichen" ausgibt.
 */

export type PreisLabels = {
  /** „statt" — steht vor dem alten Preis */
  instead: string;
  /** „ab" — bei Artikeln mit mehreren Ausführungen */
  from?: string;
};

/** Das Band mit dem Prozentsatz. Auch allein verwendbar, etwa über einem Bild. */
export function Rabattband({
  prozent,
  className = "",
}: {
  prozent: number;
  className?: string;
}) {
  return (
    <span
      className={`tracking-nav bg-accent text-on-ink inline-block px-2 py-1 text-[11px] font-semibold uppercase ${className}`}
    >
      −{Math.round(prozent)} %
    </span>
  );
}

export function Preis({
  betrag,
  aktion,
  locale,
  labels,
  ab = false,
  gross = false,
  ohneBand = false,
}: {
  betrag: number;
  aktion?: Preisaktion | null;
  locale: Locale;
  labels: PreisLabels;
  /** Bei mehreren Ausführungen steht „ab" davor */
  ab?: boolean;
  /** Artikelseite statt Kachel */
  gross?: boolean;
  /** Das Band weglassen — auf der Kachel sitzt es schon auf dem Bild */
  ohneBand?: boolean;
}) {
  const vorsatz = ab && labels.from ? `${labels.from} ` : "";

  if (!aktion) {
    return (
      <span
        className={
          gross ? "text-ink text-2xl font-semibold" : "text-ink text-sm font-medium"
        }
      >
        {vorsatz}
        {formatPrice(betrag, locale)}
      </span>
    );
  }

  const neu = mitRabatt(betrag, aktion.prozent);

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span
        className={
          gross ? "text-accent text-2xl font-semibold" : "text-accent text-sm font-semibold"
        }
      >
        {vorsatz}
        {formatPrice(neu, locale)}
      </span>
      <s className={`text-ink-soft ${gross ? "text-base" : "text-xs"}`}>
        {labels.instead} {formatPrice(betrag, locale)}
      </s>
      {ohneBand ? null : <Rabattband prozent={aktion.prozent} />}
    </span>
  );
}
