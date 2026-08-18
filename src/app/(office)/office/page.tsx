import Link from 'next/link'
import React from 'react'

import { payloadClient } from '../../../lib/data'
import { bueroBenutzer, datum, euro, jahresZeitraum } from '../../../lib/office'

export const dynamic = 'force-dynamic'

/**
 * Übersicht: was dieses Jahr rein- und rausging, was offen ist und woran
 * gerade etwas hakt. Bewusst wenige Zahlen — die Details stehen auf den
 * eigenen Seiten.
 */
export default async function BueroUebersicht() {
  await bueroBenutzer()
  const payload = await payloadClient()
  const jahr = new Date().getFullYear()
  const { von, bis } = jahresZeitraum(jahr)

  const [shop, rechnungen, ausgaben, offeneRechnungen, offeneAnfragen, inventar] =
    await Promise.all([
      payload.find({
        collection: 'orders',
        where: {
          and: [
            { status: { in: ['paid', 'inProduction', 'shipped'] } },
            { createdAt: { greater_than_equal: von } },
            { createdAt: { less_than: bis } },
          ],
        },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'outgoing-invoices',
        where: {
          and: [
            { status: { in: ['gestellt', 'bezahlt'] } },
            { issueDate: { greater_than_equal: von } },
            { issueDate: { less_than: bis } },
          ],
        },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'expenses',
        where: {
          and: [
            { deductible: { equals: true } },
            { invoiceDate: { greater_than_equal: von } },
            { invoiceDate: { less_than: bis } },
          ],
        },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'outgoing-invoices',
        where: { status: { equals: 'gestellt' } },
        sort: 'dueDate',
        limit: 10,
        depth: 0,
        overrideAccess: true,
      }),
      payload.count({
        collection: 'inquiries',
        where: { status: { equals: 'neu' } },
        overrideAccess: true,
      }),
      payload.find({ collection: 'inventory-items', limit: 500, depth: 0, overrideAccess: true }),
    ])

  const runden = (n: number) => Math.round(n * 100) / 100
  const shopUmsatz = runden(shop.docs.reduce((s, o) => s + (o.total ?? 0), 0))
  const projektUmsatz = runden(rechnungen.docs.reduce((s, r) => s + (r.total ?? 0), 0))
  const ausgabenSumme = runden(ausgaben.docs.reduce((s, a) => s + (a.grossAmount ?? 0), 0))
  const ohneBeleg = ausgaben.docs.filter((a) => !a.document).length
  const ungeprueft = ausgaben.docs.filter((a) => a.extraction?.status === 'ungeprueft').length
  const inventarWert = runden(
    inventar.docs.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitValue ?? 0), 0),
  )
  const knapp = inventar.docs.filter(
    (i) => typeof i.minQuantity === 'number' && (i.quantity ?? 0) < i.minQuantity,
  )
  const heute = Date.now()
  const ueberfaellig = offeneRechnungen.docs.filter(
    (r) => r.dueDate && new Date(r.dueDate).getTime() < heute,
  )

  return (
    <>
      <h1>Übersicht {jahr}</h1>
      <p className="buero-unterzeile">
        Stand heute. Alle Beträge brutto, wie sie auf den Belegen stehen.
      </p>

      <div className="buero-kacheln">
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Einnahmen</div>
          <div className="buero-kachel-wert">{euro(shopUmsatz + projektUmsatz)}</div>
          <div className="buero-kachel-fuss">
            Shop {euro(shopUmsatz)} · Projekte {euro(projektUmsatz)}
          </div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Ausgaben</div>
          <div className="buero-kachel-wert">{euro(ausgabenSumme)}</div>
          <div className="buero-kachel-fuss">{ausgaben.totalDocs} Belege</div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Differenz</div>
          <div className="buero-kachel-wert">
            {euro(runden(shopUmsatz + projektUmsatz - ausgabenSumme))}
          </div>
          <div className="buero-kachel-fuss">Einnahmen minus Ausgaben</div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Inventarwert</div>
          <div className="buero-kachel-wert">{euro(inventarWert)}</div>
          <div className="buero-kachel-fuss">{inventar.totalDocs} Posten</div>
        </div>
      </div>

      {(ohneBeleg > 0 || ungeprueft > 0 || ueberfaellig.length > 0 || knapp.length > 0) && (
        <>
          <h2>Kümmern</h2>
          <div className="buero-liste">
            {ueberfaellig.length > 0 && (
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
            {ungeprueft > 0 && (
              <Link href="/office/belege?filter=ungeprueft" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{ungeprueft} ausgelesene Belege ungeprüft</div>
                  <div className="buero-zeile-neben">Von der KI gelesen, noch nicht bestätigt</div>
                </div>
                <span className="buero-marker offen">prüfen</span>
              </Link>
            )}
            {ohneBeleg > 0 && (
              <Link href="/office/belege?filter=ohne-beleg" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{ohneBeleg} Ausgaben ohne Beleg</div>
                  <div className="buero-zeile-neben">
                    Ohne Beleg zählt die Buchung beim Finanzamt nicht
                  </div>
                </div>
                <span className="buero-marker warn">Beleg fehlt</span>
              </Link>
            )}
            {knapp.length > 0 && (
              <Link href="/office/inventar" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{knapp.length} Posten unter Mindestbestand</div>
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
            {offeneAnfragen.totalDocs > 0 && (
              <Link href="/admin/collections/inquiries" className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {offeneAnfragen.totalDocs} neue Kundenanfragen
                  </div>
                  <div className="buero-zeile-neben">In der Website-Verwaltung</div>
                </div>
                <span className="buero-marker offen">ansehen</span>
              </Link>
            )}
          </div>
        </>
      )}

      <h2>Offene Rechnungen</h2>
      <div className="buero-liste">
        {offeneRechnungen.docs.length === 0 ? (
          <div className="buero-leer">Nichts offen.</div>
        ) : (
          offeneRechnungen.docs.map((r) => {
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

      <h2>Schnell erledigen</h2>
      <div className="buero-kacheln">
        <Link href="/office/belege/neu" className="buero-kachel">
          <div className="buero-kachel-titel">Beleg</div>
          <div className="buero-kachel-fuss" style={{ marginTop: '.4rem' }}>
            Foto hochladen, Rest liest die KI
          </div>
        </Link>
        <Link href="/office/rechnungen/neu" className="buero-kachel">
          <div className="buero-kachel-titel">Rechnung schreiben</div>
          <div className="buero-kachel-fuss" style={{ marginTop: '.4rem' }}>
            Fürs Projektgeschäft
          </div>
        </Link>
        <Link href="/office/steuer" className="buero-kachel">
          <div className="buero-kachel-titel">Steuer-Export</div>
          <div className="buero-kachel-fuss" style={{ marginTop: '.4rem' }}>
            Alles für den Steuerberater
          </div>
        </Link>
      </div>
    </>
  )
}
