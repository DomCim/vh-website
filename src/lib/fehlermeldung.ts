import { createHmac, timingSafeEqual } from 'crypto'

/**
 * „Das stimmt hier nicht" — und was daraus wird.
 *
 * **Das Problem.** Was am Büro auffällt, fällt beim Arbeiten auf: mitten in
 * der Werkstatt, das Handy in der Hand, zwischen zwei Aufträgen. Bis daraus
 * eine Nachricht wurde, die jemand nachvollziehen kann — welche Seite, welche
 * Fassung, was genau —, war der Gedanke meist weg. Übrig blieb „irgendwas mit
 * dem Inventar war komisch", und das ist keine Fehlermeldung, das ist eine
 * Erinnerung an eine Fehlermeldung.
 *
 * **Was hier passiert.** Ein Knopf, drei Felder, Fotos vom Handy. Daraus wird
 * ein Eintrag im Repository — mit dem Bild, der Seite, der laufenden Fassung
 * und dem Gerät. Wer das später liest, muss nicht mehr nachfragen.
 *
 * **Warum die Fotos einen unterschriebenen Link bekommen.** GitHub kann kein
 * Bild aus einer geschützten Ablage anzeigen; damit es im Eintrag zu sehen
 * ist, muss es unter einer Adresse liegen, die GitHub erreicht. Es öffentlich
 * in die Mediathek zu legen wäre der bequeme Weg und der falsche: Dort stehen
 * die Produktbilder, und ein Bildschirmfoto vom Büro hat dort nichts zu
 * suchen. Stattdessen liegt das Foto in der geschützten Dateiablage, und der
 * Link trägt seine Berechtigung selbst — eine Prüfsumme über die Datei,
 * geschlüsselt mit dem Geheimnis der Anwendung. Wer die Nummer in der Adresse
 * hochzählt, kommt keinen Schritt weiter.
 *
 * **Ohne Ablaufdatum, und das ist Absicht.** Ein Eintrag im Repository wird in
 * einem halben Jahr gelesen, wenn jemand denselben Fehler noch einmal sucht;
 * ein Bild, das bis dahin abgelaufen ist, macht ihn wertlos. Wer ein Foto
 * loswerden muss, löscht die Datei — dann läuft der Link ins Leere, sofort.
 * Dieselbe Abwägung wie bei der Weitergabe an Zulieferer (`lib/weitergabe.ts`),
 * nur andersherum entschieden, weil der Zweck ein anderer ist.
 */

/**
 * Was für eine Meldung es ist — und was daraus für ein Kennzeichen wird.
 *
 * **Warum das dazugekommen ist.** Nach fünf Meldungen an einem Morgen stand
 * die Liste im Repository ungeordnet da: kein Kennzeichen, keine Dringlichkeit,
 * alles gleich. Bei fünf geht das im Kopf, bei fünfzig nicht. Und zwei
 * Meldungen betrafen dieselbe Sache aus zwei Fassungen — das fiel nur auf,
 * weil jemand es zufällig noch wusste.
 *
 * **Ein Tipp, mehr nicht.** Die Art ist vorbelegt und lässt sich in einer
 * Zeile umstellen. Eine Pflichtangabe wäre hier falsch: Eine Hürde vor „hier
 * stimmt was nicht" bekommt man nie wieder weg, dann wird gar nicht mehr
 * gemeldet.
 *
 * `bug` und `enhancement` heißen englisch, weil GitHub sie in jedem
 * Repository von selbst anlegt; `design`, `büro` und die Fassung sind eigene.
 * Ob GitHub fehlende Kennzeichen beim Anlegen mit erzeugt, ist nicht die
 * Frage, an der eine Meldung scheitern darf — deshalb werden sie in einem
 * zweiten Schritt angehängt (siehe die Route). Geht der schief, steht der
 * Eintrag trotzdem.
 */
export const MELDUNGSARTEN = [
  { wert: 'fehler', text: 'Fehler', kennzeichen: 'bug' },
  { wert: 'gestaltung', text: 'Gestaltung', kennzeichen: 'design' },
  { wert: 'idee', text: 'Idee', kennzeichen: 'enhancement' },
] as const

export type Meldungsart = (typeof MELDUNGSARTEN)[number]['wert']

/**
 * Die Kennzeichen für einen Eintrag: die Art und die laufende Fassung.
 *
 * Die Fassung als Kennzeichen ist der eigentliche Gewinn. An ihr sieht man in
 * der Liste sofort, ob zwei Meldungen aus demselben Stand kommen — und ob
 * eine ältere sich mit dem letzten Ausrollen schon erledigt hat. Genau das
 * war am 24.08.2026 der Fall und kostete eine halbe Fehlersuche.
 *
 * `büro` steht immer dabei: Was von Hand angelegt wurde, soll sich davon
 * unterscheiden lassen.
 */
export function meldungsKennzeichen(art?: string | null, fassung?: string | null): string[] {
  const gefunden = MELDUNGSARTEN.find((a) => a.wert === art)
  const raus = ['büro', gefunden?.kennzeichen ?? 'bug']
  const stand = String(fassung ?? '').trim()
  // Nur ein plausibler Kurz-Hash, kein „Entwicklungs-Version" o. ä.
  if (/^[0-9a-f]{7,40}$/i.test(stand)) raus.push(`Fassung ${stand.slice(0, 7)}`)
  return raus
}

/** Der Ordner, in dem die Fotos einer Meldung liegen */
export const FEHLERMELDUNGS_ORDNER = 'Fehlermeldungen'

/** Wie viele Fotos an eine Meldung dürfen — mehr sieht sich niemand an */
export const MAX_FOTOS = 5

/**
 * Was als Foto durchgeht. Eine Fräsdatei ist kein Bildschirmfoto.
 *
 * **HEIC und HEIF gehören dazu, auch wenn sie ungewohnt aussehen.** Ein iPhone
 * nimmt seit Jahren in diesem Format auf; es ist das, was aus der Kamera
 * kommt, wenn niemand die Einstellung umgestellt hat. Ohne die beiden wurde
 * jedes Kamerafoto mit „Angehängt werden können nur Bilder" abgewiesen —
 * Bildschirmfotos (PNG) gingen dagegen durch. Daher las es sich als „mal
 * klappt es, mal nicht" (#40, #42 und noch einmal #43): Es hing nicht am
 * Zufall, sondern daran, woher das Bild kam.
 */
export const BILDARTEN = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]

export function istBild(mimeType: string | null | undefined): boolean {
  return BILDARTEN.includes(String(mimeType ?? '').toLowerCase())
}

function geheimnis(): string {
  return process.env.PAYLOAD_SECRET ?? ''
}

export function bildSignatur(datei: number | string): string {
  return createHmac('sha256', geheimnis()).update(`meldung:${datei}`).digest('base64url')
}

export function bildGueltig(datei: number | string, sig: string): boolean {
  if (!datei || !sig) return false
  const soll = Buffer.from(bildSignatur(datei))
  const ist = Buffer.from(sig)
  // Länge zuerst: `timingSafeEqual` wirft bei ungleich langen Puffern
  return soll.length === ist.length && timingSafeEqual(soll, ist)
}

export function bildLink(datei: number | string, basis?: string): string {
  const wurzel = (basis || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  )
  return `${wurzel}/api/fehlermeldung/bild?datei=${encodeURIComponent(String(datei))}&sig=${bildSignatur(datei)}`
}

/**
 * „Besitzer/Name" auseinandernehmen.
 *
 * Streng, und zwar mit Absicht: Was hier durchfällt, wandert sonst ungeprüft
 * in eine Adresse bei GitHub. Erlaubt ist, was GitHub selbst erlaubt —
 * Buchstaben, Ziffern, Punkt, Strich, Unterstrich —, und genau ein Schrägstrich.
 */
export function repoZerlegen(wert: string | null | undefined): { besitzer: string; name: string } | null {
  const teile = String(wert ?? '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .split('/')
  if (teile.length !== 2) return null
  const [besitzer, name] = teile.map((t) => t.trim())
  const erlaubt = /^[A-Za-z0-9._-]+$/
  if (!besitzer || !name || !erlaubt.test(besitzer) || !erlaubt.test(name)) return null
  return { besitzer, name }
}

export type Umgebung = {
  /** Wo es passiert ist, z.B. /office/inventar/neu */
  seite?: string | null
  /** Welcher Stand läuft */
  fassung?: string | null
  /** Was für ein Gerät und Browser */
  geraet?: string | null
  /** Wer gemeldet hat */
  melder?: string | null
  /** Wann, als lesbarer Text */
  zeitpunkt?: string | null
}

/** Eine Zeile in der Umgebungstabelle — leere Angaben fallen weg */
const ZEILEN: { schluessel: keyof Umgebung; titel: string }[] = [
  { schluessel: 'seite', titel: 'Seite' },
  { schluessel: 'fassung', titel: 'Fassung' },
  { schluessel: 'geraet', titel: 'Gerät' },
  { schluessel: 'melder', titel: 'Gemeldet von' },
  { schluessel: 'zeitpunkt', titel: 'Zeitpunkt' },
]

/** Was in einer Tabellenzelle den Aufbau sprengen würde */
const zelle = (wert: string) => wert.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()

/**
 * Der Text des Eintrags.
 *
 * Zuerst die Beschreibung, dann die Bilder, zuletzt die Umgebung — und die
 * eingeklappt. Wer den Eintrag öffnet, will wissen, was nicht stimmt, und
 * nicht zuerst eine Tabelle mit der Browserkennung lesen. Nachgesehen wird sie
 * erst, wenn die Beschreibung allein nicht reicht.
 */
export function fehlermeldungsKoerper(eingabe: {
  text: string
  umgebung?: Umgebung
  bilder?: string[]
}): string {
  const teile: string[] = []

  const text = eingabe.text.trim()
  teile.push(text || '_Ohne Beschreibung gemeldet._')

  const bilder = (eingabe.bilder ?? []).filter(Boolean)
  if (bilder.length) {
    teile.push(bilder.map((url, i) => `![Foto ${i + 1}](${url})`).join('\n\n'))
  }

  const angaben = ZEILEN.map(({ schluessel, titel }) => ({
    titel,
    wert: String(eingabe.umgebung?.[schluessel] ?? '').trim(),
  })).filter((z) => z.wert !== '')

  if (angaben.length) {
    teile.push(
      [
        '<details><summary>Umgebung</summary>',
        '',
        '| | |',
        '| --- | --- |',
        ...angaben.map((z) => `| ${z.titel} | ${zelle(z.wert)} |`),
        '',
        '</details>',
      ].join('\n'),
    )
  }

  teile.push('_Aus dem Büro gemeldet._')
  return teile.join('\n\n')
}

/**
 * Der Titel des Eintrags.
 *
 * GitHub nimmt lange Titel an und zeigt sie abgeschnitten; in der Liste zählt
 * der Anfang. Wer nichts eintippt, bekommt keinen leeren Eintrag, sondern
 * einen mit dem Ort — „Meldung aus /office/inventar" ist immer noch besser als
 * eine Zeile ohne Inhalt.
 */
export function fehlermeldungsTitel(titel: string, seite?: string | null): string {
  const sauber = titel.replace(/\s+/g, ' ').trim()
  if (sauber) return sauber.slice(0, 120)
  const ort = String(seite ?? '').trim()
  return ort ? `Meldung aus ${ort}`.slice(0, 120) : 'Meldung aus dem Büro'
}
