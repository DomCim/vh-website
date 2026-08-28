import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { AUFTRAG_STATUS, werteVon } from '../../../../../lib/listen'
import { darf } from '../../../../../lib/wache'
import { rechnungAusAuftrag } from '../../../../../lib/rechnungsstufen'
import { nurGesendete } from '../../../../../lib/teilaenderung'

export const dynamic = 'force-dynamic'

/** Fertigungsauftrag anlegen oder ändern. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    /*
     * Termin verschieben ist ein eigener, enger Weg.
     *
     * Alles darunter baut den vollständigen Datensatz und schreibt ihn. Wer
     * von einer Leiste aus nur `{ id, dueDate }` schickte, träfe damit auch
     * `positions: []` und `material: []` — und löschte Stückliste und
     * Positionen des Auftrags. Ein Klick, und der Auftrag ist leer.
     *
     * Dieselbe Falle wie bei den Rechnungen; weitere schmale Änderungen
     * gehören genauso hier oben angelegt und nicht unten drangehängt.
     */
    if (b.aktion === 'termin') {
      if (!b.id || !b.dueDate) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      const doc = await payload.update({
        collection: 'jobs',
        id: b.id,
        overrideAccess: true,
        data: { dueDate: b.dueDate },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    /*
     * Aus dem Auftrag einen Artikel machen — der Weg zurück zur Vorlage.
     *
     * Die Gegenrichtung gibt es längst (Artikel → Auftrag, orderHooks). Was
     * fehlte: Eine Lohnarbeit, die zum zweiten Mal kommt, fing wieder bei
     * null an — Stückliste abtippen, Ablauf abtippen. Hier wird der Auftrag
     * zur Vorlage: Material, Ablauf und Zeit wandern an einen neuen Artikel,
     * der **nicht** im Shop erscheint (onRequestOnly und nicht verfügbar,
     * doppelt vernäht — sichtbar machen ist danach eine bewusste
     * Entscheidung in der Verwaltung).
     *
     * Kategorie und Bild sind Pflicht, weil der Artikel sie verlangt — ein
     * Artikel ohne Bild ließe sich schlicht nicht anlegen.
     *
     * Doppelrecht wie bei `rechnung`: Es entsteht Website-Inhalt.
     */
    if (b.aktion === 'alsArtikel') {
      if (!b.id || !b.kategorie || !b.bild) {
        return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      }
      if (!(await darf(payload, user, 'website.pflegen'))) {
        return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
      }

      const auftrag = await payload
        .findByID({ collection: 'jobs', id: b.id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!auftrag) return NextResponse.json({ error: 'auftrag-fehlt' }, { status: 400 })

      /*
       * Zeigt schon eine Position auf einen Artikel, gibt es nichts
       * abzulegen — und die Offline-Warteschlange darf einen doppelt
       * getippten Knopf nicht in zwei Artikel verwandeln.
       */
      const positionen = (auftrag.positions ?? []) as Record<string, unknown>[]
      if (positionen.some((p) => p.product)) {
        return NextResponse.json({ error: 'schon-verknuepft' }, { status: 409 })
      }

      // Der Auftrag zählt gesamt, der Artikel je Stück
      const stueckzahl = Math.max(1, Number(positionen[0]?.quantity) || 1)
      const runden = (n: number) => Math.round(n * 1000) / 1000

      /*
       * Beigestelltes bleibt draußen: Es gehört dem Auftraggeber, und in
       * einer Vorlage wäre es eine Lüge über den eigenen Bedarf.
       */
      const stueckliste = ((auftrag.material ?? []) as Record<string, unknown>[])
        .filter((m) => m.item && !m.beigestellt)
        .map((m) => ({
          item: Number(typeof m.item === 'object' ? (m.item as { id?: number })?.id : m.item),
          quantity: runden((Number(m.quantity) || 0) / stueckzahl),
        }))
        .filter((m) => m.item && m.quantity > 0)

      /*
       * Der Ablauf gestutzt auf die Vorlagenform: `stand`, `erledigtAm` und
       * die Reise-Zeitstempel sind Geschichte dieses einen Auftrags, keine
       * Vorlage für den nächsten.
       */
      const ablauf = ((auftrag.arbeitsplan ?? []) as Record<string, unknown>[])
        .filter((s) => typeof s.was === 'string' && s.was.trim())
        .map((s) => ({
          was: s.was as string,
          art: (s.art === 'fremd' ? 'fremd' : 'eigen') as 'eigen' | 'fremd',
          minuten: (s.minuten as number | null) ?? null,
          dienstleister:
            Number(typeof s.dienstleister === 'object' ? (s.dienstleister as { id?: number })?.id : s.dienstleister) ||
            undefined,
          kosten: (s.kosten as number | null) ?? null,
          vorlaufTage: (s.vorlaufTage as number | null) ?? null,
          notiz: (s.notiz as string | null) || undefined,
        }))

      const artikel = await payload.create({
        collection: 'products',
        overrideAccess: true,
        locale: 'de',
        data: {
          title: (typeof b.titel === 'string' && b.titel.trim()) || auftrag.title || 'Artikel',
          category: Number(b.kategorie),
          images: [Number(b.bild)],
          /*
           * Intern, und dazu doppelt vernäht: `intern` nimmt dem Artikel die
           * Seite, die Sitemap und die Suche — an einer Lohnarbeits-Vorlage
           * hängen Kundenname und Zuschnitt, die gehen Google nichts an.
           * `onRequestOnly` und `available: false` bleiben als Gürtel zum
           * Hosenträger: Wer den Artikel später sichtbar macht, hat immer
           * noch keinen Kaufknopf, bis er es ausdrücklich will. Preise
           * wandern bewusst nicht mit — die am Auftrag sind verhandelt und
           * kundenspezifisch.
           */
          intern: true,
          onRequestOnly: true,
          available: false,
          billOfMaterials: stueckliste as never,
          arbeitsplan: ablauf as never,
          productionMinutes: auftrag.plannedMinutes
            ? Math.max(1, Math.round(auftrag.plannedMinutes / stueckzahl))
            : undefined,
        },
      })

      /*
       * Rückverweis: Die erste Position zeigt jetzt auf den neuen Artikel —
       * damit erscheint künftig das Bild auf den Papieren, und der nächste
       * gleiche Auftrag findet Vorlage und Stückliste. Die ganze Liste wird
       * zurückgeschrieben, samt `farbe` — Teilabschriften verlieren Felder.
       */
      await payload.update({
        collection: 'jobs',
        id: b.id,
        overrideAccess: true,
        data: {
          positions: positionen.map((p, i) =>
            i === 0 ? { ...p, product: artikel.id } : p,
          ) as never,
        },
      })

      return NextResponse.json({ ok: true, artikel: artikel.id })
    }

    /*
     * Teil raus zum Dienstleister / Teil ist zurück — zwei enge Wege.
     *
     * Sie buchen genau einen Fremd-Schritt des Ablaufs und fassen sonst
     * nichts an: Lesen–Ändern–Schreiben der Liste, jede Zeile mit ihrer
     * Kennung, damit Payload die ungenannten Felder behält. „Raus" setzt den
     * Schritt auf „läuft" und stempelt `rausAm`; „zurück" stempelt
     * `zurueckAm` und hakt den Schritt ab. Die Zeitstempel des Betriebs
     * (`angekommenAm`, `fertigGemeldetAm`) gehören dem Scan und bleiben
     * unberührt — zwei Schreiber, zwei Felderpaare.
     */
    if (
      b.aktion === 'schrittRaus' ||
      b.aktion === 'schrittZurueck' ||
      b.aktion === 'schrittErledigt'
    ) {
      const index = Number(b.schritt)
      if (!b.id || !Number.isInteger(index) || index < 0) {
        return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      }
      const auftrag = await payload
        .findByID({ collection: 'jobs', id: b.id, depth: 0, overrideAccess: true })
        .catch(() => null)
      const plan = (auftrag?.arbeitsplan ?? []) as Record<string, unknown>[]
      const schritt = plan[index]
      if (!schritt) {
        return NextResponse.json({ error: 'kein-schritt' }, { status: 400 })
      }
      /*
       * Raus und zurück gibt es nur bei fremden Schritten — ein Teil, das
       * das Haus nie verlässt, kann nicht zurückkommen. Abhaken gibt es
       * dagegen für jeden Schritt: Beim Scan einer Laufmarke steht meist
       * eigene Arbeit an („CNC - ASP2"), und ohne diesen Weg gab es dort
       * keinen Knopf — man musste den Auftrag im Büro suchen und dort
       * abhaken. Gemeldet von Dominik nach dem ersten Scan (08/2026).
       */
      if (b.aktion !== 'schrittErledigt' && schritt.art !== 'fremd') {
        return NextResponse.json({ error: 'kein-fremdschritt' }, { status: 400 })
      }
      const jetzt = new Date().toISOString()
      const neu =
        b.aktion === 'schrittRaus'
          ? { ...schritt, stand: 'laeuft', rausAm: schritt.rausAm ?? jetzt }
          : b.aktion === 'schrittErledigt'
            ? { ...schritt, stand: 'erledigt', erledigtAm: schritt.erledigtAm ?? jetzt }
            : {
                ...schritt,
                stand: 'erledigt',
                zurueckAm: schritt.zurueckAm ?? jetzt,
                erledigtAm: schritt.erledigtAm ?? jetzt,
              }
      const doc = await payload.update({
        collection: 'jobs',
        id: b.id,
        overrideAccess: true,
        data: { arbeitsplan: plan.map((s, i) => (i === index ? neu : s)) as never },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    /*
     * Rechnung aus dem Auftrag — ebenfalls ein enger Weg.
     *
     * Am Auftrag steht alles, was auf die Rechnung gehört: Positionen,
     * Mengen, Preise, Kundschaft. Trotzdem gab es keinen Weg, daraus eine
     * Rechnung zu machen, solange keine Bestellung dahinterstand: Die
     * Auslöser in `collections/Jobs.ts` legen nur Stufenentwürfe an, und die
     * greifen nur bei einem Auftrag mit Zahlplan. Beim gewöhnlichen Auftrag
     * blieb Abtippen — jede Position von Hand, mit der Gefahr, dass eine Zahl
     * abweicht.
     *
     * Angelegt wird ein Entwurf, nicht eine gestellte Rechnung. Verschickt
     * wird von Hand, wie bei den Stufen: Ein Klick soll eine Rechnung
     * vorbereiten und nicht eine hinausschicken.
     */
    if (b.aktion === 'rechnung') {
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      if (!(await darf(payload, user, 'rechnungen.schreiben'))) {
        return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
      }

      /*
       * Zwei Rechnungen zum selben Auftrag entstehen hier nicht aus
       * Versehen. Der Knopf im Büro verschwindet, sobald eine liegt — aber
       * ohne Netz steht die Anfrage in der Warteschlange, und zweimal
       * getippt käme sie zweimal an.
       */
      const { totalDocs } = await payload.count({
        collection: 'outgoing-invoices',
        where: { auftrag: { equals: b.id } },
        overrideAccess: true,
      })
      if (totalDocs > 0) {
        return NextResponse.json({ error: 'schon-vorhanden' }, { status: 409 })
      }

      const id = await rechnungAusAuftrag(payload, b.id)
      if (!id) {
        // Ohne Positionen gibt es nichts zu berechnen — das ist kein Fehler
        // des Servers, sondern eine unfertige Vorbereitung am Auftrag.
        return NextResponse.json({ error: 'keine-positionen' }, { status: 400 })
      }
      return NextResponse.json({ ok: true, rechnung: id })
    }

    // Pflicht nur beim Anlegen: Eine Änderung, die den Titel nicht anfasst,
    // muss ihn auch nicht mitschicken.
    if (!b.id && !b.title?.trim()) {
      return NextResponse.json({ error: 'titel-fehlt' }, { status: 400 })
    }

    // Ein Tippfehler im Status liefe sonst bis in die Datenbank durch —
    // und die Übersichten wüssten nicht, in welche Spalte damit.
    if (b.status && !werteVon(AUFTRAG_STATUS).includes(b.status)) {
      return NextResponse.json({ error: 'status-unbekannt' }, { status: 400 })
    }

    const daten = {
      title: b.title,
      status: b.status || 'geplant',
      customerName: b.customerName || undefined,
      startDate: b.startDate || undefined,
      dueDate: b.dueDate || undefined,
      // Leer heißt „nicht geschätzt" und nicht „null Stunden" — sonst zählte
      // ein Auftrag ohne Angabe als kostenlos in der Auslastung
      plannedMinutes:
        b.plannedMinutes === '' || b.plannedMinutes == null ? null : Number(b.plannedMinutes) || 0,
      notes: b.notes || undefined,
      positions: (b.positions ?? [])
        .filter((p: { description?: string }) => p.description?.trim())
        .map((p: Record<string, unknown>) => ({
          description: p.description,
          quantity: Number(p.quantity) || 1,
          price: p.price ?? undefined,
          // Nur für das Bild auf den Papieren — siehe Jobs.positions.product
          product: Number(p.product) || undefined,
          // Für den Beschichter über die Laufmarke — siehe Jobs.positions.farbe
          farbe: typeof p.farbe === 'string' && p.farbe.trim() ? p.farbe.trim() : undefined,
        })),
      material: (b.material ?? [])
        .filter((m: { item?: number }) => m.item)
        .map((m: Record<string, unknown>) => ({
          item: Number(m.item),
          quantity: Number(m.quantity) || 0,
          beigestellt: Boolean(m.beigestellt),
        })),
      /*
       * Der Ablauf kommt vollständig aus dem Formular, wie Positionen und
       * Material. Die Reihenfolge ist die Aussage — deshalb wird die Liste
       * ersetzt und nicht ergänzt.
       */
      arbeitsplan: (b.arbeitsplan ?? [])
        .filter((s: { was?: string }) => s.was?.trim())
        .map((s: Record<string, unknown>) => ({
          was: s.was,
          art: s.art === 'fremd' ? 'fremd' : 'eigen',
          minuten: s.minuten === '' || s.minuten == null ? null : Number(s.minuten) || 0,
          dienstleister: Number(s.dienstleister) || undefined,
          kosten: s.kosten === '' || s.kosten == null ? null : Number(s.kosten) || 0,
          vorlaufTage:
            s.vorlaufTage === '' || s.vorlaufTage == null ? null : Number(s.vorlaufTage) || 0,
          stand: ['offen', 'laeuft', 'erledigt'].includes(String(s.stand)) ? s.stand : 'offen',
          erledigtAm: s.erledigtAm || undefined,
          notiz: s.notiz || undefined,
        })),
      /*
       * Was über die Meldungen entscheidet. `gemeldet` steht bewusst **nicht**
       * dabei: Das schreibt der Auslöser am Datenmodell, und ein Formular, das
       * es mitschickte, könnte einen Versand ungeschehen machen, der längst
       * stattgefunden hat.
       */
      lieferart: (b.lieferart === 'abholung' ? 'abholung' : 'versand') as 'versand' | 'abholung',
      trackingNumber: b.trackingNumber || undefined,
      trackingUrl: b.trackingUrl || undefined,
      kundeEmail: b.kundeEmail || undefined,
      kundeBenachrichtigen: b.kundeBenachrichtigen !== false,
      // Abwahl (`null` bzw. '') muss durchgehen — sonst wird man einen
      // einmal verknüpften Partner nie wieder los.
      contact: b.contact === null || b.contact === '' ? null : Number(b.contact) || undefined,
      source: b.source || 'manuell',
      customerOrderRef: b.customerOrderRef || undefined,
      orderedAt: b.orderedAt || undefined,
      zahlplan: {
        anzahlungProzent: Number(b.anzahlungProzent) || 0,
        zwischenProzent: Number(b.zwischenProzent) || 0,
      },
      /*
       * Das Datum am Meilenstein legt die Zwischenrechnung an. Es kommt
       * deshalb genauso aus dem Formular wie alles andere — der Auslöser sitzt
       * am Datenmodell, nicht hier, damit er auch greift, wenn die Änderung
       * aus dem Admin oder vom KI-Zugang kommt.
       */
      meilenstein: {
        bezeichnung: b.meilensteinBezeichnung || undefined,
        erreichtAm: b.meilensteinErreichtAm || undefined,
      },
    }

    /* Beim Ändern nur das Gesendete — siehe lib/teilaenderung.ts */
    const doc = b.id
      ? await payload.update({
          collection: 'jobs',
          id: b.id,
          overrideAccess: true,
          data: nurGesendete(b, daten, {
            zahlplan: ['anzahlungProzent', 'zwischenProzent'],
            meilenstein: ['meilensteinBezeichnung', 'meilensteinErreichtAm'],
          }),
        })
      : await payload.create({ collection: 'jobs', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id, jobNumber: doc.jobNumber })
  } catch (err) {
    console.error('Auftrag speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
