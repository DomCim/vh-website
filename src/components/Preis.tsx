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
 * **Warum kein rotes Band.** Die erste Fassung schrieb den Rabatt in rote
 * Kästen und färbte auch den Preis rot. Es funktionierte und sah aus wie ein
 * Prospekt: Rot ist die Farbe des Discounters, und an einer Liege für 3.790 €
 * klingt sie nach Räumungsverkauf statt nach Werkstatt. Dazu kam, dass das Rot
 * im dunklen Thema aufgehellt wird und dann richtig springt — bei vier Kacheln
 * acht rote Signale, die um dieselbe Aufmerksamkeit stritten.
 *
 * Jetzt trägt die Aktion den Corten-Ton des Hauses und die Form, die auf der
 * ganzen Seite unter den Überschriften liegt: gesperrte Versalien mit dem
 * auslaufenden Bronzestrich darunter. Der Preis bleibt schwarz — dass etwas
 * günstiger ist, sagt der durchgestrichene Betrag daneben, dafür braucht es
 * keine zweite Farbe.
 *
 * Der alte Preis steht in `<s>` und nicht nur mit einer Linie aus dem
 * Stilblatt, damit auch eine Vorlesehilfe ihn als „gestrichen" ausgibt.
 */

export type PreisLabels = {
  /** „statt" — steht vor dem alten Preis */
  instead: string;
  /** „ab" — bei Artikeln mit mehreren Ausführungen */
  from?: string;
  /** „noch bis" — nur auf der Artikelseite, vor dem Ende der Aktion */
  until?: string;
};

/**
 * Das Etikett am Bild.
 *
 * Kein gefüllter Aufkleber, sondern ein Schild auf Papier mit dünner
 * Bronzelinie, vom Rand abgerückt: etwas, das jemand angebracht hat, statt
 * etwas, das aufgedruckt wurde. Weil die Fläche die Papierfarbe ist, trägt es
 * sich im hellen wie im dunklen Thema gleich.
 */
export function Etikett({
  prozent,
  className = "",
}: {
  prozent: number;
  className?: string;
}) {
  return (
    <span
      className={`tracking-nav border-bronze text-ink inline-block border bg-paper px-2 py-1 text-[11px] font-semibold uppercase tabular-nums ${className}`}
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
}: {
  betrag: number;
  aktion?: Preisaktion | null;
  locale: Locale;
  labels: PreisLabels;
  /** Bei mehreren Ausführungen steht „ab" davor */
  ab?: boolean;
  /** Artikelseite statt Kachel — größer, und mit dem Ende der Aktion */
  gross?: boolean;
}) {
  const vorsatz = ab && labels.from ? `${labels.from} ` : "";
  const betragKlasse = gross
    ? "text-ink text-2xl font-semibold"
    : "text-ink text-sm font-medium";

  if (!aktion) {
    return (
      <span className={betragKlasse}>
        {vorsatz}
        {formatPrice(betrag, locale)}
      </span>
    );
  }

  const neu = mitRabatt(betrag, aktion.prozent);

  /*
   * Das Ende steht nur auf der Artikelseite. In der Übersicht wäre es die
   * dritte Angabe in einer Kachel, die vor allem den Artikel zeigen soll —
   * und dieselbe Frist stünde dann zwölfmal untereinander auf einer Seite.
   */
  const bis =
    gross && labels.until
      ? ` · ${labels.until} ${new Date(aktion.giltBis).toLocaleDateString(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}`
      : "";

  return (
    <span className="flex flex-col gap-1">
      <span className="tracking-nav text-bronze rule-bronze-sm block text-[11px] font-semibold uppercase">
        {aktion.titel} · −{Math.round(aktion.prozent)} %{bis}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={betragKlasse}>
          {vorsatz}
          {formatPrice(neu, locale)}
        </span>
        <s className={`text-ink-soft ${gross ? "text-base" : "text-xs"}`}>
          {labels.instead} {formatPrice(betrag, locale)}
        </s>
      </span>
    </span>
  );
}
