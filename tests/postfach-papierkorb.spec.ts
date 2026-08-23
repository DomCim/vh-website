import { expect, test } from '@playwright/test'

import { papierkorbOrdner } from '../src/lib/postfachOrdner'

/**
 * Welchen Ordner das Löschen im Postfach trifft.
 *
 * Gemeldet von Dominik (08/2026): „Wenn ich beim IMAP eine E-Mail lösche, wird
 * sie nicht in den Trash verschoben, sondern verschwindet nur aus der Liste im
 * Eingang. Wenn ich neu lade, sind sie wieder da."
 *
 * Die Ursache war ein geratener Name. Gelöscht wurde nach `fach.trashMailbox`
 * (Vorgabe „Trash"); heißt der Ordner beim Anbieter „INBOX.Trash" oder
 * „Papierkorb", scheiterte das Verschieben. Der Fehlschlag wurde aufgefangen,
 * die Mail nur beflaggt — ein Flag entfernt nichts —, und weil die Antwort
 * „hat geklappt" lautete, nahm die Liste die Zeile trotzdem heraus. Beim
 * nächsten Laden war die Mail wieder da.
 *
 * Der Server weiß selbst, welcher Ordner sein Papierkorb ist. Geprüft wird
 * deshalb hier, dass gefragt und nicht geraten wird — und dass eine falsche
 * Einstellung ehrlich zu „nichts gefunden" führt statt zu einem Ordner, den es
 * nicht gibt.
 */

// Der Ordnerliste des Servers nachgebaut; mehr braucht die Funktion nicht.
const server = (ordner: { path: string; name: string; specialUse?: string }[]) =>
  ({ list: async () => ordner }) as never

test('die Kennzeichnung des Servers gewinnt vor dem eingestellten Namen', async () => {
  const gefunden = await papierkorbOrdner(
    server([
      { path: 'INBOX', name: 'INBOX' },
      { path: 'INBOX.Papierkorb', name: 'Papierkorb', specialUse: '\\Trash' },
    ]),
    { trashMailbox: 'Trash' } as never,
  )
  expect(gefunden).toBe('INBOX.Papierkorb')
})

test('ohne Kennzeichnung zählt der eingestellte Name — auch als voller Pfad', async () => {
  const ordner = [
    { path: 'INBOX', name: 'INBOX' },
    { path: 'INBOX.Trash', name: 'Trash' },
  ]
  expect(await papierkorbOrdner(server(ordner), { trashMailbox: 'INBOX.Trash' } as never)).toBe(
    'INBOX.Trash',
  )
  // Und ebenso, wenn nur der schlichte Name eingetragen ist
  expect(await papierkorbOrdner(server(ordner), { trashMailbox: 'Trash' } as never)).toBe(
    'INBOX.Trash',
  )
})

test('ein Name, den es nicht gibt, liefert nichts — und nicht sich selbst', async () => {
  // Genau hier lag der Fehler: Früher wurde „Trash" einfach als Ziel benutzt,
  // obwohl es den Ordner nicht gab. Das Verschieben scheiterte danach lautlos.
  const gefunden = await papierkorbOrdner(
    server([
      { path: 'INBOX', name: 'INBOX' },
      { path: 'INBOX.Gelöschte Objekte', name: 'Gelöschte Objekte' },
    ]),
    { trashMailbox: 'Trash' } as never,
  )
  expect(gefunden).toBeNull()
})

test('ohne eingestellten Namen und ohne Kennzeichnung gibt es nichts zu raten', async () => {
  expect(
    await papierkorbOrdner(server([{ path: 'INBOX', name: 'INBOX' }]), { trashMailbox: '' } as never),
  ).toBeNull()
})
