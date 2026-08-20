/**
 * Grenzen und erlaubte Dateitypen für Übergabemappen und Werkstattdateien.
 *
 * Eigene Datei, weil der Browser sie braucht: Die Upload-Ansicht will vorher
 * wissen, was zu groß ist und welche Endung abgelehnt wird — und `uebergabe.ts`
 * daneben hängt an Node-Bordmitteln (`crypto`) und lässt sich nicht laden,
 * ohne den ganzen Server mitzubringen.
 */

/**
 * 500 MB je Datei.
 *
 * Eine Baugruppe als STEP mit allen Normteilen wird groß, ein Scan noch
 * größer, und ein gepacktes Projektarchiv ist beides zusammen. Wer bei 50 MB
 * abriegelt, bekommt die Daten stattdessen per WeTransfer — also außerhalb
 * des Vorgangs, ohne Zuordnung und mit eigener Ablauffrist.
 *
 * Die Datei wird deshalb **nicht** über ein Formular eingelesen, sondern
 * unverändert als Rumpf der Anfrage geschickt und stückweise auf die Platte
 * geschrieben. Sonst läge sie beim Hochladen komplett im Arbeitsspeicher, und
 * zwei gleichzeitige Uploads legten den Server um.
 *
 * Achtung beim Ausrollen: Der Reverse Proxy muss so viel durchlassen
 * (`client_max_body_size`), sonst endet der Upload mit 413, bevor überhaupt
 * etwas hier ankommt.
 */
export const MAX_BYTES = 500 * 1024 * 1024

/** So viele Dateien darf eine Mappe fassen — Schutz vor Ablage aus Versehen. */
export const MAX_DATEIEN = 500

/**
 * Erlaubte Endungen.
 *
 * Bewusst eine Liste des Erlaubten und nicht eine des Verbotenen: Der Ordner
 * steht im Netz und nimmt entgegen, was hereingereicht wird. Eine Liste des
 * Verbotenen vergisst immer etwas; eine Liste des Erlaubten lehnt höchstens
 * einmal zu viel ab — und dafür gibt es die Antwort „packen Sie es in ein
 * ZIP", die jeder versteht.
 *
 * Was fehlt, fehlt mit Absicht: `html`, `svg` und `xhtml` würden vom Browser
 * ausgeführt, wenn sie doch einmal direkt ausgeliefert werden; ausführbare
 * Dateien haben in einer Zeichnungsablage ohnehin nichts zu suchen.
 */
export const ERLAUBTE_ENDUNGEN = [
  // Zeichnung, Modell, Maschine
  'dxf', 'dwg', 'dwf', 'step', 'stp', 'iges', 'igs', 'stl', '3mf', 'obj',
  'sat', 'x_t', 'x_b', 'sldprt', 'sldasm', 'ipt', 'iam', 'prt', 'asm',
  'catpart', 'catproduct', 'f3d', '3dm', 'skp', 'dstv', 'nc', 'nc1', 'tap',
  'gcode', 'cnc', 'mpf', 'eia', 'din', 'elt', 'geo', 'ebo', 'lbr',
  // Schriftstücke
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'odt', 'ods',
  // Bilder
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tif', 'tiff', 'gif', 'bmp',
  // Gepacktes
  'zip', '7z', 'rar', 'tar', 'gz',
]

export function endungVon(name: string): string {
  const teil = name.toLowerCase().split('.').pop() ?? ''
  return teil === name.toLowerCase() ? '' : teil
}

export function endungErlaubt(name: string): boolean {
  return ERLAUBTE_ENDUNGEN.includes(endungVon(name))
}

/**
 * Ein Dateiname, der auf jeder Platte funktioniert.
 *
 * Ohne Pfadanteile — `..\\..\\etc\\passwd` ist ein gültiger Dateiname im
 * Formular und darf niemals einer auf der Platte werden.
 */
export function dateiName(wert: unknown): string {
  return String(wert ?? '')
    .replace(/[\r\n]/g, ' ')
    .split(/[\\/]/)
    .pop()!
    // Buchstaben aller Sprachen bleiben stehen: „Träger.dxf" soll auf der
    // Platte nicht „Tr_ger.dxf" heißen — Umlaute sind hier die Regel
    .replace(/[^\p{L}\p{N}._\- ()+]/gu, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim()
}

