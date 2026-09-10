import type { Arbeitsschritt } from '../arbeitsplan'
import type {
  AuftragMaterial,
  AuftragPosition,
  AuftragWerte,
} from '../../components/office/AuftragFormular'

/**
 * Einen Auftrag als Vorlage für einen neuen nehmen.
 *
 * **Wofür.** Vincent baut wiederkehrende Stücke: derselbe Ablauf, dieselben
 * Positionen, dasselbe Material, nur ein anderer Kunde. Das alles ein zweites
 * Mal einzutippen dauert und geht daneben — eine Zahl weicht ab, und in der
 * Auslastung steht sie als Zusage.
 *
 * **Was nicht mitkommt und warum.** Ein Duplikat ist ein *neuer* Auftrag und
 * kein Abzug des alten:
 *
 *  - **Kunde und Bezeichnung** bleiben leer. Ein Duplikat entsteht meist für
 *    jemand anderen, und ein stehengebliebener fremder Name auf einem
 *    Lieferschein ist schlimmer als ein leeres Feld.
 *  - **Auftragsnummer, Status, Daten** — die Nummer vergibt das Haus, der
 *    Status fängt von vorn an.
 *  - **Alles Geschehene**: erledigte Schritte, Meldungen, Abnahme,
 *    Übergabefotos, Sendungsnummern, Zeitbuchungen, Rechnungen. Das gehört
 *    dem alten Auftrag und niemandem sonst.
 *  - **`materialGebucht`** ist ausdrücklich falsch: Das Material des neuen
 *    Auftrags ist noch nicht vom Bestand abgezogen. Käme das Häkchen mit,
 *    würde nie abgebucht, und der Bestand zeigte Ware, die längst verbaut ist.
 *
 * **Kein Weg um ein Storno herum.** Wer nach einer stornierten Rechnung eine
 * neue braucht, nimmt *denselben* Auftrag — der Knopf dafür kommt zurück,
 * sobald keine gültige Rechnung mehr an ihm hängt. Ein Duplikat wäre dort der
 * falsche Griff: Es zählt in Nachkalkulation, Auslastung und Statistik ein
 * zweites Mal mit.
 */

type Quelle = {
  /*
   * Bezüge kommen aus dem Bestand im Gerät mal als Kennung, mal als ganzer
   * Datensatz — je nachdem, wie tief der Abgleich sie geholt hat. Deshalb
   * hier absichtlich offen und in `bezugId` zusammengeführt.
   */
  positions?: (Omit<AuftragPosition, 'product'> & { product?: unknown })[] | null
  material?: (Omit<AuftragMaterial, 'item'> & { item?: unknown })[] | null
  arbeitsplan?: Arbeitsschritt[] | null
  plannedMinutes?: number | null
  zahlplan?: { anzahlungProzent?: number | null; zwischenProzent?: number | null } | null
  meilenstein?: { bezeichnung?: string | null } | null
  anzahlungProzent?: number | null
  zwischenProzent?: number | null
  meilensteinBezeichnung?: string | null
  notes?: string | null
}

/** Die Kennung eines Bezugs, gleich ob er als Zahl oder als Datensatz kommt. */
function bezugId(wert: unknown): number | '' {
  if (typeof wert === 'number') return wert
  if (typeof wert === 'string' && wert.trim()) return Number(wert) || ''
  if (wert && typeof wert === 'object') {
    const id = (wert as { id?: number }).id
    return typeof id === 'number' ? id : ''
  }
  return ''
}

export function werteAusVorlage(vorlage: Quelle): AuftragWerte {
  return {
    // Der Arbeitsinhalt — das, wofür ein Duplikat überhaupt gemacht wird
    positions: (vorlage.positions ?? [])
      .filter((p) => p?.description?.trim())
      .map((p) => ({
        description: p.description,
        quantity: Number(p.quantity) || 1,
        price: p.price ?? null,
        product: bezugId(p.product) || null,
        farbe: p.farbe ?? null,
      })),

    material: (vorlage.material ?? [])
      .map((m) => ({
        item: bezugId(m?.item),
        quantity: Number(m?.quantity) || 0,
        ...(m?.beigestellt ? { beigestellt: true } : {}),
      }))
      .filter((m) => m.item !== ''),

    /*
     * Der Ablauf kommt als Plan, nicht als Verlauf: Jeder Schritt steht
     * wieder auf „offen", ohne erledigt-Datum, ohne Buchungen des Büros
     * (raus/zurück) und ohne die Meldungen des Dienstleisters. Was der Betrieb
     * macht, steht bleibt — wer, wie lange, zu welchem Preis.
     */
    arbeitsplan: (vorlage.arbeitsplan ?? [])
      .filter((s) => s?.was?.trim())
      .map((s) => ({
        was: s.was,
        art: s.art ?? 'eigen',
        minuten: s.minuten ?? null,
        dienstleister: s.dienstleister ?? null,
        kosten: s.kosten ?? null,
        vorlaufTage: s.vorlaufTage ?? null,
        stand: 'offen' as const,
      })),

    plannedMinutes: vorlage.plannedMinutes ?? null,

    // Zahlplan und Meilenstein als Vereinbarung, ohne das Erreichte
    anzahlungProzent: vorlage.zahlplan?.anzahlungProzent ?? vorlage.anzahlungProzent ?? null,
    zwischenProzent: vorlage.zahlplan?.zwischenProzent ?? vorlage.zwischenProzent ?? null,
    meilensteinBezeichnung:
      vorlage.meilenstein?.bezeichnung ?? vorlage.meilensteinBezeichnung ?? null,

    notes: vorlage.notes ?? null,

    // Und ausdrücklich: das Material ist noch nicht abgebucht
    materialGebucht: false,
  }
}
