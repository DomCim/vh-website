import { expect, test } from '@playwright/test'

import { dkimAus, dkimFuer, dkimPasst, domainVon } from '../src/lib/dkim'

/**
 * DKIM ist die Unterschrift unter der Mail. Zwei Regeln entscheiden darüber,
 * ob sie gesetzt wird — beide stehen in `src/lib/dkim.ts`, und beide wären
 * still falsch, wenn sie kippen: Die Mail geht raus, sie kommt an, sie landet
 * nur im Spam. Das merkt man erst Wochen später an ausbleibenden Antworten.
 */

const SCHLUESSEL = '-----BEGIN PRIVATE KEY-----'
const ALLGEMEIN = dkimAus('vincent-hellmann.com', 'vh', SCHLUESSEL)!

test.describe('Vollständigkeit', () => {
  test('vollständige Angaben ergeben eine Signatur', () => {
    expect(ALLGEMEIN).toEqual({
      domainName: 'vincent-hellmann.com',
      keySelector: 'vh',
      privateKey: SCHLUESSEL,
    })
  })

  /*
   * Eine halbe Unterschrift ist schlimmer als keine: Der empfangende Server
   * prüft sie, sie schlägt fehl, und die Mail sieht nach einer Fälschung aus.
   */
  test('fehlt eine Angabe, wird nicht signiert', () => {
    expect(dkimAus(undefined, 'vh', SCHLUESSEL)).toBeUndefined()
    expect(dkimAus('vincent-hellmann.com', undefined, SCHLUESSEL)).toBeUndefined()
    expect(dkimAus('vincent-hellmann.com', 'vh', undefined)).toBeUndefined()
    expect(dkimAus('', '', '')).toBeUndefined()
    expect(dkimAus('  ', ' ', ' ')).toBeUndefined()
  })
})

test.describe('Die Domain muss zur Absenderadresse passen', () => {
  test('die Domain steht hinter dem @, egal wie die Adresse aussieht', () => {
    expect(domainVon('info@vincent-hellmann.com')).toBe('vincent-hellmann.com')
    expect(domainVon('Info@Vincent-Hellmann.COM')).toBe('vincent-hellmann.com')
    // Ein @ im lokalen Teil ist erlaubt — es zählt das letzte
    expect(domainVon('"a@b"@example.com')).toBe('example.com')
    expect(domainVon('ohne-at')).toBe('')
  })

  test('gleiche Domain passt, Unterdomain auch', () => {
    expect(dkimPasst(ALLGEMEIN, 'info@vincent-hellmann.com')).toBe(true)
    expect(dkimPasst(ALLGEMEIN, 'info@mail.vincent-hellmann.com')).toBe(true)
  })

  /*
   * Umgekehrt nicht: Ein Schlüssel für eine Unterdomain darf nicht für die
   * ganze Domain sprechen. Und eine fremde Domain schon gar nicht — auch
   * dann nicht, wenn sie ähnlich heißt.
   */
  test('fremde Domain passt nicht', () => {
    expect(dkimPasst(ALLGEMEIN, 'info@vincent-hellmann.fr')).toBe(false)
    expect(dkimPasst(ALLGEMEIN, 'info@vincent-hellmann.de')).toBe(false)
    expect(dkimPasst(ALLGEMEIN, 'info@nicht-vincent-hellmann.com')).toBe(false)
    expect(dkimPasst(dkimAus('mail.vincent-hellmann.com', 'vh', SCHLUESSEL)!, 'info@vincent-hellmann.com')).toBe(false)
    expect(dkimPasst(ALLGEMEIN, 'ohne-at')).toBe(false)
  })
})

test.describe('Welche Unterschrift ein Postfach bekommt', () => {
  test('ohne eigene Angaben die allgemeine — wenn sie passt', () => {
    expect(dkimFuer('info@vincent-hellmann.com', undefined, ALLGEMEIN)).toEqual(ALLGEMEIN)
  })

  /*
   * Der Fall, der ohne Hinweis still bliebe: DKIM ist eingetragen, das
   * Postfach liegt aber auf einer anderen Domain. Signiert wird nicht — und
   * es muss im Log stehen, sonst sucht man den Fehler nie dort.
   */
  test('passt sie nicht, wird nicht signiert und es gibt einen Hinweis', () => {
    const hinweise: string[] = []
    expect(dkimFuer('info@vincent-hellmann.fr', undefined, ALLGEMEIN, (g) => hinweise.push(g))).toBeUndefined()
    expect(hinweise).toHaveLength(1)
    expect(hinweise[0]).toContain('vincent-hellmann.fr')
  })

  test('eigene Angaben am Postfach gehen vor', () => {
    const eigen = dkimAus('vincent-hellmann.fr', 'vh', SCHLUESSEL)!
    expect(dkimFuer('info@vincent-hellmann.fr', eigen, ALLGEMEIN)).toEqual(eigen)
    // Auch dann, wenn die allgemeine ebenfalls passen würde
    expect(dkimFuer('info@vincent-hellmann.com', eigen, ALLGEMEIN)).toEqual(eigen)
  })

  test('ohne jede Angabe bleibt es unsigniert — ohne Hinweis', () => {
    const hinweise: string[] = []
    expect(dkimFuer('info@vincent-hellmann.com', undefined, undefined, (g) => hinweise.push(g))).toBeUndefined()
    expect(hinweise).toEqual([])
  })
})
