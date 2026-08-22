import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Dateien weitergeben — der Weg zum Zulieferer.
 *
 * Der Laserschneider braucht die DXF, der Pulverbeschichter die Zeichnung mit
 * den Maßen. Bisher ging das nur über den Umweg einer Übergabemappe: anlegen,
 * Bezug wählen, Datei **erneut** hochladen, Passwort erzeugen, verschicken.
 * Fünf Schritte für „hier ist die Datei" — und am Ende lag dieselbe Zeichnung
 * zweimal im Haus, mit zwei Ständen, die auseinanderlaufen.
 *
 * Deshalb hier das kürzere Werkzeug: Datei am Artikel ankreuzen, Adresse
 * eintippen, fertig. Es entsteht kein zweiter Datensatz und kein Ordner,
 * sondern nur ein Link auf die Datei, die ohnehin schon da ist.
 *
 * Drei Entscheidungen, und alle drei sind bewusst anders als bei der Mappe:
 *
 * **Kein Passwort.** Es reiste in derselben Mail wie der Link — wer die Mail
 * lesen kann, hat ohnehin beides. Es kostete nur den Anruf, wenn es
 * verlorenging. Dieselbe Abwägung steht beim Abhol-Link des Monatspakets in
 * `steuerpaket.ts`.
 *
 * **Nichts gespeichert.** Der Link trägt seine Berechtigung selbst: eine
 * Prüfsumme über Datei und Ablaufzeit, geschlüsselt mit dem Geheimnis der
 * Anwendung. Kein Datensatz, keine Tabelle, keine Migration. Der Preis steht
 * unten und ist bekannt.
 *
 * **Vierzehn Tage.** Länger als die Woche der Mappe, weil ein Zulieferer nicht
 * am selben Tag schneidet; kurz genug, dass ein weitergeleiteter Link nicht
 * im nächsten Jahr noch die Fertigungsdaten des Hauses hergibt.
 *
 * **Was das nicht kann, und warum das hier in Ordnung ist:** Ein einmal
 * verschickter Link lässt sich nicht zurückziehen — dazu müsste festgehalten
 * werden, welche es gibt, und dann wäre es eine halbe Mappe. Wer einen Link
 * loswerden muss, bevor er abläuft, löscht die Datei oder ersetzt sie; beides
 * greift sofort, denn ausgeliefert wird immer der Stand von jetzt. Aus dem
 * gleichen Grund geht eine Revision automatisch mit hinaus: Der Zulieferer
 * holt nicht die Fassung von vorgestern, sondern die, die im Haus gilt.
 * Genau das ist der Unterschied zum Anhang in der Mail.
 */

/** Wie lange ein Abhol-Link gilt. */
export const WEITERGABE_TAGE = 14

/** Wie viele Dateien in eine Nachricht dürfen — mehr liest niemand. */
export const MAX_JE_NACHRICHT = 20

function geheimnis(): string {
  return process.env.PAYLOAD_SECRET ?? ''
}

export function weitergabeSignatur(datei: number | string, bis: number): string {
  return createHmac('sha256', geheimnis())
    .update(`weitergabe:${datei}:${bis}`)
    .digest('base64url')
}

/**
 * Der Link zu einer Datei.
 *
 * `bis` kommt von außen mit, damit alle Dateien einer Nachricht **dieselbe**
 * Ablaufzeit tragen: Sonst läuft die dritte Zeichnung eine Sekunde später ab
 * als die erste, und wer das nachrechnet, hält es für einen Fehler.
 */
export function weitergabeLink(datei: number | string, bis: number): string {
  const basis = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${basis}/api/weitergabe?datei=${encodeURIComponent(String(datei))}&bis=${bis}&sig=${weitergabeSignatur(datei, bis)}`
}

/** Das Ende der Gültigkeit für eine Nachricht — einmal für alle Dateien darin. */
export function weitergabeBis(tage = WEITERGABE_TAGE, ab = Date.now()): number {
  return ab + tage * 24 * 60 * 60 * 1000
}

export function weitergabeGueltig(
  datei: number | string,
  bis: number,
  sig: string,
  jetzt = Date.now(),
): boolean {
  if (!datei || !Number.isInteger(bis) || bis < jetzt) return false
  const soll = Buffer.from(weitergabeSignatur(datei, bis))
  const ist = Buffer.from(sig)
  // Länge zuerst: `timingSafeEqual` wirft bei ungleich langen Puffern
  return soll.length === ist.length && timingSafeEqual(soll, ist)
}
