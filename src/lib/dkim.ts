/**
 * Welche Unterschrift unter welche Mail gehört.
 *
 * DKIM signiert im Namen einer Domain. Der empfangende Server holt sich den
 * öffentlichen Schlüssel unter `<selector>._domainkey.<domain>` und rechnet
 * nach. Damit das der Mail auch nützt, muss die signierende Domain zur
 * Absenderadresse passen — das verlangt DMARC („Alignment"). Eine Mail von
 * `info@vincent-hellmann.fr`, unterschrieben mit dem Schlüssel von
 * `vincent-hellmann.com`, besteht zwar die DKIM-Prüfung, gilt aber trotzdem
 * als nicht ausgewiesen. Sie hilft also nicht und kostet nur Rechenzeit.
 *
 * Deshalb wird die allgemeine Unterschrift nur dann verwendet, wenn sie zur
 * Absenderadresse passt. Trägt jemand am Postfach eigene Angaben ein, gelten
 * die — das ist eine ausdrückliche Entscheidung und keine Vermutung.
 */

/** Was nodemailer für die Unterschrift braucht */
export type DkimAngaben = {
  domainName: string
  keySelector: string
  privateKey: string
}

/**
 * Alles oder nichts: Fehlt eine der drei Angaben, wird nicht signiert. Eine
 * unvollständige Unterschrift schlägt beim Empfänger fehl und schadet mehr
 * als gar keine — dann sieht die Mail nach einer Fälschung aus.
 */
export function dkimAus(
  domain: string | undefined,
  selector: string | undefined,
  schluessel: string | undefined,
): DkimAngaben | undefined {
  if (!domain?.trim() || !selector?.trim() || !schluessel?.trim()) return undefined
  return {
    domainName: domain.trim(),
    keySelector: selector.trim(),
    privateKey: schluessel.trim(),
  }
}

/** Der Teil hinter dem @, klein geschrieben */
export function domainVon(adresse: string): string {
  const at = String(adresse ?? '').lastIndexOf('@')
  return at < 0 ? '' : adresse.slice(at + 1).trim().toLowerCase()
}

/**
 * Passt die Unterschrift zur Absenderadresse?
 *
 * Gleiche Domain zählt, und eine Unterdomain zählt auch: `mail.example.com`
 * darf mit dem Schlüssel von `example.com` unterschreiben, denn beide gehören
 * derselben Organisation. Umgekehrt nicht — sonst könnte ein Schlüssel für
 * eine Unterdomain für die ganze Domain sprechen.
 */
export function dkimPasst(dkim: DkimAngaben, adresse: string): boolean {
  const absender = domainVon(adresse)
  const signiert = dkim.domainName.trim().toLowerCase()
  if (!absender || !signiert) return false
  return absender === signiert || absender.endsWith('.' + signiert)
}

/**
 * Die Unterschrift für eine Absenderadresse — eigene vor allgemeiner.
 *
 * `hinweis` wird gerufen, wenn eine allgemeine Unterschrift da wäre, aber
 * nicht zur Adresse passt. Sonst bliebe genau der Fall still, der wehtut:
 * Man trägt DKIM ein, freut sich, und die Post aus dem Postfach geht
 * weiterhin unsigniert raus.
 */
export function dkimFuer(
  adresse: string,
  eigene: DkimAngaben | undefined,
  allgemeine: DkimAngaben | undefined,
  hinweis?: (grund: string) => void,
): DkimAngaben | undefined {
  if (eigene) return eigene
  if (!allgemeine) return undefined
  if (dkimPasst(allgemeine, adresse)) return allgemeine
  hinweis?.(
    `DKIM ist für ${allgemeine.domainName} hinterlegt, ${adresse} gehört aber nicht dazu — ` +
      'diese Mail geht unsigniert raus. Eigene DKIM-Angaben am Postfach eintragen.',
  )
  return undefined
}
