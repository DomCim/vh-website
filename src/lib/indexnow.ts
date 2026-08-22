import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from 'payload'

import { locales } from './i18n'
import { BASE_URL } from './seo'

/**
 * IndexNow — den Suchdiensten sagen, dass sich etwas geändert hat.
 *
 * **Warum überhaupt.** Bisher warten wir darauf, dass jemand vorbeischaut. Ein
 * neuer Artikel steht in der Sitemap, und irgendwann in den nächsten Tagen
 * kommt ein Crawler und findet ihn. Bei einer kleinen Seite ohne täglichen
 * Zustrom kann „irgendwann" eine Woche heißen — und in der Woche ist die
 * Aktion vorbei, über die der Beitrag berichtet.
 *
 * IndexNow dreht das um: Wir melden die Adresse in dem Moment, in dem sie sich
 * ändert. Ein einziger Aufruf, und Bing, Yandex, Seznam und Naver holen sie
 * sich. Die beteiligten Dienste geben die Meldung untereinander weiter — man
 * meldet also einmal, nicht bei jedem einzeln.
 *
 * **Google ist nicht dabei** und wird es nach eigener Aussage auch nicht.
 * Trotzdem lohnt es sich, und zwar aus einem Grund, den man leicht übersieht:
 * Hinter der Websuche von ChatGPT steht Bing. Wer dort schnell auftauchen
 * will, meldet hier.
 *
 * **Der Nachweis.** Dass wir für diese Adresse sprechen dürfen, zeigt eine
 * Datei mit einem Schlüssel, die unter unserer eigenen Adresse liegt
 * (`public/<schlüssel>.txt`). Der Schlüssel ist absichtlich kein Geheimnis —
 * er steht öffentlich im Netz und beweist nur, dass wir den Server bestücken
 * können. Deshalb darf er auch im Quelltext stehen.
 *
 * **Was nicht gemeldet wird.** Nichts von einer Adresse, die nicht öffentlich
 * erreichbar ist (Entwicklung, Vorschau) — eine Meldung über `localhost` wäre
 * bestenfalls sinnlos. Und dieselbe Adresse nicht öfter als einmal je
 * Viertelstunde: Im Büro ändert sich an einem Artikel den Tag über einiges,
 * und ein Dienst, dem man im Minutentakt dieselbe Seite meldet, hört
 * irgendwann auf zuzuhören.
 */

/**
 * Der Schlüssel liegt als `public/d632…8947.txt` bereit — Dateiname und Inhalt
 * müssen dem Wert hier entsprechen, sonst weist der Dienst die Meldung ab.
 */
export const INDEXNOW_SCHLUESSEL = 'd632eb4d4c897ea7ae7063f284768947'

const DIENST = 'https://api.indexnow.org/indexnow'

/** Dieselbe Adresse höchstens alle 15 Minuten */
const SPERRE_MS = 15 * 60 * 1000

/**
 * Erst sammeln, dann melden.
 *
 * Ein Speichern im Büro löst mehrere Hooks aus, und ein Artikel hat drei
 * Sprachfassungen. Ohne dieses Fenster gingen daraus fünf Aufrufe statt einem
 * — mit demselben Ergebnis, aber fünfmal so viel Lärm.
 */
const SAMMELN_MS = 5000

const zuletzt = new Map<string, number>()
const wartend = new Set<string>()
let uhr: ReturnType<typeof setTimeout> | null = null

/** Öffentlich erreichbar? Alles andere hat dort nichts zu suchen. */
function meldenErlaubt(): boolean {
  if (process.env.INDEXNOW_AUS === 'true') return false
  try {
    const adresse = new URL(BASE_URL)
    return adresse.protocol === 'https:' && !/^(localhost|127\.|0\.0\.0\.0|\[)/.test(adresse.host)
  } catch {
    return false
  }
}

async function senden(payload: Payload, adressen: string[]) {
  const host = new URL(BASE_URL).host
  const antwort = await fetch(DIENST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key: INDEXNOW_SCHLUESSEL,
      keyLocation: `${BASE_URL}/${INDEXNOW_SCHLUESSEL}.txt`,
      urlList: adressen,
    }),
  })

  /*
   * 200 und 202 heißen beide „angenommen"; 429 heißt „zu viel auf einmal".
   * Nichts davon darf den Vorgang stören, der die Meldung ausgelöst hat —
   * deshalb steht ein Fehlschlag im Protokoll und nicht in der Antwort ans
   * Büro. Eine nicht gemeldete Seite wird gefunden wie früher: später.
   */
  if (antwort.ok) {
    payload.logger.info(`IndexNow: ${adressen.length} Adresse(n) gemeldet`)
  } else {
    payload.logger.warn(
      `IndexNow hat die Meldung abgelehnt (HTTP ${antwort.status}) — ${adressen.length} Adresse(n)`,
    )
  }
}

/**
 * Pfade **ohne** Sprachkürzel melden, etwa `/news/mein-beitrag` oder `''` für
 * die Startseite. Jede Sprachfassung ist eine eigene Adresse und geht einzeln
 * hinaus.
 *
 * Der Aufrufer wartet nicht: Ob ein Suchdienst antwortet, geht den Menschen
 * nichts an, der gerade auf „Speichern" gedrückt hat.
 */
export function indexNowMelden(payload: Payload, pfade: string[]): void {
  if (!meldenErlaubt() || pfade.length === 0) return

  const jetzt = Date.now()
  for (const pfad of pfade) {
    for (const sprache of locales) {
      const adresse = `${BASE_URL}/${sprache}${pfad}`
      const letzte = zuletzt.get(adresse)
      if (letzte && jetzt - letzte < SPERRE_MS) continue
      zuletzt.set(adresse, jetzt)
      wartend.add(adresse)
    }
  }

  if (wartend.size === 0 || uhr) return
  uhr = setTimeout(() => {
    uhr = null
    const stapel = [...wartend]
    wartend.clear()
    senden(payload, stapel).catch((err) => {
      payload.logger.warn({ err }, 'IndexNow war nicht erreichbar')
    })
  }, SAMMELN_MS)
  // Der Zeitgeber darf den Server nicht am Beenden hindern
  uhr.unref?.()
}

/**
 * Hooks für eine Collection, deren Einträge eine öffentliche Seite haben.
 *
 * `pfad` bekommt den Datensatz und gibt den Pfad ohne Sprachkürzel zurück —
 * oder nichts, wenn es (noch) keine öffentliche Seite gibt: ein Entwurf, ein
 * Artikel ohne Kategorie, ein Stück, das nicht mehr angeboten wird.
 *
 * Gelöschtes wird ebenfalls gemeldet. Das klingt verkehrt, ist es aber nicht:
 * Der Dienst schaut nach, findet nichts mehr und nimmt die Seite aus dem
 * Verzeichnis. Sonst steht sie dort noch wochenlang und führt Menschen auf
 * eine Fehlerseite.
 */
export function indexNowHooks(
  pfad: (
    doc: Record<string, unknown>,
    payload: Payload,
  ) => string | undefined | null | Promise<string | undefined | null>,
): {
  afterChange: CollectionAfterChangeHook[]
  afterDelete: CollectionAfterDeleteHook[]
} {
  const melden = async ({ doc, req }: { doc: Record<string, unknown>; req: { payload: Payload } }) => {
    const ziel = await pfad(doc, req.payload)
    if (typeof ziel === 'string') indexNowMelden(req.payload, [ziel])
    return doc
  }

  return {
    afterChange: [melden as unknown as CollectionAfterChangeHook],
    afterDelete: [melden as unknown as CollectionAfterDeleteHook],
  }
}
