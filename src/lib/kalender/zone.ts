/**
 * Die Zeitzone der Werkstatt.
 *
 * Sie steht hier und nicht in der Terminkarte, weil inzwischen zwei Stellen
 * sie brauchen: die Anzeige („Sonntag, 18. Oktober · 10–18 Uhr") und die
 * strukturierten Daten für Google. Stünden sie auseinander, wäre der Termin
 * auf der Seite ein anderer als der im Suchergebnis — und das fiele erst auf,
 * wenn jemand zur falschen Stunde vor einem geschlossenen Stand steht.
 *
 * Lauterbourg liegt im Elsass, also Paris. Dieselbe Uhr wie Deutschland, aber
 * die Zone des Betriebssitzes ist die richtige Angabe.
 */
export const WERKSTATT_ZONE = 'Europe/Paris'
