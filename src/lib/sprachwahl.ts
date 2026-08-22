import { defaultLocale, isLocale, type Locale, locales } from './i18n'

/**
 * Welche Sprache ein Besucher zu sehen bekommt.
 *
 * Bisher landete jeder auf Deutsch — auch der Kunde aus Toulouse, der die
 * Adresse ohne Sprachkürzel eintippt oder einer Suchmaschine folgt. Die
 * Werkstatt steht in Frankreich; das war die falsche Voreinstellung für einen
 * guten Teil der Kundschaft, und der Weg zur richtigen Sprache führte über ein
 * Kürzel oben rechts, das man erst einmal finden muss.
 *
 * Die Regeln stehen hier und nicht in der Middleware, weil sie prüfbar sein
 * müssen: Es sind Entscheidungen über den ersten Eindruck, und die will man
 * nachmessen können, ohne einen Server zu starten.
 *
 * **Die eigene Wahl schlägt alles.** Wer einmal auf FR geklickt hat, hat
 * gesprochen. Ein Browser, der weiter Deutsch verlangt, ändert daran nichts —
 * sonst kippt die Seite bei jedem Besuch zurück, und der Klick von gestern war
 * umsonst.
 *
 * **Danach der Wunsch des Browsers, nicht die Region.** `Accept-Language` ist
 * die Sprache, die der Mensch eingestellt hat; die IP-Region ist nur der Ort,
 * an dem er gerade steht. Ein deutscher Kunde im Urlaub an der Küste bekäme
 * sonst Französisch, und geteilte Links führten je nach Standort woandershin.
 *
 * **Und wenn wir seine Sprache nicht sprechen: Englisch.** Wer Italienisch
 * eingestellt hat, ist mit einer deutschen Seite nicht besser bedient als mit
 * einer englischen — im Zweifel schlechter. Deutsch bleibt nur da, wo gar kein
 * Wunsch geäußert wird: Ein Aufruf ohne `Accept-Language` kommt von keinem
 * Menschen mit einer Vorliebe, sondern von einem Programm, und für das gilt
 * dieselbe Sprache wie in `x-default` — die des Hauses.
 *
 * **Eine Adresse mit Sprachkürzel bleibt, wie sie ist.** `/fr/kontakt` ist eine
 * Zusage: Wer den Link weitergibt, gibt die Sprache mit. Umgeleitet wird nur,
 * was gar keine Sprache nennt.
 */

/** Wo die getroffene Wahl steht. Ein Jahr, damit sie den Winter übersteht. */
export const SPRACH_COOKIE = 'vh-sprache'
export const SPRACH_COOKIE_TAGE = 365

/**
 * Die beste unterstützte Sprache aus einem `Accept-Language`-Kopf.
 *
 * Der Kopf sieht etwa so aus: `fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7`. Gewichte
 * entscheiden, nicht die Reihenfolge — manche Browser schicken sie
 * durcheinander. Das Land wird abgeschnitten (`fr-CH` → `fr`): Für die Website
 * gibt es kein Schweizer Französisch, und ein Treffer ist besser als keiner.
 */
export function spracheAusKopf(kopf?: string | null): Locale | null {
  if (!kopf) return null

  const wuensche = kopf
    .split(',')
    .map((teil) => {
      const [name, ...rest] = teil.trim().split(';')
      const gewicht = rest
        .map((r) => r.trim())
        .find((r) => r.startsWith('q='))
        ?.slice(2)
      const q = gewicht === undefined ? 1 : Number(gewicht)
      return { code: name.trim().toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0 }
    })
    // `q=0` heißt ausdrücklich „diese Sprache nicht"
    .filter((w) => w.code && w.q > 0)
    .sort((a, b) => b.q - a.q)

  return (wuensche.find((w) => isLocale(w.code))?.code as Locale) ?? null
}

/**
 * Die Sprache, in die wir einen Besucher schicken, der keine genannt hat.
 *
 * Wer eine Sprache verlangt, die wir nicht sprechen, bekommt Englisch — die
 * Sprache, in der man sich im Zweifel verständigt. Siehe oben.
 */
export const AUSWEICHSPRACHE: Locale = 'en'

/**
 * Die Sprache für einen Besuch ohne Sprachkürzel in der Adresse.
 *
 * Vier Stufen, und jede ist oben begründet: eigene Wahl, dann eine Sprache aus
 * dem Wunsch des Browsers, dann Englisch für jeden anderen Wunsch — und
 * Deutsch nur, wenn überhaupt keiner geäußert wurde.
 */
export function spracheWaehlen({
  gemerkt,
  kopf,
}: {
  gemerkt?: string | null
  kopf?: string | null
}): Locale {
  if (gemerkt && isLocale(gemerkt)) return gemerkt

  const gewuenscht = spracheAusKopf(kopf)
  if (gewuenscht) return gewuenscht

  // Ein Wunsch war da, nur keiner, den wir erfüllen können
  return kopf?.trim() ? AUSWEICHSPRACHE : defaultLocale
}

/** Nennt dieser Pfad schon eine Sprache? */
export function pfadNenntSprache(pfad: string): boolean {
  return isLocale(pfad.split('/')[1] ?? '')
}

/** Derselbe Pfad mit Sprachkürzel davor. */
export function mitSprache(pfad: string, sprache: Locale): string {
  return pfad === '/' ? `/${sprache}` : `/${sprache}${pfad}`
}

export { locales }
