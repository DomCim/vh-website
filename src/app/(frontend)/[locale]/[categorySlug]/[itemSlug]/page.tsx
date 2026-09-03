import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
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
import { aktionFuerArtikel, mitRabatt } from "../../../../../lib/aktionspreis";
import { bildKennung, galerieErgaenzen } from "../../../../../lib/artikelbilder";
import {
  getCategoryBySlug,
  getPreisaktionen,
  getProductBySlug,
  getProjectsForProduct,
  getSiteSettings,
  getTestimonialsForProduct,
  mediaAlt,
  mediaUrl,
  payloadClient,
} from "../../../../../lib/data";
import { isLocale, t } from "../../../../../lib/i18n";
import {
  absoluteUrl,
  alternatesFor,
  BASE_URL,
  breadcrumbJsonLd,
  jsonLd,
  versandUndRueckgabe,
} from "../../../../../lib/seo";
import { versandzonen } from "../../../../../lib/versand";

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
  /*
   * Die maßgebliche Adresse kommt vom Artikel, nicht aus dem Aufruf.
   *
   * Ein Artikel gehört zu **einer** Kategorie; jede andere im Pfad ist ein
   * Irrtum. Die Seite leitet solche Aufrufe inzwischen dorthin um, wo der
   * Artikel wirklich steht (siehe unten) — aber die Angabe hier bleibt: Sie
   * wird berechnet, bevor die Umleitung greift, und ein `canonical` aus dem
   * Aufruf erklärte jede Falschadresse zur maßgeblichen. Zwei Seiten mit
   * demselben Inhalt bekommen dann halb so viel Gewicht wie eine.
   */
  const eigeneKategorie =
    typeof product.category === "object" && product.category
      ? ((product.category as { slug?: string }).slug ?? categorySlug)
      : categorySlug;
  return {
    title: product.title,
    description: product.shortDescription || undefined,
    alternates: alternatesFor(locale, `/${eigeneKategorie}/${itemSlug}`),
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

  /*
   * Wohin geliefert wird, kommt aus den Versandzonen — derselben Quelle, aus
   * der die Kasse rechnet. Stünde hier eine eigene Liste, versprächen die
   * strukturierten Daten etwas, das an der Kasse nicht gilt.
   */
  const zonen = await versandzonen(await payloadClient());

  /*
   * Die Adresse, unter der der Artikel wirklich einsortiert ist — siehe die
   * Begründung bei `alternatesFor` weiter oben. Sie gilt auch für die
   * Auszeichnungen: Was Google als Adresse des Artikels und als Weg dorthin
   * bekommt, muss dieselbe sein, die oben als maßgeblich steht.
   */
  const kanonischeKategorie =
    typeof product.category === "object" && product.category
      ? ((product.category as { slug?: string }).slug ?? categorySlug)
      : categorySlug;
  const artikelPfad = `/${kanonischeKategorie}/${itemSlug}`;

  /*
   * Falsche Kategorie in der Adresse? Dann dorthin, wo der Artikel wirklich
   * steht.
   *
   * Bis hierher wurde nur geprüft, ob es die Kategorie *gibt* und ob es den
   * Artikel *gibt* — nie, ob beide zusammengehören. Damit war jeder Artikel
   * unter jeder Kategorie erreichbar: `/de/maschinenbau/outdoor-sessel-os`
   * lieferte den Gartensessel, mit „Maschinenbau" im Brotkrumen-Pfad. Bei
   * vierzehn Kategorien ist das die vierzehnfache Zahl an Adressen für
   * dieselbe Seite — und Google meldete nicht ohne Grund „Duplikat".
   *
   * Aufgefallen ist es nie, weil `rel=canonical` seit jeher auf die richtige
   * Adresse zeigt: Google räumte still hinter uns auf. Ein Mensch, der über so
   * einen Link kommt, sieht dagegen die falsche Einordnung.
   *
   * Umgeleitet statt abgewiesen: Solche Adressen stehen in Suchmaschinen und
   * in fremden Verweisen. Ein 404 verlöre sie; die dauerhafte Umleitung führt
   * den Besucher ans Ziel und sagt Google zugleich, welche Adresse gilt.
   */
  if (kanonischeKategorie !== categorySlug) {
    permanentRedirect(`/${locale}${artikelPfad}`);
  }

  /*
   * Läuft für diesen Artikel eine Aktion? Dann steht der Rabatt am Preis —
   * und nicht erst im Warenkorb, wie es bis eben war.
   */
  const aktion = aktionFuerArtikel(
    {
      id: product.id,
      categoryId:
        typeof product.category === "object" && product.category
          ? (product.category as { id?: number | string }).id
          : (product.category as number | string | null | undefined),
    },
    await getPreisaktionen(locale),
  );

  const testimonials = await getTestimonialsForProduct(product.id, locale);
  const settings = await getSiteSettings(locale);
  const referenzen = await getProjectsForProduct(product.id, locale);

  // Die Galerie bekommt alle Zuschnitte mit — das große Produktbild ist auf
  // dieser Seite das Wichtigste, und ein Handy soll dafür keine 1800 Pixel laden.
  const alsGaleriebild = (img: unknown) => {
    const quellen = bildQuellen(img as BildQuelle, "large");
    const url = quellen?.src || mediaUrl(img, "large") || "";
    if (!url) return null;
    return {
      // Die Kennung ordnet Farben und Varianten ihr Bild zu
      id: bildKennung(img as Parameters<typeof bildKennung>[0]),
      url,
      srcSet: quellen?.srcSet,
      width: quellen?.width,
      height: quellen?.height,
      alt: mediaAlt(img, product.title),
    };
  };

  /*
   * Farben und Varianten dürfen auf ein Bild zeigen, das nicht oben unter
   * „Bilder" steht — sonst müsste jemand jedes Farbbild zweimal eintragen und
   * würde es beim zweiten Mal vergessen. Solche Bilder hängen hinten an.
   */
  const images = galerieErgaenzen(
    (product.images ?? [])
      .map(alsGaleriebild)
      .filter((b): b is NonNullable<typeof b> => b !== null),
    [
      ...(product.colorOptions ?? []).map((c) => ({
        bezug: c.image,
        bild: alsGaleriebild(c.image),
      })),
      ...(product.variants ?? []).map((v) => ({
        bezug: v.image,
        bild: alsGaleriebild(v.image),
      })),
    ],
  );

  // schema.org-Produktdaten für Google Rich Results
  const prices = [
    ...(product.variants?.map((v) => v.price) ?? []),
    ...(typeof product.price === "number" ? [product.price] : []),
  ];
  const minPrice = prices.length ? Math.min(...prices) : undefined;
  /*
   * Sterne im Suchergebnis — aus denselben Stimmen, die unten auf der Seite
   * stehen.
   *
   * Zwei Regeln, und beide sind nicht verhandelbar: Google verlangt, dass die
   * Bewertung **auf der Seite sichtbar** ist (ist sie, weiter unten), und
   * gerechnet wird nur mit dem, was wirklich vergeben wurde. Eine Stimme ohne
   * Sterne zählt deshalb nicht als „5" und auch nicht als „0", sondern gar
   * nicht — sonst stünde am Ende eine Zahl da, die niemand abgegeben hat.
   *
   * Erfundene Bewertungen wären hier nicht nur unlauter, sondern kurzsichtig:
   * Google nimmt die Auszeichnung dauerhaft weg, wenn sie nicht zur Seite
   * passt.
   */
  const bewertet = testimonials.filter(
    (tst) => typeof tst.rating === 'number' && tst.rating >= 1 && tst.rating <= 5,
  )
  const schnitt = bewertet.length
    ? Math.round((bewertet.reduce((summe, tst) => summe + Number(tst.rating), 0) / bewertet.length) * 10) / 10
    : null

  const productJsonLd = jsonLd({
    "@type": "Product",
    name: product.title,
    description: product.shortDescription || undefined,
    image: images.map((i) => absoluteUrl(i.url)).filter(Boolean),
    url: `${BASE_URL}/${locale}${artikelPfad}`,
    brand: { "@type": "Brand", name: "Vincent Hellmann" },
    ...(schnitt !== null && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: schnitt,
        reviewCount: bewertet.length,
        bestRating: 5,
        worstRating: 1,
      },
      review: bewertet.slice(0, 5).map((tst) => ({
        "@type": "Review",
        author: { "@type": "Person", name: tst.author },
        reviewRating: { "@type": "Rating", ratingValue: tst.rating, bestRating: 5, worstRating: 1 },
        reviewBody: tst.quote,
        ...(tst.createdAt ? { datePublished: String(tst.createdAt).slice(0, 10) } : {}),
      })),
    }),
    /*
     * Der Preis für Google — derselbe, der auf der Seite steht.
     *
     * Läuft eine Aktion, ist das der rabattierte. Stünde hier weiter der alte,
     * wiese die Search Console eine Preisabweichung zwischen Auszeichnung und
     * Seite aus, und im Zweifel fällt das Suchergebnis samt Sternen weg.
     * `priceValidUntil` sagt dazu, wie lange die Angabe trägt.
     */
    ...(minPrice !== undefined &&
      !product.onRequestOnly && {
        offers: {
          "@type": "Offer",
          priceCurrency: "EUR",
          price: aktion ? mitRabatt(minPrice, aktion.prozent) : minPrice,
          ...(aktion ? { priceValidUntil: String(aktion.giltBis).slice(0, 10) } : {}),
          availability:
            product.available !== false
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: `${BASE_URL}/${locale}${artikelPfad}`,
          /*
           * Wer verkauft, gehört ans Angebot — und das ist der Betrieb und
           * nicht die Marke: Der Kaufvertrag kommt mit der Next-Concept SAS
           * zustande, genau so steht es in den AGB. Die Marke „Vincent
           * Hellmann" steht daneben in `brand`, wo sie hingehört.
           */
          seller: {
            "@type": "Organization",
            name:
              settings?.company?.legalName || settings?.siteName || "Vincent Hellmann",
            ...(settings?.company?.vatId ? { vatID: settings.company.vatId } : {}),
            url: BASE_URL,
          },
          /*
           * Versandkosten und Rückgabefrist gehören ans Angebot, nicht auf
           * eine Unterseite: Google zeigt beides unter dem Treffer an, und
           * ohne die Angaben bleibt dort die Zeile leer, in der bei der
           * Konkurrenz „Kostenloser Versand" steht. Begründung und Herkunft
           * der Werte in lib/seo.ts.
           */
          ...versandUndRueckgabe(product, zonen),
        },
      }),
  });

  // Der Weg, den Google unter dem Treffer zeigt
  const brotkrumen = breadcrumbJsonLd(locale, [
    { name: dict.nav.collection, pfad: "/kollektion" },
    { name: category?.name ?? kanonischeKategorie, pfad: `/${kanonischeKategorie}` },
    { name: product.title, pfad: artikelPfad },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: productJsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: brotkrumen }}
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
            digital: Boolean(product.digital),
            variants: (product.variants ?? []).map((v) => ({
              id: v.id,
              title: v.title,
              price: v.price,
              bildId: bildKennung(v.image) ?? undefined,
            })),
            colorOptions: (product.colorOptions ?? []).map((c) => ({
              name: c.name,
              hex: c.hex ?? undefined,
              bildId: bildKennung(c.image) ?? undefined,
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
            instead: dict.product.instead,
            promoUntil: dict.product.promoUntil,
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
          aktion={aktion}
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
              <figure className="border-line border bg-paper p-6">
                {/* Sichtbar auf der Seite — sonst darf die Bewertung auch
                    nicht im Suchergebnis stehen. Wer keine Sterne vergeben
                    hat, dessen Stimme steht ohne, und das ist kein Mangel. */}
                {typeof tst.rating === "number" && (
                  <div
                    className="text-bronze mb-2 text-sm"
                    aria-label={`${tst.rating} von 5`}
                  >
                    {"★".repeat(tst.rating)}
                    <span className="text-line">{"★".repeat(5 - tst.rating)}</span>
                  </div>
                )}
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
