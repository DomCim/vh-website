/**
 * Erzeugt PDF und Mail-HTML zum Ansehen — dieselben Funktionen wie im Versand,
 * damit die Vorschau nicht schöner ist als die Wirklichkeit.
 */
import { writeFileSync } from 'fs'

import { rechnungPdf } from '../src/lib/invoice'
import { orderConfirmationEmail } from '../src/lib/mail'
import { briefbogen } from '../src/lib/postfach'

const AUS = '/tmp/claude-0/-home-user-vh-website/a0d5393f-bc69-517d-81b8-6de4b31084e3/scratchpad'

const firma = {
  name: 'Vincent Hellmann',
  legalName: 'Vincent Hellmann',
  legalForm: 'SAS',
  shareCapital: 10000,
  address: '12 rue des Artisans, 67000 Strasbourg',
  siret: '123 456 789 00012',
  vatId: 'FR12345678900',
  rcsNumber: '123 456 789',
  rcsCity: 'Strasbourg',
  vatRate: 20,
  paymentTerms: '30 Tage netto',
}

const pdf = await rechnungPdf(
  {
    art: 'angebot',
    nummer: 'AN-2026-0003',
    datum: '2026-08-18',
    gueltigBis: '2026-09-17',
    fertigungszeit: '6–8 Wochen ab Auftrag',
    fassung: 2,
    preiseSind: 'netto',
    empfaenger: {
      name: 'Gemeinde Naila',
      anschrift: ['Marktplatz 1', '95119 Naila', 'Deutschland'],
      email: 'bauamt@naila.de',
    },
    positionen: [
      { bezeichnung: 'Sitzbank Corten, 2 m', zusatz: null, menge: 6, einzelpreis: 1250, steuersatz: 20 },
      { bezeichnung: 'Pflanzkübel 80 × 80 cm', zusatz: null, menge: 3, einzelpreis: 640, steuersatz: 20 },
    ],
    rabatt: { bezeichnung: 'Projektnachlass', betrag: 525 },
    hinweis: 'Montage vor Ort nach Absprache. Lieferung frei Baustelle.',
  },
  firma,
)
writeFileSync(`${AUS}/kunde-angebot.pdf`, pdf)

const text = `Guten Tag Gemeinde Naila,

anbei unser Angebot AN-2026-0003 (Fassung 2) vom 18.08.2026.
Es gilt bis zum 17.09.2026.
Fertigungszeit: 6–8 Wochen ab Auftrag.

Für Rückfragen stehe ich gern zur Verfügung.`

const signatur = ['Mit freundlichen Grüßen', 'Vincent Hellmann', 'info@vincent-hellmann.com', '+33 3 88 00 00 00'].join('\n')

const html = briefbogen(text, signatur, firma)
  // Fürs Ansehen das eingebettete Logo durch die Datei ersetzen
  .replace('cid:vh-logo', 'file:///home/user/vh-website/public/logo.png')

writeFileSync(
  `${AUS}/kunde-mail.html`,
  `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f2f2f2;padding:28px">
   <div style="background:#fff;padding:28px;max-width:620px;margin:0 auto;box-shadow:0 1px 4px rgba(0,0,0,.12)">
   <div style="font-size:12px;color:#888;border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:18px">
   Von: Vincent Hellmann &lt;info@vincent-hellmann.com&gt;<br>An: bauamt@naila.de<br>
   Betreff: <strong>Angebot AN-2026-0003 (Fassung 2)</strong> &nbsp;·&nbsp; 📎 AN-2026-0003.pdf</div>
   ${html}</div></body>`,
)
// Und die Bestellbestätigung, die der Shop verschickt
const bestellung = orderConfirmationEmail(
  {
    orderNumber: 'VH-2026-0042',
    total: 1490,
    subtotal: 1400,
    shippingTotal: 90,
    deliveryMethod: 'shipping',
    accessToken: 'abc123',
    items: [
      { titleSnapshot: 'Feuerschale Corten', variantTitle: '80 cm', color: null, quantity: 1, unitPrice: 1400 },
    ],
    customer: { name: 'Familie Berger', email: 'berger@example.com' },
    shippingAddress: { line1: 'Am Anger 12', postalCode: '95119', city: 'Naila', country: 'Deutschland' },
  },
  firma,
  'Jedes Stück entsteht einzeln in unserer Werkstatt.',
)

writeFileSync(
  `${AUS}/kunde-bestellung.html`,
  `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f2f2f2;padding:28px">
   <div style="background:#fff;padding:28px;max-width:620px;margin:0 auto;box-shadow:0 1px 4px rgba(0,0,0,.12)">
   <div style="font-size:12px;color:#888;border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:18px">
   Von: Vincent Hellmann &lt;noreply@vincent-hellmann.com&gt;<br>An: berger@example.com<br>
   Betreff: <strong>${bestellung.subject}</strong> &nbsp;·&nbsp; 📎 Rechnung-VH-2026-0042.pdf</div>
   ${bestellung.html.replace('cid:vh-logo', 'file:///home/user/vh-website/public/logo.png')}</div></body>`,
)

console.log('PDF und beide Mails geschrieben.')
