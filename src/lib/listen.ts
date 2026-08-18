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
