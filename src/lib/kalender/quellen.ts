import type { Payload } from 'payload'

import type { Termin } from './ical'

/**
 * Was im Kalender steht — an einer Stelle gesammelt.
 *
 * Dieselben fünf Quellen, die das Monatsblatt im Büro zeigt (siehe
 * `office/kalender/Ansicht.tsx`), nur hier auf dem Server und für das
 * Telefon. Zwei Wege, ein Inhalt: Was im Büro im Kalender steht, steht auch
 * im Abonnement, sonst wäre es ein zweiter Kalender und keine Aussicht auf
 * denselben.
 *
 * Die Filter sind absichtlich Zeile für Zeile dieselben wie in der Ansicht.
 * Wer dort einen ändert, muss ihn hier mitändern — das ist der Preis dafür,
 * dass die Ansicht aus dem Bestand im Gerät rechnet und diese Stelle aus der
 * Datenbank. Ein gemeinsamer Filter ginge nur, wenn beide dieselbe Quelle
 * hätten, und genau das wollen sie nicht: Das Büro soll ohne Netz arbeiten.
 */

/** Wie weit zurück und voraus geliefert wird. */
const MONATE_ZURUECK = 3
const MONATE_VORAUS = 12

function zeitraum() {
  const jetzt = new Date()
  const von = new Date(jetzt)
  von.setMonth(von.getMonth() - MONATE_ZURUECK)
  const bis = new Date(jetzt)
  bis.setMonth(bis.getMonth() + MONATE_VORAUS)
  return { von, bis }
}

/** Aus einem Datumsfeld einen ganztägigen Termin machen. */
function amTag(wert: string): Date {
  const d = new Date(wert)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

/**
 * Die eigenen Termine — die einzige Quelle, die auch zurückgeschrieben wird.
 */
export async function eigeneTermine(payload: Payload, basis: string): Promise<Termin[]> {
  const { von, bis } = zeitraum()
  const treffer = await payload.find({
    collection: 'appointments',
    overrideAccess: true,
    limit: 1000,
    depth: 0,
    where: {
      and: [{ start: { greater_than_equal: von.toISOString() } }, { start: { less_than_equal: bis.toISOString() } }],
    },
  })

  return treffer.docs.map((t: Record<string, any>) => ({
    uid: String(t.uid ?? `termin-${t.id}@vincent-hellmann.fr`),
    titel: String(t.title ?? 'Termin'),
    beginn: t.ganztaegig ? amTag(t.start) : new Date(t.start),
    ende: t.ende ? (t.ganztaegig ? amTag(t.ende) : new Date(t.ende)) : null,
    ganztaegig: Boolean(t.ganztaegig),
    notiz: t.notiz ?? null,
    ort: t.ort ?? null,
    geaendert: t.updatedAt ? new Date(t.updatedAt) : null,
    url: `${basis}/office/kalender`,
  }))
}

/**
 * Alles Abgeleitete: Aufträge, Bestellungen, Angebote, Belege.
 *
 * Durchweg ganztägig. Ein Fertigstellungstermin ist ein Tag, keine Uhrzeit —
 * stünde er als „08:00 bis 09:00" im Telefon, wäre das eine Genauigkeit, die
 * es nicht gibt, und der Tag sähe im Kalender voller aus, als er ist.
 */
export async function abgeleiteteTermine(payload: Payload, basis: string): Promise<Termin[]> {
  const { von, bis } = zeitraum()
  const spanne = (feld: string) => ({
    and: [
      { [feld]: { greater_than_equal: von.toISOString() } },
      { [feld]: { less_than_equal: bis.toISOString() } },
    ],
  })

  const [auftraege, bestellungen, angebote, belege] = await Promise.all([
    payload.find({
      collection: 'jobs',
      overrideAccess: true,
      limit: 1000,
      depth: 0,
      where: {
        and: [{ status: { in: ['geplant', 'inFertigung', 'fertig'] } }, spanne('dueDate')],
      },
    }),
    payload.find({
      collection: 'orders',
      overrideAccess: true,
      limit: 1000,
      depth: 1,
      where: { and: [{ status: { in: ['paid', 'inProduction'] } }, spanne('expectedReady')] },
    }),
    payload.find({
      collection: 'quotes',
      overrideAccess: true,
      limit: 1000,
      depth: 0,
      where: { and: [{ status: { equals: 'versendet' } }, spanne('validUntil')] },
    }),
    payload.find({
      collection: 'expenses',
      overrideAccess: true,
      limit: 1000,
      depth: 0,
      where: { and: [{ paid: { not_equals: true } }, spanne('dueDate')] },
    }),
  ])

  const termine: Termin[] = []

  for (const a of auftraege.docs as Record<string, any>[]) {
    termine.push({
      uid: `auftrag-${a.id}@vincent-hellmann.fr`,
      titel: `${a.title ?? a.jobNumber ?? 'Auftrag'}${a.customerName ? ` — ${a.customerName}` : ''}`,
      beginn: amTag(a.dueDate),
      ganztaegig: true,
      notiz: 'Fertigstellung',
      geaendert: a.updatedAt ? new Date(a.updatedAt) : null,
      url: `${basis}/office/auftraege/${a.id}`,
    })
  }

  for (const b of bestellungen.docs as Record<string, any>[]) {
    termine.push({
      uid: `bestellung-${b.id}@vincent-hellmann.fr`,
      titel: `${b.orderNumber ?? 'Bestellung'}${b.customer?.name ? ` — ${b.customer.name}` : ''}`,
      beginn: amTag(b.expectedReady),
      ganztaegig: true,
      notiz: 'Zugesagter Liefertermin',
      geaendert: b.updatedAt ? new Date(b.updatedAt) : null,
      url: `${basis}/office/bestellungen/${b.id}`,
    })
  }

  for (const a of angebote.docs as Record<string, any>[]) {
    termine.push({
      uid: `angebot-${a.id}@vincent-hellmann.fr`,
      titel: `${a.quoteNumber ?? 'Angebot'} läuft ab`,
      beginn: amTag(a.validUntil),
      ganztaegig: true,
      notiz: a.customerName ?? null,
      geaendert: a.updatedAt ? new Date(a.updatedAt) : null,
      url: `${basis}/office/angebote/${a.id}`,
    })
  }

  for (const b of belege.docs as Record<string, any>[]) {
    termine.push({
      uid: `beleg-${b.id}@vincent-hellmann.fr`,
      titel: `${b.supplierName || b.title || 'Beleg'} fällig`,
      beginn: amTag(b.dueDate),
      ganztaegig: true,
      notiz: 'Offener Beleg',
      geaendert: b.updatedAt ? new Date(b.updatedAt) : null,
      url: `${basis}/office/belege/${b.id}`,
    })
  }

  return termine
}

/** Der ganze Kalender, wie ihn das Telefon sieht. */
export async function alleTermine(payload: Payload, basis: string): Promise<Termin[]> {
  const [eigene, abgeleitet] = await Promise.all([
    eigeneTermine(payload, basis),
    abgeleiteteTermine(payload, basis),
  ])
  return [...eigene, ...abgeleitet]
}
