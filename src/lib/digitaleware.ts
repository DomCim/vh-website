import { createHmac, timingSafeEqual } from 'crypto'
import type { Payload } from 'payload'

/**
 * Digitale Ware ausliefern — die Datei nach der Zahlung.
 *
 * **Was hier verkauft wird, und warum es überhaupt dazu kam.** Auf Etsy steht
 * seit einer Weile ein Bauplan als Download, und drei Leute hatten ihn beim
 * Nachsehen im Warenkorb. Das ist keine Vermutung über Nachfrage, sondern
 * Nachfrage. Der eigene Shop konnte bis hierher nur Stahl verkaufen.
 *
 * **Ab wann geliefert wird: ab „bezahlt", und keinen Schritt früher.** Eine
 * Datei lässt sich nicht zurückholen. Bei einem Tisch ist ein zu früher
 * Versand ärgerlich und heilbar; hier wäre er endgültig. Deshalb hängt der
 * Link am Bestellstatus und nicht am Anlegen der Bestellung.
 *
 * **Warum der Link unterschrieben ist und nicht an der Anmeldung hängt.** Er
 * steht in der Bestätigungsmail, und dort hilft keine Sitzung: Wer die Mail
 * öffnet, ist selten angemeldet, und ein Kauf, der erst eine Anmeldung
 * verlangt, ist ein Kauf, der im Postfach liegen bleibt. Der Link trägt seine
 * Berechtigung deshalb selbst — eine Prüfsumme über Bestellung, Datei und
 * Ablaufzeit. Im Kundenkonto stehen dieselben Dateien noch einmal, für die,
 * die die Mail verlegt haben.
 *
 * **Ein Jahr, und dann ist Schluss.** Lange genug, dass niemand um einen
 * neuen Link bitten muss, weil er den Rechner gewechselt hat; kurz genug,
 * dass ein weitergereichter Link nicht auf Dauer den Shop ersetzt. Wer
 * danach noch einmal herankommen will, meldet sich im Kundenkonto an — dort
 * entsteht der Link frisch.
 */

/** Wie lange ein Download-Link gilt. */
export const DOWNLOAD_TAGE = 365

function geheimnis(): string {
  return process.env.PAYLOAD_SECRET ?? ''
}

export function downloadSignatur(bestellung: number | string, datei: number | string, bis: number): string {
  return createHmac('sha256', geheimnis())
    .update(`download:${bestellung}:${datei}:${bis}`)
    .digest('base64url')
}

export function downloadGueltig(
  bestellung: number | string,
  datei: number | string,
  bis: number,
  sig: string,
  jetzt = Date.now(),
): boolean {
  if (!bestellung || !datei || !Number.isInteger(bis) || bis < jetzt) return false
  const soll = Buffer.from(downloadSignatur(bestellung, datei, bis))
  const ist = Buffer.from(sig)
  // Länge zuerst: `timingSafeEqual` wirft bei ungleich langen Puffern
  return soll.length === ist.length && timingSafeEqual(soll, ist)
}

/** Das Ende der Gültigkeit — einmal für alle Dateien einer Bestellung. */
export function downloadBis(tage = DOWNLOAD_TAGE, ab = Date.now()): number {
  return ab + tage * 24 * 60 * 60 * 1000
}

export function downloadLink(
  bestellung: number | string,
  datei: number | string,
  bis: number,
  basis?: string,
): string {
  const wurzel = (basis || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  )
  const sig = downloadSignatur(bestellung, datei, bis)
  return `${wurzel}/api/download?bestellung=${encodeURIComponent(String(bestellung))}&datei=${encodeURIComponent(String(datei))}&bis=${bis}&sig=${sig}`
}

/**
 * Ab wann eine Bestellung ihre Dateien hergibt.
 *
 * Zurückgenommenes Geld nimmt die Datei nicht mit: Eine stornierte Bestellung
 * liefert nichts mehr, auch wenn sie einmal bezahlt war. Was der Kunde schon
 * heruntergeladen hat, ist damit nicht zurückgeholt — aber der Link ist tot,
 * und das ist alles, was diese Stelle leisten kann.
 */
export function darfHerunterladen(status: string | null | undefined): boolean {
  return status === 'paid' || status === 'inProduction' || status === 'shipped'
}

export type Downloaddatei = {
  id: number | string
  name: string
  groesse: number | null
}

/**
 * Die Dateien, die zu einer Bestellung gehören.
 *
 * Gesucht wird über die Artikel der Bestellung und nicht über eine Liste an
 * ihr: Wer einen Bauplan verbessert, soll die neue Fassung ausliefern, ohne
 * alte Bestellungen anzufassen. Der Preis dafür ist bekannt und gewollt —
 * ein Kunde, der im nächsten Jahr noch einmal herunterlädt, bekommt den Stand
 * von dann. Bei einem Bauplan ist das ein Geschenk und kein Problem.
 */
export async function dateienZurBestellung(
  payload: Payload,
  bestellung: { items?: { product?: unknown }[] | null },
): Promise<Downloaddatei[]> {
  const artikel = [
    ...new Set(
      (bestellung.items ?? [])
        .map((p) => (typeof p.product === 'object' ? (p.product as { id?: unknown })?.id : p.product))
        .filter((id): id is number | string => id !== null && id !== undefined),
    ),
  ]
  if (artikel.length === 0) return []

  const { docs } = await payload.find({
    collection: 'product-files',
    where: { and: [{ product: { in: artikel } }, { download: { equals: true } }] },
    limit: 50,
    depth: 0,
    overrideAccess: true,
    sort: 'label',
  })

  return docs
    .filter((d) => d.filename)
    .map((d) => ({
      id: d.id,
      name: (d.label || d.filename) as string,
      groesse: (d.filesize as number) ?? null,
    }))
}

/**
 * Dieselbe Frage für mehrere Bestellungen — in zwei Abfragen statt in 2n.
 *
 * Gebraucht im Kundenkonto: Dort steht die ganze Liste, und für jede Zeile
 * einzeln nachzufragen hieße bei zehn Bestellungen zwanzig Abfragen für eine
 * Seite, die meistens gar nichts Digitales enthält.
 *
 * Bestellungen, die noch nicht bezahlt sind, kommen hier gar nicht erst vor:
 * Was nicht ausgeliefert werden darf, braucht auch keinen Link.
 */
export async function dateienZuBestellungen(
  payload: Payload,
  ids: (number | string)[],
): Promise<Map<string, Downloaddatei[]>> {
  const raus = new Map<string, Downloaddatei[]>()
  if (ids.length === 0) return raus

  const { docs: bestellungen } = await payload.find({
    collection: 'orders',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 0,
    overrideAccess: true,
  })

  const bezahlte = bestellungen.filter((b) => darfHerunterladen(b.status))
  if (bezahlte.length === 0) return raus

  const artikelJeBestellung = new Map<string, string[]>()
  for (const b of bezahlte) {
    const artikel = (b.items ?? [])
      .map((p) => (typeof p.product === 'object' ? (p.product as { id?: unknown })?.id : p.product))
      .filter((id): id is number | string => id !== null && id !== undefined)
      .map(String)
    if (artikel.length) artikelJeBestellung.set(String(b.id), [...new Set(artikel)])
  }

  const alleArtikel = [...new Set([...artikelJeBestellung.values()].flat())]
  if (alleArtikel.length === 0) return raus

  const { docs: dateien } = await payload.find({
    collection: 'product-files',
    where: { and: [{ product: { in: alleArtikel } }, { download: { equals: true } }] },
    limit: 200,
    depth: 0,
    overrideAccess: true,
    sort: 'label',
  })

  for (const [bestellung, artikel] of artikelJeBestellung) {
    const passend = dateien
      .filter((d) => {
        const id = typeof d.product === 'object' ? (d.product as { id?: unknown })?.id : d.product
        return d.filename && artikel.includes(String(id))
      })
      .map((d) => ({
        id: d.id,
        name: (d.label || d.filename) as string,
        groesse: (d.filesize as number) ?? null,
      }))
    if (passend.length) raus.set(bestellung, passend)
  }

  return raus
}
