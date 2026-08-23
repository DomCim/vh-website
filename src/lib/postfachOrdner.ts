import type { ImapFlow } from 'imapflow'

/**
 * Welchen Ordner eine Aktion trifft — gefragt, nicht geraten.
 *
 * **Warum das eine eigene Datei ist.** Die Regel gilt für „Gesendet" und für
 * „Papierkorb" gleichermaßen, stand aber nur einmal da: Beim Gesendet-Ordner
 * war sie eingebaut, beim Papierkorb nicht — dort wurde weiter der
 * eingestellte Name benutzt, ohne nachzusehen, ob es ihn gibt. Das Ergebnis
 * hat Dominik 08/2026 gemeldet: Eine gelöschte Mail verschwand aus der Liste
 * und war nach dem Neuladen wieder da.
 *
 * Nebenbei ist das die einzige Stelle im Postfach, die sich ohne Mailserver
 * prüfen lässt. `postfach.ts` bringt über den Mailversand nodemailer mit und
 * ist damit aus einem Testlauf heraus gar nicht ladbar; hier hängt nichts
 * daran außer dem Typ.
 */

/** Was von der Postfach-Einstellung gebraucht wird — mehr nicht. */
type Ordnerwunsch = { sentMailbox?: string | null; trashMailbox?: string | null }

/**
 * Der Ordner mit dieser IMAP-Kennzeichnung, sonst der eingestellte Name —
 * und auch der erst, wenn es ihn wirklich gibt.
 *
 * Der letzte Halbsatz ist der Kern: Ein Name, den es nicht gibt, wird nicht
 * zurückgegeben. Sonst läuft der Aufrufer auf einen Ordner zu, den der Server
 * nicht kennt, und das scheitert später und an einer Stelle, an der niemand
 * mehr nach der Ursache sucht.
 */
async function ordnerFinden(
  client: ImapFlow,
  kennzeichen: string,
  gewuenschterName: string | null | undefined,
): Promise<string | null> {
  const liste = await client.list()
  const gekennzeichnet = liste.find((o) => o.specialUse === kennzeichen)
  if (gekennzeichnet) return gekennzeichnet.path

  const gewuenscht = gewuenschterName?.trim().toLowerCase()
  if (!gewuenscht) return null
  const passend = liste.find(
    (o) => o.path.toLowerCase() === gewuenscht || o.name.toLowerCase() === gewuenscht,
  )
  return passend?.path ?? null
}

/**
 * Der Ordner, in dem die Kopie einer verschickten Mail landet.
 *
 * Bisher stand dort stur der eingestellte Name („Sent"). Heißt der Ordner beim
 * Anbieter anders — „INBOX.Sent", „Gesendete Objekte", „Gesendet" —, dann
 * scheitert das Ablegen, und zwar lautlos: Die Mail ist beim Empfänger, im
 * eigenen Postfach fehlt sie. Wer am Rechner nachsieht, hält sie für nie
 * verschickt und schreibt sie ein zweites Mal.
 */
export function gesendetOrdner(client: ImapFlow, fach: Ordnerwunsch): Promise<string | null> {
  return ordnerFinden(client, '\\Sent', fach.sentMailbox)
}

/**
 * Der Papierkorb des Postfachs.
 *
 * Dieselbe Falle, nur wurde sie beim Gesendet-Ordner schon beseitigt und hier
 * nicht. Bis 08/2026 stand beim Löschen stur der eingestellte Name („Trash").
 * Heißt der Ordner beim Anbieter „INBOX.Trash", „Papierkorb" oder „Gelöschte
 * Objekte", scheiterte das Verschieben — und der Fehlschlag wurde aufgefangen
 * und die Mail nur mit `\\Deleted` beflaggt. Ein Flag entfernt nichts; die
 * Liste im Büro nahm die Zeile trotzdem heraus, weil sie „hat geklappt" als
 * Antwort bekam. Beim nächsten Laden war die Mail wieder da.
 */
export function papierkorbOrdner(client: ImapFlow, fach: Ordnerwunsch): Promise<string | null> {
  return ordnerFinden(client, '\\Trash', fach.trashMailbox)
}
