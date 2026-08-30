import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";

import { Bild, bildQuellen, type BildQuelle } from "../../../components/Bild";

import { CategoryTile } from "../../../components/CategoryTile";
import { Fragen, gueltigeFragen } from "../../../components/Fragen";
import { HeroCarousel, type HeroSlide } from "../../../components/HeroCarousel";
import { ImageReveal } from "../../../components/motion/ImageReveal";
import { Marquee } from "../../../components/motion/Marquee";
import { Parallax } from "../../../components/motion/Parallax";
import {
  Reveal,
  RevealItem,
  RevealStagger,
} from "../../../components/motion/Reveal";
import { SplitTextReveal } from "../../../components/motion/SplitTextReveal";
import { TerminKarte } from "../../../components/Termine";
import { PromoBanner } from "../../../components/PromoBanner";
import {
  getActivePromotions,
  getFeaturedProjects,
  getFeaturedTestimonials,
  getHomepage,
  getMainCategories,
  getNews,
  getSiteSettings,
  mediaAlt,
  mediaUrl,
} from "../../../lib/data";
import { heroTintFor } from "../../../lib/heroColor";
import { payloadClient } from "../../../lib/data";
import { oeffentlicheTermine } from "../../../lib/kalender/oeffentlich";
import { formatDate, isLocale, t } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = t(locale);

  const [
    homepage,
    categories,
    news,
    promotions,
    featuredProjects,
    testimonials,
    settings,
    termine,
  ] = await Promise.all([
    getHomepage(locale),
    getMainCategories(locale),
    getNews(locale, 3),
    getActivePromotions(locale),
    getFeaturedProjects(locale),
    getFeaturedTestimonials(locale),
    getSiteSettings(locale),
    /*
     * Die naechsten drei oeffentlichen Termine.
     *
     * Nur drei: Die Startseite ist ein Schaufenster, keine Liste. Wer mehr
     * sehen will, folgt dem Weg zu `/termine` darunter.
     */
    payloadClient().then((p) => oeffentlicheTermine(p, locale, 3)),
  ]);

  /*
   * Ein Anriss der häufigen Fragen, nicht die ganze Liste.
   *
   * Die Fragen standen bisher allein unter „Maßanfertigung" — dort, wo sie
   * entstanden sind, und dort, wo sie kaum jemand sucht. Auf der Startseite
   * stehen die ersten vier offen da: Wer wissen will, wie lange eine Fertigung
   * dauert oder ob man abholen kann, bekommt die Antwort, ohne erst irgendwo
   * hinzuklicken. Der Rest steht eine Zeile weiter unter „Alle Fragen".
   *
   * Die Auszeichnung für Suchmaschinen sitzt bewusst nicht hier, sondern auf
   * `/faq` — sonst stritten Startseite und FAQ-Seite um denselben Treffer.
   */
  const fragen = gueltigeFragen(settings?.faq).slice(0, 4);

  const slides: HeroSlide[] = await Promise.all(
    (homepage?.heroSlides ?? []).map(async (s) => ({
      image: mediaUrl(s.image, "large"),
      // Der Hero ist das größte Bild der Seite; ohne srcset lädt ein Handy
      // dieselbe Datei wie ein 4K-Bildschirm.
      srcSet: bildQuellen(s.image as BildQuelle, "xl")?.srcSet,
      video: mediaUrl(s.video),
      alt: mediaAlt(s.image, s.title || ""),
      title: s.title,
      subtitle: s.subtitle,
      link: s.link,
      tint: await heroTintFor(s.image),
    })),
  );

  const gallery = homepage?.gallery ?? [];

  return (
    <>
      <HeroCarousel slides={slides} />

      {/* Der Farbton des aktiven Hero-Bildes strahlt hier weich ins Weiß aus */}
      <div className="hero-fade">
        {promotions.length > 0 && (
          <PromoBanner promotions={promotions} locale={locale} />
        )}

        {(homepage?.missionTitle || homepage?.missionText) && (
          <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
            {homepage.missionTitle && (
              <SplitTextReveal
                as="h1"
                text={homepage.missionTitle}
                className="tracking-nav text-ink rule-bronze rule-bronze-center text-2xl font-semibold uppercase sm:text-3xl"
              />
            )}
            {homepage.missionText && (
              <Reveal delay={0.25}>
                <p className="text-ink-soft mt-5 text-base leading-relaxed sm:text-lg">
                  {homepage.missionText}
                </p>
              </Reveal>
            )}
          </section>
        )}
      </div>

      <Marquee words={[...dict.home.marquee]} />

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SplitTextReveal
            text={dict.home.categoriesTitle}
            className="tracking-nav text-ink rule-bronze mb-8 text-xl font-semibold uppercase"
          />
          <RevealStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <RevealItem key={c.id}>
                <CategoryTile
                  href={`/${locale}/${c.slug}`}
                  name={c.name}
                  description={c.description}
                  image={c.image}
                />
              </RevealItem>
            ))}
          </RevealStagger>
        </section>
      )}

      {(homepage?.highlights?.length ?? 0) > 0 && (
        <section className="bg-paper-soft">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <SplitTextReveal
              text={dict.home.highlightsTitle}
              className="tracking-nav text-ink rule-bronze mb-8 text-xl font-semibold uppercase"
            />
            <RevealStagger className="grid gap-8 sm:grid-cols-3">
              {homepage!.highlights!.map((h, i) => (
                <RevealItem key={i}>
                  <h3 className="tracking-nav text-ink rule-bronze-sm text-sm font-semibold uppercase">
                    {h.title}
                  </h3>
                  {h.text && (
                    <p className="text-ink-soft mt-2 text-sm leading-relaxed">
                      {h.text}
                    </p>
                  )}
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SplitTextReveal
            text={dict.home.galleryTitle}
            className="tracking-nav text-ink rule-bronze mb-8 text-xl font-semibold uppercase"
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {gallery.map((img, i) => (
              <ImageReveal
                key={i}
                delay={i * 0.08}
                className="bg-paper-soft aspect-square"
              >
                <Parallax amount={16} className="h-full w-full">
                  <Bild
                    media={img as BildQuelle}
                    bevorzugt="card"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="h-full w-full scale-110 object-cover"
                  />
                </Parallax>
              </ImageReveal>
            ))}
          </div>
        </section>
      )}

      {(homepage?.values?.length ?? 0) > 0 && (
        <section className="bg-dark text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <SplitTextReveal
              text={dict.home.valuesTitle}
              className="tracking-nav rule-bronze mb-8 text-xl font-semibold uppercase"
            />
            <RevealStagger className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {homepage!.values!.map((v, i) => (
                <RevealItem key={i}>
                  <h3 className="tracking-nav rule-bronze-sm text-sm font-semibold uppercase">
                    {v.title}
                  </h3>
                  {v.text && (
                    <p className="mt-2 text-sm leading-relaxed text-white/75">
                      {v.text}
                    </p>
                  )}
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      )}

      {featuredProjects.length > 0 && (
        <section className="bg-paper-soft">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <Reveal>
              <div className="mb-8 flex items-baseline justify-between">
                <h2 className="tracking-nav text-ink rule-bronze text-xl font-semibold uppercase">
                  {dict.projects.homeTitle}
                </h2>
                <Link
                  href={`/${locale}/projekte`}
                  className="tracking-nav text-ink-soft hover:text-ink text-xs uppercase underline-offset-4 hover:underline"
                >
                  {dict.projects.viewAll} →
                </Link>
              </div>
            </Reveal>
            <RevealStagger className="grid gap-6 sm:grid-cols-3">
              {featuredProjects.map((p) => (
                <RevealItem key={p.id}>
                  <Link
                    href={`/${locale}/projekte/${p.slug}`}
                    className="group border-line block h-full border bg-paper transition-shadow hover:shadow-lg"
                  >
                    <div className="bg-paper-soft aspect-[4/3] overflow-hidden">
                      <Bild
                        media={p.images?.[0] as BildQuelle}
                        alt={p.title}
                        bevorzugt="card"
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5">
                      <p className="text-ink-soft text-xs uppercase">
                        {dict.projects.sectors[p.sector] ?? p.sector}
                        {p.year ? ` · ${p.year}` : ""}
                      </p>
                      <h3 className="tracking-nav text-ink mt-1 text-sm font-semibold uppercase">
                        {p.title}
                      </h3>
                    </div>
                  </Link>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SplitTextReveal
            text={dict.testimonials.title}
            className="tracking-nav text-ink rule-bronze mb-8 text-xl font-semibold uppercase"
          />
          <RevealStagger className="grid gap-6 sm:grid-cols-3">
            {testimonials.map((tst) => (
              <RevealItem key={tst.id}>
                <figure className="border-line flex h-full flex-col border bg-paper p-6">
                  <blockquote className="text-ink-soft flex-1 leading-relaxed">
                    „{tst.quote}&ldquo;
                  </blockquote>
                  <figcaption className="mt-4">
                    <p className="tracking-nav text-ink text-sm font-semibold uppercase">
                      {tst.author}
                    </p>
                    {tst.context && (
                      <p className="text-ink-soft text-xs">{tst.context}</p>
                    )}
                  </figcaption>
                </figure>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>
      )}

      {fragen.length > 0 && (
        <section className="bg-paper-soft">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <Reveal>
              <div className="mb-8 flex items-baseline justify-between gap-4">
                <h2 className="tracking-nav text-ink rule-bronze text-xl font-semibold uppercase">
                  {dict.faq.title}
                </h2>
                <Link
                  href={`/${locale}/faq`}
                  className="tracking-nav text-ink-soft hover:text-ink shrink-0 text-xs uppercase underline-offset-4 hover:underline"
                >
                  {dict.faq.all} →
                </Link>
              </div>
            </Reveal>
            <Reveal>
              <Fragen fragen={fragen} offenAb={0} />
            </Reveal>
          </div>
        </section>
      )}

      {/*
        * Wo Vincent als Naechstes zu finden ist.
        *
        * Steht ueber den News, weil ein Termin verfaellt und ein Beitrag
        * nicht: Was naechste Woche stattfindet, muss diese Woche gesehen
        * werden. Faellt nichts an, faellt der ganze Abschnitt weg — eine
        * Ueberschrift ueber einer leeren Flaeche sieht nach Baustelle aus.
        */}
      {termine.length > 0 && (
        <section className="bg-paper-soft">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <Reveal>
              <div className="mb-8 flex items-baseline justify-between">
                <h2 className="tracking-nav text-ink rule-bronze text-xl font-semibold uppercase">
                  {dict.events.homeTitle}
                </h2>
                <Link
                  href={`/${locale}/termine`}
                  className="tracking-nav text-ink-soft hover:text-ink text-xs uppercase underline-offset-4 hover:underline"
                >
                  {dict.events.all} →
                </Link>
              </div>
            </Reveal>
            <RevealStagger className="grid gap-4">
              {termine.map((termin) => (
                <RevealItem key={termin.id}>
                  <TerminKarte termin={termin} sprache={locale} />
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mb-8 flex items-baseline justify-between">
              <h2 className="tracking-nav text-ink rule-bronze text-xl font-semibold uppercase">
                {dict.home.newsTitle}
              </h2>
              <Link
                href={`/${locale}/news`}
                className="tracking-nav text-ink-soft hover:text-ink text-xs uppercase underline-offset-4 hover:underline"
              >
                {dict.home.allNews} →
              </Link>
            </div>
          </Reveal>
          <RevealStagger className="grid gap-6 sm:grid-cols-3">
            {news.map((n) => (
              <RevealItem key={n.id}>
                <Link
                  href={`/${locale}/news/${n.slug}`}
                  className="group border-line block border bg-paper transition-shadow hover:shadow-lg"
                >
                  <div className="bg-paper-soft aspect-[16/10] overflow-hidden">
                    <Bild
                      media={n.coverImage as BildQuelle}
                      alt={n.title}
                      bevorzugt="card"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-ink-soft text-xs">
                      {formatDate(n.publishedDate, locale)}
                    </p>
                    <h3 className="tracking-nav text-ink mt-1 text-sm font-semibold uppercase">
                      {n.title}
                    </h3>
                    {n.excerpt && (
                      <p className="text-ink-soft mt-2 line-clamp-3 text-sm">
                        {n.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>
      )}
    </>
  );
}
