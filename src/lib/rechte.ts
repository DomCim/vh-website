/**
 * Was jemand im Büro darf.
 *
 * Bisher gab es zwei Rollen — Redaktion und Inhaber — als festes Auswahlfeld,
 * und an rund dreißig Stellen stand wörtlich `role !== 'inhaber'`. Das trug,
 * solange zwei Leute mit demselben Vertrauen an derselben Werkstatt arbeiten.
 * Sobald jemand dazukommt, der Aufträge sehen soll, aber keine Umsätze, oder
 * die Buchhaltung, die Belege bucht, aber keine Preise ändert, reicht es
 * nicht mehr — und jede neue Rolle hieße eine Änderung am Code.
 *
 * Deshalb sind Rollen jetzt Datensätze mit angehakten Rechten (siehe
 * collections/Roles.ts), und der Code fragt nach dem **Recht**, nicht nach der
 * Rolle. Eine neue Rolle anzulegen ist damit eine Sache von Haken setzen.
 *
 * Der Katalog hier ist bewusst grob. Ein Recht je Knopf wäre genauer und in
 * der Verwaltung unbrauchbar: Wer fünfzig Haken setzen muss, setzt am Ende
 * alle. Geschnitten ist er entlang der Dinge, die man einem Menschen
 * tatsächlich einzeln zutraut oder eben nicht.
 */

export const RECHTE = {
  'buero.oeffnen': 'Das Büro überhaupt öffnen',
  'postfach.lesen': 'Postfach lesen und beantworten',
  'anfragen.bearbeiten': 'Anfragen und Bestellungen bearbeiten',
  'angebote.schreiben': 'Angebote schreiben und verschicken',
  'auftraege.bearbeiten': 'Aufträge planen, Zeit erfassen, Lieferscheine',
  'rechnungen.schreiben': 'Rechnungen schreiben, mahnen, verschicken',
  'belege.erfassen': 'Belege erfassen und buchen',
  'inventar.pflegen': 'Inventar und Inventur pflegen',
  'partner.pflegen': 'Geschäftspartner anlegen und ändern',
  'zahlen.sehen': 'Umsätze, Auswertungen und den Steuer-Export sehen',
  'website.pflegen': 'Artikel, Preise und Website-Inhalte ändern',
  'newsletter.versenden': 'Newsletter verschicken',
  'sicherung.ausloesen': 'Sicherung anstoßen und wiederherstellen',
  'einstellungen.aendern': 'Einstellungen und Zugangsdaten ändern',
  'benutzer.verwalten': 'Benutzer und Rollen verwalten',
} as const

export type Recht = keyof typeof RECHTE

export const ALLE_RECHTE = Object.keys(RECHTE) as Recht[]

/** Der Schlüssel der eingebauten Inhaberrolle. Sie hat immer alles. */
export const INHABER = 'inhaber'

type MitRolle = {
  role?: string | null
  rolle?: { schluessel?: string | null; rechte?: string[] | null } | number | string | null
}

/**
 * Darf dieser Benutzer das?
 *
 * Drei Wege hinein, und der erste ist der wichtigste: Die Inhaberrolle darf
 * alles, ohne dass jemand Haken setzen muss. Ein Betrieb, der sich beim
 * Umbauen der Rechte selbst aussperrt, steht am Freitagabend vor einer
 * verschlossenen Tür — und niemand kann ihn hereinlassen, weil dazu ja
 * gerade das Recht fehlt.
 *
 * Der zweite Weg ist die aufgelöste Rolle mit ihren Rechten. Der dritte ist
 * das alte Auswahlfeld `role`: Konten, die noch nicht umgestellt sind, sollen
 * weiterarbeiten können, statt an einem halb fertigen Umzug hängenzubleiben.
 */
export function hatRecht(benutzer: unknown, recht: Recht): boolean {
  const b = benutzer as MitRolle | null | undefined
  if (!b) return false

  // Alter Stand: das Auswahlfeld, das es vor den Rollen gab
  if (b.role === INHABER) return true

  const rolle = typeof b.rolle === 'object' && b.rolle ? b.rolle : null
  if (!rolle) return false
  if (rolle.schluessel === INHABER) return true

  return Array.isArray(rolle.rechte) && rolle.rechte.includes(recht)
}

/** Alle Rechte, die dieser Benutzer hat — für die Oberfläche. */
export function rechteVon(benutzer: unknown): Recht[] {
  return ALLE_RECHTE.filter((r) => hatRecht(benutzer, r))
}
