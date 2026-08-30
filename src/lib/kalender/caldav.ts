import type { Payload } from 'payload'

import { alsEreignis, ereignisseLesen, type Termin } from './ical'

/**
 * CalDAV — der Rückweg vom Telefon ins Büro.
 *
 * Warum überhaupt, wo es doch das Abonnement gibt: Ein abonnierter Kalender
 * ist am iPhone **unabänderlich**. Man kann darin keinen Termin anlegen, das
 * Pluszeichen bietet ihn gar nicht erst an. Das ist keine Einstellung, die
 * man umlegt — ein Abonnement ist einseitig gedacht. Wer am Telefon Termine
 * eintragen will, braucht ein Konto, und Konten sprechen CalDAV.
 *
 * CalDAV ist WebDAV (RFC 4918) mit Kalenderaufsatz (RFC 4791), also HTTP mit
 * eigenen Verben — `PROPFIND`, `REPORT`, `MKCALENDAR` — und XML als Sprache.
 * Umgesetzt ist hier der Ausschnitt, den iOS zum Einrichten und Abgleichen
 * wirklich abfragt; alles Weitere (Freibusy, geteilte Kalender, Aufgaben)
 * bleibt außen vor, weil es niemand aufruft.
 *
 * Der Ablauf beim Einrichten am iPhone ist immer derselbe, und jede Stufe
 * muss sitzen, sonst bricht es wortlos ab:
 *
 *   1. `PROPFIND /` fragt, wo der Nutzer zu Hause ist → `current-user-principal`
 *   2. `PROPFIND` darauf fragt nach dem Kalender-Zuhause → `calendar-home-set`
 *   3. `PROPFIND` darauf listet die Kalender auf
 *   4. `REPORT` holt die Termine, `PUT`/`DELETE` schreiben sie
 *
 * **ETags sind der Kern des Ganzen.** Das Telefon merkt sich zu jedem Termin
 * ein Kennzeichen und fragt beim nächsten Mal nur, was sich geändert hat.
 * Wer hier bei jedem Abruf ein neues ausgibt, lädt jedes Mal alles neu; wer
 * es nie ändert, bekommt Änderungen nie mit. Der Zeitstempel der letzten
 * Änderung ist deshalb genau richtig.
 */

/** Der Pfadname, unter dem ein Termin liegt. */
export function dateiname(uid: string): string {
  return `${encodeURIComponent(uid)}.ics`
}

/** Aus einem Pfadnamen die Kennung zurück. */
export function kennungAus(pfad: string): string {
  const letzter = pfad.split('/').filter(Boolean).pop() ?? ''
  return decodeURIComponent(letzter.replace(/\.ics$/i, ''))
}

/**
 * Das Kennzeichen eines Termins.
 *
 * In Anführungszeichen, weil die Norm es so will — ohne sie vergleichen
 * manche Geräte falsch und laden dann bei jedem Abgleich alles neu.
 */
export function etagVon(t: { uid: string; geaendert?: Date | null }): string {
  const stand = t.geaendert ? t.geaendert.getTime() : 0
  return `"${stand.toString(36)}"`
}

/** XML-Sonderzeichen entschärfen. */
export function xml(wert: string): string {
  return wert
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Eine Mehrfachantwort (`207 Multi-Status`) — die Währung von WebDAV.
 *
 * Anders als bei gewöhnlichem HTTP steht der Erfolg nicht im Statuscode,
 * sondern je Teilstück im Rumpf. Ein `207` heißt nur „sieh selbst nach".
 */
export function mehrfachAntwort(inhalt: string): Response {
  return new Response(`<?xml version="1.0" encoding="utf-8"?>\n${inhalt}`, {
    status: 207,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      DAV: '1, 2, 3, calendar-access',
    },
  })
}

/** Ein Termin als vollständiges, einzeln stehendes Kalenderdokument. */
export function einzelnesDokument(t: Termin): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vincent Hellmann//Buero//DE',
    'CALSCALE:GREGORIAN',
    ...alsEreignis(t),
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

/**
 * Was das Telefon geschickt hat, in unsere Felder übersetzen.
 *
 * Gibt `null`, wenn nichts Brauchbares darin steht — ein leeres `PUT` soll
 * keinen Termin ohne Titel und ohne Zeitpunkt anlegen.
 */
export function ausDokument(roh: string): Termin | null {
  const [erster] = ereignisseLesen(roh)
  return erster ?? null
}

/**
 * Einen Termin vom Telefon speichern — anlegen oder ändern.
 *
 * Erkannt wird er an der Kennung, nicht an einer Datenbanknummer: Das Telefon
 * vergibt sie beim Anlegen selbst und kennt unsere Nummern nicht.
 *
 * Nur eigene Termine. Die abgeleiteten Einträge — Aufträge, Bestellungen,
 * Angebote, Belege — sind hier bewusst unabänderlich: Ein am Telefon
 * verschobener Liefertermin wäre eine stille Zusage an die Kundschaft, die
 * niemand geprüft hat. `Jobs.ts` schreibt so einen Termin beim Wechsel in die
 * Fertigung in die Bestellung; das gehört ins Büro und nicht in eine
 * Wischgeste in der Bahn.
 */
export async function terminSpeichern(
  payload: Payload,
  termin: Termin,
  benutzerId: number,
): Promise<'angelegt' | 'geaendert'> {
  const vorhanden = await payload.find({
    collection: 'appointments',
    overrideAccess: true,
    limit: 1,
    depth: 0,
    where: { uid: { equals: termin.uid } },
  })

  const daten = {
    title: termin.titel || 'Termin',
    start: termin.beginn.toISOString(),
    ende: termin.ende ? termin.ende.toISOString() : null,
    ganztaegig: Boolean(termin.ganztaegig),
    notiz: termin.notiz ?? null,
    ort: termin.ort ?? null,
    uid: termin.uid,
    quelle: 'caldav' as const,
  }

  if (vorhanden.docs[0]) {
    await payload.update({
      collection: 'appointments',
      id: vorhanden.docs[0].id,
      overrideAccess: true,
      data: daten,
    })
    return 'geaendert'
  }

  await payload.create({
    collection: 'appointments',
    overrideAccess: true,
    data: { ...daten, createdBy: benutzerId },
  })
  return 'angelegt'
}

/** Einen Termin vom Telefon aus löschen. Nur eigene, aus demselben Grund. */
export async function terminLoeschen(payload: Payload, uid: string): Promise<boolean> {
  const vorhanden = await payload.find({
    collection: 'appointments',
    overrideAccess: true,
    limit: 1,
    depth: 0,
    where: { uid: { equals: uid } },
  })
  if (!vorhanden.docs[0]) return false

  await payload.delete({
    collection: 'appointments',
    id: vorhanden.docs[0].id,
    overrideAccess: true,
  })
  return true
}
