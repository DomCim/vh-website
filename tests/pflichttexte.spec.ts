import { expect, test } from '@playwright/test'

import {
  pflichttexte,
  RECHTSTEXT_SPRACHEN,
  type Firmenangaben,
} from '../src/lib/rechtstexte'

/**
 * Die Pflichttexte des Shops — geprüft am Text, nicht am Server.
 *
 * Zwei Fehler sollen hier auffallen, bevor sie draußen stehen:
 *
 *  - **Ein Prüfhinweis am Ende.** „Dieser Text ist ein Entwurf und wurde noch
 *    nicht anwaltlich geprüft" stand jahrelang unter jedem Text. Gemeint war
 *    er für den Betrieb, gelesen hat ihn die Kundschaft — und ein Rechtstext,
 *    der sich selbst als Entwurf bezeichnet, belehrt nicht, sondern
 *    relativiert. Er ist raus und soll nicht zurückkommen.
 *
 *  - **Eine deutsche Formel in einem französischen Betrieb.** Next-Concept
 *    ist eine SAS; nach Art. L612-1 Code de la consommation muss der Zugang
 *    zu einer Verbraucherschlichtung eröffnet und die Stelle benannt sein.
 *    Der deutsche Satz „weder verpflichtet noch bereit" wäre dort das
 *    Gegenteil des Erlaubten.
 */

const VOLLSTAENDIG: Firmenangaben = {
  name: 'Next-Concept SAS',
  anschrift: '24, avenue Clemenceau \n67630 Lauterbourg\nFrankreich',
  email: 'info@vincent-hellmann.com',
  telefon: '+49 173 309 4034',
  rechtsform: 'SAS',
  stammkapital: 1000,
  rcsNummer: '987550159',
  rcsStadt: 'RCS Strasbourg',
  siret: '98755015900014',
  vatId: 'FR53987550159',
  schlichtung: 'Médiateur de la consommation, 1 rue Beispiel, 75000 Paris',
}

const FELDER = [
  'impressum',
  'datenschutz',
  'agb',
  'widerruf',
  'widerrufsformular',
  'versandZahlung',
]

test('jede Sprache bringt alle sechs Texte mit', () => {
  for (const sprache of RECHTSTEXT_SPRACHEN) {
    const texte = pflichttexte(VOLLSTAENDIG, sprache)
    expect(Object.keys(texte).sort()).toEqual([...FELDER].sort())
    for (const feld of FELDER) {
      expect(texte[feld].length, `${sprache}/${feld} ist zu kurz`).toBeGreaterThan(200)
    }
  }
})

test('kein Text bezeichnet sich selbst als ungeprüften Entwurf', () => {
  // Die Wendungen aus den drei alten Hinweisen, je Sprache.
  const verraeter = [
    'anwaltlich',
    'Hinweis der Werkstatt',
    "Note de l'atelier",
    'pas encore été',
    'Note from the workshop',
    'has not yet been checked',
    'by a lawyer',
  ]
  for (const sprache of RECHTSTEXT_SPRACHEN) {
    const texte = pflichttexte(VOLLSTAENDIG, sprache)
    for (const [feld, text] of Object.entries(texte)) {
      for (const wort of verraeter) {
        expect(text.includes(wort), `${sprache}/${feld} enthält „${wort}"`).toBe(false)
      }
    }
  }
})

test('sind alle Firmenangaben gepflegt, bleibt keine Lücke im Text', () => {
  // Fehlendes steht als `[…]` da — mit vollständigen Angaben darf davon
  // nichts übrig bleiben, sonst geht eine Lücke unbemerkt online.
  for (const sprache of RECHTSTEXT_SPRACHEN) {
    for (const [feld, text] of Object.entries(pflichttexte(VOLLSTAENDIG, sprache))) {
      // Ausgenommen: Präsident und Hoster stehen in keiner Einstellung.
      const rest = text.replace(/\[(Vor- und Nachname[^\]]*|Name[^\]]*|Prénom[^\]]*|Hoster[^\]]*|Nom, adresse[^\]]*|Hébergeur[^\]]*)\]/g, '')
      expect(rest.includes('['), `${sprache}/${feld}: ${rest.slice(rest.indexOf('['), rest.indexOf('[') + 60)}`).toBe(false)
    }
  }
})

test('das Impressum trägt die französischen Pflichtangaben', () => {
  for (const sprache of RECHTSTEXT_SPRACHEN) {
    const text = pflichttexte(VOLLSTAENDIG, sprache).impressum
    for (const angabe of ['Next-Concept SAS', 'RCS Strasbourg', '98755015900014', 'FR53987550159']) {
      expect(text.includes(angabe), `${sprache}: ${angabe} fehlt`).toBe(true)
    }
    // Der Hoster ist in Frankreich Pflichtangabe und in Deutschland nicht —
    // genau deshalb wird er hier festgehalten.
    expect(text.toLowerCase()).toMatch(/hosting|héberg|hosted/)
  }
})

test('die Anschrift steht ohne Leerzeichen vor dem Komma', () => {
  // Die Anschrift kommt mehrzeilig aus den Einstellungen; beim Zusammenziehen
  // blieb früher „avenue Clemenceau , 67630" stehen.
  for (const sprache of RECHTSTEXT_SPRACHEN) {
    for (const [feld, text] of Object.entries(pflichttexte(VOLLSTAENDIG, sprache))) {
      expect(text.includes(' ,'), `${sprache}/${feld}`).toBe(false)
    }
  }
})

test('die Schlichtungsstelle wird benannt statt abgelehnt', () => {
  for (const sprache of RECHTSTEXT_SPRACHEN) {
    const { agb, impressum } = pflichttexte(VOLLSTAENDIG, sprache)
    expect(agb.includes('Médiateur de la consommation, 1 rue Beispiel, 75000 Paris')).toBe(true)
    expect(impressum.includes('Médiateur de la consommation, 1 rue Beispiel, 75000 Paris')).toBe(true)
    for (const absage of ['weder verpflichtet noch bereit', 'ni tenus ni disposés', 'neither obliged nor']) {
      expect(agb.includes(absage), `${sprache}: „${absage}" steht noch drin`).toBe(false)
    }
  }
})

test('die abgeschaltete ODR-Plattform wird nirgends verlinkt', () => {
  // Die Europäische Kommission hat sie am 20. Juli 2025 abgeschaltet; ein
  // Verweis dorthin führt ins Leere und ist selbst ein Mangel.
  for (const sprache of RECHTSTEXT_SPRACHEN) {
    for (const [feld, text] of Object.entries(pflichttexte(VOLLSTAENDIG, sprache))) {
      expect(text.includes('ec.europa.eu/consumers/odr'), `${sprache}/${feld}`).toBe(false)
    }
  }
})

test('das Land steht in der Sprache des Textes', () => {
  // Die Anschrift kommt auf Deutsch aus den Einstellungen. In der
  // französischen Belehrung stand deshalb „Lauterbourg, Frankreich".
  expect(pflichttexte(VOLLSTAENDIG, 'fr').impressum).toContain('67630 Lauterbourg, France')
  expect(pflichttexte(VOLLSTAENDIG, 'en').impressum).toContain('67630 Lauterbourg, France')
  expect(pflichttexte(VOLLSTAENDIG, 'de').impressum).toContain('67630 Lauterbourg, Frankreich')
  // Der Ortsname selbst wird nicht angefasst.
  for (const sprache of RECHTSTEXT_SPRACHEN) {
    expect(pflichttexte(VOLLSTAENDIG, sprache).impressum).toContain('24, avenue Clemenceau')
  }
})

test('ohne gepflegte Angaben steht die Lücke sichtbar da', () => {
  // Nichts erfinden: Was fehlt, soll auffallen und nicht still verschwinden.
  const text = pflichttexte({}, 'de').impressum
  expect(text).toContain('[Firmenname]')
  expect(text).toContain('[Anschrift]')
})
