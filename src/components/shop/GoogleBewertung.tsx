"use client";

import React, { useState } from "react";

/**
 * Die Frage nach der Bewertung — und warum sie hier gestellt wird und nicht
 * von Google.
 *
 * Google Kundenrezensionen funktioniert so: Auf der Bestätigungsseite lädt
 * man ein Skript von Google, das ein eigenes Fenster einblendet und dort
 * fragt, ob der Kunde später eine Umfrage bekommen darf. Sagt er ja, meldet
 * sich Google ein paar Wochen nach der voraussichtlichen Lieferung mit zwei
 * Fragen; die Antworten zählen als Verkäuferbewertung im Merchant Center.
 *
 * **Warum wir zuerst selbst fragen.** Diese Website setzt kein Cookie und
 * lädt nichts von fremden Servern — genau deshalb steht auf ihr auch kein
 * Einwilligungsbanner, und das ist ein Wert, den man nicht für ein Abzeichen
 * aufgibt. Würde Googles Skript hier einfach geladen, wäre diese Aussage
 * hinfällig, und jeder Besucher müsste künftig erst etwas wegklicken.
 *
 * Also: Erst steht hier eine Frage in unseren eigenen Worten. Erst wenn
 * jemand darauf drückt, wird Googles Skript nachgeladen und dessen Einladung
 * eingeblendet. Wer nicht drückt, bekommt von Google nichts zu sehen — kein
 * Skript, kein Aufruf, nichts. Das ist nicht nur die saubere Reihenfolge, es
 * ist auch die ehrlichere: Die Einwilligung passiert bei uns.
 *
 * **Warum es zweimal fragen kann.** Nach dem Klick zeigt Google seine eigene
 * Einladung mit Ja/Nein. Das wirkt doppelt gemoppelt, ist aber Googles
 * Vorgabe — die Einwilligung muss dort erteilt werden, sonst zählt sie
 * nicht. Unser Knopf holt nur die Erlaubnis, das Fenster überhaupt zu
 * zeigen.
 */

export type BewertungLabels = {
  /** „Eine Bitte zum Schluss" */
  title: string;
  /** Der erklärende Satz */
  text: string;
  /** Beschriftung des Knopfes */
  button: string;
  /** Steht nach dem Klick da, während Googles Fenster kommt */
  loading: string;
  /** Wenn Google nicht erreichbar ist */
  error: string;
};

export type BewertungDaten = {
  merchantId: string;
  orderId: string;
  email: string;
  /** Zwei Buchstaben, z.B. FR — Google verlangt das Länderkürzel */
  deliveryCountry: string;
  /** Voraussichtliche Lieferung, YYYY-MM-DD */
  estimatedDeliveryDate: string;
};

declare global {
  interface Window {
    gapi?: {
      load: (modul: string, rueckruf: () => void) => void;
      surveyoptin?: { render: (einstellungen: Record<string, unknown>) => void };
    };
    renderOptIn?: () => void;
  }
}

/** Googles Skript einmal laden — ein zweiter Aufruf hängt sich an denselben Ladevorgang */
let ladeVorgang: Promise<void> | null = null;

function skriptLaden(): Promise<void> {
  if (ladeVorgang) return ladeVorgang;

  ladeVorgang = new Promise<void>((fertig, fehler) => {
    if (window.gapi) return fertig();
    const element = document.createElement("script");
    element.src = "https://apis.google.com/js/platform.js?onload=renderOptIn";
    element.async = true;
    element.defer = true;
    // `onload` von Google ruft `window.renderOptIn` auf — erst dann steht gapi
    // wirklich bereit. Das reine `load`-Ereignis des Elements käme zu früh.
    window.renderOptIn = () => fertig();
    element.onerror = () => fehler(new Error("Google nicht erreichbar"));
    document.head.appendChild(element);
  });

  return ladeVorgang;
}

export function GoogleBewertung({
  daten,
  labels,
}: {
  daten: BewertungDaten;
  labels: BewertungLabels;
}) {
  const [stand, setStand] = useState<"frage" | "laedt" | "gezeigt" | "fehler">("frage");

  async function zustimmen() {
    setStand("laedt");
    try {
      await skriptLaden();
      window.gapi?.load("surveyoptin", () => {
        window.gapi?.surveyoptin?.render({
          merchant_id: Number(daten.merchantId),
          order_id: daten.orderId,
          email: daten.email,
          delivery_country: daten.deliveryCountry,
          estimated_delivery_date: daten.estimatedDeliveryDate,
          opt_in_style: "CENTER_DIALOG",
        });
      });
      setStand("gezeigt");
    } catch {
      setStand("fehler");
    }
  }

  return (
    <section className="border-line mt-12 border-t pt-8 text-left">
      <h2 className="tracking-nav text-ink rule-bronze-sm text-sm font-semibold uppercase">
        {labels.title}
      </h2>
      <p className="text-ink-soft mt-4 text-sm leading-relaxed">{labels.text}</p>

      {stand === "frage" && (
        <button
          type="button"
          onClick={zustimmen}
          className="border-bronze text-ink tracking-nav hover:bg-bronze hover:text-on-ink mt-5 cursor-pointer border px-6 py-2 text-xs font-semibold uppercase transition-colors"
        >
          {labels.button}
        </button>
      )}

      {stand === "laedt" && <p className="text-ink-soft mt-5 text-xs">{labels.loading}</p>}
      {stand === "fehler" && <p className="text-accent mt-5 text-xs">{labels.error}</p>}
    </section>
  );
}
