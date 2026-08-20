import { expect, test } from '@playwright/test'

/**
 * DKIM wird nur vollständig oder gar nicht gesetzt.
 *
 * Eine halbe Unterschrift ist schlimmer als keine: Der empfangende Server
 * prüft sie, sie schlägt fehl, und die Mail sieht nach einer Fälschung aus.
 * Deshalb muss `getIntegrations` bei fehlenden Angaben `undefined` liefern —
 * dann kommt der Block bei nodemailer gar nicht erst an.
 *
 * Geprüft wird die Regel selbst, ohne Datenbank: Sie steht in `settings.ts`
 * und ist die Stelle, an der ein Fehler still bliebe.
 */

/** Dieselbe Bedingung wie in `getIntegrations` */
function dkimAus(domain?: string, selector?: string, schluessel?: string) {
  return domain && selector && schluessel
    ? { domainName: domain, keySelector: selector, privateKey: schluessel }
    : undefined
}

test('vollständige Angaben ergeben eine Signatur', () => {
  expect(dkimAus('vincent-hellmann.com', 'vh', '-----BEGIN PRIVATE KEY-----')).toEqual({
    domainName: 'vincent-hellmann.com',
    keySelector: 'vh',
    privateKey: '-----BEGIN PRIVATE KEY-----',
  })
})

test('fehlt eine Angabe, wird nicht signiert', () => {
  expect(dkimAus(undefined, 'vh', 'schluessel')).toBeUndefined()
  expect(dkimAus('vincent-hellmann.com', undefined, 'schluessel')).toBeUndefined()
  expect(dkimAus('vincent-hellmann.com', 'vh', undefined)).toBeUndefined()
  expect(dkimAus('', '', '')).toBeUndefined()
})
