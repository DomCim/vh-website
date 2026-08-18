import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";

import {
  Bild,
  bildQuellen,
  type BildQuelle,
} from "../../../../../components/Bild";
import { MassanfertigungHinweis } from "../../../../../components/MassanfertigungHinweis";
import { Reveal } from "../../../../../components/motion/Reveal";
import { RichText } from "../../../../../components/RichText";
import { ProductDetail } from "../../../../../components/shop/ProductDetail";
import {
  getCategoryBySlug,
  getProductBySlug,
  getProjectsForProduct,
  getSiteSettings,
  getTestimonialsForProduct,
  mediaAlt,
  mediaUrl,
} from "../../../../../lib/data";
import { isLocale, t } from "../../../../../lib/i18n";
import {
  absoluteUrl,
  alternatesFor,
  BASE_URL,
  jsonLd,
} from "../../../../../lib/seo";

export const dynamic = "force-dynamic";

type PageParams = Promise<{
  locale: string;
  categorySlug: string;
  itemSlug: string;
}>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { locale, categorySlug, itemSlug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProductBySlug(itemSlug, locale);
  if (!product) return {};
  const image = absoluteUrl(mediaUrl(product.images?.[0], "large"));
  return {
    title: product.title,
    description: product.shortDescription || undefined,
    alternates: alternatesFor(locale, `/${categorySlug}/${itemSlug}`),
    openGraph: {
      title: product.title,
      description: product.shortDescription || undefined,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: PageParams }) {
  const { locale, categorySlug, itemSlug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = t(locale);

  const category = await getCategoryBySlug(categorySlug, locale);
  if (!category) notFound();

  const product = await getProductBySlug(itemSlug, locale);
  if (!product) notFound();

  const testimonials = await getTestimonialsForProduct(product.id, locale);
  const settings = await getSiteSettings(locale);
  const referenzen = await getProjectsForProduct(product.id, locale);

  // Die Galerie bekommt alle Zuschnitte mit — das große Produktbild ist auf
  // dieser Seite das Wichtigste, und ein Handy soll dafür keine 1800 Pixel laden.
  const images = (product.images ?? []).map((img) => {
    const quellen = bildQuellen(img as BildQuelle, "large");
    return {
      url: quellen?.src || mediaUrl(img, "large") || "",
      srcSet: quellen?.srcSet,
      width: quellen?.width,
      height: quellen?.height,
      alt: mediaAlt(img, product.title),
    };
  });

  // schema.org-Produktdaten für Google Rich Results
  const prices = [
    ...(product.variants?.map((v) => v.price) ?? []),
    ...(typeof product.price === "number" ? [product.price] : []),
  ];
  const minPrice = prices.length ? Math.min(...prices) : undefined;
  const productJsonLd = jsonLd({
    "@type": "Product",
    name: product.title,
    description: product.shortDescription || undefined,
    image: images.map((i) => absoluteUrl(i.url)).filter(Boolean),
    url: `${BASE_URL}/${locale}/${categorySlug}/${itemSlug}`,
    brand: { "@type": "Brand", name: "Vincent Hellmann" },
    ...(minPrice !== undefined &&
      !product.onRequestOnly && {
        offers: {
          "@type": "Offer",
          priceCurrency: "EUR",
          price: minPrice,
          availability:
            product.available !== false
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: `${BASE_URL}/${locale}/${categorySlug}/${itemSlug}`,
        },
      }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: productJsonLd }}
      />
      <Reveal>
        <Link
          href={`/${locale}/${categorySlug}`}
          className="tracking-nav text-ink-soft hover:text-ink text-xs uppercase"
        >
          ← {dict.product.backToCategory}
        </Link>
      </Reveal>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductDetail
          locale={locale}
          product={{
            id: product.id,
            slug: product.slug ?? "",
            title: product.title,
            price: product.price ?? undefined,
            shippingCost: product.shippingCost ?? undefined,
            onRequestOnly: Boolean(product.onRequestOnly),
            available: product.available !== false,
            productionTime:
              product.productionTime ??
              settings?.craft?.defaultProductionTime ??
              null,
            readyMade: Boolean(product.readyMade),
            variants: (product.variants ?? []).map((v) => ({
              title: v.title,
              price: v.price,
            })),
            colorOptions: (product.colorOptions ?? []).map((c) => ({
              name: c.name,
              hex: c.hex ?? undefined,
            })),
            images,
            categorySlug,
          }}
          dict={{
            addToCart: dict.product.addToCart,
            added: dict.product.added,
            onRequest: dict.product.onRequest,
            requestNow: dict.product.requestNow,
            variant: dict.product.variant,
            color: dict.product.color,
            priceNote: dict.product.priceNote,
            shippingPerItem: dict.product.shippingPerItem,
            freeShipping: dict.product.freeShipping,
            pickupAvailable: dict.product.pickupAvailable,
            unavailable: dict.product.unavailable,
            craftNotice: settings?.craft?.notice ?? null,
            craft: dict.craft,
            inquiry: {
              name: dict.contact.name,
              email: dict.contact.email,
              phone: dict.contact.phone,
              message: dict.contact.message,
              send: dict.contact.send,
              success: dict.contact.success,
              error: dict.contact.error,
            },
          }}
          shortDescription={product.shortDescription ?? undefined}
        />
      </div>

      {product.description ? (
        <Reveal className="mt-14 max-w-3xl">
          <RichText data={product.description} />
        </Reveal>
      ) : null}

      {testimonials.length > 0 && (
        <div className="mt-14 max-w-3xl space-y-6">
          <h2 className="tracking-nav text-ink text-lg font-semibold uppercase">
            {dict.testimonials.title}
          </h2>
          {testimonials.map((tst) => (
            <Reveal key={tst.id}>
              <figure className="border-line border bg-white p-6">
                <blockquote className="text-ink-soft leading-relaxed">
                  „{tst.quote}&ldquo;
                </blockquote>
                <figcaption className="mt-3">
                  <span className="tracking-nav text-ink text-sm font-semibold uppercase">
                    {tst.author}
                  </span>
                  {tst.context && (
                    <span className="text-ink-soft text-xs">
                      {" "}
                      · {tst.context}
                    </span>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      )}

      {referenzen.length > 0 && (
        <div className="mt-16">
          <h2 className="tracking-nav text-ink heading-rule text-lg font-semibold uppercase">
            {dict.custom.seenInProjects}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {referenzen.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/${locale}/projekte/${r.slug}`}
                  className="group block"
                >
                  <div className="bg-paper-soft overflow-hidden">
                    <Bild
                      media={r.images?.[0] as BildQuelle}
                      alt={r.title}
                      bevorzugt="card"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="group-hover:text-bronze mt-3 text-sm font-semibold transition-colors">
                    {r.title}
                  </p>
                  {r.client && (
                    <p className="text-ink-soft text-xs">{r.client}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MassanfertigungHinweis
        locale={locale}
        text={dict.custom.cta}
        label={dict.custom.title}
      />
    </div>
  );
}
