/**
 * Auswahllisten, die Datenmodell und Oberfläche gemeinsam benutzen.
 *
 * Bewusst hier und nicht in der Collection: Seit die Büro-Seiten im Browser
 * rendern, brauchen sie dieselben Listen — und ein Import aus einer Collection
 * zöge Payload mit in das Bündel, das im Handy landet.
 */

/** Ausgaben-Kategorien — bewusst grob, so wie der Steuerberater sie erwartet */
export const AUSGABEN_KATEGORIEN = [
  { label: 'Material & Rohstoffe', value: 'material' },
  { label: 'Werkzeug & Maschinen', value: 'werkzeug' },
  { label: 'Fremdleistungen', value: 'fremdleistung' },
  { label: 'Fahrzeug & Kraftstoff', value: 'fahrzeug' },
  { label: 'Miete & Nebenkosten', value: 'miete' },
  { label: 'Versicherungen & Beiträge', value: 'versicherung' },
  { label: 'Büro, Software & Telefon', value: 'buero' },
  { label: 'Werbung & Messen', value: 'werbung' },
  { label: 'Reise & Bewirtung', value: 'reise' },
  { label: 'Gebühren & Bankkosten', value: 'gebuehren' },
  { label: 'Sonstiges', value: 'sonstiges' },
] as const

/** Wie die drei Stufen des Mahnwesens heißen. */
export const MAHN_TITEL: Record<1 | 2 | 3, string> = {
  1: 'Zahlungserinnerung',
  2: 'Mahnung',
  3: 'Letzte Mahnung',
}

/*
 * Die Status-Listen der Vorgänge.
 *
 * Dieselbe Liste stand eine Zeit lang in der Collection, im Formular und in
 * der Übersicht — dreimal, und bei den Bestellungen fünfmal. Das ging gut,
 * bis die erste Beschriftung nur an einer Stelle geändert wurde. Seitdem
 * gilt: Werte, Beschriftung und Ampelfarbe (`art`) stehen hier, alles andere
 * leitet ab.
 *
 * `art` ist die Farbe des Status-Abzeichens in den Büro-Listen:
 * '' = neutral, 'offen' = wartet auf uns, 'gut' = erledigt, 'warn' = Achtung.
 */

export const AUFTRAG_STATUS = [
  { label: 'Geplant', value: 'geplant', art: '' },
  { label: 'In Fertigung', value: 'inFertigung', art: 'offen' },
  { label: 'Fertig', value: 'fertig', art: 'gut' },
  { label: 'Geliefert', value: 'geliefert', art: 'gut' },
  { label: 'Abgebrochen', value: 'abgebrochen', art: 'warn' },
] as const

/**
 * Rückabwicklung — was von einer Bestellung zurückkommt und warum.
 *
 * **Warum ein eigener Vorgang und nicht bloß „storniert".** Der Status der
 * Bestellung sagt, ob sie noch läuft; er sagt nichts darüber, ob das Geld
 * zurück ist und ob die Ware wieder im Haus steht. Genau daran ging bisher
 * beides verloren: Ein Storno war folgenlos — kein Geld zurück, das Stück
 * blieb ausgeblendet, der Auftrag lief weiter.
 *
 * **Warum drei Gründe und nicht einer.** An ihnen hängt Verschiedenes.
 * Beim Storno ist noch keine Ware unterwegs, es geht nur ums Geld. Beim
 * Widerruf kommt sie zurück, und die Rücksendung zahlt der Kunde (so steht
 * es in der Widerrufsbelehrung). Bei der Reklamation zahlt sie das Haus.
 */
export const RUECKGABE_GRUND = [
  { label: 'Storniert', value: 'storno' },
  { label: 'Widerruf (14 Tage)', value: 'widerruf' },
  { label: 'Reklamation', value: 'reklamation' },
] as const

export const RUECKGABE_STATUS = [
  { label: 'Offen', value: 'offen', art: 'offen' },
  { label: 'Ware zurück', value: 'wareZurueck', art: 'offen' },
  { label: 'Erstattet', value: 'erstattet', art: 'gut' },
  { label: 'Abgelehnt', value: 'abgelehnt', art: 'warn' },
] as const

/*
 * Kein Weg zurück aus „erstattet" oder „abgelehnt": Beides ist nach außen
 * geschehen — Geld ist geflossen oder der Kundschaft wurde abgesagt. Wer
 * korrigieren muss, tut das in der Verwaltung und sieht dabei, was er tut.
 */
export const RUECKGABE_UEBERGAENGE: Record<string, readonly string[]> = {
  offen: ['wareZurueck', 'erstattet', 'abgelehnt'],
  wareZurueck: ['erstattet', 'abgelehnt'],
  erstattet: [],
  abgelehnt: [],
}

export const BESTELL_STATUS = [
  { label: 'Offen (unbezahlt)', value: 'pending', art: 'offen' },
  { label: 'Bezahlt', value: 'paid', art: 'gut' },
  { label: 'In Fertigung', value: 'inProduction', art: 'offen' },
  { label: 'Versendet', value: 'shipped', art: 'gut' },
  { label: 'Storniert', value: 'cancelled', art: 'warn' },
] as const

/*
 * Welcher Bestellstatus von wo aus erreichbar ist. Ein Sprung zurück —
 * versendet zu unbezahlt, storniert zu bezahlt — hat noch nie etwas
 * repariert, aber schon Kundenmails ausgelöst, die nie hätten rausgehen
 * dürfen. Wer wirklich zurück muss, macht das im Admin, nicht im Vorbeigehen.
 */
export const BESTELL_UEBERGAENGE: Record<string, readonly string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['inProduction', 'shipped', 'cancelled'],
  inProduction: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: [],
}

export const RECHNUNG_STATUS = [
  { label: 'Entwurf', value: 'entwurf', art: '' },
  { label: 'Gestellt', value: 'gestellt', art: 'offen' },
  { label: 'Bezahlt', value: 'bezahlt', art: 'gut' },
  { label: 'Storniert', value: 'storniert', art: 'warn' },
] as const

/**
 * Die Steuerfälle einer Ausgangsrechnung.
 *
 * Alle außer `inland` bedeuten null Umsatzsteuer — aber aus verschiedenen
 * Gründen, und nur einer darf auf dem Beleg stehen. Der Empfänger stützt
 * seine eigene Steuerschuld darauf.
 *
 * `kuerzel` ist der Kategoriecode nach EN 16931, wie ihn die Factur-X-Datei
 * führt: `S` normal, `K` innergemeinschaftliche Lieferung, `AE` Reverse
 * Charge. Er steht hier und nicht im XML-Bauer, damit Beschriftung, Hinweis
 * und Code nicht auseinanderlaufen können — genau das war einmal der Fall.
 */
export const STEUERFAELLE = [
  {
    label: 'Inland / normale Umsatzsteuer',
    value: 'inland',
    kuerzel: 'S',
    kurz: 'Inland',
    erklaerung:
      'Der Normalfall: Vincent stellt französische TVA in Rechnung. Gilt auch für Privatkundschaft und für Kleinunternehmer im Ausland, die keine USt-IdNr angeben — die zahlen die Steuer einfach mit.',
    hinweis: null,
  },
  {
    label: 'Innergemeinschaftliche Lieferung (Ware)',
    value: 'ig_lieferung',
    kuerzel: 'K',
    kurz: 'Ware ins EU-Ausland',
    erklaerung:
      'Eine Ware geht körperlich in ein anderes EU-Land, an einen Geschäftskunden mit gültiger USt-IdNr. Beispiel: Vincent liefert ein Sofa nach Deutschland. Die Rechnung bleibt ohne Steuer, der Kunde versteuert den Erwerb. Nötig sind beide USt-IdNr auf dem Beleg und ein Nachweis, dass die Ware angekommen ist (Gelangensbestätigung).',
    hinweis:
      'Innergemeinschaftliche steuerfreie Lieferungen erfolgen nach § 4 Nr. 1 b in Verbindung mit § 6 a UStG.',
  },
  {
    label: 'Reverse Charge (sonstige Leistung)',
    value: 'reverse_charge',
    kuerzel: 'AE',
    kurz: 'Leistung ins EU-Ausland',
    erklaerung:
      'Keine Ware, sondern eine Leistung an einen Geschäftskunden im EU-Ausland — Montage vor Ort, Konstruktion, Reparatur. Die Steuerschuld geht auf den Kunden über. Auch hier gehören beide USt-IdNr auf den Beleg.',
    hinweis:
      'Steuerschuldnerschaft des Leistungsempfängers — Autoliquidation (Art. 196 MwStSystRL).',
  },
] as const

export type Steuerfall = (typeof STEUERFAELLE)[number]['value']

/** Ein Steuerfall samt Kürzel, Erklärung und dem Satz, der aufs Blatt gehört. */
export function steuerfallVon(wert: unknown) {
  return STEUERFAELLE.find((f) => f.value === wert) ?? STEUERFAELLE[0]
}

export const RECHNUNG_STUFEN = [
  { label: 'Vollständige Rechnung', value: 'vollstaendig' },
  { label: 'Anzahlung', value: 'anzahlung' },
  { label: 'Zwischenrechnung', value: 'zwischen' },
  { label: 'Schlussrechnung', value: 'schluss' },
] as const

export const ANGEBOT_STATUS = [
  { label: 'Entwurf', value: 'entwurf', art: '' },
  { label: 'Versendet', value: 'versendet', art: 'offen' },
  { label: 'Angenommen', value: 'angenommen', art: 'gut' },
  { label: 'Abgelehnt', value: 'abgelehnt', art: 'warn' },
] as const

export const ANFRAGE_STATUS = [
  { label: 'Neu', value: 'neu', art: 'offen' },
  { label: 'In Bearbeitung', value: 'inBearbeitung', art: 'offen' },
  { label: 'Beantwortet', value: 'beantwortet', art: 'gut' },
  { label: 'Erledigt', value: 'erledigt', art: '' },
] as const

export const ANFRAGE_ARTEN = [
  { label: 'Kontaktformular', value: 'kontakt' },
  { label: 'Produktanfrage', value: 'produkt' },
  { label: 'Maßanfertigung', value: 'massanfertigung' },
] as const

type Eintrag = { readonly label: string; readonly value: string; readonly art?: string }

/** Nur die Werte — für Prüfungen in Routen und für Schema-Enums. */
export const werteVon = (liste: readonly Eintrag[]): string[] => liste.map((e) => e.value)

/** Wert → Beschriftung, z. B. für Listen und Protokolltexte. */
export const textKarte = (liste: readonly Eintrag[]): Record<string, string> =>
  Object.fromEntries(liste.map((e) => [e.value, e.label]))

/** Wert → { text, art } — die Form, in der die Büro-Übersichten es brauchen. */
export const statusKarte = (
  liste: readonly Eintrag[],
): Record<string, { text: string; art: string }> =>
  Object.fromEntries(liste.map((e) => [e.value, { text: e.label, art: e.art ?? '' }]))

/**
 * Die Zustandsklasse für den Statusbalken einer Listenzeile.
 *
 * `art` beschreibt seit jeher die Ampelfarbe des Status-Abzeichens — dieselbe
 * Sprache, die der Balken links an der Zeile spricht (siehe office.css,
 * „Der Statusbalken links"). Statt sie in jeder Übersicht neu zu übersetzen,
 * steht die Umrechnung hier: Wer einen Status ergänzt, gibt ihm sein `art`
 * und bekommt Abzeichen **und** Balken auf einmal richtig.
 *
 * Leeres `art` heißt „kein Vorrang" und damit kein Balken — das ist die
 * richtige Antwort für Entwürfe und Erledigtes, das niemanden mehr angeht.
 */
export const balkenKlasse = (art: string | undefined | null): string =>
  art ? `ist-${art}` : ''
