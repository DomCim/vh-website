import { expect, test } from '@playwright/test'

import { OutgoingInvoices } from '../src/collections/OutgoingInvoices'

/**
 * Eine gestellte Rechnung wird storniert, nicht gelöscht.
 *
 * Der Weg über das Büro prüft das seit jeher, die Sammlung selbst stand aber
 * offen — über die Website-Verwaltung wäre damit jede Rechnung löschbar
 * gewesen. Ein Loch im Nummernkreis ist das Erste, was eine Prüfung findet,
 * und es lässt sich hinterher nicht mehr erklären.
 *
 * Geprüft wird die Regel selbst, nicht die Oberfläche: Was `delete` zurückgibt,
 * ist keine Erlaubnis, sondern eine Einschränkung — und die landet als
 * Bedingung in der Abfrage.
 */

const alsInhaber = { req: { user: { role: 'inhaber' } } } as never
const ohneAnmeldung = { req: { user: null } } as never

test('gelöscht werden darf nur, was nie hinausgegangen ist', () => {
  const regel = OutgoingInvoices.access?.delete
  expect(regel, 'die Sammlung muss eine Löschregel haben').toBeDefined()

  expect(regel!(alsInhaber)).toEqual({
    and: [{ invoiceNumber: { exists: false } }, { status: { equals: 'entwurf' } }],
  })
})

test('ohne Anmeldung wird gar nichts gelöscht', () => {
  expect(OutgoingInvoices.access!.delete!(ohneAnmeldung)).toBe(false)
})

test('die Regel ist keine bloße Erlaubnis', () => {
  // `true` wäre der Fehler, der hier behoben wurde: Damit dürfte das
  // Admin-Panel jede Rechnung löschen, auch eine gestellte.
  expect(OutgoingInvoices.access!.delete!(alsInhaber)).not.toBe(true)
})
