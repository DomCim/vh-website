/**
 * Wie ein neuer Postfach-Ordner heißt.
 *
 * Eigene Datei, weil beide Seiten sie brauchen: Der Browser stellt den Pfad
 * zusammen, der Server prüft ihn nach. `postfach.ts` scheidet als Heimat aus —
 * das zieht `imapflow` und `nodemailer` nach sich, und beides gehört nicht in
 * ein Bündel, das ans Telefon ausgeliefert wird. (Dieselbe Trennung wie bei
 * `dateigrenzen.ts`.)
 */

/**
 * Ordnernamen dürfen kein Trennzeichen enthalten.
 *
 * Wer „Kunden/2026" eingibt, meint einen Ordner mit Schrägstrich im Namen. Bei
 * IMAP entstünde daraus aber eine Ebene — und je nach Anbieter eine an ganz
 * anderer Stelle, weil der eine mit Punkt trennt und der andere mit Strich.
 * Abzulehnen ist ehrlicher, als etwas anderes anzulegen, als der Name verspricht.
 */
export function ordnernameGueltig(name: string): boolean {
  const sauber = name.trim()
  if (!sauber) return false
  if (sauber.length > 60) return false
  return !/[/\\.]/.test(sauber)
}

/**
 * Der Pfad für einen neuen Ordner **neben** dem gerade offenen.
 *
 * „Neben" und nicht „darin" ist die Erwartung: Wer im Posteingang steht und
 * „Kunden" anlegt, will einen Ordner Kunden — keinen Unterordner des
 * Posteingangs, den manche Mailprogramme gar nicht erst anzeigen.
 *
 * Steht man schon in einem Unterordner (`INBOX.Kunden`), entsteht der neue auf
 * derselben Ebene (`INBOX.Rechnungen`). Der Trenner kommt vom Server und wird
 * nie geraten.
 */
export function ordnerPfadNeben(offen: string, trenner: string, name: string): string {
  const t = trenner || '/'
  const sauber = name.trim()
  const teile = offen.split(t)
  const darueber = teile.length > 1 ? teile.slice(0, -1).join(t) : ''
  return darueber ? `${darueber}${t}${sauber}` : sauber
}
