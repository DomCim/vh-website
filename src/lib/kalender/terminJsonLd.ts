import type { Locale } from '../i18n'
import { absoluteUrl, BASE_URL } from '../seo'
import type { OeffentlicherTermin } from './oeffentlich'
import { WERKSTATT_ZONE } from './zone'

/**
 * Die Termine als `Event`-Daten für Suchmaschinen.
 *
 * **Wofür das gut ist.** Google zeigt Termine, die es als solche erkennt,
 * anders an als eine gewöhnliche Seite: mit Datum, Ort und einem eigenen
 * Eintrag je Termin, teils in einer Terminübersicht neben dem Ergebnis. Ohne
 * diese Auszeichnung steht dort eine Seite namens „Termine" — mit ihr steht
 * dort, dass Vincent am 18. Oktober in Ettlingen ist. Für einen Markt, an dem
 * jemand vorbeikommen soll, ist das der ganze Unterschied.
 *
 * **Warum die Uhrzeit hier so umständlich entsteht.** Google verlangt in
 * `startDate` die Ortszeit mit Zonenversatz („2026-10-18T10:00:00+02:00").
 * Ein `toISOString()` gäbe UTC — daraus würde in der Anzeige eine Stunde
 * früher, im Sommer zwei. Deshalb wird die Zeit in der Zone der Werkstatt
 * formatiert und der Versatz aus derselben Zone dazugerechnet; damit stimmt
 * sie zur Sommer- wie zur Winterzeit, ohne dass jemand zweimal im Jahr
 * nachjustiert.
 *
 * **Ganztägige Termine tragen nur das Datum.** Das ist die Art, wie
 * schema.org „den ganzen Tag" ausdrückt: kein `T`, keine Uhrzeit. Stünde dort
 * `00:00`, läse Google einen Termin, der um Mitternacht beginnt.
 *
 * **Ohne Ort kein Eintrag.** `location` ist eine Pflichtangabe, und ein
 * geratener Ort wäre schlimmer als keiner: Wer zur Werkstatt fährt, weil dort
 * in Wahrheit nichts stattfindet, kommt nicht wieder. Ein Termin ohne Ort
 * steht deshalb auf der Seite, aber nicht in den strukturierten Daten — er
 * verschwindet aus dem Suchergebnis und nicht aus dem Netz.
 */

/** Der Zonenversatz zu diesem Zeitpunkt, z.B. „+02:00" */
function versatz(zeitpunkt: Date, zone: string): string {
  const teil = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(zeitpunkt)
    .find((p) => p.type === 'timeZoneName')?.value
  // „GMT+02:00" — und im Winter mancherorts schlicht „GMT"
  const treffer = /GMT([+-]\d{2}:\d{2})/.exec(teil ?? '')
  return treffer ? treffer[1] : '+00:00'
}

/** Der Tag in der Zone der Werkstatt, „2026-10-18" */
export function alsTag(zeitpunkt: Date, zone: string = WERKSTATT_ZONE): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(zeitpunkt)
}

/** Ortszeit mit Zonenversatz, „2026-10-18T10:00:00+02:00" */
export function alsOrtszeit(zeitpunkt: Date, zone: string = WERKSTATT_ZONE): string {
  // `sv-SE` liefert „2026-10-18 10:00:00" — das ist ISO bis auf das Leerzeichen
  const formatiert = new Intl.DateTimeFormat('sv-SE', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(zeitpunkt)
  return `${formatiert.replace(' ', 'T')}${versatz(zeitpunkt, zone)}`
}

/**
 * Der Ort eines Termins als Anschrift.
 *
 * Er kommt als eine getippte Zeile — mal „Ettlingen", mal „Marktplatz 1,
 * 76275 Ettlingen". Steht eine Postleitzahl darin, wird sie herausgelöst;
 * steht keine da, ist die Zeile der Ortsname und nicht die Straße. Das ist
 * der Unterschied, den Google für die örtliche Zuordnung braucht — und ein
 * bloßes „Ettlingen" als `streetAddress` wäre schlicht falsch.
 */
function ortAlsAnschrift(ort: string): Record<string, string> {
  const treffer = /^(.*?)[,\s]*\b(\d{4,5})\s+(.+)$/.exec(ort)
  if (!treffer) return { '@type': 'PostalAddress', addressLocality: ort }

  const [, strasse, plz, stadt] = treffer
  return {
    '@type': 'PostalAddress',
    ...(strasse.trim() ? { streetAddress: strasse.trim() } : {}),
    postalCode: plz,
    addressLocality: stadt.trim(),
  }
}

/** Ein einzelner Termin als schema.org-Event — oder `null`, wenn der Ort fehlt */
export function terminEvent(
  termin: OeffentlicherTermin,
  sprache: Locale,
  betrieb: { name: string },
): Record<string, unknown> | null {
  const ort = termin.ort?.trim()
  if (!ort) return null

  const beginn = new Date(termin.beginn)
  const ende = termin.ende ? new Date(termin.ende) : null

  const startDate = termin.ganztaegig ? alsTag(beginn) : alsOrtszeit(beginn)
  /*
   * Das Ende nur, wenn es einen Tag weiterreicht. Bei einem eintägigen
   * Termin denselben Tag noch einmal hinzuschreiben ist Rauschen, und bei
   * einer Uhrzeit ohne Ende hätten wir schlicht keine.
   */
  const endDate = !ende
    ? undefined
    : termin.ganztaegig
      ? alsTag(ende) !== alsTag(beginn)
        ? alsTag(ende)
        : undefined
      : alsOrtszeit(ende)

  return {
    '@type': 'Event',
    name: termin.titel,
    startDate,
    ...(endDate ? { endDate } : {}),
    /*
     * Ein abgesagter Termin wird als abgesagt ausgezeichnet und nicht
     * weggelassen: Google zeigt ihn dann durchgestrichen, statt ihn weiter
     * als stattfindend zu führen — genau wie die Seite selbst es tut.
     */
    eventStatus: termin.abgesagt
      ? 'https://schema.org/EventCancelled'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: ort, address: ortAlsAnschrift(ort) },
    /*
     * Wer dort ausstellt, ist die Werkstatt selbst — bei einem Markt oder
     * einer Ausstellung führt sie ihre eigenen Stücke vor. Google führt das
     * Feld als empfohlen; hier ist es schlicht wahr.
     */
    performer: { '@type': 'Organization', name: betrieb.name },
    ...(termin.beschreibungText ? { description: termin.beschreibungText } : {}),
    ...(termin.bild ? { image: absoluteUrl(termin.bild) } : {}),
    /*
     * Jeder Termin bekommt seine eigene Adresse — die Terminseite mit einem
     * Anker auf die Karte. Ohne den zeigten alle Einträge auf dieselbe Seite,
     * und Google hätte keinen Grund, sie als verschiedene Dinge zu führen.
     */
    url: `${BASE_URL}/${sprache}/termine#termin-${termin.id}`,
    organizer: { '@type': 'Organization', name: betrieb.name, url: `${BASE_URL}/${sprache}` },
  }
}

/**
 * Alle Termine einer Seite als ein `<script>`-Inhalt.
 *
 * Ein Feld mit mehreren Einträgen statt eines Skripts je Termin: beides ist
 * erlaubt, aber ein einzelnes Feld bleibt lesbar, wenn zwanzig Märkte
 * anstehen.
 */
export function termineJsonLd(
  termine: OeffentlicherTermin[],
  sprache: Locale,
  betrieb: { name: string },
): string | null {
  const events = termine
    .map((termin) => terminEvent(termin, sprache, betrieb))
    .filter((e): e is Record<string, unknown> => e !== null)
    .map((e) => ({ '@context': 'https://schema.org', ...e }))

  return events.length ? JSON.stringify(events) : null
}
