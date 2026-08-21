import type { Field } from 'payload'

/**
 * Übersetzt Payloads Feldbeschreibung in etwas, das das Büro rendern kann.
 *
 * Warum nicht die Formulare von Hand nachbauen: Die Integrationen allein sind
 * über fünfhundert Zeilen Felddefinition. Von Hand nachgebaut liefe das
 * auseinander, sobald jemand ein Feld ergänzt — und zwar stillschweigend. So
 * erscheint ein neues Feld in Payload auch im Büro, ohne dass hier etwas
 * angefasst wird.
 *
 * Herausgereicht wird bewusst wenig: Name, Beschriftung, Art, Erläuterung.
 * Alles, was nur das Admin-Panel angeht, bleibt draußen.
 */

export type FeldArt =
  | 'text'
  | 'email'
  | 'zahl'
  | 'haken'
  | 'auswahl'
  | 'absatz'
  /** Mehrzeilig mit Gestaltung — im Büro als Schreibfeld, gespeichert als HTML */
  | 'gestaltet'
  | 'gruppe'
  | 'liste'

export type FeldBeschreibung = {
  name: string
  label: string
  art: FeldArt
  hinweis?: string
  pflicht?: boolean
  /** Wie ein Passwort behandeln: verdeckt, aber kopierfähig */
  geheim?: boolean
  optionen?: { wert: string; text: string }[]
  /** Bei Gruppen und Listen: was darin steht */
  felder?: FeldBeschreibung[]
}

const GEHEIM = '/components/admin/GeheimFeld#GeheimFeld'

function beschriftung(feld: Field & { name?: string; label?: unknown }): string {
  if (typeof feld.label === 'string') return feld.label
  if (feld.label && typeof feld.label === 'object') {
    const de = (feld.label as { de?: string }).de
    if (de) return de
  }
  return (feld.name as string) ?? ''
}

function hinweisAus(feld: Field): string | undefined {
  const beschreibung = (feld.admin as { description?: unknown } | undefined)?.description
  if (typeof beschreibung === 'string') return beschreibung
  return undefined
}

function istGeheim(feld: Field): boolean {
  const komponente = (
    feld.admin as { components?: { Field?: unknown } } | undefined
  )?.components?.Field
  return komponente === GEHEIM
}

/** Wandelt eine Liste von Payload-Feldern um. Zeilen werden dabei aufgelöst. */
export function felderLesen(felder: Field[]): FeldBeschreibung[] {
  const ergebnis: FeldBeschreibung[] = []

  for (const feld of felder) {
    // Zeilen sind reine Anordnung — im Büro entscheidet das Blatt selbst,
    // was nebeneinander passt
    if (feld.type === 'row' || feld.type === 'collapsible') {
      ergebnis.push(...felderLesen(feld.fields))
      continue
    }
    // Reine Anzeigeelemente des Admin-Panels haben hier nichts verloren
    if (feld.type === 'ui') continue
    if (!('name' in feld) || !feld.name) continue

    const gemeinsam = {
      name: feld.name,
      label: beschriftung(feld),
      hinweis: hinweisAus(feld),
      pflicht: 'required' in feld ? Boolean(feld.required) : undefined,
    }

    switch (feld.type) {
      case 'group':
        ergebnis.push({ ...gemeinsam, art: 'gruppe', felder: felderLesen(feld.fields) })
        break
      case 'array':
        ergebnis.push({ ...gemeinsam, art: 'liste', felder: felderLesen(feld.fields) })
        break
      case 'checkbox':
        ergebnis.push({ ...gemeinsam, art: 'haken' })
        break
      case 'number':
        ergebnis.push({ ...gemeinsam, art: 'zahl' })
        break
      case 'email':
        ergebnis.push({ ...gemeinsam, art: 'email' })
        break
      case 'textarea': {
        /*
         * Auch ein mehrzeiliges Feld kann ein Geheimnis sein — der private
         * DKIM-Schlüssel ist eines. Stünde er hier offen im Blatt, läge er
         * lesbar auf dem Telefon, das in der Werkstatt herumliegt.
         *
         * Und eines kann Gestaltung wollen: Die Signatur trägt dafür
         * `custom.gestaltet` — im Büro wird daraus das Schreibfeld.
         */
        const gestaltet = Boolean(
          (feld as { custom?: { gestaltet?: boolean } }).custom?.gestaltet,
        )
        ergebnis.push({
          ...gemeinsam,
          art: gestaltet ? 'gestaltet' : 'absatz',
          geheim: istGeheim(feld) || undefined,
        })
        break
      }
      case 'select':
        ergebnis.push({
          ...gemeinsam,
          art: 'auswahl',
          optionen: (feld.options ?? []).map((o) =>
            typeof o === 'string'
              ? { wert: o, text: o }
              : { wert: String(o.value), text: beschriftung(o as never) },
          ),
        })
        break
      case 'text':
        ergebnis.push({ ...gemeinsam, art: 'text', geheim: istGeheim(feld) || undefined })
        break
      default:
        // Alles Übrige (Rich Text, Verweise, Uploads) bleibt der
        // Website-Verwaltung vorbehalten — dort gehört es auch hin.
        break
    }
  }

  return ergebnis
}
