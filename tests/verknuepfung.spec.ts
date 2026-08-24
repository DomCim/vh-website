import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

import { arbeitenAus } from '../src/lib/arbeiten'

/**
 * Der Weg vom Text zur Ware — und zurück zur Anfrage.
 *
 * Zwei Lücken, die dasselbe Problem hatten: Eine Seite endete, ohne irgendwo
 * hinzuführen. Ein Ratgeber über Rostschutz brachte Leser, aber keinen
 * Auftrag; und wer eine Referenz ansah und auf „Nach Maß fertigen" klickte,
 * landete auf einem leeren Formular und musste von vorn erklären, was er
 * eben gesehen hatte.
 *
 * Geprüft wird hier das, was dabei still schiefgehen kann: Kacheln, die ins
 * Leere führen, und eine Anfrage, die ihren Bezug unterwegs verliert.
 */

const bild = () => undefined
const alt = (_m: unknown, fallback: string) => fallback

const artikel = (zusatz: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Gartensessel',
  slug: 'gartensessel',
  category: { slug: 'moebel' },
  ...zusatz,
})

test('aus verknüpften Artikeln werden Kacheln mit vollständiger Adresse', () => {
  const raus = arbeitenAus([artikel()], bild, alt)
  expect(raus).toHaveLength(1)
  expect(raus[0].slug).toBe('gartensessel')
  expect(raus[0].kategorieSlug).toBe('moebel')
})

test('ein Artikel ohne Kategorie fällt heraus, statt ins Leere zu führen', () => {
  /*
   * Die Adresse eines Artikels ist `/<kategorie>/<artikel>`. Ohne Kategorie
   * gibt es sie nicht — eine Kachel dorthin wäre eine Fehlerseite, und die
   * ist schlimmer als eine Kachel weniger.
   */
  expect(arbeitenAus([artikel({ category: null })], bild, alt)).toEqual([])
  expect(arbeitenAus([artikel({ slug: '' })], bild, alt)).toEqual([])
})

test('nicht aufgelöste Verweise fallen heraus', () => {
  // Reine Zahlen heißt: `depth` reichte nicht. Daraus lässt sich keine
  // Kachel bauen, und geraten wird hier nichts.
  expect(arbeitenAus([7, 9], bild, alt)).toEqual([])
  expect(arbeitenAus(null, bild, alt)).toEqual([])
})

/**
 * Die Nachrichtenseite braucht zwei Ebenen Tiefe.
 *
 * Die erste löst die verknüpften Artikel auf, die zweite deren Kategorie.
 * Bei `depth: 1` käme `category` als bloße Zahl zurück, `arbeitenAus` würfe
 * jede Kachel weg — und unter dem Ratgeber stünde stillschweigend nichts.
 */
test('News werden tief genug geladen, damit die Kacheln eine Adresse haben', () => {
  const data = fs.readFileSync(path.join(process.cwd(), 'src/lib/data.ts'), 'utf8')
  const stelle = data.slice(data.indexOf('export async function getNewsBySlug'))
  const bisEnde = stelle.slice(0, stelle.indexOf('\n}'))
  expect(bisEnde).toContain('depth: 2')
})

/**
 * Der Bezug zur Referenz überlebt bis in die Anfrage.
 *
 * Er steht zwar auch im vorbelegten Text — aber den überschreibt mancher,
 * und dann bleibt nur „ich hätte gern so etwas". Als eigenes Feld übersteht
 * er das; deshalb wird hier geprüft, dass die Kette lückenlos ist.
 */
test('die Referenz reicht vom Knopf bis in die Anfrage durch', () => {
  const lies = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')

  // 1. Der Knopf an der Referenz hängt den Pfad an
  expect(lies('src/components/MassanfertigungHinweis.tsx')).toContain('?referenz=')
  // 2. Die Referenzseite gibt ihn mit
  expect(lies('src/app/(frontend)/[locale]/projekte/[slug]/page.tsx')).toContain(
    'referenz={project.slug',
  )
  // 3. Das Formular schickt Titel und Pfad mit
  const formular = lies('src/components/MassanfertigungForm.tsx')
  expect(formular).toContain('referenceTitle: bezug?.titel')
  expect(formular).toContain('referenceUrl: bezug?.pfad')
  // 4. Die Schnittstelle schreibt beides an die Anfrage
  const route = lies('src/app/(frontend)/api/contact/route.ts')
  expect(route).toContain('referenceTitle: body.referenceTitle')
  expect(route).toContain('referenceUrl: body.referenceUrl')
  // 5. Und die Sammlung hat die Felder dafür
  expect(lies('src/collections/Inquiries.ts')).toContain("name: 'referenceTitle'")
})

/**
 * Was sich am Beitrag verknüpfen lässt, muss auch über den Fernzugriff gehen.
 *
 * Sonst kann der Assistent einen Ratgeber schreiben, aber nicht dorthin
 * führen, wo etwas zu kaufen ist — und genau das war der Zweck der Übung.
 */
test('die Verknüpfung lässt sich per MCP setzen und wieder lesen', () => {
  const news = fs.readFileSync(path.join(process.cwd(), 'src/lib/mcp/news.ts'), 'utf8')
  // Setzen beim Anlegen und beim Ändern
  expect(news.match(/produktSlugs: z/g) ?? []).toHaveLength(2)
  // Und im Lesen wieder heraus — sonst ließe sich die Leitplanke
  // „vor dem Schreiben lesen" nicht befolgen
  expect(news).toContain('produktSlugs: (n.relatedProducts')
  // Ein Pfad, den es nicht gibt, ist ein Tippfehler und kein leeres Feld
  expect(news).toContain('Diese Artikel gibt es nicht')
})
