import React from "react";

/**
 * Ein Bild in der jeweils passenden Größe.
 *
 * Payload legt zu jedem Upload mehrere Zuschnitte an; bisher wurde davon
 * genau einer verwendet — dieselbe Datei fürs Handy wie für den großen
 * Bildschirm. Diese Komponente reicht alle vorhandenen Größen als `srcset`
 * weiter und überlässt dem Browser die Wahl. Dazu Höhe und Breite, damit die
 * Seite beim Laden nicht springt.
 *
 * `sizes` beschreibt, wie breit das Bild im Layout tatsächlich wird — ohne
 * diese Angabe nimmt der Browser die volle Fensterbreite an und lädt zu groß.
 */

type Zuschnitt = {
  url?: string | null;
  width?: number | null;
  height?: number | null;
};

export type BildQuelle = {
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  sizes?: Record<string, Zuschnitt | undefined> | null;
} | null;

/** Baut `src`, `srcSet` und die Maße aus einem Medien-Datensatz. */
export function bildQuellen(media: BildQuelle, bevorzugt: string = "card") {
  if (!media || typeof media !== "object") return null;

  const zuschnitte = Object.values(media.sizes ?? {}).filter(
    (z): z is Zuschnitt => Boolean(z?.url && z?.width),
  );

  /*
   * Das Original gehört mit in die Auswahl — aber nur, wenn es wirklich mehr
   * bietet als die Zuschnitte.
   *
   * Der Grund ist handfest und hat Ladezeit gekostet: Die Zuschnitte sind
   * WebP, das Original ist das hochgeladene JPG. Beim Hero-Bild war das
   * Original 1200 Pixel breit — genauso breit wie der größte Zuschnitt. Im
   * `srcset` standen damit zwei Einträge mit derselben Breitenangabe
   * (`1200w`), und bei Gleichstand darf der Browser den letzten nehmen. Das
   * war das JPG: **192 KB statt 74 KB** für die Fassung, die ein Handy
   * tatsächlich braucht.
   *
   * Nachgemessen an der laufenden Website, nachdem die Ladezeit trotz
   * Vorladen nicht besser wurde — sondern schlechter.
   *
   * Das Original kommt deshalb nur dazu, wenn es **breiter** ist als jeder
   * Zuschnitt. Dann ist es die einzige Fassung in dieser Größe und der
   * Mehraufwand gerechtfertigt. Gibt es gar keine Zuschnitte (ein kleiner
   * Upload), bleibt es ohnehin die einzige Wahl.
   */
  const breitesterZuschnitt = zuschnitte.reduce(
    (max, z) => Math.max(max, z.width ?? 0),
    0,
  );

  const alle = [...zuschnitte];
  if (media.url && media.width && media.width > breitesterZuschnitt) {
    alle.push({ url: media.url, width: media.width, height: media.height });
  }
  if (!alle.length && !media.url) return null;

  /*
   * Nach Breite sortiert — und doppelte Breiten fliegen raus.
   *
   * Zwei Einträge mit derselben Angabe sind für den Browser eine
   * Zufallsentscheidung; einer davon ist immer der falsche. Es gewinnt der
   * erste, weil die Zuschnitte vor dem Original stehen und WebP kleiner ist
   * als das hochgeladene Bild.
   */
  const nachBreite = [...alle].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const gesehen = new Set<number>();
  const eindeutig = nachBreite.filter((z) => {
    const b = z.width ?? 0;
    if (gesehen.has(b)) return false;
    gesehen.add(b);
    return true;
  });
  const srcSet = eindeutig.map((z) => `${z.url} ${z.width}w`).join(", ");

  const gewaehlt =
    media.sizes?.[bevorzugt]?.url ??
    eindeutig[eindeutig.length - 1]?.url ??
    media.url ??
    undefined;

  const mass = media.sizes?.[bevorzugt] ?? eindeutig[eindeutig.length - 1];

  return {
    src: gewaehlt as string,
    srcSet: srcSet || undefined,
    width: mass?.width ?? media.width ?? undefined,
    height: mass?.height ?? media.height ?? undefined,
    alt: media.alt ?? "",
  };
}

export function Bild({
  media,
  alt,
  sizes = "100vw",
  className,
  bevorzugt = "card",
  /** Nur fürs erste Bild über der Falz — alles andere lädt verzögert. */
  vorrang = false,
}: {
  media: BildQuelle;
  alt?: string;
  sizes?: string;
  className?: string;
  bevorzugt?: string;
  vorrang?: boolean;
}) {
  const quellen = bildQuellen(media, bevorzugt);
  if (!quellen?.src) return null;

  return (
    <img
      src={quellen.src}
      srcSet={quellen.srcSet}
      sizes={sizes}
      width={quellen.width}
      height={quellen.height}
      alt={alt ?? quellen.alt}
      className={className}
      loading={vorrang ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={vorrang ? "high" : undefined}
    />
  );
}
