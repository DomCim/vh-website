'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'

import { useBestand } from '../../../lib/buero/bestand'
import { useDarf } from '../../../lib/buero/rechte'
import { datum, euro } from '../../../lib/format'

/**
 * Übersicht: was dieses Jahr rein- und rausging, was offen ist und woran
 * gerade etwas hakt. Bewusst wenige Zahlen — die Details stehen auf den
 * eigenen Seiten.
 *
 * Sieben Abfragen waren das früher, bei jedem Aufruf. Jetzt rechnet die Seite
 * aus dem Bestand im Gerät: Sie steht sofort da, auch in der Werkstatt.
 */

const runden = (n: number) => Math.round(n * 100) / 100

type Bestellung = { total?: number | null; status?: string | null; createdAt?: string | null }
type Rechnung = {
  id: number | string
  total?: number | null
  status?: string | null
  issueDate?: string | null
  dueDate?: string | null
  invoiceNumber?: string | null
  customerName?: string | null
}
type Beleg = {
  grossAmount?: number | null
  deductible?: boolean | null
  invoiceDate?: string | null
  dueDate?: string | null
  paid?: boolean | null
  document?: unknown
  title?: string | null
  supplierName?: string | null
  extraction?: { status?: string | null } | null
}
type Posten = {
  name?: string | null
  quantity?: number | null
  unitValue?: number | null
  minQuantity?: number | null
}
type Anfrage = { status?: string | null }
type Wiedervorlage = {
  id: number | string
  title?: string | null
  dueDate?: string | null
  done?: boolean | null
}

export function UebersichtAnsicht() {
  const bestellungen = useBestand<Bestellung>('bestellungen')
  const rechnungen = useBestand<Rechnung>('rechnungen')
  const belege = useBestand<Beleg>('belege')
  const inventar = useBestand<Posten>('inventar')
  const anfragen = useBestand<Anfrage>('anfragen')
  const wiedervorlagen = useBestand<Wiedervorlage>('wiedervorlagen')
  const darf = useDarf()

  const jahr = new Date().getFullYear()
  const heute = Date.now()
  const imJahr = (wert: string | null | undefined) => (wert ?? '').startsWith(String(jahr))

  const zahlen = useMemo(() => {
    const shop = bestellungen.filter(
      (o) => ['paid', 'inProduction', 'shipped'].includes(o.status ?? '') && imJahr(o.createdAt),
    )
    const gestellt = rechnungen.filter(
      (r) => ['gestellt', 'bezahlt'].includes(r.status ?? '') && imJahr(r.issueDate),
    )
    const ausgaben = belege.filter((a) => a.deductible !== false && imJahr(a.invoiceDate))

    return {
      shopUmsatz: runden(shop.reduce((s, o) => s + (o.total ?? 0), 0)),
      projektUmsatz: runden(gestellt.reduce((s, r) => s + (r.total ?? 0), 0)),
      ausgabenSumme: runden(ausgaben.reduce((s, a) => s + (a.grossAmount ?? 0), 0)),
      ausgabenAnzahl: ausgaben.length,
      ohneBeleg: ausgaben.filter((a) => !a.document).length,
      ungeprueft: ausgaben.filter((a) => a.extraction?.status === 'ungeprueft').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestellungen, rechnungen, belege])

  const inventarWert = runden(
    inventar.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitValue ?? 0), 0),
  )
  const knapp = inventar.filter(
    (i) => typeof i.minQuantity === 'number' && (i.quantity ?? 0) < i.minQuantity,
  )

  const offeneRechnungen = useMemo(
    () =>
      rechnungen
        .filter((r) => r.status === 'gestellt')
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
        .slice(0, 10),
    [rechnungen],
  )
  const ueberfaellig = offeneRechnungen.filter(
    (r) => r.dueDate && new Date(r.dueDate).getTime() < heute,
  )

  // Alles, was in den nächsten drei Tagen fällig wird oder es schon war —
  // derselbe Zeitraum, in dem auch die Erinnerung aufs Handy geht.
  const zuZahlen = useMemo(
    () =>
      belege
        .filter(
          (b) =>
            !b.paid && b.dueDate && new Date(b.dueDate).getTime() < Date.now() + 3 * 86400_000,
        )
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [belege],
  )
  const laengstFaellig = zuZahlen[0]
  const offeneAnfragen = anfragen.filter((a) => a.status === 'neu').length

  // Selbst gestellte Erinnerungen, deren Tag da ist. Sie stehen hier zwischen
  // dem, was das Büro von allein gefunden hat — der Zettel am Monitor gehört
  // auf dieselbe Liste wie die überfällige Rechnung.
  const heuteStempel = new Date().toISOString().slice(0, 10)
  const faelligeZettel = useMemo(
    () =>
      wiedervorlagen
        .filter((w) => !w.done && (w.dueDate ?? '').slice(0, 10) <= heuteStempel)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wiedervorlagen],
  )

  return (
    <>
      <h1>Übersicht {jahr}</h1>
      <p className="buero-unterzeile">
        Stand heute. Alle Beträge brutto, wie sie auf den Belegen stehen.
      </p>

      <div className="buero-kacheln">
        {darf('zahlen.sehen') && (
          <>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Einnahmen</div>
          <div className="buero-kachel-wert">
            {euro(zahlen.shopUmsatz + zahlen.projektUmsatz)}
          </div>
          <div className="buero-kachel-fuss">
            Shop {euro(zahlen.shopUmsatz)} · Projekte {euro(zahlen.projektUmsatz)}
          </div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Ausgaben</div>
          <div className="buero-kachel-wert">{euro(zahlen.ausgabenSumme)}</div>
          <div className="buero-kachel-fuss">{zahlen.ausgabenAnzahl} Belege</div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Differenz</div>
          <div className="buero-kachel-wert">
            {euro(runden(zahlen.shopUmsatz + zahlen.projektUmsatz - zahlen.ausgabenSumme))}
          </div>
          <div className="buero-kachel-fuss">Einnahmen minus Ausgaben</div>
        </div>
          </>
        )}
        {darf('inventar.pflegen') && (
          <div className="buero-kachel">
            <div className="buero-kachel-titel">Inventarwert</div>
            <div className="buero-kachel-wert">{euro(inventarWert)}</div>
            <div className="buero-kachel-fuss">{inventar.length} Posten</div>
          </div>
        )}
      </div>

      {/* Die Überschrift nur, wenn darunter auch etwas steht: Wer die Rechte
          für Belege und Rechnungen nicht hat, sah sonst „Kümmern" über einer
          leeren Fläche und suchte nach dem, was fehlt. */}
      {(faelligeZettel.length > 0 ||
        (zahlen.ohneBeleg > 0 && darf('belege.erfassen')) ||
        (zahlen.ungeprueft > 0 && darf('belege.erfassen')) ||
        (ueberfaellig.length > 0 && darf('rechnungen.schreiben')) ||
        (zuZahlen.length > 0 && darf('belege.erfassen')) ||
        (knapp.length > 0 && darf('inventar.pflegen')) ||
        (offeneAnfragen > 0 && darf('anfragen.bearbeiten'))) && (
        <>
          <h2>Kümmern</h2>
          <div className="buero-liste">
            {faelligeZettel.length > 0 && (
              <Link href="/office/wiedervorlagen" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {faelligeZettel.length} Wiedervorlage
                    {faelligeZettel.length === 1 ? '' : 'n'} fällig
                  </div>
                  <div className="buero-zeile-neben">
                    {faelligeZettel
                      .slice(0, 2)
                      .map((w) => w.title)
                      .join(' · ')}
                    {faelligeZettel.length > 2 ? ' …' : ''}
                  </div>
                </div>
                <span className="buero-marker offen">ansehen</span>
              </Link>
            )}
            {zuZahlen.length > 0 && darf('belege.erfassen') && (
              <Link href="/office/belege?filter=offen" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {zuZahlen.length} Beleg{zuZahlen.length === 1 ? '' : 'e'} zu zahlen
                  </div>
                  <div className="buero-zeile-neben">
                    {euro(runden(zuZahlen.reduce((s, b) => s + (b.grossAmount ?? 0), 0)))} ·
                    {' nächster: '}
                    {laengstFaellig?.supplierName || laengstFaellig?.title || 'Beleg'} bis{' '}
                    {datum(laengstFaellig?.dueDate)}
                  </div>
                </div>
                <span
                  className={`buero-marker ${
                    laengstFaellig?.dueDate && new Date(laengstFaellig.dueDate).getTime() < heute
                      ? 'warn'
                      : 'offen'
                  }`}
                >
                  {laengstFaellig?.dueDate && new Date(laengstFaellig.dueDate).getTime() < heute
                    ? 'überfällig'
                    : 'bald fällig'}
                </span>
              </Link>
            )}
            {ueberfaellig.length > 0 && darf('rechnungen.schreiben') && (
              <Link href="/office/rechnungen" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {ueberfaellig.length} Rechnung{ueberfaellig.length === 1 ? '' : 'en'} überfällig
                  </div>
                  <div className="buero-zeile-neben">
                    {euro(runden(ueberfaellig.reduce((s, r) => s + (r.total ?? 0), 0)))} offen
                  </div>
                </div>
                <span className="buero-marker warn">nachhaken</span>
              </Link>
            )}
            {zahlen.ungeprueft > 0 && darf('belege.erfassen') && (
              <Link href="/office/belege?filter=ungeprueft" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {zahlen.ungeprueft} ausgelesene Belege ungeprüft
                  </div>
                  <div className="buero-zeile-neben">Von der KI gelesen, noch nicht bestätigt</div>
                </div>
                <span className="buero-marker offen">prüfen</span>
              </Link>
            )}
            {zahlen.ohneBeleg > 0 && darf('belege.erfassen') && (
              <Link href="/office/belege?filter=ohne-beleg" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{zahlen.ohneBeleg} Ausgaben ohne Beleg</div>
                  <div className="buero-zeile-neben">
                    Ohne Beleg zählt die Buchung beim Finanzamt nicht
                  </div>
                </div>
                <span className="buero-marker warn">Beleg fehlt</span>
              </Link>
            )}
            {knapp.length > 0 && darf('inventar.pflegen') && (
              <Link href="/office/inventar" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {knapp.length} Posten unter Mindestbestand
                  </div>
                  <div className="buero-zeile-neben">
                    {knapp
                      .slice(0, 3)
                      .map((k) => k.name)
                      .join(', ')}
                    {knapp.length > 3 ? ' …' : ''}
                  </div>
                </div>
                <span className="buero-marker offen">nachbestellen</span>
              </Link>
            )}
            {offeneAnfragen > 0 && darf('anfragen.bearbeiten') && (
              <Link href="/office/anfragen" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{offeneAnfragen} neue Kundenanfragen</div>
                  <div className="buero-zeile-neben">Noch unbeantwortet</div>
                </div>
                <span className="buero-marker offen">ansehen</span>
              </Link>
            )}
          </div>
        </>
      )}

      {darf('rechnungen.schreiben') && (
        <>
      <h2>Offene Rechnungen</h2>
      <div className="buero-liste">
        {offeneRechnungen.length === 0 ? (
          <div className="buero-leer">Nichts offen.</div>
        ) : (
          offeneRechnungen.map((r) => {
            const spaet = r.dueDate && new Date(r.dueDate).getTime() < heute
            return (
              <Link key={r.id} href={`/office/rechnungen/${r.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {r.invoiceNumber} · {r.customerName ?? 'ohne Kunde'}
                  </div>
                  <div className="buero-zeile-neben">
                    gestellt {datum(r.issueDate)}
                    {r.dueDate ? ` · fällig ${datum(r.dueDate)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  {spaet && <span className="buero-marker warn">überfällig</span>}
                  <span className="buero-betrag">{euro(r.total)}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
        </>
      )}

      <h2>Schnell erledigen</h2>
      <div className="buero-kacheln">
        {darf('belege.erfassen') && (
          <Link href="/office/belege/neu" className="buero-kachel">
            <div className="buero-kachel-titel">Beleg</div>
            <div className="buero-kachel-fuss" style={{ marginTop: '.4rem' }}>
              Foto hochladen, Rest liest die KI
            </div>
          </Link>
        )}
        {darf('rechnungen.schreiben') && (
          <Link href="/office/rechnungen/neu" className="buero-kachel">
            <div className="buero-kachel-titel">Rechnung schreiben</div>
            <div className="buero-kachel-fuss" style={{ marginTop: '.4rem' }}>
              Fürs Projektgeschäft
            </div>
          </Link>
        )}
        {darf('zahlen.sehen') && (
          <Link href="/office/steuer" className="buero-kachel">
            <div className="buero-kachel-titel">Steuer-Export</div>
            <div className="buero-kachel-fuss" style={{ marginTop: '.4rem' }}>
              Alles für den Steuerberater
            </div>
          </Link>
        )}
        {darf('auftraege.bearbeiten') && (
          <Link href="/office/auftraege" className="buero-kachel">
            <div className="buero-kachel-titel">Aufträge</div>
            <div className="buero-kachel-fuss" style={{ marginTop: '.4rem' }}>
              Was gerade in der Werkstatt steht
            </div>
          </Link>
        )}
      </div>
    </>
  )
}
