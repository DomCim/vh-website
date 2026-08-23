import type { Payload } from 'payload'

import { richText } from './richtext'

/**
 * Entwürfe für die Pflichttexte des Shops.
 *
 * Warum überhaupt im Code? Weil leere Rechtsseiten schlimmer sind als
 * Entwürfe: Wer an Verbraucher verkauft, braucht eine Widerrufsbelehrung, ein
 * Muster-Widerrufsformular und Angaben zu Versand und Zahlung — fehlt das,
 * verlängert sich die Widerrufsfrist, und Abmahnungen kosten mehr als eine
 * Stunde Lesen.
 *
 * Die Texte sind bewusst als Entwurf gekennzeichnet und tragen einen Hinweis
 * am Ende. Sie ersetzen keine Rechtsberatung und müssen zur tatsächlichen
 * Praxis der Werkstatt passen — vor allem bei den Rücksendekosten.
 */

type Sprache = 'de' | 'fr' | 'en'

export type Firmenangaben = {
  name?: string | null
  anschrift?: string | null
  email?: string | null
  telefon?: string | null
}

const platzhalter = (angaben: Firmenangaben, sprache: Sprache): string => {
  const zeilen = [
    angaben.name,
    angaben.anschrift?.replace(/\n/g, ', '),
    angaben.email,
    angaben.telefon,
  ].filter(Boolean)
  if (zeilen.length) return zeilen.join(' · ')
  return sprache === 'fr'
    ? '[Raison sociale, adresse, e-mail, téléphone]'
    : sprache === 'en'
      ? '[Company, address, email, phone]'
      : '[Firmenname, Anschrift, E-Mail, Telefon]'
}

const HINWEIS: Record<Sprache, string> = {
  de: 'Hinweis der Werkstatt: Dieser Text ist ein Entwurf und wurde noch nicht anwaltlich geprüft. Bitte vor dem Verkaufsstart prüfen lassen und an die tatsächliche Praxis anpassen.',
  fr: "Note de l'atelier : ce texte est un projet qui n'a pas encore été validé juridiquement. À faire vérifier avant la mise en vente et à adapter à la pratique réelle.",
  en: 'Note from the workshop: this text is a draft and has not yet been checked by a lawyer. Please have it reviewed before selling and adapt it to actual practice.',
}

function widerruf(angaben: Firmenangaben, sprache: Sprache): string {
  const wer = platzhalter(angaben, sprache)

  if (sprache === 'fr') {
    return [
      'Droit de rétractation',
      "Vous disposez d'un délai de quatorze jours pour vous rétracter, sans avoir à justifier de motifs. Le délai court à compter du jour où vous, ou un tiers désigné par vous et différent du transporteur, prenez physiquement possession du bien.",
      `Pour exercer ce droit, informez-nous de votre décision par une déclaration dénuée d'ambiguïté (lettre ou courriel) : ${wer}. Vous pouvez utiliser le modèle de formulaire ci-dessous, sans obligation.`,
      "Pour que le délai soit respecté, il suffit que votre communication soit envoyée avant son expiration.",
      'Effets de la rétractation',
      "En cas de rétractation, nous vous remboursons tous les paiements reçus, y compris les frais de livraison standard, sans retard excessif et au plus tard quatorze jours à compter du jour où nous sommes informés de votre décision. Nous pouvons différer le remboursement jusqu'à réception du bien ou jusqu'à ce que vous ayez fourni une preuve d'expédition.",
      "Vous supportez les coûts directs du renvoi du bien. Les meubles en acier étant lourds et encombrants, ces frais peuvent être élevés ; nous les estimons sur demande avant votre commande.",
      "Votre responsabilité n'est engagée qu'à l'égard de la dépréciation du bien résultant de manipulations autres que celles nécessaires pour établir sa nature, ses caractéristiques et son bon fonctionnement.",
      'Exception : pièces réalisées sur mesure',
      "Conformément à l'article L221-28 du code de la consommation, le droit de rétractation ne s'applique pas aux biens confectionnés selon les spécifications du consommateur ou nettement personnalisés. Dans cet atelier, chaque pièce est fabriquée à l'unité : les commandes sur mesure et les pièces réalisées d'après vos indications (dimensions, coloris RAL, exécution) en sont donc exclues dès le début de la fabrication.",
      "Les pièces déjà terminées et disponibles en atelier ne sont pas concernées par cette exception : pour elles, le droit de rétractation s'applique pleinement.",
      'Exception : contenus numériques',
      "Conformément à l'article L221-28 13° du code de la consommation, le droit de rétractation ne s'applique pas non plus à la fourniture de contenus numériques non fournis sur un support matériel — plans de construction et fichiers de fabrication à télécharger, par exemple. Le droit de rétractation s'éteint dès lors que vous avez expressément demandé l'exécution avant la fin du délai de rétractation et reconnu que vous perdiez ainsi ce droit. Ces deux points sont recueillis lors de la commande et conservés, horodatés, avec celle-ci ; les fichiers sont disponibles dès réception du paiement.",
      HINWEIS.fr,
    ].join('\n\n')
  }

  if (sprache === 'en') {
    return [
      'Right of withdrawal',
      'You have the right to withdraw from this contract within fourteen days without giving any reason. The period begins on the day on which you, or a third party named by you who is not the carrier, takes possession of the goods.',
      `To exercise this right you must inform us by means of a clear statement (letter or email): ${wer}. You may use the model withdrawal form below, but you are not obliged to.`,
      'To meet the deadline it is sufficient to send your notice before the withdrawal period expires.',
      'Consequences of withdrawal',
      'If you withdraw, we will refund all payments received from you, including the costs of standard delivery, without undue delay and no later than fourteen days after we receive your notice. We may withhold the refund until we have received the goods back or you have supplied proof of return.',
      'You bear the direct cost of returning the goods. Steel furniture is heavy and bulky, so this can be substantial; we will estimate it on request before you order.',
      'You are only liable for any diminished value of the goods resulting from handling other than what is necessary to establish their nature, characteristics and functioning.',
      'Exception: made-to-order pieces',
      'There is no right of withdrawal for goods that are not prefabricated and are made on the basis of an individual choice or decision by the consumer, or which are clearly tailored to personal needs. In this workshop every piece is made individually, so bespoke commissions and pieces built to your specifications (dimensions, RAL colour, execution) are excluded once production begins.',
      'Finished pieces already available in the workshop are not covered by this exception — for those the right of withdrawal applies in full.',
      'Exception: digital content',
      'Nor is there a right of withdrawal for digital content not supplied on a tangible medium — construction plans and production files for download, for example. The right of withdrawal lapses once you have expressly requested that we begin performance before the withdrawal period ends and have acknowledged that you thereby lose that right. Both are collected at checkout and stored with your order, with a timestamp; the files are available as soon as the payment arrives.',
      HINWEIS.en,
    ].join('\n\n')
  }

  return [
    'Widerrufsrecht',
    'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Frist beginnt an dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Ware in Besitz genommen haben.',
    `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung (Brief oder E-Mail) über Ihren Entschluss informieren: ${wer}. Sie können dafür das untenstehende Muster-Widerrufsformular verwenden, das aber nicht vorgeschrieben ist.`,
    'Zur Wahrung der Frist genügt es, dass Sie die Mitteilung vor Ablauf der Widerrufsfrist absenden.',
    'Folgen des Widerrufs',
    'Wenn Sie widerrufen, erstatten wir Ihnen alle Zahlungen zurück, die wir von Ihnen erhalten haben, einschließlich der Kosten der Standardlieferung, unverzüglich und spätestens binnen vierzehn Tagen ab Eingang Ihrer Mitteilung. Wir können die Rückzahlung zurückbehalten, bis die Ware wieder bei uns ist oder Sie den Rückversand nachgewiesen haben.',
    'Die unmittelbaren Kosten der Rücksendung tragen Sie. Stahlmöbel sind schwer und sperrig, die Kosten können deshalb erheblich sein — auf Anfrage schätzen wir sie vor Ihrer Bestellung.',
    'Für einen Wertverlust der Ware müssen Sie nur aufkommen, wenn er auf einen Umgang zurückgeht, der über die Prüfung von Beschaffenheit, Eigenschaften und Funktionsweise hinausgeht.',
    'Ausnahme: Einzelanfertigungen',
    'Kein Widerrufsrecht besteht bei Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch Sie maßgeblich ist oder die eindeutig auf Ihre persönlichen Bedürfnisse zugeschnitten sind. In dieser Werkstatt entsteht jedes Stück einzeln: Maßanfertigungen und nach Ihren Vorgaben gefertigte Stücke (Maße, RAL-Farbton, Ausführung) sind davon erfasst, sobald die Fertigung beginnt.',
    'Fertige Werkstattstücke, die bereits vorhanden sind, fallen nicht unter diese Ausnahme — dort gilt das Widerrufsrecht uneingeschränkt.',
    'Ausnahme: digitale Inhalte',
    'Kein Widerrufsrecht besteht ferner bei digitalen Inhalten, die nicht auf einem körperlichen Datenträger geliefert werden — etwa Bauplänen und Fertigungsdateien zum Herunterladen. Das Widerrufsrecht erlischt, wenn Sie beim Bestellen ausdrücklich verlangt haben, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung beginnen, und Sie bestätigt haben, dass Sie damit Ihr Widerrufsrecht verlieren. Beides wird an der Kasse abgefragt und mit Zeitpunkt zu Ihrer Bestellung festgehalten; die Dateien stehen unmittelbar nach dem Zahlungseingang bereit.',
    HINWEIS.de,
  ].join('\n\n')
}

function widerrufsformular(angaben: Firmenangaben, sprache: Sprache): string {
  const wer = platzhalter(angaben, sprache)

  if (sprache === 'fr') {
    return [
      'Modèle de formulaire de rétractation',
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
      'Model withdrawal form',
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
    'Muster-Widerrufsformular',
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
      'Livraison',
      "Les frais de port sont indiqués par article et additionnés dans le panier ; le montant exact apparaît avant la commande. L'enlèvement à l'atelier est possible et gratuit — nous convenons ensemble de la date.",
      "Chaque pièce est fabriquée à l'unité. Le délai de fabrication figure sur la fiche produit et court à partir du paiement ; nous vous informons dès que la fabrication commence et dès l'expédition, avec le numéro de suivi.",
      'Paiement',
      "Le paiement se fait au choix via PayPal ou sur facture par virement — les deux voies sont proposées pour chaque article. Via PayPal — avec un compte PayPal, une carte ou un prélèvement ; un compte PayPal n'est pas nécessaire — le montant total est dû à la commande ; si PayPal vous propose un paiement différé ou en plusieurs fois, c'est un accord entre vous et PayPal, sans effet sur notre créance. Sur facture, vous recevez la facture par e-mail, avec un QR code pour votre application bancaire ; pour les pièces fabriquées à l'unité, le montant se règle en plusieurs tranches exprimées en pourcentage : un acompte à la confirmation de commande, avant le début de la fabrication ; une facture intermédiaire dès que l'étape convenue est atteinte — en règle générale lorsque la structure de la pièce est achevée ; la facture de solde avant la livraison. Les pourcentages figurent sur la fiche produit et sont repris dans la confirmation de commande. La fabrication commence à réception de l'acompte, la livraison après règlement du solde.",
      'Prix',
      'Tous les prix sont TTC. La TVA applicable est indiquée sur la confirmation de commande et sur la facture.',
      HINWEIS.fr,
    ].join('\n\n')
  }

  if (sprache === 'en') {
    return [
      'Delivery',
      'Shipping costs are shown per item and added up in the cart; the exact amount appears before you order. Collection from the workshop is possible and free of charge — we agree on a date with you.',
      'Every piece is made individually. The production time is stated on the product page and starts once payment is received; we let you know when production begins and again when the piece ships, including the tracking number.',
      'Payment',
      'You can pay either by PayPal or on invoice by bank transfer — both routes are offered for every item. With PayPal — using a PayPal account, a card or direct debit; a PayPal account is not required — the full amount is due towards us when you order. Whether PayPal additionally offers you deferred payment or instalments is PayPal\'s decision — that is an agreement between you and PayPal and does not affect our claim. On invoice you receive the bill by email, with a QR code for your banking app; for pieces made to order the amount is split into instalments given as percentages: a deposit with the order confirmation, before production starts; an interim invoice once the agreed stage is reached — as a rule when the body of the piece stands; the final invoice before delivery. The percentages are stated on the product page and again in the order confirmation. Production starts once the deposit has arrived, and the piece is delivered once the final invoice has been settled.',
      'Prices',
      'All prices include VAT. The applicable VAT is shown on the order confirmation and on the invoice.',
      HINWEIS.en,
    ].join('\n\n')
  }

  return [
    'Lieferung',
    'Die Versandkosten stehen je Artikel dabei und werden im Warenkorb zusammengerechnet; der genaue Betrag steht vor dem Bestellen. Abholung in der Werkstatt ist möglich und kostenfrei — den Termin stimmen wir mit Ihnen ab.',
    'Jedes Stück entsteht einzeln. Die Fertigungszeit steht am Artikel und beginnt mit dem Zahlungseingang; wir melden uns, wenn die Fertigung startet, und noch einmal beim Versand mit der Sendungsnummer.',
    'Zahlung',
    'Bezahlt wird wahlweise über PayPal oder auf Rechnung per Überweisung — beide Wege stehen bei jedem Artikel zur Wahl. Über PayPal — mit PayPal-Konto, Karte oder Lastschrift; ein PayPal-Konto ist dafür nicht nötig — ist uns gegenüber der volle Betrag mit der Bestellung fällig. Ob PayPal Ihnen darüber hinaus ein späteres Zahlungsziel oder eine Ratenzahlung anbietet, entscheidet PayPal — das ist eine Vereinbarung zwischen Ihnen und PayPal, auf unsere Forderung wirkt sie sich nicht aus. Auf Rechnung bekommen Sie die Rechnung per E-Mail, mit QR-Code für die Banking-App; bei Einzelanfertigungen verteilt sich der Betrag auf Teilbeträge, die als Prozentsätze festgelegt sind: eine Anzahlung mit der Auftragsbestätigung, vor Fertigungsbeginn; eine Zwischenrechnung, sobald der vereinbarte Fertigungsabschnitt erreicht ist — in aller Regel, wenn der Rohbau des Stücks steht; die Schlussrechnung vor der Auslieferung. Die Anteile stehen am Artikel und noch einmal in der Auftragsbestätigung. Gefertigt wird nach Eingang der Anzahlung, ausgeliefert nach Ausgleich der Schlussrechnung.',
    'Preise',
    'Alle Preise verstehen sich inklusive Mehrwertsteuer. Die enthaltene Steuer ist auf der Bestellbestätigung und auf der Rechnung ausgewiesen.',
    HINWEIS.de,
  ].join('\n\n')
}

const SPRACHEN: Sprache[] = ['de', 'fr', 'en']

/**
 * Schreibt die Entwürfe in die Rechtsseiten — standardmäßig nur dort, wo noch
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
  }

  const geschrieben: string[] = []

  for (const sprache of SPRACHEN) {
    const vorhanden = (await payload.findGlobal({
      slug: 'legal',
      locale: sprache,
      fallbackLocale: false as never,
      depth: 0,
    })) as Record<string, any>

    const felder: Record<string, string> = {
      widerruf: widerruf(angaben, sprache),
      widerrufsformular: widerrufsformular(angaben, sprache),
      versandZahlung: versandZahlung(sprache),
    }

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
