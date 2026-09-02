import type { Payload } from 'payload'

import { richText } from './richtext'

/**
 * Die Pflichttexte des Shops — Impressum, Datenschutz, AGB, Widerruf,
 * Muster-Widerrufsformular sowie Versand und Zahlung.
 *
 * **Warum sie im Code stehen.** Weil leere Rechtsseiten schlimmer sind als
 * gute Vorbelegungen: Wer an Verbraucher verkauft, braucht sie ab dem ersten
 * Tag. Fehlt die Widerrufsbelehrung, verlängert sich die Frist von vierzehn
 * Tagen auf ein Jahr und vierzehn Tage; fehlt das Impressum, ist das in
 * Frankreich eine Ordnungswidrigkeit. Eine frisch aufgesetzte Datenbank soll
 * deshalb nicht mit „Platzhalter: bitte einfügen" online gehen.
 *
 * **Der Betrieb sitzt in Frankreich.** Next-Concept SAS in Lauterbourg im
 * Elsass — und daran hängt mehr, als man zuerst denkt: Es gilt der Code de la
 * consommation und nicht das BGB, die Aufsichtsbehörde ist die CNIL, das
 * Impressum folgt der LCEN (Herausgeber, Rechtsform, Kapital, RCS, SIRET,
 * TVA, Verlagsleiter **und** der Hoster), und für Streitigkeiten mit
 * Verbrauchern muss eine Schlichtungsstelle benannt sein. Die deutsche
 * Fassung ist deshalb eine Übersetzung dieser Rechtslage und keine deutsche
 * Rechtslage — wer hier „§ 5 TMG" oder „Wir sind nicht bereit, an einem
 * Schlichtungsverfahren teilzunehmen" hineinschreibt, hat es genau falsch
 * herum.
 *
 * **Alles Veränderliche kommt aus den Einstellungen.** Firmierung, Anschrift,
 * RCS, SIRET, TVA und die Schlichtungsstelle stehen unter „Firmen-/
 * Steuerangaben" und werden hier eingesetzt. Was dort leer ist, steht als
 * `[…]` im Text — sichtbar und damit auffindbar, statt still zu fehlen.
 * Ausgeschrieben wird nichts, was sich ändern kann: Eine Nummer, die an zwei
 * Stellen gepflegt werden muss, ist an einer davon irgendwann falsch.
 *
 * **Ein Prüfhinweis steht nicht mehr darunter** (Entscheidung Dominik,
 * 09/2026). Er stand am Ende jedes Textes und richtete sich an den Betrieb —
 * gelesen hat ihn die Kundschaft. Ein Rechtstext, der sich selbst als Entwurf
 * bezeichnet, ist als Rechtstext wertlos: Er belehrt nicht, er relativiert.
 */

type Sprache = 'de' | 'fr' | 'en'

export type Firmenangaben = {
  name?: string | null
  anschrift?: string | null
  email?: string | null
  telefon?: string | null
  rechtsform?: string | null
  stammkapital?: number | null
  rcsNummer?: string | null
  rcsStadt?: string | null
  siret?: string | null
  vatId?: string | null
  /** Verbraucherschlichtungsstelle — in Frankreich Pflicht (Art. L612-1 Code de la consommation) */
  schlichtung?: string | null
}

/** Fehlt eine Angabe, steht sie als `[…]` im Text — sichtbar statt still weg. */
const luecke = (was: Record<Sprache, string>, sprache: Sprache) => `[${was[sprache]}]`

/**
 * Das Land in der Sprache des Textes.
 *
 * Die Anschrift steht in den Einstellungen so da, wie sie jemand eingetippt
 * hat — auf Deutsch. In der französischen Widerrufsbelehrung stand deshalb
 * „67630 Lauterbourg, Frankreich": ein deutsches Wort mitten in einem
 * französischen Pflichttext. Übersetzt wird nur die letzte Zeile und nur,
 * wenn sie ein Land ist, das hier vorkommt; alles andere — Straße, Ort — ist
 * ein Eigenname und bleibt, wie es ist.
 */
const LAENDER: Record<string, Record<Sprache, string>> = {
  frankreich: { de: 'Frankreich', fr: 'France', en: 'France' },
  france: { de: 'Frankreich', fr: 'France', en: 'France' },
  deutschland: { de: 'Deutschland', fr: 'Allemagne', en: 'Germany' },
  allemagne: { de: 'Deutschland', fr: 'Allemagne', en: 'Germany' },
  germany: { de: 'Deutschland', fr: 'Allemagne', en: 'Germany' },
}

/** Die Anschrift einzeilig, wie sie in einen Satz gehört. */
function anschriftZeile(angaben: Firmenangaben, sprache: Sprache): string {
  const roh = angaben.anschrift?.trim()
  if (!roh) return luecke({ de: 'Anschrift', fr: 'Adresse', en: 'Address' }, sprache)
  // Zeilenumbrüche werden zu Kommas — und das Leerzeichen davor fällt weg,
  // sonst steht „avenue Clemenceau , 67630" im Text.
  const zeilen = roh
    .split('\n')
    .map((z) => z.trim())
    .filter(Boolean)
  const letzte = zeilen[zeilen.length - 1]
  const land = LAENDER[letzte?.toLocaleLowerCase('de') ?? '']
  if (land) zeilen[zeilen.length - 1] = land[sprache]
  return zeilen.join(', ')
}

/** Firma, Anschrift und Kontakt in einer Zeile — für „schreiben Sie uns an: …" */
function werWirSind(angaben: Firmenangaben, sprache: Sprache): string {
  const teile = [
    angaben.name?.trim(),
    anschriftZeile(angaben, sprache),
    angaben.email?.trim(),
    angaben.telefon?.trim(),
  ].filter(Boolean)
  if (teile.length > 1) return teile.join(' · ')
  return luecke(
    {
      de: 'Firmenname, Anschrift, E-Mail, Telefon',
      fr: 'Raison sociale, adresse, courriel, téléphone',
      en: 'Company, address, email, phone',
    },
    sprache,
  )
}

const firma = (angaben: Firmenangaben, sprache: Sprache) =>
  angaben.name?.trim() ||
  luecke({ de: 'Firmenname', fr: 'Raison sociale', en: 'Company name' }, sprache)

const schlichtungsstelle = (angaben: Firmenangaben, sprache: Sprache) =>
  angaben.schlichtung?.trim().replace(/\n/g, ', ') ||
  luecke(
    {
      de: 'Name und Anschrift der Verbraucherschlichtungsstelle',
      fr: 'Nom et adresse du médiateur de la consommation',
      en: 'Name and address of the consumer mediation body',
    },
    sprache,
  )


/**
 * Impressum — nach französischem Recht (Art. 6 III LCEN, Art. R123-237 Code
 * de commerce). Verlangt sind: Herausgeber, Rechtsform und Kapital,
 * Anschrift, Kontakt, RCS und SIRET, TVA-Nummer, der Verlagsleiter und —
 * anders als in Deutschland — **der Hoster mit Namen und Anschrift**.
 */
function impressum(angaben: Firmenangaben, sprache: Sprache): string {
  const rechtsform = angaben.rechtsform?.trim() || 'SAS'
  const kapital =
    typeof angaben.stammkapital === 'number'
      ? new Intl.NumberFormat(sprache === 'de' ? 'de-DE' : sprache === 'fr' ? 'fr-FR' : 'en-GB', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0,
        }).format(angaben.stammkapital)
      : null
  const anschrift = anschriftZeile(angaben, sprache)

  const person = (de: string, fr: string, en: string) =>
    luecke({ de, fr, en }, sprache)

  if (sprache === 'fr') {
    const leitung = person('Name', 'Prénom et nom du président', 'Name')
    const hoster = person('Hoster', "Nom, adresse et téléphone de l'hébergeur", 'Host')
    return [
      '## Éditeur du site',
      `${firma(angaben, sprache)}, ${anschrift}`,
      '## Forme juridique et représentation',
      [
        `- Forme juridique : **${rechtsform}**`,
        kapital ? `- Capital social : ${kapital}` : null,
        `- Représentée par son président : ${leitung}`,
      ]
        .filter(Boolean)
        .join('\n'),
      '## Contact',
      [
        `- Téléphone : ${angaben.telefon?.trim() || person('Telefon', 'Téléphone', 'Phone')}`,
        `- Courriel : ${angaben.email?.trim() || person('E-Mail', 'Courriel', 'Email')}`,
      ].join('\n'),
      '## Immatriculation',
      [
        `- Registre du commerce : **${angaben.rcsStadt?.trim() || person('RCS', "Ville du RCS", 'RCS city')}**`,
        `- Numéro d'immatriculation : ${angaben.rcsNummer?.trim() || person('RCS-Nummer', "Numéro RCS", 'RCS number')}`,
        `- SIRET : ${angaben.siret?.trim() || person('SIRET', 'SIRET', 'SIRET')}`,
      ].join('\n'),
      '## TVA',
      `Numéro de TVA intracommunautaire : **${angaben.vatId?.trim() || person('TVA', 'Numéro de TVA', 'VAT number')}**`,
      '## Directeur de la publication',
      `${leitung}, adresse ci-dessus.`,
      '## Hébergement',
      `Ce site est hébergé par : ${hoster}`,
      '## Médiation de la consommation',
      `Conformément aux articles L612-1 et suivants du code de la consommation, tout consommateur a le droit de recourir gratuitement à un médiateur de la consommation. Le médiateur dont nous relevons est : ${schlichtungsstelle(angaben, sprache)}.`,
      '## Activité',
      "Construction métallique et fabrication, exercées en France.",
      '## Crédits photographiques',
      "Toutes les images montrent des pièces de notre propre fabrication et proviennent de l'atelier.",
    ].join('\n\n')
  }

  if (sprache === 'en') {
    const leitung = person('Name', 'Nom', 'Name of the president')
    const hoster = person('Hoster', 'Hébergeur', 'Name, address and phone of the host')
    return [
      '## Publisher',
      `${firma(angaben, sprache)}, ${anschrift}`,
      '## Legal form and representation',
      [
        `- Legal form: **${rechtsform}** (société par actions simplifiée, France)`,
        kapital ? `- Share capital: ${kapital}` : null,
        `- Represented by its president: ${leitung}`,
      ]
        .filter(Boolean)
        .join('\n'),
      '## Contact',
      [
        `- Phone: ${angaben.telefon?.trim() || person('Telefon', 'Téléphone', 'Phone')}`,
        `- Email: ${angaben.email?.trim() || person('E-Mail', 'Courriel', 'Email')}`,
      ].join('\n'),
      '## Commercial register',
      [
        `- Register: **${angaben.rcsStadt?.trim() || person('RCS', 'RCS', 'RCS city')}**`,
        `- Registration number: ${angaben.rcsNummer?.trim() || person('RCS-Nummer', 'Numéro RCS', 'RCS number')}`,
        `- SIRET: ${angaben.siret?.trim() || person('SIRET', 'SIRET', 'SIRET')}`,
      ].join('\n'),
      '## VAT',
      `VAT identification number: **${angaben.vatId?.trim() || person('TVA', 'TVA', 'VAT number')}**`,
      '## Responsible for the content',
      `${leitung}, address as above.`,
      '## Hosting',
      `This website is hosted by: ${hoster}`,
      '## Consumer mediation',
      `Under French law (articles L612-1 ff. of the Code de la consommation) every consumer may call on a consumer mediator free of charge. The mediator responsible for us is: ${schlichtungsstelle(angaben, sprache)}.`,
      '## Trade',
      'Metal construction and fabrication, carried out in France.',
      '## Picture credits',
      'All images show pieces from our own production and were taken in the workshop.',
    ].join('\n\n')
  }

  const leitung = person('Vor- und Nachname des Präsidenten', 'Nom', 'Name')
  const hoster = person('Name, Anschrift und Telefon des Hosters', 'Hébergeur', 'Host')
  return [
    '## Anbieter',
    `${firma(angaben, sprache)}, ${anschrift}`,
    '## Rechtsform und Vertretung',
    [
      `- Rechtsform: **${rechtsform}** (Société par actions simplifiée nach französischem Recht)`,
      kapital ? `- Stammkapital: ${kapital}` : null,
      `- Vertreten durch den Präsidenten: ${leitung}`,
    ]
      .filter(Boolean)
      .join('\n'),
    '## Kontakt',
    [
      `- Telefon: ${angaben.telefon?.trim() || person('Telefon', 'Téléphone', 'Phone')}`,
      `- E-Mail: ${angaben.email?.trim() || person('E-Mail', 'Courriel', 'Email')}`,
    ].join('\n'),
    '## Registereintrag',
    [
      `- Handelsregister: **${angaben.rcsStadt?.trim() || person('Registergericht', 'RCS', 'RCS city')}**`,
      `- Registernummer: ${angaben.rcsNummer?.trim() || person('Registernummer', 'Numéro RCS', 'RCS number')}`,
      `- SIRET: ${angaben.siret?.trim() || person('SIRET', 'SIRET', 'SIRET')}`,
    ].join('\n'),
    '## Umsatzsteuer',
    `Umsatzsteuer-Identifikationsnummer (TVA intracommunautaire): **${angaben.vatId?.trim() || person('TVA-Nummer', 'TVA', 'VAT number')}**`,
    '## Verantwortlich für den Inhalt',
    `${leitung}, Anschrift wie oben.`,
    '## Hosting',
    `Diese Website wird betrieben von: ${hoster}`,
    '## Verbraucherschlichtung',
    `Der Betrieb sitzt in Frankreich; nach Art. L612-1 ff. des Code de la consommation steht jeder Verbraucherin und jedem Verbraucher der kostenlose Weg zu einer Schlichtungsstelle offen. Zuständig ist: ${schlichtungsstelle(angaben, sprache)}.`,
    '## Berufsbezeichnung',
    'Metallbau und Fertigung, ausgeübt in Frankreich.',
    '## Bildnachweis',
    'Alle Aufnahmen zeigen Stücke aus eigener Fertigung und stammen aus der Werkstatt.',
  ].join('\n\n')
}


/**
 * Datenschutzerklärung — DSGVO/RGPD, Aufsicht ist die CNIL.
 *
 * **Was hier bewusst fehlt: die Besucherzählung.** Der Abschnitt entsteht auf
 * der Seite selbst aus der Einstellung nebenan (siehe
 * `components/shop/Besucherzaehlung.tsx`) und nicht aus diesem Text. Der
 * Grund ist der Fehler, den eine Datenschutzerklärung am wenigsten machen
 * darf: Zählung an, Absatz vergessen. Hier steht deshalb nur der Hinweis, dass
 * ohne Cookie gezählt wird — die Einzelheiten trägt die Seite selbst bei,
 * solange gezählt wird, und lässt sie weg, sobald nicht mehr gezählt wird.
 */
function datenschutz(angaben: Firmenangaben, sprache: Sprache): string {
  const wer = `${firma(angaben, sprache)}, ${anschriftZeile(angaben, sprache)}`
  const post = [angaben.email?.trim(), angaben.telefon?.trim()].filter(Boolean).join(' · ')
  const mail = angaben.email?.trim() || luecke({ de: 'E-Mail', fr: 'Courriel', en: 'Email' }, sprache)

  if (sprache === 'fr') {
    return [
      '## Responsable du traitement',
      wer,
      post,
      "## Ce qui se passe lors d'une simple visite",
      "Qui consulte ces pages laisse au serveur les informations techniques habituelles : adresse de la page appelée, date et heure, navigateur et système d'exploitation. Elles sont nécessaires à la diffusion du site et servent à la sécurité de l'exploitation ; elles sont effacées dès qu'elles ne sont plus utiles à cette fin. La base est notre intérêt légitime à un fonctionnement sans incident (art. 6 § 1 f RGPD).",
      "## Mesure d'audience sans cookie",
      "Nous comptons les visites à l'aide d'un logiciel que nous hébergeons nous-mêmes. **Aucun cookie** n'est déposé, **rien** n'est enregistré sur votre appareil ni lu depuis celui-ci, et **rien** n'est transmis à des tiers. Le détail figure plus bas, à la rubrique « Mesure d'audience ».",
      '## Panier',
      "Le contenu de votre panier est conservé dans la mémoire locale de votre navigateur, afin qu'il ne se vide pas d'une page à l'autre. Ces informations restent sur votre appareil, ne nous parviennent qu'au moment de la commande et peuvent être supprimées à tout moment via les réglages de votre navigateur.",
      '## Prise de contact et demandes sur mesure',
      "Qui nous écrit ou nous adresse une demande communique son nom, son adresse électronique et le contenu de son message ; pour une demande sur mesure s'y ajoutent les indications et les fichiers que vous joignez, par exemple un croquis ou une photo. Nous n'utilisons ces informations que pour répondre et traiter une éventuelle commande (art. 6 § 1 b RGPD). Elles sont conservées le temps de l'affaire, puis aussi longtemps que les obligations légales l'exigent.",
      '## Commandes dans la boutique',
      "Pour une commande, nous avons besoin du nom, de l'adresse, du courriel et des informations de livraison. Elles servent à l'exécution du contrat (art. 6 § 1 b RGPD). Les pièces comptables sont conservées dix ans, comme l'impose l'article L123-22 du code de commerce.",
      '### Paiement',
      "Le paiement se fait par **PayPal** ou **sur facture, par virement**. La voie que vous choisissez détermine aussi qui voit vos données de paiement.",
      "Avec **PayPal**, les informations nécessaires sont transmises à PayPal (Europe) S.à r.l. et Cie, S.C.A., 22-24 Boulevard Royal, L-2449 Luxembourg. PayPal est responsable de ce traitement pour son propre compte ; ses règles de confidentialité s'appliquent. Nous ne voyons pas vos données de carte.",
      "En cas de **paiement sur facture**, aucun prestataire de paiement n'intervient. Vous recevez la facture par courriel et virez le montant à notre banque ; nous ne transmettons rien à des tiers pour cela. Ce qui apparaît sur le relevé — nom, IBAN et libellé — relève de la comptabilité.",
      '### Expédition',
      "Pour la livraison, nous transmettons le nom et l'adresse de livraison au transporteur mandaté — rien de plus, et uniquement ce qui est nécessaire à la remise du colis.",
      '## Compte client',
      "Un compte client n'est pas nécessaire pour commander. Si vous en ouvrez un, vous vous connectez au moyen d'un code à usage unique envoyé par courriel, ou avec une clé d'accès (passkey) enregistrée sur votre appareil ; nous ne conservons aucun mot de passe. Le compte sert à retrouver vos commandes et vos documents (art. 6 § 1 b RGPD) et peut être supprimé à tout moment sur simple demande.",
      "## Lettre d'information",
      "Qui s'abonne confirme son inscription par un lien reçu par courriel — sans cette confirmation, aucun envoi n'a lieu. La base est le consentement (art. 6 § 1 a RGPD) ; il peut être retiré à tout moment d'un clic, en bas de chaque envoi.",
      '## Témoignages de clients',
      "Un témoignage n'est publié qu'avec un accord exprès. Le texte paraît avec le nom que la personne indique elle-même.",
      '## Google Avis clients',
      "Après une commande, nous vous proposons de participer à **Google Avis clients**. Le prestataire est Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.",
      "La participation est facultative. Ce n'est que si vous y consentez expressément lors de la commande que nous transmettons à Google votre adresse électronique, le numéro de commande et les données de livraison prévisionnelles ; Google vous invite alors par courriel à évaluer votre commande. Si vous ne consentez pas, rien n'est transmis et la commande suit son cours normalement. Le script de Google n'est chargé que sur la page de confirmation, au moment où la question vous est posée ; votre adresse IP peut alors être transmise à Google.",
      `La base de la transmission est votre **consentement** (art. 6 § 1 a RGPD), que vous pouvez retirer à tout moment avec effet pour l'avenir — par simple message à ${mail} ou via le lien de désinscription figurant dans le courriel de Google. Des données peuvent également être transmises à Google LLC aux États-Unis ; Google est certifié au titre du EU-US Data Privacy Framework et les clauses contractuelles types de la Commission européenne s'appliquent en complément. Détails : https://policies.google.com/privacy`,
      '## Sous-traitants',
      "Nous faisons appel à des prestataires pour l'hébergement du site, l'envoi des courriels et l'expédition. Ils n'agissent que sur nos instructions et sont liés par un contrat de sous-traitance au sens de l'article 28 RGPD.",
      '## Vos droits',
      "Vous disposez d'un droit",
      [
        "- d'accès aux données vous concernant",
        '- de rectification des informations inexactes',
        "- d'effacement, sauf obligation de conservation",
        '- à la limitation du traitement',
        '- à la portabilité des données',
        "- d'opposition à un traitement fondé sur l'intérêt légitime",
        '- de retrait des consentements donnés, avec effet pour l\'avenir',
        '- de définir des directives relatives au sort de vos données après votre décès',
      ].join('\n'),
      `Une simple demande à ${mail} suffit. Vous pouvez également saisir l'autorité de contrôle : en France, la **CNIL**, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.`,
    ].join('\n\n')
  }

  if (sprache === 'en') {
    return [
      '## Who is responsible',
      wer,
      post,
      '## What happens when you simply visit',
      'Anyone opening these pages leaves the usual technical details with the server: the address of the page requested, date and time, browser and operating system. They are needed to deliver the site and serve the security of its operation; they are deleted as soon as they are no longer required for that. The basis is our legitimate interest in trouble-free operation (Art. 6(1)(f) GDPR).',
      '## Visitor counting without a cookie',
      'We count visits using software we run ourselves. **No cookie** is set, **nothing** is stored on or read from your device, and **nothing** is passed to third parties. The details follow below under “Visitor counting”.',
      '## Shopping cart',
      'What you put in the cart is kept in your browser’s local storage so it does not empty itself between pages. It stays on your device, reaches us only when you place the order, and can be cleared at any time in your browser settings.',
      '## Enquiries and bespoke requests',
      'Anyone writing to us gives their name, email address and the content of their message; a bespoke request adds the details and any files you attach, such as a sketch or a photo. We use this only to answer the enquiry and to handle a possible order (Art. 6(1)(b) GDPR). It is kept while the matter is running, and beyond that for as long as statutory retention periods require.',
      '## Orders in the shop',
      'For an order we need your name, address, email address and the delivery details. They serve the performance of the contract (Art. 6(1)(b) GDPR). Accounting records are kept for ten years, as required by article L123-22 of the French commercial code.',
      '### Payment',
      'You pay either by **PayPal** or **on invoice by bank transfer**. Which route you choose also decides who gets to see your payment data.',
      'With **PayPal**, the details needed for the payment are passed to PayPal (Europe) S.à r.l. et Cie, S.C.A., 22-24 Boulevard Royal, L-2449 Luxembourg. PayPal is responsible for that processing in its own right; PayPal’s privacy terms apply. We never see your card details.',
      'With **payment on invoice** no payment service is involved. You receive the invoice by email and transfer the amount to our bank; we pass nothing to third parties for this. What arrives on the bank statement — name, IBAN and reference — belongs to our bookkeeping.',
      '### Shipping',
      'For delivery we pass your name and delivery address to the carrier we commission — no more than that, and only what the delivery requires.',
      '## Customer account',
      'You do not need an account to order. If you open one, you sign in with a one-time code sent by email or with a passkey stored on your device; we keep no passwords. The account serves to find your orders and documents again (Art. 6(1)(b) GDPR) and can be deleted at any time on request.',
      '## Newsletter',
      'Anyone subscribing confirms the subscription through a link sent by email — without that confirmation nothing is ever sent. The basis is consent (Art. 6(1)(a) GDPR); it can be withdrawn at any time with one click at the foot of every mailing.',
      '## Customer testimonials',
      'A testimonial is published only with express agreement. The text appears with the name the person gives us themselves.',
      '## Google Customer Reviews',
      'After an order we offer you the chance to take part in **Google Customer Reviews**. The provider is Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.',
      'Taking part is voluntary. Only if you expressly agree during checkout do we pass your email address, the order number and the expected delivery data to Google, which then emails you an invitation to rate the order. If you do not agree, nothing is transmitted and the order runs on unchanged. Google’s script is loaded only on the confirmation page, at the moment the question is put to you; your IP address may then be transmitted to Google.',
      `The basis for the transfer is your **consent** (Art. 6(1)(a) GDPR), which you can withdraw at any time with effect for the future — informally to ${mail} or via the unsubscribe link in Google’s email. Data may also be transferred to Google LLC in the United States; Google is certified under the EU-US Data Privacy Framework, and the European Commission’s standard contractual clauses apply in addition. Details: https://policies.google.com/privacy`,
      '## Processors',
      'We use service providers for hosting the site, sending email and shipping. They act only on our instructions and are bound by a processing agreement under Art. 28 GDPR.',
      '## Your rights',
      'You have the right to',
      [
        '- access the data held about you',
        '- have incorrect details corrected',
        '- have data erased, unless we must keep it',
        '- restrict the processing',
        '- data portability',
        '- object to processing based on legitimate interest',
        '- withdraw consent with effect for the future',
      ].join('\n'),
      `An informal message to ${mail} is enough. You may also turn to the supervisory authority: in France that is the **CNIL**, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.`,
    ].join('\n\n')
  }

  return [
    '## Wer für die Daten verantwortlich ist',
    wer,
    post,
    '## Was beim bloßen Besuch der Website geschieht',
    'Wer diese Seiten aufruft, hinterlässt beim Server die üblichen technischen Angaben: Adresse der aufgerufenen Seite, Datum und Uhrzeit, Browser und Betriebssystem. Sie sind nötig, damit die Seite ausgeliefert werden kann, und dienen der Sicherheit des Betriebs; gelöscht werden sie, sobald sie dafür nicht mehr gebraucht werden. Grundlage ist unser berechtigtes Interesse an einem störungsfreien Betrieb (Art. 6 Abs. 1 lit. f DSGVO).',
    '## Besucherzählung ohne Cookie',
    'Wir zählen Besuche mit einer Software, die wir selbst betreiben. Dabei wird **kein Cookie** gesetzt, **nichts auf Ihrem Gerät** gespeichert oder ausgelesen und **nichts an Dritte** weitergegeben. Die Einzelheiten stehen unten im Abschnitt „Besucherzählung“.',
    '## Warenkorb',
    'Was Sie in den Warenkorb legen, liegt im lokalen Speicher Ihres Browsers, damit er sich zwischen zwei Seiten nicht leert. Diese Angaben bleiben auf Ihrem Gerät, erreichen uns erst mit der Bestellung und lassen sich in den Einstellungen Ihres Browsers jederzeit löschen.',
    '## Kontaktaufnahme und Maßanfragen',
    'Wer uns schreibt, gibt Name, E-Mail-Adresse und den Inhalt seiner Nachricht preis; bei einer Maßanfrage kommen die Angaben und Dateien dazu, die Sie anhängen — eine Skizze etwa oder ein Foto. Wir verwenden das ausschließlich, um die Anfrage zu beantworten und einen möglichen Auftrag abzuwickeln (Art. 6 Abs. 1 lit. b DSGVO). Aufbewahrt wird, solange die Sache läuft, und darüber hinaus, soweit Aufbewahrungsfristen es verlangen.',
    '## Bestellungen im Shop',
    'Für eine Bestellung brauchen wir Name, Anschrift, E-Mail-Adresse und die Angaben zur Lieferung. Sie dienen der Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO). Buchhaltungsunterlagen bewahren wir zehn Jahre auf, wie es Art. L123-22 des französischen Handelsgesetzbuchs verlangt.',
    '### Zahlung',
    'Bezahlt wird über **PayPal** oder **auf Rechnung per Überweisung**. Welchen Weg Sie wählen, entscheidet auch darüber, wer Ihre Zahlungsdaten zu sehen bekommt.',
    'Bei **PayPal** werden die für die Zahlung nötigen Angaben an PayPal (Europe) S.à r.l. et Cie, S.C.A., 22-24 Boulevard Royal, L-2449 Luxemburg übermittelt. Für diese Verarbeitung ist PayPal eigenständig verantwortlich; es gelten die Datenschutzbestimmungen von PayPal. Ihre Kartendaten sehen wir nicht.',
    'Bei **Zahlung auf Rechnung** ist kein Zahlungsdienst beteiligt. Sie bekommen die Rechnung per E-Mail und überweisen an unsere Bank; an Dritte geben wir dafür nichts weiter. Was auf dem Kontoauszug ankommt — Name, IBAN und Verwendungszweck —, gehört zur Buchhaltung.',
    '### Versand',
    'Für die Zustellung geben wir Name und Lieferanschrift an das beauftragte Versandunternehmen weiter — mehr nicht, und nur, was für die Zustellung nötig ist.',
    '## Kundenkonto',
    'Zum Bestellen braucht es kein Konto. Wer eines anlegt, meldet sich mit einem einmaligen Code per E-Mail an oder mit einem auf dem Gerät hinterlegten Passkey; Kennwörter speichern wir keine. Das Konto dient dazu, Bestellungen und Unterlagen wiederzufinden (Art. 6 Abs. 1 lit. b DSGVO), und lässt sich jederzeit auf Zuruf löschen.',
    '## Newsletter',
    'Wer den Newsletter bestellt, bestätigt die Anmeldung über einen Link in einer E-Mail — ohne diese Bestätigung geht nichts hinaus. Grundlage ist die Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); sie lässt sich jederzeit mit einem Klick am Ende jeder Sendung widerrufen.',
    '## Kundenstimmen',
    'Eine Kundenstimme erscheint nur, wenn ihr ausdrücklich zugestimmt wurde. Veröffentlicht wird der Text mit dem Namen, den die Kundschaft selbst angibt.',
    '## Google Kundenrezensionen',
    'Nach einer Bestellung bieten wir Ihnen an, an **Google Kundenrezensionen** teilzunehmen. Anbieter ist Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.',
    'Die Teilnahme ist freiwillig. Nur wenn Sie im Bestellvorgang ausdrücklich zustimmen, übermitteln wir Ihre E-Mail-Adresse, die Bestellnummer und die voraussichtlichen Lieferdaten an Google; Google bittet Sie dann per E-Mail um eine Bewertung. Stimmen Sie nicht zu, wird nichts übermittelt und die Bestellung läuft unverändert weiter. Das Skript von Google wird erst auf der Bestätigungsseite geladen, in dem Augenblick, in dem Ihnen die Frage gestellt wird; dabei kann Ihre IP-Adresse an Google übertragen werden.',
    `Grundlage der Übermittlung ist Ihre **Einwilligung** (Art. 6 Abs. 1 lit. a DSGVO); Sie können sie jederzeit mit Wirkung für die Zukunft widerrufen — formlos an ${mail} oder über den Abmeldelink in der E-Mail von Google. Dabei können Daten auch an Google LLC in den Vereinigten Staaten übermittelt werden; Google ist unter dem EU-US Data Privacy Framework zertifiziert, ergänzend gelten die Standardvertragsklauseln der Europäischen Kommission. Einzelheiten: https://policies.google.com/privacy`,
    '## Auftragsverarbeiter',
    'Für den Betrieb der Website, den Versand von E-Mails und die Zustellung setzen wir Dienstleister ein. Sie handeln allein nach unserer Weisung und sind über einen Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO gebunden.',
    '## Ihre Rechte',
    'Sie haben das Recht auf',
    [
      '- Auskunft über die zu Ihnen gespeicherten Daten',
      '- Berichtigung unrichtiger Angaben',
      '- Löschung, soweit keine Aufbewahrungspflicht entgegensteht',
      '- Einschränkung der Verarbeitung',
      '- Datenübertragbarkeit',
      '- Widerspruch gegen eine Verarbeitung, die auf berechtigtem Interesse beruht',
      '- Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft',
    ].join('\n'),
    `Eine Anfrage genügt formlos an ${mail}. Daneben steht Ihnen der Weg zur Aufsichtsbehörde offen; zuständig ist die französische **CNIL**, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07. Sie können sich auch an die Aufsichtsbehörde Ihres Wohnsitzes wenden.`,
  ].join('\n\n')
}


/**
 * AGB / CGV.
 *
 * **Der Satz, der hier lange falsch stand.** „Wir sind zur Teilnahme an einem
 * Schlichtungsverfahren weder verpflichtet noch bereit" ist die deutsche
 * Formel — und für einen französischen Betrieb schlicht unzutreffend: Nach
 * Art. L612-1 des Code de la consommation **muss** ein Händler Verbrauchern
 * den kostenlosen Zugang zu einer Schlichtungsstelle eröffnen und sie
 * benennen. Der Verweis auf die europäische ODR-Plattform fehlt dagegen
 * bewusst: Die Kommission hat sie am 20. Juli 2025 abgeschaltet, ein Link
 * dorthin liefe ins Leere.
 *
 * **Und die Gewährleistung ist französisch.** Nicht die zwei Jahre des BGB,
 * sondern die garantie légale de conformité (Art. L217-3 ff. Code de la
 * consommation) und die Haftung für versteckte Mängel (Art. 1641 Code civil).
 */
function agb(angaben: Firmenangaben, sprache: Sprache): string {
  const wer = `${firma(angaben, sprache)}, ${anschriftZeile(angaben, sprache)}`

  if (sprache === 'fr') {
    return [
      "## Champ d'application",
      `Ces conditions s'appliquent à toutes les commandes passées sur ce site auprès de ${wer}.`,
      '## Ce qui est vendu ici',
      "Dans cet atelier, **chaque pièce est réalisée à l'unité et sur commande**. Il n'y a ni production en série ni stock au sens habituel — seules sont disponibles immédiatement les quelques pièces d'atelier déjà terminées, signalées comme telles. Les dimensions, la teinte et la finition font d'une pièce une fabrication selon vos indications ; cela a des conséquences sur les délais et sur le droit de rétractation.",
      '## Formation du contrat',
      "La présentation des pièces sur ce site ne constitue pas une offre ferme, mais une invitation à commander. En envoyant votre commande, vous formulez une offre ferme. Le contrat est conclu dès que nous acceptons la commande — au plus tard à l'expédition ou au début de la fabrication. Vous recevez la confirmation par courriel.",
      '## Prix',
      "Tous les prix s'entendent **toutes taxes comprises**. La TVA incluse est indiquée sur la confirmation de commande et sur la facture. Les frais de port figurent à chaque article et sont additionnés dans le panier ; le montant total apparaît avant l'envoi de la commande.",
      '## Paiement',
      "Le paiement se fait par **PayPal** — avec un compte PayPal, une carte ou un prélèvement — ou **sur facture, par virement**. Que PayPal vous accorde par ailleurs un délai ou un paiement en plusieurs fois relève de PayPal ; c'est un accord entre vous et PayPal, sans effet sur notre créance.",
      'Le mode de facturation dépend du montant de la commande :',
      [
        '- Les **montants modestes** sont dus en une seule fois à la commande.',
        '- Les **commandes plus importantes** sont facturées par tranches : un acompte à la commande, une tranche intermédiaire dès que la structure est montée, et la facture de solde avant la livraison.',
      ].join('\n'),
      "Nous vous indiquons avant le début des travaux à partir de quel montant nous facturons par tranches ; la répartition est consignée dans le devis. La fabrication commence à chaque fois à réception du paiement dû.",
      '## Livraison et délais de fabrication',
      "Le délai de fabrication figure à chaque article et court à compter de la réception du paiement. Nous vous prévenons au début de la fabrication, puis à l'expédition avec le numéro de suivi. Le retrait à l'atelier est possible et gratuit ; nous convenons du rendez-vous ensemble.",
      "Nous livrons en France, en Allemagne et dans les pays limitrophes. Pour les pièces encombrantes, nous convenons du mode d'expédition avec vous au préalable. Le risque de perte ou de détérioration ne vous est transféré qu'à la remise du bien.",
      '## Réserve de propriété',
      "La marchandise reste notre propriété jusqu'au paiement intégral.",
      '## Contenus numériques',
      "Les plans de construction et fichiers de fabrication proposés au téléchargement vous sont concédés pour votre usage propre. Leur revente, leur diffusion et leur mise à disposition publique ne sont pas autorisées.",
      '## Droit de rétractation',
      "Les consommateurs disposent d'un droit de rétractation. Les modalités et l'exception applicable aux fabrications selon vos indications figurent dans la **notice de rétractation** ; elle fait partie intégrante des présentes conditions.",
      '## Garantie',
      "Nous répondons de la garantie légale de conformité (art. L217-3 et suivants du code de la consommation) ainsi que des vices cachés (art. 1641 et suivants du code civil).",
      "L'acier est un matériau vivant : l'**acier Corten** développe volontairement une couche de rouille dont la couleur évolue sur plusieurs mois et diffère d'une pièce à l'autre. Ces évolutions sont recherchées et ne constituent pas un défaut. De même, de légers écarts de dimension, de surface et de teinte sont propres à une fabrication artisanale à l'unité.",
      '## Médiation de la consommation',
      `En cas de litige né d'un contrat de consommation, vous pouvez recourir gratuitement à un médiateur de la consommation, après nous avoir adressé une réclamation écrite restée sans réponse satisfaisante. Le médiateur dont nous relevons est : ${schlichtungsstelle(angaben, sprache)}.`,
      "Un entretien direct avec nous vous reste évidemment ouvert — et c'est le plus souvent le chemin le plus court.",
      '## Droit applicable',
      "Le droit français s'applique. Les dispositions impératives de protection des consommateurs de l'État de résidence habituelle du consommateur demeurent réservées.",
    ].join('\n\n')
  }

  if (sprache === 'en') {
    return [
      '## Scope',
      `These terms apply to every order placed through this website with ${wer}.`,
      '## What is sold here',
      'In this workshop **every piece is made individually and to order**. There is no series production and no stock in the usual sense — only the few finished workshop pieces, marked as such, are available straight away. Dimensions, colour and finish turn a piece into a made-to-order item; that has consequences for the lead time and for the right of withdrawal.',
      '## How the contract comes about',
      'The presentation of pieces on this website is not a binding offer but an invitation to order. By sending your order you make a binding offer. The contract comes about once we accept it — at the latest when the piece ships or production begins. You receive the confirmation by email.',
      '## Prices',
      'All prices **include VAT**. The VAT contained is shown on the order confirmation and on the invoice. Shipping costs are stated with each item and added up in the cart; the total appears before you send the order.',
      '## Payment',
      'You pay by **PayPal** — with a PayPal account, a card or direct debit — or **on invoice by bank transfer**. Whether PayPal additionally grants you deferred or instalment payment is PayPal’s decision; that is an agreement between you and PayPal and does not affect our claim.',
      'How we invoice depends on the order value:',
      [
        '- **Smaller amounts** are due in full with the order.',
        '- **Larger commissions** are invoiced in instalments: a deposit with the order, a further instalment once the body of the piece stands, and the final invoice before delivery.',
      ].join('\n'),
      'We tell you before work starts from which amount we invoice in instalments; the split is recorded in the quotation. Production begins in each case once the payment due has arrived.',
      '## Delivery and lead time',
      'The lead time is stated with each item and starts when payment is received. We let you know when production begins and again when the piece ships, with the tracking number. Collection from the workshop is possible and free of charge; we agree a date with you.',
      'We deliver to France, Germany and neighbouring countries. For bulky pieces we agree the route with you in advance. The risk of loss or damage passes to you only when the goods are handed over.',
      '## Retention of title',
      'The goods remain our property until they have been paid for in full.',
      '## Digital content',
      'Construction plans and production files offered for download are licensed to you for your own use. Reselling, passing them on and making them publicly available are not permitted.',
      '## Right of withdrawal',
      'Consumers have a right of withdrawal. The details, and the exception for pieces made to your specifications, are set out in the **withdrawal notice**, which forms part of these terms.',
      '## Warranty',
      'We are liable under the statutory guarantee of conformity (articles L217-3 ff. of the French consumer code) and for hidden defects (articles 1641 ff. of the French civil code).',
      'Steel is a living material: **Corten steel** deliberately develops a layer of rust whose colour changes over months and differs from piece to piece. Such changes are intended and are not a defect. Likewise, small variations in dimension, surface and shade are inherent in handmade single pieces.',
      '## Consumer mediation',
      `In a dispute arising from a consumer contract you may call on a consumer mediator free of charge, after you have sent us a written complaint that has not been resolved to your satisfaction. The mediator responsible for us is: ${schlichtungsstelle(angaben, sprache)}.`,
      'A direct conversation with us of course remains open to you — and it is usually the shorter route.',
      '## Applicable law',
      'French law applies. Mandatory consumer protection provisions of the country in which a consumer has their habitual residence remain unaffected.',
    ].join('\n\n')
  }

  return [
    '## Geltungsbereich',
    `Diese Bedingungen gelten für alle Bestellungen über diese Website bei der ${wer}.`,
    '## Was hier verkauft wird',
    'In dieser Werkstatt entsteht **jedes Stück einzeln und auf Bestellung**. Es gibt keine Serienfertigung und kein Lager im üblichen Sinn — vorrätig sind nur die wenigen fertigen Werkstattstücke, die als solche gekennzeichnet sind. Maße, Farbton und Ausführung machen aus einem Stück eine Anfertigung nach Ihren Vorgaben; das hat Folgen für Lieferzeit und Widerrufsrecht.',
    '## Wie der Vertrag zustande kommt',
    'Die Darstellung der Stücke auf dieser Website ist noch kein bindendes Angebot, sondern eine Aufforderung zur Bestellung. Mit dem Absenden der Bestellung geben Sie ein verbindliches Angebot ab. Der Vertrag kommt zustande, sobald wir die Bestellung annehmen — spätestens mit dem Versand oder mit dem Beginn der Fertigung. Die Bestätigung erhalten Sie per E-Mail.',
    '## Preise',
    'Alle Preise verstehen sich **inklusive der gesetzlichen Mehrwertsteuer**. Die enthaltene Steuer wird auf der Bestellbestätigung und auf der Rechnung ausgewiesen. Versandkosten stehen am jeweiligen Artikel und werden im Warenkorb zusammengerechnet; der Gesamtbetrag steht vor dem Absenden der Bestellung.',
    '## Zahlung',
    'Bezahlt wird über **PayPal** — mit PayPal-Konto, Karte oder Lastschrift — oder **auf Rechnung per Überweisung**. Ob PayPal Ihnen darüber hinaus ein späteres Zahlungsziel oder eine Ratenzahlung einräumt, entscheidet PayPal; das ist eine Vereinbarung zwischen Ihnen und PayPal und berührt unsere Forderung nicht.',
    'Wie abgerechnet wird, richtet sich nach dem Auftragswert:',
    [
      '- **Kleinere Beträge** sind mit der Bestellung in einer Summe fällig.',
      '- **Größere Aufträge** rechnen wir in Teilbeträgen ab: eine Anzahlung bei Auftragserteilung, ein weiterer Teilbetrag, sobald der Rohbau steht, und die Schlussrechnung vor der Auslieferung.',
    ].join('\n'),
    'Ab welchem Betrag wir in Teilbeträgen abrechnen, nennen wir Ihnen vor Auftragsbeginn; die Aufteilung halten wir im Angebot fest. Die Fertigung beginnt jeweils mit dem Eingang der fälligen Zahlung.',
    '## Lieferung und Fertigungszeit',
    'Die Fertigungszeit steht am jeweiligen Artikel und beginnt mit dem Zahlungseingang. Wir melden uns, wenn die Fertigung beginnt, und noch einmal beim Versand mit der Sendungsnummer. Abholung in der Werkstatt ist möglich und kostenfrei; den Termin stimmen wir ab.',
    'Geliefert wird nach Frankreich, Deutschland und in angrenzende Länder. Bei sperrigen Stücken sprechen wir den Versandweg vorher mit Ihnen ab. Die Gefahr des Verlusts oder der Beschädigung geht erst mit der Übergabe auf Sie über.',
    '## Eigentumsvorbehalt',
    'Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.',
    '## Digitale Inhalte',
    'Baupläne und Fertigungsdateien zum Herunterladen überlassen wir Ihnen zum eigenen Gebrauch. Weiterverkauf, Weitergabe und öffentliche Zugänglichmachung sind nicht gestattet.',
    '## Widerrufsrecht',
    'Verbraucherinnen und Verbrauchern steht ein Widerrufsrecht zu. Die Einzelheiten und die Ausnahme für Anfertigungen nach Ihren Vorgaben stehen in der **Widerrufsbelehrung**; sie ist Teil dieser Bedingungen.',
    '## Gewährleistung',
    'Wir haften nach der gesetzlichen Gewährleistung für Vertragsmäßigkeit (Art. L217-3 ff. Code de la consommation) und für versteckte Mängel (Art. 1641 ff. Code civil).',
    'Stahl ist ein lebendiger Werkstoff: **Cortenstahl** bildet mit Absicht eine Rostschicht aus, deren Farbe sich über Monate verändert und die an jedem Stück anders ausfällt. Solche Veränderungen sind gewollt und kein Mangel. Ebenso gehören kleine Abweichungen in Maß, Oberfläche und Farbton zur handwerklichen Einzelfertigung.',
    '## Verbraucherschlichtung',
    `Bei Streitigkeiten aus einem Verbrauchervertrag können Sie kostenlos eine Verbraucherschlichtungsstelle anrufen, nachdem Sie sich zuvor schriftlich bei uns beschwert haben und die Sache nicht zu Ihrer Zufriedenheit gelöst wurde. Zuständig ist: ${schlichtungsstelle(angaben, sprache)}.`,
    'Das Gespräch mit uns steht Ihnen daneben jederzeit offen — und meistens ist es der kürzere Weg.',
    '## Anwendbares Recht',
    'Es gilt französisches Recht. Zwingende Verbraucherschutzvorschriften des Staates, in dem eine Verbraucherin oder ein Verbraucher ihren gewöhnlichen Aufenthalt hat, bleiben davon unberührt.',
  ].join('\n\n')
}


/**
 * Widerrufsbelehrung nach dem Code de la consommation.
 *
 * Der zweite Teil ist der, auf den es in dieser Werkstatt ankommt: Bei einem
 * nach Kundenvorgabe gefertigten Stück besteht kein Widerrufsrecht (Art.
 * L221-28). Das muss ausdrücklich dastehen, sonst gilt es doch.
 */
function widerruf(angaben: Firmenangaben, sprache: Sprache): string {
  const wer = werWirSind(angaben, sprache)

  if (sprache === 'fr') {
    return [
      '## Droit de rétractation',
      "Vous disposez d'un délai de quatorze jours pour vous rétracter, sans avoir à justifier de motifs. Le délai court à compter du jour où vous, ou un tiers désigné par vous et différent du transporteur, prenez physiquement possession du bien.",
      `Pour exercer ce droit, informez-nous de votre décision par une déclaration dénuée d'ambiguïté (lettre ou courriel) : ${wer}. Vous pouvez utiliser le modèle de formulaire ci-dessous, sans obligation.`,
      "Pour que le délai soit respecté, il suffit que votre communication soit envoyée avant son expiration.",
      '## Effets de la rétractation',
      "En cas de rétractation, nous vous remboursons tous les paiements reçus, y compris les frais de livraison standard, sans retard excessif et au plus tard quatorze jours à compter du jour où nous sommes informés de votre décision. Nous pouvons différer le remboursement jusqu'à réception du bien ou jusqu'à ce que vous ayez fourni une preuve d'expédition.",
      "Vous supportez les coûts directs du renvoi du bien. Les meubles en acier étant lourds et encombrants, ces frais peuvent être élevés ; nous les estimons sur demande avant votre commande.",
      "Votre responsabilité n'est engagée qu'à l'égard de la dépréciation du bien résultant de manipulations autres que celles nécessaires pour établir sa nature, ses caractéristiques et son bon fonctionnement.",
      '## Exception : pièces réalisées sur mesure',
      "Conformément à l'article L221-28 du code de la consommation, le droit de rétractation ne s'applique pas aux biens confectionnés selon les spécifications du consommateur ou nettement personnalisés. Dans cet atelier, chaque pièce est fabriquée à l'unité : les commandes sur mesure et les pièces réalisées d'après vos indications (dimensions, coloris RAL, exécution) en sont donc exclues dès le début de la fabrication.",
      "Les pièces déjà terminées et disponibles en atelier ne sont pas concernées par cette exception : pour elles, le droit de rétractation s'applique pleinement.",
      '## Exception : contenus numériques',
      "Conformément à l'article L221-28 13° du code de la consommation, le droit de rétractation ne s'applique pas non plus à la fourniture de contenus numériques non fournis sur un support matériel — plans de construction et fichiers de fabrication à télécharger, par exemple. Le droit de rétractation s'éteint dès lors que vous avez expressément demandé l'exécution avant la fin du délai de rétractation et reconnu que vous perdiez ainsi ce droit. Ces deux points sont recueillis lors de la commande et conservés, horodatés, avec celle-ci ; les fichiers sont disponibles dès réception du paiement.",
    ].join('\n\n')
  }

  if (sprache === 'en') {
    return [
      '## Right of withdrawal',
      'You have the right to withdraw from this contract within fourteen days without giving any reason. The period begins on the day on which you, or a third party named by you who is not the carrier, takes possession of the goods.',
      `To exercise this right you must inform us by means of a clear statement (letter or email): ${wer}. You may use the model withdrawal form below, but you are not obliged to.`,
      'To meet the deadline it is sufficient to send your notice before the withdrawal period expires.',
      '## Consequences of withdrawal',
      'If you withdraw, we will refund all payments received from you, including the costs of standard delivery, without undue delay and no later than fourteen days after we receive your notice. We may withhold the refund until we have received the goods back or you have supplied proof of return.',
      'You bear the direct cost of returning the goods. Steel furniture is heavy and bulky, so this can be substantial; we will estimate it on request before you order.',
      'You are only liable for any diminished value of the goods resulting from handling other than what is necessary to establish their nature, characteristics and functioning.',
      '## Exception: made-to-order pieces',
      'There is no right of withdrawal for goods that are not prefabricated and are made on the basis of an individual choice or decision by the consumer, or which are clearly tailored to personal needs. In this workshop every piece is made individually, so bespoke commissions and pieces built to your specifications (dimensions, RAL colour, execution) are excluded once production begins.',
      'Finished pieces already available in the workshop are not covered by this exception — for those the right of withdrawal applies in full.',
      '## Exception: digital content',
      'Nor is there a right of withdrawal for digital content not supplied on a tangible medium — construction plans and production files for download, for example. The right of withdrawal lapses once you have expressly requested that we begin performance before the withdrawal period ends and have acknowledged that you thereby lose that right. Both are collected at checkout and stored with your order, with a timestamp; the files are available as soon as the payment arrives.',
    ].join('\n\n')
  }

  return [
    '## Widerrufsrecht',
    'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Frist beginnt an dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Ware in Besitz genommen haben.',
    `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung (Brief oder E-Mail) über Ihren Entschluss informieren: ${wer}. Sie können dafür das untenstehende Muster-Widerrufsformular verwenden, das aber nicht vorgeschrieben ist.`,
    'Zur Wahrung der Frist genügt es, dass Sie die Mitteilung vor Ablauf der Widerrufsfrist absenden.',
    '## Folgen des Widerrufs',
    'Wenn Sie widerrufen, erstatten wir Ihnen alle Zahlungen zurück, die wir von Ihnen erhalten haben, einschließlich der Kosten der Standardlieferung, unverzüglich und spätestens binnen vierzehn Tagen ab Eingang Ihrer Mitteilung. Wir können die Rückzahlung zurückbehalten, bis die Ware wieder bei uns ist oder Sie den Rückversand nachgewiesen haben.',
    'Die unmittelbaren Kosten der Rücksendung tragen Sie. Stahlmöbel sind schwer und sperrig, die Kosten können deshalb erheblich sein — auf Anfrage schätzen wir sie vor Ihrer Bestellung.',
    'Für einen Wertverlust der Ware müssen Sie nur aufkommen, wenn er auf einen Umgang zurückgeht, der über die Prüfung von Beschaffenheit, Eigenschaften und Funktionsweise hinausgeht.',
    '## Ausnahme: Einzelanfertigungen',
    'Kein Widerrufsrecht besteht bei Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch Sie maßgeblich ist oder die eindeutig auf Ihre persönlichen Bedürfnisse zugeschnitten sind. In dieser Werkstatt entsteht jedes Stück einzeln: Maßanfertigungen und nach Ihren Vorgaben gefertigte Stücke (Maße, RAL-Farbton, Ausführung) sind davon erfasst, sobald die Fertigung beginnt.',
    'Fertige Werkstattstücke, die bereits vorhanden sind, fallen nicht unter diese Ausnahme — dort gilt das Widerrufsrecht uneingeschränkt.',
    '## Ausnahme: digitale Inhalte',
    'Kein Widerrufsrecht besteht ferner bei digitalen Inhalten, die nicht auf einem körperlichen Datenträger geliefert werden — etwa Bauplänen und Fertigungsdateien zum Herunterladen. Das Widerrufsrecht erlischt, wenn Sie beim Bestellen ausdrücklich verlangt haben, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung beginnen, und Sie bestätigt haben, dass Sie damit Ihr Widerrufsrecht verlieren. Beides wird an der Kasse abgefragt und mit Zeitpunkt zu Ihrer Bestellung festgehalten; die Dateien stehen unmittelbar nach dem Zahlungseingang bereit.',
  ].join('\n\n')
}

function widerrufsformular(angaben: Firmenangaben, sprache: Sprache): string {
  const wer = werWirSind(angaben, sprache)

  if (sprache === 'fr') {
    return [
      '## Modèle de formulaire de rétractation',
      "(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)",
      `À l'attention de : ${wer}`,
      "Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien ci-dessous :",
      'Commandé le (*) / reçu le (*) :',
      'Nom du (des) consommateur(s) :',
      'Adresse du (des) consommateur(s) :',
      "Signature du (des) consommateur(s) (uniquement en cas de notification sur papier) :",
      'Date :',
      '(*) Rayez la mention inutile.',
    ].join('\n\n')
  }

  if (sprache === 'en') {
    return [
      '## Model withdrawal form',
      '(Complete and return this form only if you wish to withdraw from the contract.)',
      `To: ${wer}`,
      'I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods:',
      'Ordered on (*) / received on (*):',
      'Name of consumer(s):',
      'Address of consumer(s):',
      'Signature of consumer(s) (only if this form is notified on paper):',
      'Date:',
      '(*) Delete as appropriate.',
    ].join('\n\n')
  }

  return [
    '## Muster-Widerrufsformular',
    '(Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie es zurück.)',
    `An: ${wer}`,
    'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren:',
    'Bestellt am (*) / erhalten am (*):',
    'Name des/der Verbraucher(s):',
    'Anschrift des/der Verbraucher(s):',
    'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):',
    'Datum:',
    '(*) Unzutreffendes streichen.',
  ].join('\n\n')
}

function versandZahlung(sprache: Sprache): string {
  if (sprache === 'fr') {
    return [
      '## Livraison',
      "Les frais de port sont indiqués par article et additionnés dans le panier ; le montant exact apparaît avant la commande. L'enlèvement à l'atelier est possible et gratuit — nous convenons ensemble de la date.",
      "Chaque pièce est fabriquée à l'unité. Le délai de fabrication figure sur la fiche produit et court à partir du paiement ; nous vous informons dès que la fabrication commence et dès l'expédition, avec le numéro de suivi.",
      '## Paiement',
      "Le paiement se fait au choix via PayPal ou sur facture par virement — les deux voies sont proposées pour chaque article. Via PayPal — avec un compte PayPal, une carte ou un prélèvement ; un compte PayPal n'est pas nécessaire — le montant total est dû à la commande ; si PayPal vous propose un paiement différé ou en plusieurs fois, c'est un accord entre vous et PayPal, sans effet sur notre créance. Sur facture, vous recevez la facture par e-mail, avec un QR code pour votre application bancaire ; pour les pièces fabriquées à l'unité, le montant se règle en plusieurs tranches exprimées en pourcentage : un acompte à la confirmation de commande, avant le début de la fabrication ; une facture intermédiaire dès que l'étape convenue est atteinte — en règle générale lorsque la structure de la pièce est achevée ; la facture de solde avant la livraison. Les pourcentages figurent sur la fiche produit et sont repris dans la confirmation de commande. La fabrication commence à réception de l'acompte, la livraison après règlement du solde.",
      '## Prix',
      'Tous les prix sont TTC. La TVA applicable est indiquée sur la confirmation de commande et sur la facture.',
    ].join('\n\n')
  }

  if (sprache === 'en') {
    return [
      '## Delivery',
      'Shipping costs are shown per item and added up in the cart; the exact amount appears before you order. Collection from the workshop is possible and free of charge — we agree on a date with you.',
      'Every piece is made individually. The production time is stated on the product page and starts once payment is received; we let you know when production begins and again when the piece ships, including the tracking number.',
      '## Payment',
      'You can pay either by PayPal or on invoice by bank transfer — both routes are offered for every item. With PayPal — using a PayPal account, a card or direct debit; a PayPal account is not required — the full amount is due towards us when you order. Whether PayPal additionally offers you deferred payment or instalments is PayPal\'s decision — that is an agreement between you and PayPal and does not affect our claim. On invoice you receive the bill by email, with a QR code for your banking app; for pieces made to order the amount is split into instalments given as percentages: a deposit with the order confirmation, before production starts; an interim invoice once the agreed stage is reached — as a rule when the body of the piece stands; the final invoice before delivery. The percentages are stated on the product page and again in the order confirmation. Production starts once the deposit has arrived, and the piece is delivered once the final invoice has been settled.',
      '## Prices',
      'All prices include VAT. The applicable VAT is shown on the order confirmation and on the invoice.',
    ].join('\n\n')
  }

  return [
    '## Lieferung',
    'Die Versandkosten stehen je Artikel dabei und werden im Warenkorb zusammengerechnet; der genaue Betrag steht vor dem Bestellen. Abholung in der Werkstatt ist möglich und kostenfrei — den Termin stimmen wir mit Ihnen ab.',
    'Jedes Stück entsteht einzeln. Die Fertigungszeit steht am Artikel und beginnt mit dem Zahlungseingang; wir melden uns, wenn die Fertigung startet, und noch einmal beim Versand mit der Sendungsnummer.',
    '## Zahlung',
    'Bezahlt wird wahlweise über PayPal oder auf Rechnung per Überweisung — beide Wege stehen bei jedem Artikel zur Wahl. Über PayPal — mit PayPal-Konto, Karte oder Lastschrift; ein PayPal-Konto ist dafür nicht nötig — ist uns gegenüber der volle Betrag mit der Bestellung fällig. Ob PayPal Ihnen darüber hinaus ein späteres Zahlungsziel oder eine Ratenzahlung anbietet, entscheidet PayPal — das ist eine Vereinbarung zwischen Ihnen und PayPal, auf unsere Forderung wirkt sie sich nicht aus. Auf Rechnung bekommen Sie die Rechnung per E-Mail, mit QR-Code für die Banking-App; bei Einzelanfertigungen verteilt sich der Betrag auf Teilbeträge, die als Prozentsätze festgelegt sind: eine Anzahlung mit der Auftragsbestätigung, vor Fertigungsbeginn; eine Zwischenrechnung, sobald der vereinbarte Fertigungsabschnitt erreicht ist — in aller Regel, wenn der Rohbau des Stücks steht; die Schlussrechnung vor der Auslieferung. Die Anteile stehen am Artikel und noch einmal in der Auftragsbestätigung. Gefertigt wird nach Eingang der Anzahlung, ausgeliefert nach Ausgleich der Schlussrechnung.',
    '## Preise',
    'Alle Preise verstehen sich inklusive Mehrwertsteuer. Die enthaltene Steuer ist auf der Bestellbestätigung und auf der Rechnung ausgewiesen.',
  ].join('\n\n')
}


const SPRACHEN: Sprache[] = ['de', 'fr', 'en']

/**
 * Alle sechs Pflichttexte einer Sprache — die eine Stelle, an der steht,
 * welche es überhaupt gibt.
 *
 * Herausgegeben wird das, damit sich die Texte prüfen lassen, ohne eine
 * Datenbank anzuwerfen: Ob am Ende wieder ein Prüfhinweis steht oder ob im
 * Impressum die Registernummer fehlt, ist eine Frage an den Text und nicht an
 * den Server.
 */
export function pflichttexte(angaben: Firmenangaben, sprache: Sprache): Record<string, string> {
  return {
    impressum: impressum(angaben, sprache),
    datenschutz: datenschutz(angaben, sprache),
    agb: agb(angaben, sprache),
    widerruf: widerruf(angaben, sprache),
    widerrufsformular: widerrufsformular(angaben, sprache),
    versandZahlung: versandZahlung(sprache),
  }
}

export { SPRACHEN as RECHTSTEXT_SPRACHEN }

/**
 * Schreibt die Texte in die Rechtsseiten — standardmäßig nur dort, wo noch
 * nichts steht. Wer eigene Texte gepflegt hat, verliert sie also nicht.
 */
export async function rechtstexteEinspielen(
  payload: Payload,
  optionen: { ueberschreiben?: boolean } = {},
): Promise<string[]> {
  const einstellungen = (await payload
    .findGlobal({ slug: 'site-settings', depth: 0 })
    .catch(() => null)) as Record<string, any> | null

  const angaben: Firmenangaben = {
    name: einstellungen?.company?.legalName || einstellungen?.contact?.company,
    anschrift: einstellungen?.company?.address || einstellungen?.contact?.address,
    email: einstellungen?.contact?.email,
    telefon: einstellungen?.contact?.phone,
    rechtsform: einstellungen?.company?.legalForm,
    stammkapital: einstellungen?.company?.shareCapital,
    rcsNummer: einstellungen?.company?.rcsNumber,
    rcsStadt: einstellungen?.company?.rcsCity,
    siret: einstellungen?.company?.siret,
    vatId: einstellungen?.company?.vatId,
    schlichtung: einstellungen?.company?.mediator,
  }

  const geschrieben: string[] = []

  for (const sprache of SPRACHEN) {
    const vorhanden = (await payload.findGlobal({
      slug: 'legal',
      locale: sprache,
      fallbackLocale: false as never,
      depth: 0,
    })) as Record<string, any>

    const felder = pflichttexte(angaben, sprache)

    const daten: Record<string, unknown> = {}
    for (const [feld, text] of Object.entries(felder)) {
      if (!optionen.ueberschreiben && vorhanden?.[feld]) continue
      daten[feld] = richText(text)
      geschrieben.push(`${sprache}/${feld}`)
    }

    if (Object.keys(daten).length) {
      await payload.updateGlobal({ slug: 'legal', locale: sprache, overrideAccess: true, data: daten })
    }
  }

  return geschrieben
}
