import fs from 'fs'
import path from 'path'

import type { Locale } from './i18n'

type OrderLike = {
  orderNumber: string
  total: number
  subtotal: number
  discount?: number | null
  shippingTotal?: number | null
  deliveryMethod?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  accessToken?: string | null
  expectedReady?: string | null
  promotionTitle?: string | null
  items?:
    | {
        titleSnapshot: string
        variantTitle?: string | null
        color?: string | null
        quantity: number
        unitPrice: number
      }[]
    | null
  customer?: { name?: string | null; email?: string | null } | null
  shippingAddress?: {
    line1?: string | null
    line2?: string | null
    postalCode?: string | null
    city?: string | null
    country?: string | null
  } | null
}

export type CompanyInfo = {
  name?: string | null
  legalName?: string | null
  legalForm?: string | null
  shareCapital?: number | null
  rcsNumber?: string | null
  rcsCity?: string | null
  address?: string | null
  siret?: string | null
  vatId?: string | null
  vatRate?: number | null
  paymentTerms?: string | null
  latePaymentNote?: string | null
  iban?: string | null
  bic?: string | null
  /** Option „TVA d'après les débits" — muss dann auf jeder Rechnung stehen */
  vatOnDebits?: boolean | null
}

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Die Wörter der Mailbausteine in den drei Sprachen des Shops.
 *
 * Bisher standen sie deutsch im HTML — auch in der Mail an jemanden, der auf
 * Französisch bestellt hat. „Zwischensumme" über einer Rechnungssumme liest
 * sich dann wie eine Verwechslung, und bei Geld ist eine Verwechslung teuer.
 *
 * Deutsch bleibt die Vorgabe: Wo keine Sprache bekannt ist (die Bestellung
 * merkt sie sich nicht), ist das die Sprache des Hauses.
 */
const WORTE: Record<
  Locale,
  {
    zwischensumme: string
    rabatt: string
    versand: string
    gesamt: string
    steuer: (satz: number) => string
    abholungHinweis: string
    bestellung: string
    lieferadresse: string
    abholung: string
    stand: string
    gruss: string
  }
> = {
  de: {
    zwischensumme: 'Zwischensumme',
    rabatt: 'Rabatt',
    versand: 'Versand',
    gesamt: 'Gesamt',
    steuer: (satz) => `enthaltene MwSt./TVA (${satz} %)`,
    abholungHinweis: 'Abholung — Adresse und Termin werden nach der Bestellung abgestimmt.',
    bestellung: 'Ihre Bestellung',
    lieferadresse: 'Lieferadresse',
    abholung: 'Abholung',
    stand: 'Stand Ihrer Bestellung ansehen',
    gruss: 'Mit freundlichen Grüßen',
  },
  fr: {
    zwischensumme: 'Sous-total',
    rabatt: 'Remise',
    versand: 'Livraison',
    gesamt: 'Total',
    steuer: (satz) => `TVA incluse (${satz} %)`,
    abholungHinweis: 'Retrait sur place — adresse et rendez-vous seront convenus après la commande.',
    bestellung: 'Votre commande',
    lieferadresse: 'Adresse de livraison',
    abholung: 'Retrait sur place',
    stand: 'Suivre votre commande',
    gruss: 'Cordialement',
  },
  en: {
    zwischensumme: 'Subtotal',
    rabatt: 'Discount',
    versand: 'Shipping',
    gesamt: 'Total',
    steuer: (satz) => `VAT included (${satz} %)`,
    abholungHinweis: 'Collection — address and appointment are arranged after the order.',
    bestellung: 'Your order',
    lieferadresse: 'Delivery address',
    abholung: 'Collection',
    stand: 'View the status of your order',
    gruss: 'Kind regards',
  },
}

/** Enthaltene MwSt./TVA aus dem Bruttobetrag herausrechnen */
function vatRow(order: OrderLike, company?: CompanyInfo, sprache: Locale = 'de'): string {
  const rate = company?.vatRate ?? 20
  if (!rate) return ''
  const vat = Math.round((order.total - order.total / (1 + rate / 100)) * 100) / 100
  return `<tr><td></td><td style="padding:2px 12px 2px 0;color:#666;font-size:12px">${WORTE[sprache].steuer(rate)}</td><td style="text-align:right;color:#666;font-size:12px">${euro(vat)}</td></tr>`
}

/**
 * Firmierung mit Rechtsform und Stammkapital — bei einer französischen SAS
 * gehört beides auf jede Rechnung.
 */
export function firmenzeile(company?: CompanyInfo): string {
  if (!company) return ''
  const name = company.legalName || company.name || ''
  /*
   * „Next-Concept SAS SAS au capital de 1 000 €" — so stand es unter jeder
   * Mail, weil die Rechtsform schon im Firmennamen steckte und danach noch
   * einmal angehängt wurde. Wer den Namen einträgt, schreibt sie eben mit;
   * das ist kein Fehler des Menschen, sondern einer der Vorlage.
   */
  const doppelt =
    company.legalForm &&
    new RegExp(`(^|\\s)${company.legalForm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(name)
  const teile = [name, doppelt ? null : company.legalForm].filter(Boolean).join(' ')
  const kapital =
    typeof company.shareCapital === 'number' && company.shareCapital > 0
      ? ` au capital de ${new Intl.NumberFormat('fr-FR').format(company.shareCapital)} €`
      : ''
  return `${teile}${kapital}`.trim()
}

/**
 * Pflichtangaben, die unter jede geschäftliche Mail gehören.
 *
 * In Frankreich gilt für die geschäftliche E-Mail dasselbe wie für den
 * Briefbogen: Firmierung, SIRET und TVA-Nummer müssen darauf stehen. Deshalb
 * liegt das hier zentral und nicht in jeder einzelnen Vorlage.
 */
export function pflichtangaben(company?: CompanyInfo): string[] {
  if (!company) return []
  return [
    firmenzeile(company),
    company.siret ? `SIRET: ${company.siret}` : null,
    company.vatId ? `TVA: ${company.vatId}` : null,
    // Dasselbe beim Handelsregister: Steht „RCS" schon im Ort, nicht noch einmal davor
    company.rcsNumber
      ? `${/^rcs\b/i.test(company.rcsCity ?? '') ? '' : 'RCS '}${company.rcsCity ?? ''} ${company.rcsNumber}`
          .replace(/\s+/g, ' ')
          .trim()
      : null,
  ].filter(Boolean) as string[]
}

/** Pflichtangaben-Fußzeile (SIRET, TVA-Nr.) für Bestell-Mails */
function companyFooter(company?: CompanyInfo): string {
  const parts = pflichtangaben(company)
  if (parts.length === 0) return ''
  return `<p style="margin-top:28px;border-top:1px solid #eee;padding-top:10px;color:#999;font-size:11px">${parts.join(' · ')}</p>`
}

/** Corten-Ton der Website */
export const BRONZE = '#a5622d'

/**
 * Corten-Strich unter einer Überschrift — dieselbe Form wie auf der Website:
 * 112 × 3 px bei großen, 40 × 2 px bei kleinen Überschriften, nach rechts
 * auslaufend.
 *
 * Der Verlauf liegt als `background-image` über einer einfarbigen Fläche:
 * Outlook kann keine Verläufe und zeigt dann den vollen Strich — richtig
 * aussehen tut es in beiden Fällen.
 */
export function cortenStrich(gross = false): string {
  const breite = gross ? 112 : 40
  const hoehe = gross ? 3 : 2
  const oben = gross ? 12 : 7
  const unten = gross ? 20 : 12
  return `<div style="width:${breite}px;height:${hoehe}px;border-radius:9999px;background-color:${BRONZE};background-image:linear-gradient(to right,${BRONZE} 0%,${BRONZE} 30%,rgba(165,98,45,0) 100%);margin:${oben}px 0 ${unten}px"></div>`
}

/** Überschrift mit Corten-Strich darunter */
export function ueberschrift(text: string, gross = false): string {
  const groesse = gross ? 17 : 14
  return `<h2 style="font-size:${groesse}px;font-weight:600;margin:26px 0 0">${text}</h2>${cortenStrich(gross)}`
}

/**
 * Briefbogen für alle Mails — die der Website wie die aus dem Büro.
 *
 * Das Logo wird über `cid:vh-logo` eingebunden und als Anhang mitgeschickt;
 * ein aus dem Netz nachgeladenes Bild blockieren die meisten Mailprogramme,
 * und dann stünde die Mail ohne Kopf da.
 *
 * **Warum die Mail sagt, dass sie hell ist.** Wer sein Mailprogramm dunkel
 * gestellt hat, bekam von uns einen schwarzen Schriftzug auf schwarzem Grund
 * — das Logo war schlicht nicht da. Der Grund: Ohne Angabe stellt das
 * Programm seinen eigenen dunklen Hintergrund darunter, und das Bild ist nun
 * einmal schwarz.
 *
 * Dagegen steht hier dreierlei, absichtlich mehrfach:
 *
 * 1. `color-scheme` und `supported-color-schemes` — die Angabe, auf die
 *    Apple Mail und die gutwilligen Programme hören: „diese Mail ist hell
 *    gemeint, bitte nicht umfärben".
 * 2. Ein ausdrücklich weißer Grund samt gesetzter Schriftfarbe. Ein Programm,
 *    das nichts umfärbt, hat damit alles, was es braucht.
 * 3. Ein Logo, das seinen hellen Grund **im Bild** mitbringt
 *    (`logo-mail.png`). Bilder färbt keines dieser Programme um — deshalb
 *    bleibt der Schriftzug auch dort lesbar, wo Punkt 1 und 2 überfahren
 *    werden. Auf weißem Grund ist das Feld unsichtbar, auf dunklem wird es
 *    zur Karte.
 */
export function briefbogen(inhalt: string, company?: CompanyInfo, mitFuss = true): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<style>:root{color-scheme:light;supported-color-schemes:light}</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff">
<div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;background-color:#ffffff;max-width:560px;font-size:14px;line-height:1.55">
  <img src="cid:vh-logo" alt="Vincent Hellmann" style="height:26px;display:block;border:0" />
  ${cortenStrich(true)}
  ${inhalt}
  ${mitFuss ? companyFooter(company) : ''}
</div>
</body>
</html>`
}

/**
 * Das Logo als Anhang — für jeden Weg, der eine Mail verschickt.
 *
 * Steht hier und nicht zweimal daneben: `sendMail` und das Postfach hatten
 * bisher je ihre eigene Fassung derselben vier Zeilen, und eine davon hätte
 * die weiße Fassung irgendwann nicht mitbekommen.
 *
 * Ohne `cid:vh-logo` im Text wird nichts angehängt — eine Mail mit einem
 * Bild, das nirgends vorkommt, zeigen manche Programme als „Anhang" an.
 */
export function logoAnhang(html: string): { filename: string; path: string; cid: string }[] {
  if (!html.includes('cid:vh-logo')) return []
  const ordner = path.join(process.cwd(), 'public')
  // Die weiße Fassung zuerst; die alte bleibt der Rückfall, damit ein Stand
  // ohne die neue Datei nicht ohne Kopf verschickt
  for (const name of ['logo-mail.png', 'logo.png']) {
    const datei = path.join(ordner, name)
    if (fs.existsSync(datei)) return [{ filename: name, path: datei, cid: 'vh-logo' }]
  }
  return []
}

function orderTable(order: OrderLike, company?: CompanyInfo, sprache: Locale = 'de'): string {
  const w = WORTE[sprache]
  const rows = (order.items ?? [])
    .map((item) => {
      const label = [item.titleSnapshot, item.variantTitle, item.color].filter(Boolean).join(' – ')
      return `<tr>
        <td style="padding:6px 12px 6px 0">${item.quantity}×</td>
        <td style="padding:6px 12px 6px 0">${label}</td>
        <td style="padding:6px 0;text-align:right">${euro(item.unitPrice * item.quantity)}</td>
      </tr>`
    })
    .join('')

  const discountRow =
    order.discount && order.discount > 0
      ? `<tr><td></td><td style="padding:6px 12px 6px 0">${w.rabatt}${order.promotionTitle ? ` (${order.promotionTitle})` : ''}</td><td style="text-align:right">−${euro(order.discount)}</td></tr>`
      : ''

  const shippingRow =
    order.shippingTotal && order.shippingTotal > 0
      ? `<tr><td></td><td style="padding:2px 12px 2px 0">${w.versand}</td><td style="text-align:right">${euro(order.shippingTotal)}</td></tr>`
      : ''

  return `<table style="border-collapse:collapse;font-size:14px">
    ${rows}
    <tr><td colspan="3" style="border-top:1px solid #ddd;padding-top:8px"></td></tr>
    <tr><td></td><td style="padding:2px 12px 2px 0">${w.zwischensumme}</td><td style="text-align:right">${euro(order.subtotal)}</td></tr>
    ${discountRow}
    ${shippingRow}
    <tr><td></td><td style="padding:6px 12px 2px 0;font-weight:bold">${w.gesamt}</td><td style="text-align:right;font-weight:bold">${euro(order.total)}</td></tr>
    ${vatRow(order, company, sprache)}
  </table>`
}

function addressBlock(order: OrderLike, sprache: Locale = 'de'): string {
  if (order.deliveryMethod === 'pickup') return WORTE[sprache].abholungHinweis
  const a = order.shippingAddress
  if (!a) return ''
  return [order.customer?.name, a.line1, a.line2, `${a.postalCode ?? ''} ${a.city ?? ''}`, a.country]
    .filter(Boolean)
    .join('<br>')
}

/**
 * Link auf die Bestellstatus-Seite — dauerhaft gültig, verbraucht nichts.
 *
 * Die Sprache steht im Pfad. Vorher stand dort fest `/de/`: Wer auf
 * Französisch bestellt hatte, landete auf einer deutschen Seite und musste
 * oben erst umschalten.
 */
function statusLink(order: OrderLike, sprache: Locale = 'de'): string {
  if (!order.accessToken) return ''
  const basis = process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || ''
  const url = `${basis}/${sprache}/bestellung/${order.accessToken}`
  return `<p style="margin-top:20px"><a href="${url}" style="color:#1d1d1f">${WORTE[sprache].stand}</a></p>`
}

/** Hinweis auf die Einzelfertigung, wenn ein Zeitraum bekannt ist */
function fertigungsHinweis(order: OrderLike, hinweis?: string | null): string {
  const teile = [
    hinweis?.trim()
      ? `<p style="color:#666;font-size:13px">${hinweis.trim()}</p>`
      : '',
    order.expectedReady
      ? `<p><strong>Voraussichtlich fertig:</strong> ${order.expectedReady}</p>`
      : '',
  ].filter(Boolean)
  return teile.join('')
}

export function orderConfirmationEmail(
  order: OrderLike,
  company?: CompanyInfo,
  craftNotice?: string | null,
) {
  return {
    to: order.customer?.email ?? '',
    subject: `Bestellbestätigung ${order.orderNumber} – Vincent Hellmann`,
    html: briefbogen(
      `<p>Guten Tag ${order.customer?.name ?? ''},</p>
        <p>vielen Dank für Ihre Bestellung <strong>${order.orderNumber}</strong>.
        Ihre Zahlung ist bei uns eingegangen. Ihr Stück wird jetzt für Sie gefertigt — wir melden uns,
        sobald es in die Werkstatt geht.</p>
        ${fertigungsHinweis(order, craftNotice)}
        ${ueberschrift('Ihre Bestellung')}
        ${orderTable(order, company)}
        ${ueberschrift(order.deliveryMethod === 'pickup' ? 'Abholung' : 'Lieferadresse')}
        <p>${addressBlock(order)}</p>
        ${statusLink(order)}
        <p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>`,
      company,
    ),
  }
}

export function orderNotificationEmail(order: OrderLike, to: string, company?: CompanyInfo) {
  return {
    to,
    subject: `Neue Bestellung ${order.orderNumber} (${euro(order.total)})`,
    html: briefbogen(
      `${ueberschrift(`Neue bezahlte Bestellung ${order.orderNumber}`, true)}
        <p>Kunde: ${order.customer?.name ?? ''} (${order.customer?.email ?? ''})</p>
        ${orderTable(order, company)}
        ${ueberschrift(order.deliveryMethod === 'pickup' ? 'Abholung' : 'Lieferadresse')}
        <p>${addressBlock(order)}</p>
        <p>Der Vorgang steht im Büro unter „Bestellungen".</p>`,
      company,
      false,
    ),
  }
}

export function orderInProductionEmail(order: OrderLike, craftNotice?: string | null) {
  return {
    to: order.customer?.email ?? '',
    subject: `Ihre Bestellung ${order.orderNumber} ist in Fertigung – Vincent Hellmann`,
    html: briefbogen(
      `<p>Guten Tag ${order.customer?.name ?? ''},</p>
        <p>Ihre Bestellung <strong>${order.orderNumber}</strong> ist in der Werkstatt und wird jetzt
        gefertigt. Sobald sie unterwegs ist, bekommen Sie die Sendungsnummer von uns.</p>
        ${fertigungsHinweis(order, craftNotice)}
        ${statusLink(order)}
        <p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>`,
    ),
  }
}

export function orderShippedEmail(order: OrderLike) {
  const tracking = order.trackingNumber
    ? `<p><strong>Sendungsverfolgung:</strong> ${
        order.trackingUrl
          ? `<a href="${order.trackingUrl}">${order.trackingNumber}</a>`
          : order.trackingNumber
      }</p>`
    : ''
  return {
    to: order.customer?.email ?? '',
    subject: `Ihre Bestellung ${order.orderNumber} ist unterwegs – Vincent Hellmann`,
    html: briefbogen(
      `<p>Guten Tag ${order.customer?.name ?? ''},</p>
        <p>gute Nachrichten: Ihre Bestellung <strong>${order.orderNumber}</strong> wurde soeben versendet.</p>
        ${tracking}
        ${ueberschrift('Lieferadresse')}
        <p>${addressBlock(order)}</p>
        ${statusLink(order)}
        <p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>`,
    ),
  }
}

/**
 * Bitte um eine Kundenstimme, ein paar Wochen nach der Lieferung.
 *
 * Warum nicht sofort? Weil die Stimme dann nichts über das Stück aussagt,
 * sondern über die Vorfreude. Nach zwei Wochen steht es an seinem Platz, und
 * die Kundschaft weiß, ob es hält, was es versprochen hat.
 */
export function reviewRequestEmail(order: OrderLike, link: string, company?: CompanyInfo) {
  const stueck = order.items?.[0]?.titleSnapshot
  return {
    to: order.customer?.email ?? '',
    subject: `Wie steht es bei Ihnen? – Vincent Hellmann`,
    html: briefbogen(
      `<p>Guten Tag ${order.customer?.name ?? ''},</p>
        <p>vor einigen Wochen haben wir Ihnen ${
          stueck ? `<strong>${stueck}</strong>` : 'Ihre Bestellung'
        } geschickt. Wir hoffen, es hat seinen Platz gefunden.</p>
        <p>Wenn Sie kurz beschreiben mögen, wie es bei Ihnen wirkt, würden wir uns freuen — zwei, drei Sätze genügen. Wir veröffentlichen nur, was Sie uns dafür freigeben, und nur unter dem Namen, den Sie angeben.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 22px;display:inline-block;font-size:13px">Ein paar Sätze schreiben</a>
        </p>
        <p style="color:#666;font-size:12px">Keine Lust? Dann ignorieren Sie diese Mail einfach — wir fragen kein zweites Mal.</p>
        <p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>`,
      company,
    ),
  }
}

export function contactEmail(
  data: {
    name: string
    email: string
    phone?: string
    message: string
    productTitle?: string
    productUrl?: string
  },
  to: string,
) {
  const isProductInquiry = Boolean(data.productTitle)
  return {
    to,
    replyTo: data.email,
    subject: isProductInquiry
      ? `Produktanfrage: ${data.productTitle} (von ${data.name})`
      : `Kontaktanfrage von ${data.name}`,
    html: briefbogen(
      `${ueberschrift(
        isProductInquiry ? 'Neue Produktanfrage über die Website' : 'Neue Kontaktanfrage über die Website',
        true,
      )}
        ${
          isProductInquiry
            ? `<p><strong>Produkt:</strong> ${data.productTitle}${data.productUrl ? ` — <a href="${data.productUrl}">${data.productUrl}</a>` : ''}</p>`
            : ''
        }
        <p><strong>Name:</strong> ${data.name}<br>
        <strong>E-Mail:</strong> ${data.email}<br>
        ${data.phone ? `<strong>Telefon:</strong> ${data.phone}<br>` : ''}</p>
        <p style="white-space:pre-line;border-left:3px solid ${BRONZE};padding-left:12px">${data.message}</p>`,
      undefined,
      false,
    ),
  }
}

/**
 * Der sechsstellige Code — für die Kasse und für das Kundenportal.
 *
 * Beide Mails standen vorher als selbstgebautes `<div>` in ihrer Route: ohne
 * Logo, ohne Corten-Strich, ohne die Pflichtangaben, die in Frankreich unter
 * jede geschäftliche Mail gehören — und nur auf Deutsch. Wer eine solche Mail
 * bekommt, hält sie im Zweifel für einen Betrugsversuch und gibt den Code
 * lieber nicht ein. Deshalb liegt sie jetzt hier, im Briefbogen des Hauses.
 *
 * Der Code steht auch im Betreff: Er ist auf dem Sperrbildschirm zu lesen, und
 * die Mail muss dafür nicht geöffnet werden.
 */
export function zugangscodeEmail(
  code: string,
  zweck: 'bestellung' | 'anmeldung',
  sprache: Locale = 'de',
  company?: CompanyInfo,
) {
  const texte: Record<Locale, { betreff: string; einleitung: string; hinweis: string }> = {
    de: {
      betreff:
        zweck === 'bestellung'
          ? `Ihr Bestätigungscode: ${code} – Vincent Hellmann`
          : `Ihr Anmeldecode: ${code} – Vincent Hellmann`,
      einleitung:
        zweck === 'bestellung'
          ? 'Ihr Code, um die Bestellung abzuschließen:'
          : 'Ihr Anmeldecode für Ihre Übersicht:',
      hinweis:
        zweck === 'bestellung'
          ? 'Der Code gilt 10 Minuten. Wenn Sie nichts bestellt haben, können Sie diese Nachricht einfach löschen — ohne den Code passiert nichts.'
          : 'Der Code gilt 10 Minuten. Wenn Sie ihn nicht angefordert haben, können Sie diese Nachricht einfach löschen — ohne den Code passiert nichts.',
    },
    fr: {
      betreff:
        zweck === 'bestellung'
          ? `Votre code de confirmation : ${code} – Vincent Hellmann`
          : `Votre code de connexion : ${code} – Vincent Hellmann`,
      einleitung:
        zweck === 'bestellung'
          ? 'Votre code pour finaliser la commande :'
          : 'Votre code de connexion à votre espace :',
      hinweis:
        zweck === 'bestellung'
          ? "Le code est valable 10 minutes. Si vous n'avez rien commandé, vous pouvez simplement supprimer ce message — sans le code, il ne se passe rien."
          : "Le code est valable 10 minutes. Si vous ne l'avez pas demandé, vous pouvez simplement supprimer ce message — sans le code, il ne se passe rien.",
    },
    en: {
      betreff:
        zweck === 'bestellung'
          ? `Your confirmation code: ${code} – Vincent Hellmann`
          : `Your sign-in code: ${code} – Vincent Hellmann`,
      einleitung:
        zweck === 'bestellung'
          ? 'Your code to complete the order:'
          : 'Your sign-in code for your overview:',
      hinweis:
        zweck === 'bestellung'
          ? 'The code is valid for 10 minutes. If you did not place an order, simply delete this message — nothing happens without the code.'
          : 'The code is valid for 10 minutes. If you did not request it, simply delete this message — nothing happens without the code.',
    },
  }
  const t = texte[sprache] ?? texte.de

  return {
    subject: t.betreff,
    html: briefbogen(
      `<p>${t.einleitung}</p>
        <p style="font-size:30px;letter-spacing:8px;font-weight:bold;margin:18px 0">${code}</p>
        <p style="color:#666;font-size:13px">${t.hinweis}</p>`,
      company,
    ),
  }
}

/**
 * Kauf auf Rechnung: die Eingangsbestätigung.
 *
 * Anders als bei PayPal ist hier noch nichts bezahlt — diese Mail bestätigt
 * den Eingang und sagt, was als Nächstes kommt. Sie trägt trotzdem alles, was
 * eine Bestellbestätigung tragen muss: was bestellt wurde, was es kostet,
 * wohin es geht. Vorher stand dort ein einziger Satz ohne Zahlen; wer wissen
 * wollte, worüber die angekündigte Rechnung lauten würde, musste warten.
 */
export function rechnungskaufEmail(
  order: OrderLike,
  sprache: Locale = 'de',
  company?: CompanyInfo,
  craftNotice?: string | null,
) {
  const texte: Record<Locale, { betreff: string; anrede: string; text: string }> = {
    de: {
      betreff: `Ihre Bestellung ${order.orderNumber} ist eingegangen – Vincent Hellmann`,
      anrede: 'Guten Tag',
      text: `vielen Dank für Ihre Bestellung <strong>${order.orderNumber}</strong>. Sie erhalten in Kürze die Rechnung per E-Mail — mit einem QR-Code, den Sie einfach mit Ihrer Banking-App scannen. Die Fertigung beginnt, sobald die Zahlung eingegangen ist.`,
    },
    fr: {
      betreff: `Votre commande ${order.orderNumber} est bien reçue – Vincent Hellmann`,
      anrede: 'Bonjour',
      text: `merci pour votre commande <strong>${order.orderNumber}</strong>. Vous recevrez prochainement la facture par e-mail — avec un QR code à scanner avec votre application bancaire. La fabrication démarre dès réception du paiement.`,
    },
    en: {
      betreff: `Your order ${order.orderNumber} has been received – Vincent Hellmann`,
      anrede: 'Hello',
      text: `thank you for your order <strong>${order.orderNumber}</strong>. You will shortly receive the invoice by email — with a QR code you can scan with your banking app. Production starts once the payment has arrived.`,
    },
  }
  const t = texte[sprache] ?? texte.de
  const w = WORTE[sprache] ?? WORTE.de

  return {
    to: order.customer?.email ?? '',
    subject: t.betreff,
    html: briefbogen(
      `<p>${t.anrede} ${order.customer?.name ?? ''},</p>
        <p>${t.text}</p>
        ${craftNotice?.trim() ? `<p style="color:#666;font-size:13px">${craftNotice.trim()}</p>` : ''}
        ${ueberschrift(w.bestellung)}
        ${orderTable(order, company, sprache)}
        ${ueberschrift(order.deliveryMethod === 'pickup' ? w.abholung : w.lieferadresse)}
        <p>${addressBlock(order, sprache)}</p>
        ${statusLink(order, sprache)}
        <p style="margin-top:24px">${w.gruss}<br>Vincent Hellmann</p>`,
      company,
    ),
  }
}

/* ══ Statusmeldungen am Auftrag ═══════════════════════════════════════════════

   Warum eigene Vorlagen und nicht die der Bestellung: Ein Auftrag hat eine
   Auftragsnummer und eine Bezeichnung, keine Positionsliste mit Preisen und
   keinen Zugangstoken. Die Bestellvorlagen darauf zu biegen hieße, in jeder
   Zeile eine Ausnahme zu prüfen — und die Kundschaft im Projektgeschäft bekäme
   Mails, die von „Ihrer Bestellung" reden, obwohl sie nie bestellt hat.

   Verlinkt wird ins Kundenportal statt auf eine Bestellseite: Aufträge sind
   dort ohnehin sichtbar, sobald die Adresse zu einem Geschäftspartner gehört
   (siehe portalDaten.ts). Ein eigener Token wäre eine zweite Tür für dasselbe
   Zimmer. */

export type AuftragLike = {
  jobNumber?: string | null
  title?: string | null
  dueDate?: string | null
  lieferart?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
}

const AUFTRAGSWORTE: Record<
  Locale,
  {
    anrede: (name: string) => string
    auftrag: string
    inFertigung: (nr: string) => string
    inFertigungText: string
    termin: (datum: string) => string
    fertig: (nr: string) => string
    fertigVersand: string
    fertigAbholung: string
    geliefert: (nr: string) => string
    geliefertText: string
    sendung: string
    portal: string
    gruss: string
  }
> = {
  de: {
    anrede: (name) => `Guten Tag ${name}`,
    auftrag: 'Auftrag',
    inFertigung: (nr) => `Ihr Auftrag ${nr} ist in Fertigung – Vincent Hellmann`,
    inFertigungText:
      'Ihr Auftrag liegt jetzt in der Werkstatt. Wir melden uns wieder, sobald er fertig ist.',
    termin: (datum) => `Vorgesehen bis: <strong>${datum}</strong>`,
    fertig: (nr) => `Ihr Auftrag ${nr} ist fertig – Vincent Hellmann`,
    fertigVersand:
      'Ihr Auftrag ist fertig. Wir stimmen die Lieferung mit Ihnen ab und melden uns dazu.',
    fertigAbholung:
      'Ihr Auftrag ist fertig und steht zur Abholung bereit. Melden Sie sich gern für einen Termin.',
    geliefert: (nr) => `Ihr Auftrag ${nr} ist unterwegs – Vincent Hellmann`,
    geliefertText: 'Ihr Auftrag hat die Werkstatt verlassen.',
    sendung: 'Sendungsverfolgung',
    portal: 'Ihre Vorgänge im Kundenbereich ansehen',
    gruss: 'Mit freundlichen Grüßen',
  },
  fr: {
    anrede: (name) => `Bonjour ${name}`,
    auftrag: 'Commande',
    inFertigung: (nr) => `Votre commande ${nr} est en fabrication – Vincent Hellmann`,
    inFertigungText:
      "Votre commande est à l'atelier. Nous vous recontactons dès qu'elle est terminée.",
    termin: (datum) => `Prévu pour le : <strong>${datum}</strong>`,
    fertig: (nr) => `Votre commande ${nr} est terminée – Vincent Hellmann`,
    fertigVersand:
      'Votre commande est terminée. Nous convenons de la livraison avec vous et revenons vers vous.',
    fertigAbholung:
      'Votre commande est terminée et prête à être retirée. Contactez-nous pour convenir d’un rendez-vous.',
    geliefert: (nr) => `Votre commande ${nr} est en route – Vincent Hellmann`,
    geliefertText: "Votre commande a quitté l'atelier.",
    sendung: 'Suivi de colis',
    portal: 'Consulter vos dossiers dans votre espace client',
    gruss: 'Cordialement',
  },
  en: {
    anrede: (name) => `Hello ${name}`,
    auftrag: 'Order',
    inFertigung: (nr) => `Your order ${nr} is in production – Vincent Hellmann`,
    inFertigungText:
      'Your order is now in the workshop. We will be in touch again as soon as it is finished.',
    termin: (datum) => `Planned for: <strong>${datum}</strong>`,
    fertig: (nr) => `Your order ${nr} is finished – Vincent Hellmann`,
    fertigVersand:
      'Your order is finished. We will arrange delivery with you and get back to you shortly.',
    fertigAbholung:
      'Your order is finished and ready for collection. Get in touch to arrange a time.',
    geliefert: (nr) => `Your order ${nr} is on its way – Vincent Hellmann`,
    geliefertText: 'Your order has left the workshop.',
    sendung: 'Tracking',
    portal: 'View your projects in the customer area',
    gruss: 'Kind regards',
  },
}

/** Link ins Kundenportal — dort stehen Aufträge, Angebote und Rechnungen */
function portalLink(sprache: Locale): string {
  const basis = process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || ''
  if (!basis) return ''
  return `<p style="margin-top:20px"><a href="${basis}/${sprache}/konto" style="color:#1d1d1f">${AUFTRAGSWORTE[sprache].portal}</a></p>`
}

/** Kopf und Fuß sind bei allen drei Meldungen gleich — nur der Rumpf wechselt */
function auftragsMail(
  auftrag: AuftragLike,
  kundeName: string,
  sprache: Locale,
  betreff: string,
  rumpf: string,
  firma?: CompanyInfo,
) {
  const w = AUFTRAGSWORTE[sprache]
  const bezeichnung = auftrag.title?.trim()
  return {
    subject: betreff,
    html: briefbogen(
      `<p>${w.anrede(kundeName)},</p>
        ${rumpf}
        <p style="color:#666;font-size:13px">${w.auftrag} <strong>${auftrag.jobNumber ?? ''}</strong>${
          bezeichnung ? ` — ${bezeichnung}` : ''
        }</p>
        ${portalLink(sprache)}
        <p style="margin-top:24px">${w.gruss}<br>Vincent Hellmann</p>`,
      firma,
    ),
  }
}

export function auftragInFertigungEmail(
  auftrag: AuftragLike,
  kundeName: string,
  sprache: Locale = 'de',
  firma?: CompanyInfo,
) {
  const w = AUFTRAGSWORTE[sprache]
  // Der Termin steht nur dabei, wenn einer gesetzt ist — eine Zusage, die man
  // nicht gemacht hat, soll nicht aus einer Statusmail entstehen
  const termin = auftrag.dueDate
    ? `<p>${w.termin(new Date(auftrag.dueDate).toLocaleDateString(sprache === 'de' ? 'de-DE' : sprache === 'fr' ? 'fr-FR' : 'en-GB'))}</p>`
    : ''
  return auftragsMail(
    auftrag,
    kundeName,
    sprache,
    w.inFertigung(auftrag.jobNumber ?? ''),
    `<p>${w.inFertigungText}</p>${termin}`,
    firma,
  )
}

export function auftragFertigEmail(
  auftrag: AuftragLike,
  kundeName: string,
  sprache: Locale = 'de',
  firma?: CompanyInfo,
) {
  const w = AUFTRAGSWORTE[sprache]
  const text = auftrag.lieferart === 'abholung' ? w.fertigAbholung : w.fertigVersand
  return auftragsMail(
    auftrag,
    kundeName,
    sprache,
    w.fertig(auftrag.jobNumber ?? ''),
    `<p>${text}</p>`,
    firma,
  )
}

export function auftragGeliefertEmail(
  auftrag: AuftragLike,
  kundeName: string,
  sprache: Locale = 'de',
  firma?: CompanyInfo,
) {
  const w = AUFTRAGSWORTE[sprache]
  // Ohne Sendungsnummer geht die Meldung trotzdem raus: Vincent liefert oft
  // selbst, und dann gibt es schlicht nichts zu verfolgen.
  const sendung = auftrag.trackingNumber
    ? `<p><strong>${w.sendung}:</strong> ${
        auftrag.trackingUrl
          ? `<a href="${auftrag.trackingUrl}">${auftrag.trackingNumber}</a>`
          : auftrag.trackingNumber
      }</p>`
    : ''
  return auftragsMail(
    auftrag,
    kundeName,
    sprache,
    w.geliefert(auftrag.jobNumber ?? ''),
    `<p>${w.geliefertText}</p>${sendung}`,
    firma,
  )
}
