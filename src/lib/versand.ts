import type { Payload } from 'payload'

/**
 * Wohin geliefert wird, und was es dorthin kostet.
 *
 * **Warum das eine eigene Stelle bekommt.** Die Angabe stand bis hierher
 * dreimal im Haus und dreimal anders: Die Kasse rechnete einen festen Betrag
 * je Stück, ganz ohne Blick auf die Anschrift; der Produktfeed nannte
 * Frankreich, Deutschland und Österreich; die strukturierten Daten nannten
 * zusätzlich die Schweiz. Das Länderfeld in der Kasse war freier Text — dort
 * kam „Schweiz", „CH" und „Suisse" gleichermaßen an, und keines davon ließ
 * sich verrechnen.
 *
 * Was daraus folgte, ist der eigentliche Anlass: Eine Speditionssendung in
 * die Schweiz kostet ein Vielfaches einer Lieferung innerhalb Frankreichs —
 * bezahlt wurde aber überall derselbe Betrag. Und weil unter dem
 * Suchergebnis „Lieferung in die Schweiz" stand, war das keine Nachlässigkeit
 * mehr, sondern eine Zusage.
 *
 * **Jetzt gibt es Zonen, und alle drei lesen dieselben.** Eine Zone hält eine
 * Länderliste und einen Aufschlag je Stück auf den Versand des Artikels. Ein
 * Land, das in keiner Zone steht, wird nicht beliefert — die Kasse bietet es
 * gar nicht erst an, und der Feed nennt es nicht.
 *
 * **Der Aufschlag liegt an der Zone, nicht am Artikel.** Ein Faktor wäre
 * verlockend („Schweiz kostet das Doppelte"), geht aber an der Sache vorbei:
 * Beim Speditionsgut steigt der Preis mit der Entfernung und dem Zollpapier,
 * nicht mit dem Warenwert. Ein Aufschlag trifft das besser und lässt sich
 * außerdem am Angebot des Spediteurs ablesen.
 */

/**
 * Die Länder, die überhaupt zur Auswahl stehen.
 *
 * Bewusst eine kurze Liste und nicht die ganze Welt: Was hier steht, kann in
 * einer Zone landen und wird dann auch beliefert. Eine Auswahl mit
 * zweihundert Ländern lädt dazu ein, versehentlich Neuseeland freizuschalten.
 * Fehlt eines, gehört es hier ergänzt — das ist Absicht.
 */
export const LAENDER = [
  { code: 'FR', de: 'Frankreich', fr: 'France', en: 'France' },
  { code: 'DE', de: 'Deutschland', fr: 'Allemagne', en: 'Germany' },
  { code: 'AT', de: 'Österreich', fr: 'Autriche', en: 'Austria' },
  { code: 'BE', de: 'Belgien', fr: 'Belgique', en: 'Belgium' },
  { code: 'LU', de: 'Luxemburg', fr: 'Luxembourg', en: 'Luxembourg' },
  { code: 'NL', de: 'Niederlande', fr: 'Pays-Bas', en: 'Netherlands' },
  { code: 'IT', de: 'Italien', fr: 'Italie', en: 'Italy' },
  { code: 'ES', de: 'Spanien', fr: 'Espagne', en: 'Spain' },
  { code: 'CH', de: 'Schweiz', fr: 'Suisse', en: 'Switzerland' },
] as const

export type Landcode = (typeof LAENDER)[number]['code']

/**
 * Wo in Euro bezahlt wird.
 *
 * Wichtig für den Produktfeed: Der rechnet ausschließlich in Euro, und Google
 * vergleicht die Angabe mit dem, was an der Kasse wirklich verlangt wird. Für
 * die Schweiz wäre ein Euro-Betrag im Feed schlicht falsch — dorthin wird
 * geliefert und in der Kasse in Euro abgerechnet, im Merchant Center aber
 * bräuchte es Franken. Bis das geklärt ist, bleibt sie aus dem Feed heraus;
 * aus der Kasse und den strukturierten Daten ausdrücklich nicht.
 */
export const EURO_LAENDER = new Set(['FR', 'DE', 'AT', 'BE', 'LU', 'NL', 'IT', 'ES'])

export type Zone = {
  name: string
  laender: string[]
  /** Aufschlag je Stück auf den Versand des Artikels, in Euro */
  aufschlag: number
  /** Steht in der Kasse unter der Länderauswahl, z. B. wegen Zoll */
  hinweis?: string
}

/**
 * Was gilt, solange niemand Zonen gepflegt hat.
 *
 * **Der Standard bildet genau den Zustand von vorher ab** — dieselben drei
 * Länder wie im Produktfeed, kein Aufschlag, also der Betrag des Artikels.
 * Das ist wichtiger, als es aussieht: Eine leere Einstellung darf den Shop
 * nicht anhalten und auch nicht heimlich teurer machen. Wer nichts tut,
 * bekommt das, was er hatte.
 *
 * Die Schweiz steht bewusst **nicht** dabei. Sie war bis hierher nur in den
 * strukturierten Daten versprochen, nie in der Kasse berechnet; sie ohne
 * Aufschlag mitzunehmen hieße, das Versprechen zum Verlustgeschäft zu
 * machen. Wer dorthin liefern will, legt eine Zone mit dem Aufschlag an, den
 * der Spediteur nennt.
 */
export const STANDARD_ZONEN: Zone[] = [
  { name: 'Frankreich und Nachbarn', laender: ['FR', 'DE', 'AT'], aufschlag: 0 },
]

/** Die gepflegten Zonen — oder der Standard, wenn keine gepflegt sind. */
export async function versandzonen(payload: Payload): Promise<Zone[]> {
  try {
    const g = (await payload.findGlobal({ slug: 'versand', depth: 0 })) as {
      zonen?: { name?: string | null; laender?: string[] | null; aufschlag?: number | null; hinweis?: string | null }[] | null
    }
    const gepflegt = (g?.zonen ?? [])
      .map((z) => ({
        name: z.name ?? '',
        laender: (z.laender ?? []).filter(Boolean),
        aufschlag: typeof z.aufschlag === 'number' ? z.aufschlag : 0,
        hinweis: z.hinweis ?? undefined,
      }))
      .filter((z) => z.laender.length > 0)
    return gepflegt.length ? gepflegt : STANDARD_ZONEN
  } catch {
    /*
     * Ohne Einstellung ist der Shop nicht kaputt — er ist wie vorher.
     * Gerade beim ersten Start nach dem Einspielen gibt es die Zeile noch
     * nicht, und eine Kasse, die daran scheitert, wäre ein schlechter Tausch.
     */
    return STANDARD_ZONEN
  }
}

/** Die Zone zu einem Land — oder nichts, wenn dorthin nicht geliefert wird. */
export function zoneFuer(zonen: Zone[], land: string | null | undefined): Zone | null {
  if (!land) return null
  const code = land.trim().toUpperCase()
  return zonen.find((z) => z.laender.includes(code)) ?? null
}

/** Alle belieferten Länder, in der Reihenfolge der Zonen. */
export function belieferteLaender(zonen: Zone[]): string[] {
  const gesehen = new Set<string>()
  const raus: string[] = []
  for (const z of zonen) {
    for (const l of z.laender) {
      if (!gesehen.has(l)) {
        gesehen.add(l)
        raus.push(l)
      }
    }
  }
  return raus
}

/**
 * Was ein Stück dieses Artikels in dieses Land kostet.
 *
 * Ohne Land gilt der Betrag des Artikels — das ist der Fall, bevor jemand in
 * der Kasse eine Anschrift eingetippt hat, und der Fall im Produktfeed, wo je
 * Land ohnehin eine eigene Zeile steht.
 */
export function versandJeStueck(
  artikelVersand: number | null | undefined,
  zone: Zone | null,
): number {
  const grund = typeof artikelVersand === 'number' ? artikelVersand : 0
  return Math.round((grund + (zone?.aufschlag ?? 0)) * 100) / 100
}

/** Der Name eines Landes in der Sprache des Kunden — für Anschrift und Anzeige. */
export function landName(code: string, sprache: 'de' | 'fr' | 'en' = 'de'): string {
  const l = LAENDER.find((x) => x.code === code.trim().toUpperCase())
  return l ? l[sprache] : code
}
