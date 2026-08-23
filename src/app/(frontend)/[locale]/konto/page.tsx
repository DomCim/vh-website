import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { AngebotAnnehmen } from '../../../../components/shop/AngebotAnnehmen'
import { KontoAnmeldung } from '../../../../components/shop/KontoAnmeldung'
import { Vorgangsunterlagen } from '../../../../components/shop/Vorgangsunterlagen'
import { payloadClient } from '../../../../lib/data'
import {
  dateienZuBestellungen,
  downloadBis,
  downloadLink,
} from '../../../../lib/digitaleware'
import { formatPrice, isLocale, t, type Locale } from '../../../../lib/i18n'
import { SITZUNGS_COOKIE, sitzungLesen } from '../../../../lib/kundenportal'
import {
  vorgaenge,
  type PortalAngebot,
  type PortalAuftrag,
  type PortalRechnung,
} from '../../../../lib/portalDaten'

export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

/**
 * Das Kundenportal.
 *
 * Es beantwortet die drei Fragen, wegen denen Leute anrufen: Ist meine
 * Bestellung raus, wo steht mein Stück, und was schulde ich noch. Alles
 * andere — Kosten, Material, Zeiten, Notizen — bleibt drinnen.
 *
 * Wem was gehört, entscheidet ausschließlich `lib/portalDaten.ts`. Diese Seite
 * stellt nur dar; sie soll gar nicht erst in die Lage kommen, selbst zu
 * filtern.
 */
export default async function KontoSeite({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const email = sitzungLesen((await cookies()).get(SITZUNGS_COOKIE)?.value)

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      {/* Derselbe Corten-Strich wie auf jeder anderen Seite — das Portal ist
          Teil der Website und nicht ein Anhängsel davon. */}
      <h1 className="tracking-nav text-ink rule-bronze mb-8 text-2xl font-semibold uppercase">
        {dict.account.title}
      </h1>

      {!email ? (
        <div className="mt-8">
          <KontoAnmeldung labels={dict.account} locale={locale} />
        </div>
      ) : (
        <Uebersicht email={email} locale={locale} dict={dict} />
      )}
    </div>
  )
}

const ueberschrift =
  'tracking-nav text-ink rule-bronze-sm mt-14 mb-5 text-sm font-semibold uppercase'

async function Uebersicht({
  email,
  locale,
  dict,
}: {
  email: string
  locale: Locale
  dict: ReturnType<typeof t>
}) {
  const payload = await payloadClient()
  const { kunde, bestellungen, auftraege, rechnungen, angebote } = await vorgaenge(payload, email)
  const k = dict.account

  /*
   * Laufendes zuerst, Abgeschlossenes gesammelt darunter.
   *
   * Wer hierher kommt, will fast immer wissen, wo das aktuelle Stück steht.
   * Die Bestellung von vor zwei Jahren gehört trotzdem auf die Seite — als
   * Nachschlagewerk, nicht als erste Zeile. Rechnungen bleiben ungeteilt:
   * Das sind Belege, die man auch nach Jahren noch herunterlädt.
   */
  const laufendeAuftraege = auftraege.filter(
    (a) => a.status !== 'geliefert' && a.status !== 'abgebrochen',
  )
  const alteAuftraege = auftraege.filter(
    (a) => a.status === 'geliefert' || a.status === 'abgebrochen',
  )
  /*
   * Die gekauften Dateien stehen hier selbst, nicht hinter einem Link.
   *
   * Wer eine Datei gekauft hat, kommt genau deswegen ins Kundenkonto — ihn
   * erst noch auf die Bestellseite zu schicken wäre ein Klick, der nichts
   * beantwortet. Die Frist beginnt dabei mit dem Ansehen: Ein Jahr ab jetzt,
   * nicht ab dem Kauf.
   */
  const downloadDateien = await dateienZuBestellungen(
    payload,
    bestellungen.map((b) => b.id),
  )
  const downloadBisJetzt = downloadBis()

  const laufendeBestellungen = bestellungen.filter(
    (b) => b.status !== 'shipped' && b.status !== 'cancelled',
  )
  const alteBestellungen = bestellungen.filter(
    (b) => b.status === 'shipped' || b.status === 'cancelled',
  )

  const statusText = (status: string) =>
    (dict.orderStatus as unknown as Record<string, string>)[status] ?? status
  const tag = (wert?: string | null) =>
    wert ? new Date(wert).toLocaleDateString(locale) : ''

  // Offene Angebote zuerst — das ist das Einzige auf dieser Seite, wo etwas
  // von der Kundschaft erwartet wird
  const offeneAngebote = angebote.filter((a) => a.status === 'versendet')
  const alteAngebote = angebote.filter((a) => a.status !== 'versendet')

  const leer =
    !bestellungen.length && !auftraege.length && !rechnungen.length && !angebote.length

  return (
    <>
      {/*
       * Wir wissen, wer da ist — dann soll die Seite es auch sagen. Die
       * Adresse bleibt darunter stehen: Sie beantwortet die Frage, in welchem
       * Konto man gerade steckt, und die stellt sich bei zwei Adressen sofort.
       */}
      {kunde ? (
        <>
          <p className="text-ink text-lg">{k.greeting.replace('{name}', kunde)}</p>
          <p className="text-ink-soft mt-1 text-sm">{email}</p>
        </>
      ) : (
        <p className="text-ink-soft text-sm">{email}</p>
      )}

      {leer && <p className="text-ink-soft mt-8">{k.nothing}</p>}

      {offeneAngebote.length > 0 && (
        <>
          <h2 className={ueberschrift}>{k.quotes}</h2>
          <ul className="divide-line divide-y border-y">
            {offeneAngebote.map((a) => (
              <AngebotsZeile key={a.id} angebot={a} locale={locale} dict={dict} />
            ))}
          </ul>
        </>
      )}

      {laufendeAuftraege.length > 0 && (
        <>
          <h2 className={ueberschrift}>{k.jobs}</h2>
          <ul className="divide-line divide-y border-y">
            {laufendeAuftraege.map((a) => (
              <AuftragsZeile key={a.id} auftrag={a} locale={locale} dict={dict} />
            ))}
          </ul>
        </>
      )}

      {alteAngebote.length > 0 && (
        <>
          <h2 className={ueberschrift}>
            {k.quotes} · {k.finished}
          </h2>
          <ul className="divide-line divide-y border-y">
            {alteAngebote.map((a) => (
              <AngebotsZeile key={a.id} angebot={a} locale={locale} dict={dict} />
            ))}
          </ul>
        </>
      )}

      {rechnungen.length > 0 && (
        <>
          <h2 className={ueberschrift}>{k.invoices}</h2>
          <ul className="divide-line divide-y border-y">
            {rechnungen.map((r) => (
              <RechnungsZeile key={r.id} rechnung={r} locale={locale} dict={dict} />
            ))}
          </ul>
        </>
      )}

      {[...downloadDateien].length > 0 && (
        <>
          <h2 className={ueberschrift}>{dict.downloads.title}</h2>
          <p className="text-ink-soft mb-4 text-sm">{dict.downloads.intro}</p>
          <ul className="divide-line divide-y border-y">
            {bestellungen
              .filter((b) => downloadDateien.has(String(b.id)))
              .map((b) =>
                (downloadDateien.get(String(b.id)) ?? []).map((d) => (
                  <li
                    key={`${b.id}-${d.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="text-sm">{d.name}</p>
                      <p className="text-ink-soft text-xs">
                        {k.orderNumber} {b.nummer} · {tag(b.datum)}
                      </p>
                    </div>
                    <a
                      href={downloadLink(b.id, d.id, downloadBisJetzt)}
                      className="tracking-nav hover:text-bronze text-xs font-semibold uppercase underline transition-colors"
                    >
                      {dict.downloads.laden}
                    </a>
                  </li>
                )),
              )}
          </ul>
        </>
      )}

      {laufendeBestellungen.length > 0 && (
        <>
          <h2 className={ueberschrift}>{k.orders}</h2>
          <ul className="divide-line divide-y border-y">
            {laufendeBestellungen.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm font-semibold">
                    {k.orderNumber} {b.nummer}
                  </p>
                  <p className="text-ink-soft text-xs">
                    {tag(b.datum)} · {statusText(b.status)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">{formatPrice(b.betrag, locale)}</span>
                  {b.zugang && (
                    <Link
                      href={`/${locale}/bestellung/${b.zugang}`}
                      className="tracking-nav hover:text-bronze text-xs font-semibold uppercase underline transition-colors"
                    >
                      {k.showOrder}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {(alteAuftraege.length > 0 || alteBestellungen.length > 0) && (
        <>
          <h2 className={ueberschrift}>{k.finished}</h2>
          <ul className="divide-line divide-y border-y">
            {alteAuftraege.map((a) => (
              <li key={`a-${a.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm">{a.titel || `${k.jobNumber} ${a.nummer}`}</p>
                  <p className="text-ink-soft text-xs">
                    {k.jobNumber} {a.nummer} ·{' '}
                    {(k.jobState as Record<string, string>)[a.status] ?? a.status}
                  </p>
                </div>
                {a.gesamt > 0 && (
                  <span className="text-ink-soft text-sm">{formatPrice(a.gesamt, locale)}</span>
                )}
              </li>
            ))}
            {alteBestellungen.map((b) => (
              <li key={`b-${b.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm">
                    {k.orderNumber} {b.nummer}
                  </p>
                  <p className="text-ink-soft text-xs">
                    {tag(b.datum)} · {statusText(b.status)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-ink-soft text-sm">{formatPrice(b.betrag, locale)}</span>
                  {b.zugang && (
                    <Link
                      href={`/${locale}/bestellung/${b.zugang}`}
                      className="tracking-nav hover:text-bronze text-xs font-semibold uppercase underline transition-colors"
                    >
                      {k.showOrder}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-12">
        <AbmeldeButton text={k.signOut} />
      </div>
    </>
  )
}

function AuftragsZeile({
  auftrag,
  locale,
  dict,
}: {
  auftrag: PortalAuftrag
  locale: Locale
  dict: ReturnType<typeof t>
}) {
  const k = dict.account
  const zustand = (k.jobState as Record<string, string>)[auftrag.status] ?? auftrag.status
  const stufe = (k.stage as Record<string, string>)[auftrag.offeneStufe ?? ''] ?? ''

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {auftrag.titel || `${k.jobNumber} ${auftrag.nummer}`}
          </p>
          <p className="text-ink-soft text-xs">
            {k.jobNumber} {auftrag.nummer} · {zustand}
            {auftrag.fertigBis
              ? ` · ${k.readyBy} ${new Date(auftrag.fertigBis).toLocaleDateString(locale)}`
              : ''}
          </p>
        </div>
        {auftrag.gesamt > 0 && (
          <div className="text-right">
            <p className="text-sm">{formatPrice(auftrag.gesamt, locale)}</p>
            <p className="text-ink-soft text-xs">
              {formatPrice(auftrag.bezahlt, locale)} {k.paidSoFar}
            </p>
          </div>
        )}
      </div>

      {/*
       * Der Satz, wegen dem es das Portal gibt. „Ihre Anzahlung steht noch
       * aus" beantwortet den Anruf, bevor er kommt — und er ist bewusst
       * freundlich formuliert: Das hier ist keine Mahnung, die kommt auf
       * eigenem Weg.
       */}
      {auftrag.wartetAufZahlung && (
        <p className="border-bronze bg-paper-soft text-ink mt-3 border-l-2 px-4 py-3 text-sm">
          {k.depositDue.replace('{stufe}', stufe || k.invoiceNumber)}
          {auftrag.tageUeberfaellig > 0 && (
            <span className="text-ink-soft">
              {' '}
              ({k.depositOverdue.replace('{tage}', String(auftrag.tageUeberfaellig))})
            </span>
          )}
        </p>
      )}

      {/* Nachreichen und abholen — bei Lohnfertigung geht das hin und her,
          und der Auftrag ist die Stelle, an der beide danach suchen. */}
      <Vorgangsunterlagen auftrag={auftrag.id} labels={dict.handover} />
    </li>
  )
}

function AngebotsZeile({
  angebot,
  locale,
  dict,
}: {
  angebot: PortalAngebot
  locale: Locale
  dict: ReturnType<typeof t>
}) {
  const k = dict.account
  const abgelaufen = !angebot.annehmbar && angebot.status === 'versendet'

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="text-sm font-semibold">
          {k.quoteNumber} {angebot.nummer}
          {angebot.titel ? ` · ${angebot.titel}` : ''}
        </p>
        <p className="text-ink-soft text-xs">
          {angebot.status === 'angenommen'
            ? `${k.acceptedOn} ${angebot.angenommenAm ? new Date(angebot.angenommenAm).toLocaleDateString(locale) : ''}`
            : angebot.status === 'abgelehnt'
              ? k.quoteDeclined
              : abgelaufen
                ? k.expired
                : angebot.gueltigBis
                  ? `${k.validUntil} ${new Date(angebot.gueltigBis).toLocaleDateString(locale)}`
                  : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm">{formatPrice(angebot.betrag, locale)}</span>
        <a
          href={`/api/konto/angebot/${angebot.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="tracking-nav hover:text-bronze text-xs font-semibold uppercase underline transition-colors"
        >
          {k.viewQuote}
        </a>
        {angebot.annehmbar && (
          <AngebotAnnehmen
            id={angebot.id}
            labels={{
              acceptQuote: k.acceptQuote,
              acceptName: k.acceptName,
              acceptHint: k.acceptHint,
              accepting: k.accepting,
              acceptedNow: k.acceptedNow,
              acceptError: k.acceptError,
            }}
          />
        )}
      </div>
    </li>
  )
}

function RechnungsZeile({
  rechnung,
  locale,
  dict,
}: {
  rechnung: PortalRechnung
  locale: Locale
  dict: ReturnType<typeof t>
}) {
  const k = dict.account
  const stufe = (k.stage as Record<string, string>)[rechnung.stufe] ?? k.invoiceNumber
  const bezahlt = rechnung.status === 'bezahlt'

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="text-sm font-semibold">
          {stufe} {rechnung.nummer}
        </p>
        <p className="text-ink-soft text-xs">
          {rechnung.auftrag ? `${k.jobNumber} ${rechnung.auftrag} · ` : ''}
          {bezahlt
            ? k.paidOn
            : rechnung.faelligAm
              ? `${k.dueOn} ${new Date(rechnung.faelligAm).toLocaleDateString(locale)}`
              : k.open}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm">{formatPrice(rechnung.betrag, locale)}</span>
        <a
          href={`/api/konto/rechnung/${rechnung.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="tracking-nav hover:text-bronze text-xs font-semibold uppercase underline transition-colors"
        >
          {k.download}
        </a>
      </div>
    </li>
  )
}

function AbmeldeButton({ text }: { text: string }) {
  return (
    <form
      action={async () => {
        'use server'
        const speicher = await cookies()
        speicher.set(SITZUNGS_COOKIE, '', { path: '/', maxAge: 0 })
      }}
    >
      <button
        type="submit"
        className="tracking-nav text-ink-soft hover:text-bronze cursor-pointer text-xs font-semibold uppercase underline transition-colors"
      >
        {text}
      </button>
    </form>
  )
}
