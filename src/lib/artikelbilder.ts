/**
 * Welches Bild zu welcher Farbe und welcher Variante gehört.
 *
 * Der Anlass kam aus der Werkstatt: Wer auf „Rubinrot" tippt, sah bisher
 * weiter das Bild, das zufällig oben lag. Ein Farbfleck neben einem Bild in
 * einer anderen Farbe ist keine Vorschau, sondern ein Widerspruch.
 *
 * Die Zuordnung steht an der Farbe (und an der Variante) als Verweis auf ein
 * Bild aus der Mediathek — nicht als zweite Aufnahme. Diese Datei rechnet
 * daraus aus, welches Bild die Galerie zeigen soll: Aus dem Verweis wird eine
 * Stelle in der Galerie, denn die Anzeige blättert über einen Index.
 *
 * Warum eigenständig und nicht in der Anzeige: Hier steckt die einzige
 * Regelentscheidung des ganzen Vorgangs — was gilt, wenn Farbe und Variante
 * beide ein Bild mitbringen. Das gehört an eine Stelle, die man prüfen kann,
 * ohne einen Browser zu starten.
 */

/** Ein Bild, wie es die Galerie führt — mit seiner Kennung aus der Mediathek */
export type Galeriebild = {
  /** Die Kennung aus der Mediathek, für die Zuordnung */
  id?: number | string | null
  url: string
  alt: string
  srcSet?: string
  width?: number
  height?: number
}

/** Eine Farbe oder Variante, die ein eigenes Bild mitbringen kann */
export type MitBild = {
  /** Verweis auf das Bild — als Kennung oder als geladenes Objekt */
  image?: { id?: number | string | null } | number | string | null
}

/**
 * Die Kennung aus einem Verweis holen.
 *
 * Payload liefert Verweise je nach `depth` als Zahl oder als Objekt. Beide
 * Formen kommen hier an — die Anzeige soll sich darum nicht kümmern müssen.
 */
export function bildKennung(bezug: MitBild['image']): number | string | null {
  if (bezug === null || bezug === undefined) return null
  if (typeof bezug === 'number' || typeof bezug === 'string') return bezug
  const id = bezug.id
  return id === null || id === undefined ? null : id
}

/**
 * Die Stelle in der Galerie, die dieses Bild zeigt.
 *
 * `null`, wenn die Farbe kein eigenes Bild hat oder das Bild nicht in der
 * Galerie steht. Dann bleibt es bei dem, was der Besucher gerade ansieht —
 * ihn auf das erste Bild zurückzuwerfen wäre schlechter als nichts zu tun.
 */
export function stelleFuer(
  bezug: MitBild['image'],
  bilder: Pick<Galeriebild, 'id'>[],
): number | null {
  const kennung = bildKennung(bezug)
  if (kennung === null) return null
  const stelle = bilder.findIndex((b) => b.id !== null && b.id !== undefined && String(b.id) === String(kennung))
  return stelle === -1 ? null : stelle
}

/**
 * Eine Auswahl in der Anzeige — dort steht die Kennung schon aufgelöst.
 *
 * Die Anzeige bekommt vom Server `bildId` und nicht den ganzen Verweis: Ein
 * Client-Bündel soll keine Payload-Objekte mitschleppen, von denen es ein
 * einziges Feld braucht.
 */
export type MitBildId = { bildId?: number | string | null }

/**
 * Welche Stelle die Galerie nach einer Auswahl zeigen soll.
 *
 * Bringen Farbe und Variante beide ein Bild mit, **gewinnt die Farbe**: Sie
 * ist die feinere Angabe, und wer zuletzt auf einen Farbfleck getippt hat,
 * erwartet genau diese Farbe zu sehen. Die Variante entscheidet über Maß oder
 * Werkstoff, die Farbe über das, was man sieht.
 *
 * `null` heißt: keine der beiden hat ein Bild, das die Galerie kennt — die
 * Anzeige bleibt, wo sie ist.
 */
export function bildStelle(
  farbe: MitBildId | null | undefined,
  variante: MitBildId | null | undefined,
  bilder: Pick<Galeriebild, 'id'>[],
): number | null {
  const ausFarbe = stelleFuer(farbe?.bildId ?? null, bilder)
  if (ausFarbe !== null) return ausFarbe
  return stelleFuer(variante?.bildId ?? null, bilder)
}

/**
 * Die Galerie um Bilder ergänzen, die nur an einer Farbe oder Variante hängen.
 *
 * Ohne diesen Schritt müsste jemand daran denken, jedes Farbbild **auch** oben
 * unter „Bilder" einzutragen — und genau das würde vergessen. Dann zeigte die
 * Farbe auf ein Bild, das die Galerie nicht führt, und der Griff ginge ins
 * Leere.
 *
 * Angehängt wird hinten und in der Reihenfolge, in der die Farben stehen: Das
 * erste Bild der Galerie ist das Aushängeschild des Artikels — es bleibt, wo
 * es ist. Bilder, die schon oben stehen, kommen nicht doppelt.
 */
export function galerieErgaenzen<T extends Galeriebild>(
  bilder: T[],
  zusatz: { bezug: MitBild['image']; bild: T | null }[],
): T[] {
  const ergebnis = [...bilder]
  const bekannt = new Set(
    ergebnis
      .map((b) => (b.id === null || b.id === undefined ? null : String(b.id)))
      .filter((k): k is string => k !== null),
  )
  for (const { bezug, bild } of zusatz) {
    const kennung = bildKennung(bezug)
    if (kennung === null || bild === null) continue
    const schluessel = String(kennung)
    if (bekannt.has(schluessel)) continue
    bekannt.add(schluessel)
    ergebnis.push(bild)
  }
  return ergebnis
}
