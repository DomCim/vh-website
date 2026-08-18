"use client";

import { motion } from "motion/react";
import React, { useMemo, useState } from "react";

import { formatPrice, type Locale } from "../../lib/i18n";
import { useCart } from "./CartProvider";
import { ProductInquiryForm } from "./ProductInquiryForm";

type ProductProps = {
  id: number | string;
  slug: string;
  title: string;
  price?: number;
  shippingCost?: number;
  onRequestOnly: boolean;
  available: boolean;
  productionTime?: string | null;
  readyMade?: boolean;
  variants: { title: string; price: number }[];
  colorOptions: { name: string; hex?: string }[];
  images: {
    url: string;
    alt: string;
    /** Alle Zuschnitte, damit der Browser die passende Größe wählt */
    srcSet?: string;
    width?: number;
    height?: number;
  }[];
  categorySlug: string;
};

type Dict = {
  addToCart: string;
  added: string;
  onRequest: string;
  requestNow: string;
  variant: string;
  color: string;
  priceNote: string;
  shippingPerItem: string;
  freeShipping: string;
  pickupAvailable: string;
  unavailable: string;
  craftNotice?: string | null;
  craft: {
    productionTime: string;
    readyMade: string;
    readyMadeNote: string;
  };
  inquiry: {
    name: string;
    email: string;
    phone: string;
    message: string;
    send: string;
    success: string;
    error: string;
  };
};

export function ProductDetail({
  locale,
  product,
  dict,
  shortDescription,
}: {
  locale: Locale;
  product: ProductProps;
  dict: Dict;
  shortDescription?: string;
}) {
  const { addItem } = useCart();
  const [imageIndex, setImageIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const hasVariants = product.variants.length > 0;
  const unitPrice = useMemo(() => {
    if (hasVariants) return product.variants[variantIndex]?.price;
    return product.price;
  }, [hasVariants, product.price, product.variants, variantIndex]);

  const canBuy =
    product.available &&
    !product.onRequestOnly &&
    typeof unitPrice === "number";

  function handleAdd() {
    if (!canBuy || typeof unitPrice !== "number") return;
    addItem({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      variantTitle: hasVariants
        ? product.variants[variantIndex]?.title
        : undefined,
      color: product.colorOptions[colorIndex]?.name,
      unitPrice,
      shippingCost: product.shippingCost ?? 0,
      quantity: 1,
      image: product.images[0]?.url,
      categorySlug: product.categorySlug,
      // Fertige Werkstattstücke liegen schon da; alles andere entsteht erst
      // nach der Bestellung — und zwar nach Vorgabe.
      madeToOrder: !product.readyMade,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  }

  return (
    <>
      <div>
        <motion.div
          key={imageIndex}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="bg-paper-soft aspect-[4/3] overflow-hidden"
        >
          {product.images[imageIndex] && (
            <img
              src={product.images[imageIndex].url}
              srcSet={product.images[imageIndex].srcSet}
              // Nebeneinander mit den Angaben, darunter volle Breite
              sizes="(min-width: 1024px) 55vw, 100vw"
              width={product.images[imageIndex].width}
              height={product.images[imageIndex].height}
              alt={product.images[imageIndex].alt}
              className="h-full w-full object-cover"
              // Das erste Produktbild steht ganz oben — es darf nicht warten
              fetchPriority={imageIndex === 0 ? "high" : undefined}
            />
          )}
        </motion.div>
        {product.images.length > 1 && (
          <div className="mt-3 flex gap-3 overflow-x-auto">
            {product.images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImageIndex(i)}
                className={`bg-paper-soft h-20 w-24 shrink-0 overflow-hidden border transition-colors ${
                  i === imageIndex
                    ? "border-ink"
                    : "border-line hover:border-ink-soft"
                }`}
              >
                <img
                  src={img.url}
                  srcSet={img.srcSet}
                  sizes="96px"
                  alt={img.alt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h1 className="tracking-nav text-ink text-2xl font-semibold uppercase sm:text-3xl">
          {product.title}
        </h1>
        {shortDescription && (
          <p className="text-ink-soft mt-4 leading-relaxed">
            {shortDescription}
          </p>
        )}

        {hasVariants && (
          <div className="mt-8">
            <p className="tracking-nav text-ink mb-2 text-xs font-semibold uppercase">
              {dict.variant}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setVariantIndex(i)}
                  className={`border px-4 py-2 text-sm transition-colors ${
                    i === variantIndex
                      ? "border-ink bg-ink text-white"
                      : "border-line text-ink hover:border-ink"
                  }`}
                >
                  {v.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.colorOptions.length > 0 && (
          <div className="mt-6">
            <p className="tracking-nav text-ink mb-2 text-xs font-semibold uppercase">
              {dict.color}:{" "}
              <span className="font-normal normal-case">
                {product.colorOptions[colorIndex]?.name}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {product.colorOptions.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  title={c.name}
                  onClick={() => setColorIndex(i)}
                  className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${
                    i === colorIndex ? "border-ink" : "border-line"
                  }`}
                  style={{ backgroundColor: c.hex || "#d4d4d4" }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          {!product.available ? (
            <p className="text-accent font-medium">{dict.unavailable}</p>
          ) : product.onRequestOnly || typeof unitPrice !== "number" ? (
            <>
              <p className="text-ink text-xl font-semibold">{dict.onRequest}</p>
              <ProductInquiryForm
                productTitle={product.title}
                productUrl={`/${locale}/${product.categorySlug}/${product.slug}`}
                labels={{
                  requestNow: dict.requestNow,
                  ...dict.inquiry,
                }}
              />
            </>
          ) : (
            <>
              <p className="text-ink text-2xl font-semibold">
                {formatPrice(unitPrice, locale)}
              </p>
              <p className="text-ink-soft mt-1 text-xs">
                {dict.priceNote}
                {" · "}
                {product.shippingCost && product.shippingCost > 0
                  ? `+ ${formatPrice(product.shippingCost, locale)} ${dict.shippingPerItem}`
                  : dict.freeShipping}
                {" · "}
                {dict.pickupAvailable}
              </p>
              <FertigungsHinweis product={product} dict={dict} />
              <motion.button
                type="button"
                onClick={handleAdd}
                whileTap={{ scale: 0.96 }}
                className={`tracking-nav mt-5 cursor-pointer px-8 py-3 text-xs font-semibold text-white uppercase transition-colors ${
                  justAdded ? "bg-green-700" : "bg-ink hover:bg-bronze"
                }`}
              >
                {justAdded ? dict.added : dict.addToCart}
              </motion.button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Es gibt keine Serienfertigung — entweder steht das Stück fertig in der
 * Werkstatt oder es wird für die Kundschaft gefertigt. Beides gehört vor den
 * Kauf, damit die Wartezeit und kleine Abweichungen niemanden überraschen.
 */
function FertigungsHinweis({
  product,
  dict,
}: {
  product: ProductProps;
  dict: Dict;
}) {
  return (
    <div className="border-line text-ink-soft mt-4 border-l-2 pl-3 text-xs leading-relaxed">
      {product.readyMade ? (
        <p>
          <strong className="text-ink">{dict.craft.readyMade}</strong> —{" "}
          {dict.craft.readyMadeNote}
        </p>
      ) : product.productionTime ? (
        <p>
          <strong className="text-ink">{dict.craft.productionTime}:</strong>{" "}
          {product.productionTime}
        </p>
      ) : null}
      {dict.craftNotice && <p className="mt-1">{dict.craftNotice}</p>}
    </div>
  );
}
