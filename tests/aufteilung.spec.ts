import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * Die Naht zwischen den beiden Abbildern.
 *
 * Website und Büro werden getrennt gebaut und laufen in getrennten
 * Containern. Was sie verbindet, ist keine Schnittstelle, sondern eine
 * Übereinkunft an zwei Stellen: Der Bau legt fest, unter welcher Adresse das
 * Büro seine Skripte und Stile anbietet, und die Stack-Datei legt fest,
 * welche Adressen überhaupt beim Büro landen. Stimmen die beiden nicht
 * überein, ist der Fehler nicht zu übersehen und trotzdem schwer zu finden:
 * Die Seite kommt an, aber ohne eine einzige Stildatei — Überschriften,
 * blaue Links, sonst nichts.
 *
 * Genau so ist es passiert. Beide Container boten ihre Dateien unter
 * `/_next/static/…` an; Traefik schickte diesen Pfad zur Website, und die
 * hatte seit der Trennung andere Prüfsummen in den Dateinamen. Vorher fiel
 * das nicht auf, weil beide dasselbe Abbild fuhren und die Namen deshalb
 * zufällig übereinstimmten.
 *
 * Dieser Test liest beide Seiten der Übereinkunft aus den Dateien und
 * vergleicht sie. Er braucht dafür weder Server noch Container.
 */

const wurzel = new URL('..', import.meta.url).pathname

test.describe('Aufteilung in zwei Abbilder', () => {
  test('die Dateien des Büros liegen hinter einer Regel, die zum Büro führt', () => {
    const konfig = readFileSync(`${wurzel}next.config.mjs`, 'utf8')
    const stack = readFileSync(`${wurzel}docker-compose.yml`, 'utf8')

    // Unter welchem Vorsatz bietet das Büro-Abbild seine Dateien an?
    const vorsatz = konfig.match(/assetPrefix:.*?'(\/[^']*)'/)?.[1]
    expect(vorsatz, 'das Büro-Abbild bekommt einen eigenen Vorsatz').toBeTruthy()

    // Und welche Pfade schickt Traefik zum Büro?
    const regel = stack.match(/routers\.vhbuero\.rule=(.*)/)?.[1]
    expect(regel, 'das Büro hat eine Traefik-Regel').toBeTruthy()

    const pfade = [...regel!.matchAll(/PathPrefix\(`([^`]+)`\)/g)].map((t) => t[1])
    expect(
      pfade.some((p) => vorsatz!.startsWith(p)),
      `Die Dateien des Büros liegen unter ${vorsatz}/_next/…, aber die Regel deckt nur ${pfade.join(', ')} ab — sie landen beim falschen Container und die Seite kommt ohne Stile an.`,
    ).toBe(true)
  })

  test('beide Hälften melden getrennt, welcher Stand bei ihnen läuft', () => {
    const stack = readFileSync(`${wurzel}docker-compose.yml`, 'utf8')

    /*
     * Zwei Container, zwei Abbilder — und damit die Frage, ob beim Ausrollen
     * wirklich beide getauscht wurden. `/api/healthz` liegt im Website-Zweig
     * und beantwortet deshalb immer nur die eine Hälfte; das Büro hat seine
     * eigene Auskunft. Fehlt sie, lässt sich die Frage von außen gar nicht
     * stellen — und man rät, so wie wir es einen Vormittag lang getan haben.
     */
    const buero = stack.slice(stack.indexOf('  buero:'))
    expect(buero, 'die Gesundheitsprüfung des Büros fragt seine eigene Auskunft').toContain(
      '/api/office/healthz',
    )
  })
})
