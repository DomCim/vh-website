import Link from "next/link";
import React from "react";

import { preisaktionAnzeigen, type Preisaktion } from "../lib/aktionspreis";
import { type Locale } from "../lib/i18n";
import { Bild, type BildQuelle } from "./Bild";
import { Etikett, Preis } from "./Preis";

type Product = {
  slug?: string | null;
  title: string;
  shortDescription?: string | null;
  price?: number | null;
  onRequestOnly?: boolean | null;
  images?: unknown[] | null;
  variants?: { price: number }[] | null;
};

export function ProductCard({
  product,
  categorySlug,
  locale,
  labels,
  aktion,
}: {
  product: Product;
  categorySlug: string;
  locale: Locale;
  labels: { from: string; onRequest: string; instead: string };
  /** Läuft für diesen Artikel gerade eine Aktion? */
  aktion?: Preisaktion | null;
}) {
  const image = product.images?.[0];
  const prices = [
    ...(product.variants?.map((v) => v.price) ?? []),
    ...(typeof product.price === "number" ? [product.price] : []),
  ];
  const minPrice = prices.length ? Math.min(...prices) : undefined;
  const hasVariants = (product.variants?.length ?? 0) > 0;

  const zeigtAktion = preisaktionAnzeigen(
    { onRequestOnly: product.onRequestOnly, preis: minPrice },
    aktion,
  );

  return (
    <Link
      href={`/${locale}/${categorySlug}/${product.slug}`}
      className="group border-line block border bg-paper transition-shadow hover:shadow-lg"
    >
      <div className="bg-paper-soft relative aspect-[4/3] overflow-hidden">
        {image ? (
          <Bild
            media={image as BildQuelle}
            alt={product.title}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        {zeigtAktion && aktion ? (
          <Etikett prozent={aktion.prozent} className="absolute left-3 top-3" />
        ) : null}
      </div>
      <div className="p-5">
        <h3 className="tracking-nav text-ink text-sm font-semibold uppercase">
          {product.title}
        </h3>
        {product.shortDescription && (
          <p className="text-ink-soft mt-2 line-clamp-2 text-sm">
            {product.shortDescription}
          </p>
        )}
        <div className="mt-3 text-sm">
          {product.onRequestOnly || minPrice === undefined ? (
            <span className="text-ink font-medium">{labels.onRequest}</span>
          ) : (
            <Preis
              betrag={minPrice}
              aktion={zeigtAktion ? aktion : null}
              locale={locale}
              labels={{ instead: labels.instead, from: labels.from }}
              ab={hasVariants}
            />
          )}
        </div>
      </div>
    </Link>
  );
}
