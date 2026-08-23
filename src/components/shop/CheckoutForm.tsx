'use client'

import Link from 'next/link'
import React, { useRef, useState } from 'react'

import { formatPrice, type Locale } from '../../lib/i18n'
import { Schrittformular, type Schritt } from '../Schrittformular'
import { useCart } from './CartProvider'

type CheckoutDict = {
  deliveryMethod: string
  optionShipping: string
  optionPickup: string
  pickupNote: string
  paymentMethod: string
  optionPaypal: string
  paypalNote: string
  optionInvoice: string
  invoiceNote: string
  redirectNoteInvoice: string
  redirectNotePaypal: string
  paypalAddressNote: string
  differentAddress: string
  vatIncluded: string
  shipping: string
  contactData: string
  name: string
  email: string
  phone: string
  shippingAddress: string
  line1: string
  line2: string
  postalCode: string
  city: string
  country: string
  note: string
  payNow: string
  consentTerms: string
  consentWaiver: string
  consentMissing: string
  backToCart: string
  error: string
  errorNoPayment: string
  verifyTitle: string
  verifyIntro: string
  verifyCode: string
  verifyWrong: string
  verifyExpired: string
  verifyLocked: string
  verifyNeeded: string
  verifyConfirmed: string
  verifyResend: string
  stepContact: string
  stepDelivery: string
  stepAddress: string
  stepReview: string
  stepNext: string
  stepBack: string
  reviewIntro: string
}

type CartDict = {
  empty: string
  continueShopping: string
  subtotal: string
  total: string
}

/**
 * Setzt die Rechtsseiten als Links in den Zustimmungssatz ein.
 *
 * Der Satz steht als ganzer in der Übersetzung — mit Platzhaltern statt
 * zusammengestückelter Halbsätze, weil sich die Wortstellung je Sprache
 * unterscheidet.
 */
function mitLinks(satz: string, locale: Locale): React.ReactNode[] {
  const ziele: Record<string, string> = {
    agb: `/${locale}/kontakt/agb`,
    widerruf: `/${locale}/kontakt/widerruf`,
    datenschutz: `/${locale}/kontakt/datenschutzerklaerung`,
  }
  const beschriftung: Record<string, Record<Locale, string>> = {
    agb: { de: 'AGB', fr: 'CGV', en: 'terms & conditions' },
    widerruf: {
      de: 'Widerrufsbelehrung',
      fr: 'droit de rétractation',
      en: 'right of withdrawal',
    },
    datenschutz: {
      de: 'Datenschutzerklärung',
      fr: 'politique de confidentialité',
      en: 'privacy policy',
    },
  }

  return satz.split(/(\{agb\}|\{widerruf\}|\{datenschutz\})/).map((teil, i) => {
    const schluessel = teil.startsWith('{') ? teil.slice(1, -1) : null
    if (!schluessel || !ziele[schluessel]) return <React.Fragment key={i}>{teil}</React.Fragment>
    return (
      <Link key={i} href={ziele[schluessel]} className="text-ink underline" target="_blank">
        {beschriftung[schluessel][locale]}
      </Link>
    )
  })
}

export function CheckoutForm({
  locale,
  dict,
  cartDict,
  downloadDict,
  initialCode,
  paypalAvailable = false,
  vatRate = 20,
}: {
  locale: Locale
  dict: CheckoutDict
  cartDict: CartDict
  /** Nur der eine Satz für die sofortige Bereitstellung */
  downloadDict: { hinweisKasse: string }
  initialCode?: string
  paypalAvailable?: boolean
  vatRate?: number
}) {
  const { items, subtotal, clear } = useCart()
  const formular = useRef<HTMLFormElement>(null)
  const [submitting, setSubmitting] = useState(false)
  // 'allgemein' heißt „nochmal versuchen", 'keine-zahlung' heißt „ruf uns an"
  const [error, setError] = useState<null | 'allgemein' | 'keine-zahlung'>(null)
  /*
   * Zwei Zahlarten: PayPal (nur wenn eingerichtet) und Rechnung (immer).
   * Ohne PayPal-Zugangsdaten ist Rechnung vorgewählt — die Kasse funktioniert
   * damit auch, bevor irgendein Zahlungsdienst eingerichtet ist.
   */
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'rechnung'>(
    paypalAvailable ? 'paypal' : 'rechnung',
  )
  /*
   * Die E-Mail-Bestätigung ist das Tor zum zweiten Schritt.
   *
   * Sie stand früher am Ende: Man füllte zwanzig Felder aus, drückte
   * „Bestellen", und *dann* kam der Code. Wer sich vertippt hatte, merkte es
   * als Letztes. Jetzt steht sie dort, wo die Adresse eingetippt wird — wer
   * weitergeht, hat sie bestätigt.
   *
   * `bestaetigt` merkt sich, **welche** Adresse bestätigt wurde. Ändert
   * jemand sie danach noch einmal, ist die Bestätigung hinfällig und der
   * nächste Schritt wieder zu.
   */
  const [bestaetigt, setBestaetigt] = useState<string | null>(null)
  const [codeNoetig, setCodeNoetig] = useState(false)
  const [codeAn, setCodeAn] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [codeFehler, setCodeFehler] = useState<string | null>(null)
  /** Was im letzten Schritt zum Nachlesen steht */
  const [rueckschau, setRueckschau] = useState<{ was: string; wert: string }[]>([])
  /** Zähler, mit dem der Abschluss zurück zum Kontakt schicken kann */
  const [sprung, setSprung] = useState<{ schluessel: string; nr: number } | undefined>()
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping')
  const [differentAddress, setDifferentAddress] = useState(false)
  const [zustimmung, setZustimmung] = useState(false)
  const [verzicht, setVerzicht] = useState(false)
  const [sofort, setSofort] = useState(false)
  const [fehlendeZustimmung, setFehlendeZustimmung] = useState(false)

  // Bei PayPal kommt die Lieferadresse aus dem PayPal-Konto, außer der Kunde
  // will ausdrücklich eine abweichende angeben. Bei Rechnung gibt es diese
  // Quelle nicht — dort ist die Adresse bei Lieferung Pflicht.
  /*
   * Digitale Ware ändert zwei Dinge an dieser Kasse.
   *
   * Ist überhaupt etwas dabei, muss die sofortige Bereitstellung ausdrücklich
   * verlangt werden — sonst bliebe der Kauf widerrufbar, obwohl die Datei
   * längst heruntergeladen ist. Liegt **nur** Digitales im Korb, entfällt die
   * Anschrift: Es wird nichts verschickt, und ein Pflichtfeld für eine
   * Lieferung, die es nicht gibt, ist eine Hürde ohne Zweck.
   */
  const hatDigitales = items.some((i) => i.digital === true)
  const nurDigital = items.length > 0 && items.every((i) => i.digital === true)

  const showAddressForm =
    !nurDigital && deliveryMethod === 'shipping' && (paymentMethod === 'rechnung' || differentAddress)

  // Nur wenn wir sicher wissen, dass ein Stück nach Vorgabe entsteht, wird der
  // Verzicht abgefragt — sonst spräche die Kasse jemandem ein Recht ab, das er hat.
  const einzelanfertigung = items.some((i) => i.madeToOrder === true)


  const shipping =
    deliveryMethod === 'pickup'
      ? 0
      : items.reduce((s, i) => s + (i.shippingCost ?? 0) * i.quantity, 0)

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-ink-soft mb-6">{cartDict.empty}</p>
        <Link
          href={`/${locale}`}
          className="bg-ink tracking-nav hover:bg-bronze inline-block px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors"
        >
          {cartDict.continueShopping}
        </Link>
      </div>
    )
  }

  /** Der Wert eines Feldes im Formular, ohne Umweg über den Zustand */
  function feldwert(name: string): string {
    const feld = formular.current?.elements.namedItem(name)
    return feld instanceof HTMLInputElement || feld instanceof HTMLTextAreaElement
      ? feld.value.trim()
      : ''
  }

  /**
   * Das Tor zwischen Kontakt und dem Rest: erst bestätigen, dann weiter.
   *
   * Drei Fälle. Wer schon angemeldet ist, merkt nichts — der Server sagt das
   * beim Anfordern gleich mit. Wer noch keinen Code hat, bekommt einen und
   * bleibt stehen. Wer einen eingetippt hat, geht weiter, wenn er stimmt.
   */
  async function kontaktPruefen(): Promise<string | null> {
    const email = feldwert('email').toLowerCase()
    // Ohne Adresse hat die Browser-Prüfung schon vorher angehalten
    if (!email) return null
    if (bestaetigt === email) return null

    if (!codeNoetig || codeAn !== email) {
      const gesendet = await codeAnfordern(email)
      return gesendet ? null : dict.verifyIntro.replace('{email}', email)
    }

    if (emailCode.length < 6) return dict.verifyNeeded

    try {
      const res = await fetch('/api/kasse/pruefung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'bestaetigen', email, code: emailCode }),
      })
      if (res.ok) {
        setBestaetigt(email)
        setCodeFehler(null)
        return null
      }
      const { error: grund } = (await res.json()) as { error?: string }
      /*
       * Abgelaufen oder gesperrt heißt: Dieser Code ist tot. Das Feld wird
       * geleert, damit der nächste Versuch nicht denselben noch einmal
       * schickt — und `codeNoetig` bleibt stehen, damit der Knopf „Neuen Code
       * schicken" erreichbar ist.
       */
      if (grund !== 'falsch') setEmailCode('')
      const text =
        grund === 'falsch'
          ? dict.verifyWrong
          : grund === 'gesperrt'
            ? dict.verifyLocked
            : grund === 'zu-viele-anfragen'
              ? dict.verifyLocked
              : dict.verifyExpired
      setCodeFehler(text)
      return text
    } catch {
      return dict.error
    }
  }

  /** Holt einen Code. `true` heißt: schon bestätigt, es geht direkt weiter. */
  async function codeAnfordern(email: string): Promise<boolean> {
    setCodeFehler(null)
    try {
      const res = await fetch('/api/kasse/pruefung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'code-anfordern', email, locale }),
      })
      const antwort = (await res.json()) as { schonBestaetigt?: boolean; error?: string }
      if (antwort.schonBestaetigt) {
        setBestaetigt(email)
        setCodeNoetig(false)
        return true
      }
      setCodeNoetig(true)
      setCodeAn(email)
      setEmailCode('')
      if (antwort.error === 'zu-viele-anfragen') setCodeFehler(dict.verifyLocked)
      return false
    } catch {
      setCodeFehler(dict.error)
      setCodeNoetig(true)
      setCodeAn(email)
      return false
    }
  }

  /*
   * Vor dem letzten Schritt noch einmal zeigen, was man eingetippt hat.
   *
   * Genau dafür sind Schritte da: Am Stück sieht man die Anschrift beim
   * Abschicken noch vor sich, in Schritten liegt sie zwei Seiten zurück. Ein
   * falscher Hausnummerndreher fällt sonst erst dem Paketboten auf.
   */
  function rueckschauBauen() {
    const zeilen: { was: string; wert: string }[] = [
      { was: dict.name, wert: feldwert('name') },
      { was: dict.email, wert: feldwert('email') },
      { was: dict.phone, wert: feldwert('phone') },
      {
        was: dict.deliveryMethod,
        wert: deliveryMethod === 'pickup' ? dict.optionPickup : dict.optionShipping,
      },
      {
        was: dict.paymentMethod,
        wert: paymentMethod === 'rechnung' ? dict.optionInvoice : dict.optionPaypal,
      },
    ]
    if (showAddressForm) {
      const anschrift = [
        feldwert('line1'),
        feldwert('line2'),
        [feldwert('postalCode'), feldwert('city')].filter(Boolean).join(' '),
        feldwert('country'),
      ]
        .filter(Boolean)
        .join(', ')
      zeilen.push({ was: dict.shippingAddress, wert: anschrift })
    }
    setRueckschau(zeilen.filter((z) => z.wert))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!zustimmung || (einzelanfertigung && !verzicht) || (hatDigitales && !sofort)) {
      setFehlendeZustimmung(true)
      return
    }
    setSubmitting(true)
    setError(null)
    setFehlendeZustimmung(false)
    const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          promoCode: initialCode,
          deliveryMethod,
          paymentMethod,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            variantTitle: i.variantTitle,
            color: i.color,
            quantity: i.quantity,
          })),
          customer: {
            name: data.name,
            email: data.email,
            phone: data.phone || undefined,
          },
          shippingAddress: {
            line1: data.line1,
            line2: data.line2 || undefined,
            postalCode: data.postalCode,
            city: data.city,
            country: data.country,
          },
          note: data.note || undefined,
          emailCode: emailCode || undefined,
          // Was bestätigt wurde, gehört in die Bestellung — im Streitfall zählt
          // nicht, was auf der Seite stand, sondern was belegbar ist.
          consent: {
            terms: true,
            waiver: einzelanfertigung ? verzicht : undefined,
            sofortigeLieferung: hatDigitales ? sofort : undefined,
          },
        }),
      })
      const result = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !result.url) {
        /*
         * Der Server verlangt (noch) eine Bestätigung.
         *
         * Im Normalfall kommt das nicht mehr vor — bestätigt wird beim
         * Weitergehen aus dem ersten Schritt. Es bleibt der Fall, dass die
         * Sitzung zwischendurch abgelaufen ist, weil das Formular lange offen
         * stand. Dann geht es zurück zum Kontakt, statt hier unten eine
         * Meldung über ein Feld zu zeigen, das man von hier aus nicht sieht.
         */
        if (result.error === 'code-noetig' || result.error?.startsWith('code-')) {
          setBestaetigt(null)
          setCodeNoetig(true)
          setCodeAn(data.email)
          setEmailCode('')
          setCodeFehler(
            result.error === 'code-falsch'
              ? dict.verifyWrong
              : result.error === 'code-gesperrt'
                ? dict.verifyLocked
                : null,
          )
          setSprung((v) => ({ schluessel: 'kontakt', nr: (v?.nr ?? 0) + 1 }))
          setSubmitting(false)
          return
        }
        // 503 heißt: Die Bezahlung ist gar nicht eingerichtet. Ein zweiter
        // Versuch scheitert genauso — das muss dranstehen.
        setError(res.status === 503 ? 'keine-zahlung' : 'allgemein')
        setSubmitting(false)
        return
      }

      // Warenkorb leeren und zu PayPal weiterleiten
      clear()
      window.location.href = result.url
    } catch {
      setError('allgemein')
      setSubmitting(false)
    }
  }

  const inputClass =
    'border-line focus:border-ink w-full border bg-paper px-4 py-3 text-sm outline-none transition-colors'

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <form ref={formular} onSubmit={handleSubmit} className="space-y-6">
        <Schrittformular
          stil="shop"
          sprung={sprung}
          weiterText={dict.stepNext}
          zurueckText={dict.stepBack}
          /*
           * Nach jedem Wechsel nach oben — sonst steht man am Telefon mitten
           * im neuen Schritt, weil die Seite dort weiterläuft, wo der vorige
           * aufgehört hat. Und die Rückschau wird frisch gebaut, damit im
           * letzten Schritt steht, was gerade im Formular steht.
           */
          beiWechsel={() => {
            rueckschauBauen()
            formular.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          }}
          schritte={
            [
              {
                schluessel: 'kontakt',
                titel: dict.stepContact,
                pruefen: kontaktPruefen,
                inhalt: (
                  <>
                    <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
                      {dict.contactData}
                    </h2>
                    <div className="space-y-3">
                      <input name="name" required placeholder={dict.name} className={inputClass} />
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder={dict.email}
                        className={inputClass}
                        // Ändert sich die Adresse, ist die Bestätigung dahin
                        onChange={() => {
                          setBestaetigt(null)
                          setCodeFehler(null)
                        }}
                      />
                      <input name="phone" type="tel" placeholder={dict.phone} className={inputClass} />
                    </div>

                    {bestaetigt && (
                      <p className="text-ink-soft mt-3 text-sm">✓ {dict.verifyConfirmed}</p>
                    )}

                    {codeNoetig && !bestaetigt && (
                      <div className="border-bronze bg-paper-soft mt-4 border-l-2 p-4">
                        <h3 className="tracking-nav text-ink mb-2 text-sm font-semibold uppercase">
                          {dict.verifyTitle}
                        </h3>
                        <p className="text-ink-soft mb-3 text-sm">
                          {dict.verifyIntro.replace('{email}', codeAn)}
                        </p>
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder={dict.verifyCode}
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                          className={inputClass}
                          style={{ maxWidth: '14rem', letterSpacing: '.4em' }}
                        />
                        {codeFehler && <p className="text-accent mt-2 text-sm">{codeFehler}</p>}
                        <button
                          type="button"
                          className="text-ink-soft hover:text-ink mt-3 block text-sm underline"
                          onClick={() => void codeAnfordern(feldwert('email').toLowerCase())}
                        >
                          {dict.verifyResend}
                        </button>
                      </div>
                    )}
                  </>
                ),
              },
              {
                schluessel: 'versand',
                titel: dict.stepDelivery,
                inhalt: (
                  <div className="space-y-6">
                    <div>
                      <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
                        {dict.deliveryMethod}
                      </h2>
                      <div className="space-y-2">
                        <label className="border-line has-checked:border-ink flex cursor-pointer items-center gap-3 border bg-paper px-4 py-3 text-sm">
                          <input
                            type="radio"
                            name="deliveryMethod"
                            value="shipping"
                            checked={deliveryMethod === 'shipping'}
                            onChange={() => setDeliveryMethod('shipping')}
                            className="accent-ink"
                          />
                          {dict.optionShipping}
                        </label>
                        <label className="border-line has-checked:border-ink flex cursor-pointer items-center gap-3 border bg-paper px-4 py-3 text-sm">
                          <input
                            type="radio"
                            name="deliveryMethod"
                            value="pickup"
                            checked={deliveryMethod === 'pickup'}
                            onChange={() => setDeliveryMethod('pickup')}
                            className="accent-ink"
                          />
                          {dict.optionPickup}
                        </label>
                        {deliveryMethod === 'pickup' && (
                          <p className="text-ink-soft text-xs">{dict.pickupNote}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
                        {dict.paymentMethod}
                      </h2>
                      <div className="space-y-2">
                        {paypalAvailable && (
                          <label className="border-line has-checked:border-ink block cursor-pointer border bg-paper px-4 py-3 text-sm">
                            <span className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="paymentMethod"
                                value="paypal"
                                checked={paymentMethod === 'paypal'}
                                onChange={() => setPaymentMethod('paypal')}
                                className="accent-ink"
                              />
                              {dict.optionPaypal}
                            </span>
                            {paymentMethod === 'paypal' && (
                              <span className="text-ink-soft mt-1 block pl-7 text-xs">
                                {dict.paypalNote}
                              </span>
                            )}
                          </label>
                        )}
                        <label className="border-line has-checked:border-ink block cursor-pointer border bg-paper px-4 py-3 text-sm">
                          <span className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="rechnung"
                              checked={paymentMethod === 'rechnung'}
                              onChange={() => setPaymentMethod('rechnung')}
                              className="accent-ink"
                            />
                            {dict.optionInvoice}
                          </span>
                          {paymentMethod === 'rechnung' && (
                            <span className="text-ink-soft mt-1 block pl-7 text-xs">
                              {dict.invoiceNote}
                            </span>
                          )}
                        </label>
                      </div>
                    </div>

                    {deliveryMethod === 'shipping' && paymentMethod === 'paypal' && (
                      <div className="border-line bg-paper-soft border p-4 text-sm">
                        <p className="text-ink-soft">{dict.paypalAddressNote}</p>
                        <label className="text-ink mt-2 flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={differentAddress}
                            onChange={(e) => setDifferentAddress(e.target.checked)}
                            className="accent-ink"
                          />
                          {dict.differentAddress}
                        </label>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                schluessel: 'anschrift',
                titel: dict.stepAddress,
                /*
                 * Bei Abholung gibt es nichts zu liefern, und bei PayPal
                 * kommt die Anschrift aus dem PayPal-Konto — außer jemand
                 * will ausdrücklich eine andere. Dann fällt der Schritt weg,
                 * samt seiner Nummer: „Schritt 2 von 3" soll stimmen.
                 */
                entfaellt: !showAddressForm,
                inhalt: (
                  <>
                    <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
                      {dict.shippingAddress}
                    </h2>
                    <div className="space-y-3">
                      <input name="line1" required placeholder={dict.line1} className={inputClass} />
                      <input name="line2" placeholder={dict.line2} className={inputClass} />
                      <div className="grid grid-cols-[120px_1fr] gap-3">
                        <input
                          name="postalCode"
                          required
                          placeholder={dict.postalCode}
                          className={inputClass}
                        />
                        <input name="city" required placeholder={dict.city} className={inputClass} />
                      </div>
                      <input
                        name="country"
                        required
                        placeholder={dict.country}
                        defaultValue={locale === 'fr' ? 'France' : 'Deutschland'}
                        className={inputClass}
                      />
                    </div>
                  </>
                ),
              },
              {
                schluessel: 'abschluss',
                titel: dict.stepReview,
                inhalt: (
                  <div className="space-y-6">
                    <div>
                      <h2 className="tracking-nav text-ink mb-3 text-sm font-semibold uppercase">
                        {dict.stepReview}
                      </h2>
                      <p className="text-ink-soft mb-3 text-sm">{dict.reviewIntro}</p>
                      <dl className="border-line divide-line divide-y border-y text-sm">
                        {rueckschau.map((z) => (
                          <div key={z.was} className="flex gap-4 py-2">
                            <dt className="text-ink-soft w-40 shrink-0">{z.was}</dt>
                            <dd className="text-ink min-w-0 break-words">{z.wert}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <textarea name="note" rows={3} placeholder={dict.note} className={inputClass} />

                    {error && (
                      <p className="text-accent text-sm">
                        {error === 'keine-zahlung' ? dict.errorNoPayment : dict.error}
                      </p>
                    )}

                    <div className="border-line space-y-3 border-t pt-5">
                      <label className="text-ink-soft flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          required
                          checked={zustimmung}
                          onChange={(e) => setZustimmung(e.target.checked)}
                          className="accent-ink mt-0.5"
                        />
                        <span>{mitLinks(dict.consentTerms, locale)}</span>
                      </label>

                      {einzelanfertigung && (
                        <label className="text-ink-soft flex cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            required
                            checked={verzicht}
                            onChange={(e) => setVerzicht(e.target.checked)}
                            className="accent-ink mt-0.5"
                          />
                          <span>{dict.consentWaiver}</span>
                        </label>
                      )}

                      {hatDigitales && (
                        <label className="text-ink-soft flex cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            required
                            checked={sofort}
                            onChange={(e) => setSofort(e.target.checked)}
                            className="accent-ink mt-0.5"
                          />
                          <span>{downloadDict.hinweisKasse}</span>
                        </label>
                      )}

                      {fehlendeZustimmung && <p className="text-accent text-sm">{dict.consentMissing}</p>}
                    </div>

                    <p className="text-ink-soft text-xs">
                      {paymentMethod === 'rechnung' ? dict.redirectNoteInvoice : dict.redirectNotePaypal}
                    </p>
                  </div>
                ),
              },
            ] satisfies Schritt[]
          }
          abschluss={
            <button
              type="submit"
              disabled={submitting}
              className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-10 py-3.5 text-xs font-semibold text-on-ink uppercase transition-colors disabled:opacity-50"
            >
              {dict.payNow}
            </button>
          }
        />

        <Link href={`/${locale}/warenkorb`} className="text-ink-soft hover:text-ink text-sm underline">
          {dict.backToCart}
        </Link>
      </form>

      <aside className="bg-paper-soft h-fit p-6">
        <ul className="space-y-3 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-ink-soft">
                {item.quantity}× {item.title}
                {item.variantTitle ? ` (${item.variantTitle})` : ''}
              </span>
              <span className="text-ink whitespace-nowrap">
                {formatPrice(item.unitPrice * item.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-line mt-4 space-y-1 border-t pt-3 text-sm">
          <div className="text-ink-soft flex justify-between">
            <span>{cartDict.subtotal}</span>
            <span>{formatPrice(subtotal, locale)}</span>
          </div>
          {shipping > 0 && (
            <div className="text-ink-soft flex justify-between">
              <span>{dict.shipping}</span>
              <span>{formatPrice(shipping, locale)}</span>
            </div>
          )}
          <div className="text-ink flex justify-between font-semibold">
            <span>{cartDict.total}</span>
            <span>{formatPrice(subtotal + shipping, locale)}</span>
          </div>
          <p className="text-ink-soft pt-1 text-xs">
            {dict.vatIncluded.replace('{rate}', String(vatRate))}
          </p>
        </div>
      </aside>
    </div>
  )
}
