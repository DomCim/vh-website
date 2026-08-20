import { dateiName, endungErlaubt, MAX_BYTES } from './dateigrenzen'

/**
 * Dateien hochladen — im Browser, mit Fortschritt und ohne Formular.
 *
 * Warum nicht `fetch` mit `FormData`, wie sonst überall:
 *
 * **Fortschritt.** `fetch` meldet keinen. Bei einer Zeichnung mit 300 MB ist
 * eine Anzeige ohne Balken nicht zu unterscheiden von einer, die hängt — und
 * dann bricht jemand nach zwei Minuten ab und lädt von vorn.
 *
 * **Arbeitsspeicher.** Ein Formular mit fünf Dateien liegt auf dem Server
 * vollständig im Speicher, ehe eine Zeile Code läuft. Hier geht jede Datei
 * einzeln und unverpackt hinaus; der Server schreibt sie stückweise weg.
 *
 * **Nacheinander, nicht gleichzeitig.** Wer zehn Dateien auf einmal auswählt,
 * schickt sie sonst zehnfach parallel durch eine Leitung, die dafür nicht
 * gedacht ist: Alles wird gleichzeitig langsam, und beim ersten Abbruch ist
 * nichts fertig. Nacheinander ist am Ende genauso schnell — und dazwischen ist
 * jederzeit etwas fertig.
 */

export type Standder = 'wartet' | 'laeuft' | 'fertig' | 'fehler'

export type Uploadstand = {
  /** Eigene Kennung der Zeile — der Name allein taugt nicht, er kann doppelt sein */
  schluessel: string
  name: string
  bytes: number
  getan: number
  stand: Standder
  fehler?: string
}

export const FEHLERTEXTE: Record<string, string> = {
  'zu-gross': 'Diese Datei ist größer als 500 MB.',
  dateityp: 'Dieser Dateityp geht nicht durch — bitte als ZIP packen.',
  geschlossen: 'Der Ordner nimmt nichts mehr entgegen.',
  'mappe-voll': 'In diesem Ordner ist kein Platz mehr.',
  'kein-zugang': 'Der Zugang gilt nicht mehr. Bitte einen neuen Link anfordern.',
  'kein-name': 'Diese Datei hat keinen brauchbaren Namen.',
  'kein-inhalt': 'Diese Datei ist leer.',
}

export function lesbareGroesse(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/**
 * Prüft, was ohnehin abgelehnt würde — schon vor dem ersten Byte.
 *
 * Dieselben Regeln stehen auf dem Server und gelten dort; hier stehen sie noch
 * einmal, damit niemand zehn Minuten lang eine Datei hochlädt, die am Ende
 * wegen ihrer Endung abgewiesen wird.
 */
export function vorabPruefen(datei: File): string | null {
  if (!dateiName(datei.name)) return FEHLERTEXTE['kein-name']!
  if (!endungErlaubt(datei.name)) return FEHLERTEXTE.dateityp!
  if (datei.size > MAX_BYTES) return FEHLERTEXTE['zu-gross']!
  if (datei.size === 0) return FEHLERTEXTE['kein-inhalt']!
  return null
}

/** Eine einzelne Datei senden. Der Fortschritt kommt fortlaufend zurück. */
export function dateiSenden(
  adresse: string,
  datei: File,
  beiFortschritt: (getan: number) => void,
): Promise<Record<string, unknown>> {
  return new Promise((erfuellen, ablehnen) => {
    const anfrage = new XMLHttpRequest()
    anfrage.open('POST', adresse)
    anfrage.responseType = 'json'
    anfrage.upload.onprogress = (e) => beiFortschritt(e.loaded)
    anfrage.onerror = () => ablehnen(new Error('netz'))
    anfrage.onabort = () => ablehnen(new Error('abgebrochen'))
    anfrage.onload = () => {
      const antwort = (anfrage.response ?? {}) as Record<string, unknown>
      if (anfrage.status >= 200 && anfrage.status < 300) {
        erfuellen(antwort)
        return
      }
      /*
       * 413 kommt oft nicht von uns, sondern vom Reverse Proxy davor — der
       * antwortet dann mit HTML statt JSON, und `error` bliebe leer. Der
       * Statuscode allein sagt hier schon genug.
       */
      const grund =
        (typeof antwort.error === 'string' ? antwort.error : '') ||
        (anfrage.status === 413 ? 'zu-gross' : `status-${anfrage.status}`)
      ablehnen(new Error(grund))
    }
    // Die Datei geht unverpackt hinaus — Name und Ordner stehen in der Adresse
    anfrage.send(datei)
  })
}

/**
 * Eine ganze Auswahl nacheinander senden.
 *
 * `adresseFuer` baut die Adresse zur Datei; `melden` wird nach jeder Änderung
 * mit dem vollständigen Stand aufgerufen, damit die Ansicht nur eine einzige
 * Liste zu zeichnen braucht.
 */
export async function auswahlSenden(
  dateien: File[],
  adresseFuer: (datei: File) => string,
  melden: (staende: Uploadstand[]) => void,
): Promise<{ fertig: number; fehler: number }> {
  const staende: Uploadstand[] = dateien.map((d, i) => ({
    schluessel: `${i}-${d.name}`,
    name: d.name,
    bytes: d.size,
    getan: 0,
    stand: 'wartet',
  }))
  melden([...staende])

  let fertig = 0
  let fehler = 0

  for (let i = 0; i < dateien.length; i++) {
    const datei = dateien[i]!
    const stand = staende[i]!

    const einwand = vorabPruefen(datei)
    if (einwand) {
      stand.stand = 'fehler'
      stand.fehler = einwand
      fehler++
      melden([...staende])
      continue
    }

    stand.stand = 'laeuft'
    melden([...staende])
    try {
      await dateiSenden(adresseFuer(datei), datei, (getan) => {
        stand.getan = getan
        melden([...staende])
      })
      stand.stand = 'fertig'
      stand.getan = datei.size
      fertig++
    } catch (err) {
      stand.stand = 'fehler'
      const grund = err instanceof Error ? err.message : ''
      stand.fehler =
        FEHLERTEXTE[grund] ??
        (grund === 'netz' ? 'Die Verbindung ist abgerissen.' : 'Das hat nicht geklappt.')
      fehler++
    }
    melden([...staende])
  }

  return { fertig, fehler }
}
