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
 * Die Länder, in die geliefert wird.
 *
 * Bis hierher stand das nirgends im Code: Das Länderfeld in der Kasse ist
 * freier Text mit einem Vorschlag je nach Sprache. Für Google muss es
 * konkret sein — „wir liefern schon irgendwohin" ist keine Angabe, die sich
 * unter einem Suchergebnis anzeigen lässt.
 *
 * Entscheidung Dominik (08/2026). Die Schweiz ist dabei, obwohl dort Zoll
 * und Einfuhrumsatzsteuer anfallen — das trifft den Kunden, nicht die
 * Lieferfähigkeit.
 */
export const LIEFERLAENDER = ['FR', 'DE', 'AT', 'CH'] as const

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
export function versandUndRueckgabe(artikel: { shippingCost?: number | null; digital?: boolean | null }) {
  const laender = [...LIEFERLAENDER]
  return {
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: artikel.digital ? 0 : (artikel.shippingCost ?? 0),
        currency: 'EUR',
      },
      shippingDestination: laender.map((land) => ({
        '@type': 'DefinedRegion',
        addressCountry: land,
      })),
    },
    ...(artikel.digital
      ? {}
      : {
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
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
