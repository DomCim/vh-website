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

  // Das Original gehört mit in die Auswahl: Bei einem kleinen Upload ist es
  // die einzige Fassung, die es überhaupt gibt.
  const alle = [...zuschnitte];
  if (media.url && media.width) {
    alle.push({ url: media.url, width: media.width, height: media.height });
  }
  if (!alle.length && !media.url) return null;

  const nachBreite = [...alle].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const srcSet = nachBreite.map((z) => `${z.url} ${z.width}w`).join(", ");

  const gewaehlt =
    media.sizes?.[bevorzugt]?.url ??
    nachBreite[nachBreite.length - 1]?.url ??
    media.url ??
    undefined;

  const mass = media.sizes?.[bevorzugt] ?? nachBreite[nachBreite.length - 1];

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
