import { locales, type Locale } from './i18n'

export const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** Kanonische URL + hreflang-Alternates für einen Pfad (ohne Locale-Präfix) */
export function alternatesFor(locale: Locale, path: string) {
  return {
    canonical: `${BASE_URL}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `${BASE_URL}/${l}${path}`])),
      'x-default': `${BASE_URL}/de${path}`,
    },
  }
}

/**
 * Der Brotkrumen-Pfad für das Suchergebnis.
 *
 * Google zeigt darüber statt der nackten Adresse den Weg an
 * („vincent-hellmann.com › Kollektion › Pflanzkübel"). Das ist keine Kosmetik:
 * Der Weg sagt vor dem Klick, wo man landet — und in einer Ergebnisliste
 * entscheidet das mit.
 *
 * Die Sprache steht im Pfad und gehört deshalb in jede Station; der Name ist
 * das, was der Mensch liest, nicht der Slug.
 */
export function breadcrumbJsonLd(
  locale: Locale,
  stationen: { name: string; pfad: string }[],
): string {
  return jsonLd({
    '@type': 'BreadcrumbList',
    itemListElement: stationen.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      item: `${BASE_URL}/${locale}${s.pfad}`,
    })),
  })
}

/** JSON-LD-Objekt als <script>-Inhalt (Server-Komponenten) */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify({ '@context': 'https://schema.org', ...data })
}

export function absoluteUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`
}

/**
 * Eine getippte Anschrift in ihre Bestandteile zerlegt.
 *
 * **Warum das nötig wurde.** Die Anschrift stand als ein Klumpen im Feld
 * `streetAddress`: „24, avenue Clemenceau 67630 Lauterbourg Frankreich".
 * Googles Prüfung meldete daraufhin, dass Postleitzahl, Ort und Land fehlen —
 * und für die örtliche Suche sind genau das die Angaben, an denen ein Betrieb
 * einem Ort zugeordnet wird. Eine Werkstatt, die man besuchen soll, will
 * dort gefunden werden.
 *
 * **Wie zerlegt wird.** Von hinten, weil das Ende einer Anschrift die feste
 * Reihenfolge hat: zuletzt das Land, davor „Postleitzahl Ort", davor die
 * Straße. Erkannt wird nur, was sicher erkennbar ist — passt eine Zeile nicht
 * ins Muster, bleibt sie Teil der Straße. Damit ist der schlechteste Fall
 * genau der Zustand von vorher und nie ein falsch einsortierter Wert: Eine
 * erfundene Postleitzahl schickte jemanden in den falschen Ort.
 *
 * Das Land geht als Kürzel hinaus (`FR`, `DE`), weil schema.org es so
 * erwartet; ein unbekanntes bleibt stehen, wie es dasteht.
 */
const LAENDERKUERZEL: Record<string, string> = {
  frankreich: 'FR',
  france: 'FR',
  deutschland: 'DE',
  allemagne: 'DE',
  germany: 'DE',
  schweiz: 'CH',
  suisse: 'CH',
  switzerland: 'CH',
  österreich: 'AT',
  autriche: 'AT',
  austria: 'AT',
  luxemburg: 'LU',
  luxembourg: 'LU',
  belgien: 'BE',
  belgique: 'BE',
  belgium: 'BE',
}

/** Die Angaben, aus denen die Unternehmensdaten entstehen */
export type BetriebsAngaben = {
  siteName?: string | null
  tagline?: string | null
  contact?: { phone?: string | null; email?: string | null; address?: string | null } | null
  company?: { legalName?: string | null; vatId?: string | null; siret?: string | null } | null
  social?: { facebook?: string | null; instagram?: string | null; youtube?: string | null } | null
} | null

/**
 * Der Betrieb als `LocalBusiness` — was Suchmaschinen über die Werkstatt
 * erfahren.
 *
 * **Zwei Namen, und beide gehören hin.** `name` ist die Marke, „Vincent
 * Hellmann": Danach wird gesucht, unter dem Namen steht die Werkstatt auf
 * jedem Stück, und er gehört ins Suchergebnis. `legalName` ist der Betrieb
 * dahinter — Next-Concept SAS, so wie er im RCS steht und auf jeder Rechnung.
 *
 * Bis 09/2026 stand hier nur die Marke. Rechtlich war das kein Mangel, dafür
 * ist das Impressum da. Für eine Suchmaschine war es aber ein Betrieb ohne
 * Träger: eine Anschrift, eine Telefonnummer, ein Name — und keine Verbindung
 * zu dem eingetragenen Unternehmen an derselben Anschrift. Umsatzsteuer-
 * Nummer und SIRET stehen aus demselben Grund dabei: Sie sind der eindeutige
 * Schlüssel auf den Betrieb und ohnehin öffentlich.
 *
 * Steht hier und nicht im Grundgerüst, damit es sich prüfen lässt. Was
 * unsichtbar im Kopf der Seite steht, fällt beim Ansehen nie auf.
 */
export function localBusinessJsonLd(einstellungen: BetriebsAngaben): string {
  return jsonLd({
    // LocalBusiness statt reiner Organization: eine Werkstatt mit Anschrift,
    // die Suchmaschinen regional zuordnen können
    '@type': 'LocalBusiness',
    name: einstellungen?.siteName || 'Vincent Hellmann',
    ...(einstellungen?.company?.legalName && { legalName: einstellungen.company.legalName }),
    ...(einstellungen?.company?.vatId && { vatID: einstellungen.company.vatId }),
    ...(einstellungen?.company?.siret && {
      identifier: {
        '@type': 'PropertyValue',
        propertyID: 'SIRET',
        value: einstellungen.company.siret,
      },
    }),
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    // Das Logo doppelt als Bild: Google verlangt `logo` und nimmt `image`
    image: `${BASE_URL}/logo.png`,
    ...(einstellungen?.contact?.phone && { telephone: einstellungen.contact.phone }),
    ...(einstellungen?.contact?.email && { email: einstellungen.contact.email }),
    ...(einstellungen?.contact?.address && {
      address: postalAddress(einstellungen.contact.address),
    }),
    ...(einstellungen?.tagline && { description: einstellungen.tagline }),
    sameAs: [
      einstellungen?.social?.facebook,
      einstellungen?.social?.instagram,
      einstellungen?.social?.youtube,
    ].filter(Boolean),
  })
}

export function postalAddress(text?: string | null): Record<string, string> | undefined {
  const zeilen = (text ?? '')
    .split('\n')
    .map((z) => z.trim())
    .filter(Boolean)
  if (zeilen.length === 0) return undefined

  const adresse: Record<string, string> = { '@type': 'PostalAddress' }

  // Das Land steht ganz unten — aber nur, wenn darüber noch etwas steht
  if (zeilen.length > 1) {
    const kuerzel = LAENDERKUERZEL[zeilen[zeilen.length - 1].toLocaleLowerCase('de')]
    if (kuerzel) {
      adresse.addressCountry = kuerzel
      zeilen.pop()
    }
  }

  // „67630 Lauterbourg" — vier- oder fünfstellige Zahl, dann der Ort
  if (zeilen.length > 1) {
    const treffer = /^(\d{4,5})\s+(.+)$/.exec(zeilen[zeilen.length - 1])
    if (treffer) {
      adresse.postalCode = treffer[1]
      adresse.addressLocality = treffer[2]
      zeilen.pop()
    }
  }

  if (zeilen.length) adresse.streetAddress = zeilen.join(', ')
  return adresse
}

/*
 * Wohin geliefert wird, steht seit 08/2026 in den Versandzonen
 * (`lib/versand.ts`) und wird hier hereingereicht.
 *
 * Vorher stand die Liste an dieser Stelle fest verdrahtet — und eine zweite,
 * andere im Produktfeed. Die eine nannte die Schweiz, die andere nicht, und
 * die Kasse wusste von keiner der beiden. Was unter einem Suchergebnis steht,
 * ist aber eine Zusage: Es muss dasselbe sein, was die Kasse rechnet.
 */

/** Widerrufsfrist in Tagen — der gesetzliche Regelfall im Verkauf an Verbraucher. */
export const WIDERRUFSTAGE = 14

/**
 * Versand- und Rückgabebedingungen als maschinenlesbare Angabe.
 *
 * **Warum das überhaupt hier steht.** Der Test für strukturierte Daten
 * bemängelte drei fehlende Felder am Angebot, alle als „optional"
 * gekennzeichnet. Optional sind sie nur für die Prüfung; für die Anzeige sind
 * sie es nicht: Ohne `shippingDetails` und `hasMerchantReturnPolicy` zeigt
 * Google unter dem Treffer weder Versandkosten noch Rückgabefrist, und im
 * Merchant Center gelten fehlende Rückgabebedingungen als Mangel am Konto,
 * nicht am einzelnen Artikel.
 *
 * **Die Angaben sind verbindlich, deshalb kommen sie aus echten Daten.** Die
 * Versandkosten sind die des Artikels — dieselbe Zahl, die in der Kasse
 * berechnet wird. Wer hier großzügig rundet, produziert eine Abweichung
 * zwischen Auszeichnung und Seite, und die kostet im Zweifel das ganze
 * Suchergebnis samt Preis.
 *
 * **Nicht jeder Artikel bekommt eine Rückgabefrist.** Bei digitaler Ware
 * erlischt das Widerrufsrecht mit der Lieferung — dort wäre eine
 * 14-Tage-Zusage schlicht falsch. Die Entscheidung fällt am `digital`-Häkchen,
 * an dem auch die Kasse hängt.
 *
 * Die Rücksendekosten trägt der Kunde (Entscheidung Dominik 08/2026, bei
 * Speditionsware für schwere Stahlmöbel die übliche Regelung). Das muss so
 * auch in der Widerrufsbelehrung stehen — sonst gilt es nicht, gleich was
 * hier ausgezeichnet ist.
 */
export type Versandangabe = {
  '@type': 'OfferShippingDetails'
  shippingRate: { '@type': 'MonetaryAmount'; value: number; currency: 'EUR' }
  shippingDestination: { '@type': 'DefinedRegion'; addressCountry: string }[]
}

export type Angebotsdaten = {
  /** Eine Angabe je Zone; bei nur einer Zone steht sie einzeln statt in einer Liste */
  shippingDetails?: Versandangabe | Versandangabe[]
  hasMerchantReturnPolicy?: {
    '@type': 'MerchantReturnPolicy'
    applicableCountry: string[]
    returnPolicyCategory: string
    merchantReturnDays: number
    returnMethod: string
    returnFees: string
  }
}

export function versandUndRueckgabe(
  artikel: { shippingCost?: number | null; digital?: boolean | null },
  zonen: { laender: string[]; aufschlag: number }[],
): Angebotsdaten {
  const laender = zonen.flatMap((z) => z.laender)
  if (!laender.length) return {}

  /*
   * Je Zone eine eigene Angabe, nicht eine für alle.
   *
   * Schema.org erlaubt mehrere `OfferShippingDetails` nebeneinander, und
   * genau dafür sind sie da: Wenn die Lieferung in die Schweiz achtzig Euro
   * mehr kostet, ist eine gemeinsame Zahl für alle Länder entweder für die
   * einen zu hoch oder für die anderen eine falsche Zusage. Bei nur einer
   * Zone bleibt es eine einzige Angabe — dann fällt der Unterschied nicht an.
   */
  const grund = artikel.digital ? 0 : (artikel.shippingCost ?? 0)
  const versand: Versandangabe[] = zonen.map((z) => ({
    '@type': 'OfferShippingDetails' as const,
    shippingRate: {
      '@type': 'MonetaryAmount' as const,
      value: artikel.digital ? 0 : Math.round((grund + z.aufschlag) * 100) / 100,
      currency: 'EUR' as const,
    },
    shippingDestination: z.laender.map((land) => ({
      '@type': 'DefinedRegion' as const,
      addressCountry: land,
    })),
  }))

  return {
    shippingDetails: versand.length === 1 ? versand[0] : versand,
    ...(artikel.digital
      ? {}
      : {
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy' as const,
            applicableCountry: laender,
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: WIDERRUFSTAGE,
            returnMethod: 'https://schema.org/ReturnByMail',
            // Der Kunde trägt die Rücksendung — genau das sagt dieser Wert.
            returnFees: 'https://schema.org/ReturnShippingFees',
          },
        }),
  }
}
