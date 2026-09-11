/**
 * Steckt in einem Namensfeld ein Mensch und eine Firma?
 *
 * **Woher das kommt.** Der Geschäftspartner hatte lange genau ein Feld, und es
 * hieß „Name / Firma". Getippt wurde daraufhin beides hinein: „Armin Keins /
 * Majer GmbH & Co. KG". Auf der Rechnung steht dann genau das — und niemand
 * weiß mehr, wer der Rechnungsempfänger ist und wer nur der Mensch am Telefon.
 *
 * **Warum nur ein Vorschlag und keine Wanderung.** Ein Firmenname darf selbst
 * einen Schrägstrich tragen („Meier / Schulz GbR"). Eine Wanderung, die das
 * selbständig zerlegt, erwischt irgendwann den falschen — und es fällt erst
 * auf einem Beleg auf, der schon beim Kunden liegt. Also raten, vorlegen, und
 * erst auf Klick speichern.
 *
 * **Woran die Firma erkannt wird:** an der Rechtsform. Findet sich keine, gilt
 * der längere Teil als Firma — eine Firmierung ist fast immer länger als ein
 * Name.
 */

const RECHTSFORM = /\b(gmbh|kg|ag|ug|gbr|ohg|e\.?k\.?|sas|sarl|s\.?a\.?|eurl|ltd|inc|e\.?v\.?)\b/i

export type Namensteilung = { firma: string; person: string }

export function firmaUndPerson(name: string | null | undefined): Namensteilung | null {
  const teile = (name ?? '').split('/').map((t) => t.trim())
  if (teile.length !== 2) return null

  const [links, rechts] = teile
  if (!links || !rechts) return null

  const firma = RECHTSFORM.test(rechts)
    ? rechts
    : RECHTSFORM.test(links)
      ? links
      : links.length >= rechts.length
        ? links
        : rechts

  return { firma, person: firma === links ? rechts : links }
}
