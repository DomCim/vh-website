export const locales = ['de', 'fr'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'de'

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

const de = {
  nav: {
    news: 'News',
    contact: 'Kontakt',
    cart: 'Warenkorb',
    promotions: 'Aktionen',
    menu: 'Menü',
  },
  home: {
    categoriesTitle: 'Unsere Produktwelten',
    newsTitle: 'Aktuelles',
    allNews: 'Alle News',
    valuesTitle: 'Wofür wir stehen',
    highlightsTitle: 'Ihr Stück. Ihre Entscheidung.',
    galleryTitle: 'Einblicke in die Werkstatt',
    discover: 'Entdecken',
  },
  product: {
    addToCart: 'In den Warenkorb',
    added: 'Hinzugefügt ✓',
    onRequest: 'Auf Anfrage',
    requestNow: 'Jetzt anfragen',
    variant: 'Ausführung',
    color: 'Farbe',
    from: 'ab',
    priceNote: 'inkl. MwSt.',
    shippingPerItem: 'Lieferung pro Stück',
    freeShipping: 'Versandkostenfrei',
    pickupAvailable: 'Abholung möglich',
    unavailable: 'Derzeit nicht verfügbar',
    backToCategory: 'Zurück zur Übersicht',
  },
  cart: {
    title: 'Warenkorb',
    empty: 'Ihr Warenkorb ist leer.',
    continueShopping: 'Weiter stöbern',
    subtotal: 'Zwischensumme',
    discount: 'Rabatt',
    shipping: 'Versand',
    total: 'Gesamtsumme',
    checkout: 'Zur Kasse',
    remove: 'Entfernen',
    quantity: 'Menge',
    promoCode: 'Gutscheincode',
    applyCode: 'Einlösen',
    promoApplied: 'Aktion angewendet',
    promoInvalid: 'Dieser Code ist nicht gültig.',
    shippingLabel: 'Lieferung',
    priceNote: 'Preise inkl. MwSt. Bei Abholung entfallen die Versandkosten.',
  },
  checkout: {
    title: 'Kasse',
    deliveryMethod: 'Versandart',
    optionShipping: 'Lieferung',
    optionPickup: 'Abholung (versandkostenfrei)',
    pickupNote: 'Die Abholadresse und den Termin stimmen wir nach der Bestellung mit Ihnen ab.',
    shipping: 'Versand',
    contactData: 'Ihre Kontaktdaten',
    name: 'Vor- und Nachname',
    email: 'E-Mail-Adresse',
    phone: 'Telefon (optional)',
    shippingAddress: 'Lieferadresse',
    line1: 'Straße und Hausnummer',
    line2: 'Adresszusatz (optional)',
    postalCode: 'PLZ',
    city: 'Ort',
    country: 'Land',
    note: 'Anmerkung zur Bestellung (optional)',
    payNow: 'Kostenpflichtig bestellen',
    redirectNote: 'Zur Zahlung werden Sie sicher zu Stripe weitergeleitet.',
    backToCart: 'Zurück zum Warenkorb',
    error: 'Die Bestellung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.',
  },
  thanks: {
    title: 'Vielen Dank für Ihre Bestellung!',
    text: 'Wir haben Ihre Bestellung erhalten und melden uns in Kürze mit allen Details zur Lieferung.',
    backHome: 'Zur Startseite',
  },
  news: {
    title: 'News',
    readMore: 'Weiterlesen',
    empty: 'Derzeit keine Beiträge.',
  },
  promotions: {
    title: 'Aktuelle Aktionen',
    validUntil: 'Gültig bis',
    empty: 'Derzeit keine laufenden Aktionen.',
    code: 'Code',
  },
  contact: {
    title: 'Kontakt',
    intro: 'Sie haben Fragen zu unseren Produkten oder wünschen eine individuelle Anfertigung? Schreiben Sie uns.',
    name: 'Name',
    email: 'E-Mail-Adresse',
    phone: 'Telefon (optional)',
    message: 'Ihre Nachricht',
    send: 'Nachricht senden',
    success: 'Vielen Dank für Ihre Nachricht! Wir melden uns so schnell wie möglich.',
    error: 'Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
    phoneLabel: 'Telefon',
    emailLabel: 'E-Mail',
  },
  footer: {
    impressum: 'Impressum',
    datenschutz: 'Datenschutzerklärung',
    agb: 'AGB',
    followUs: 'Folgen Sie uns',
    contact: 'Kontakt',
  },
  common: {
    loading: 'Wird geladen …',
    error: 'Es ist ein Fehler aufgetreten.',
    backHome: 'Zur Startseite',
  },
}

type Dictionary = typeof de

const fr: Dictionary = {
  nav: {
    news: 'Actualités',
    contact: 'Contact',
    cart: 'Panier',
    promotions: 'Offres',
    menu: 'Menu',
  },
  home: {
    categoriesTitle: 'Nos univers de produits',
    newsTitle: 'Actualités',
    allNews: 'Toutes les actualités',
    valuesTitle: 'Nos valeurs',
    highlightsTitle: 'Votre pièce. Votre choix.',
    galleryTitle: "Aperçu de l'atelier",
    discover: 'Découvrir',
  },
  product: {
    addToCart: 'Ajouter au panier',
    added: 'Ajouté ✓',
    onRequest: 'Sur demande',
    requestNow: 'Demander maintenant',
    variant: 'Version',
    color: 'Couleur',
    from: 'à partir de',
    priceNote: 'TVA incluse',
    shippingPerItem: 'Livraison par pièce',
    freeShipping: 'Livraison gratuite',
    pickupAvailable: 'Retrait sur place possible',
    unavailable: 'Actuellement indisponible',
    backToCategory: "Retour à l'aperçu",
  },
  cart: {
    title: 'Panier',
    empty: 'Votre panier est vide.',
    continueShopping: 'Continuer vos achats',
    subtotal: 'Sous-total',
    discount: 'Remise',
    shipping: 'Livraison',
    total: 'Total',
    checkout: 'Passer à la caisse',
    remove: 'Supprimer',
    quantity: 'Quantité',
    promoCode: 'Code promo',
    applyCode: 'Appliquer',
    promoApplied: 'Offre appliquée',
    promoInvalid: "Ce code n'est pas valide.",
    shippingLabel: 'Livraison',
    priceNote: 'Prix TTC. En cas de retrait sur place, les frais de livraison sont offerts.',
  },
  checkout: {
    title: 'Caisse',
    deliveryMethod: 'Mode de livraison',
    optionShipping: 'Livraison',
    optionPickup: 'Retrait sur place (sans frais de livraison)',
    pickupNote: "Nous conviendrons de l'adresse et de la date de retrait avec vous après la commande.",
    shipping: 'Livraison',
    contactData: 'Vos coordonnées',
    name: 'Nom et prénom',
    email: 'Adresse e-mail',
    phone: 'Téléphone (facultatif)',
    shippingAddress: 'Adresse de livraison',
    line1: 'Rue et numéro',
    line2: "Complément d'adresse (facultatif)",
    postalCode: 'Code postal',
    city: 'Ville',
    country: 'Pays',
    note: 'Remarque sur la commande (facultatif)',
    payNow: 'Commander avec obligation de paiement',
    redirectNote: 'Vous serez redirigé en toute sécurité vers Stripe pour le paiement.',
    backToCart: 'Retour au panier',
    error: "La commande n'a pas pu être lancée. Veuillez réessayer.",
  },
  thanks: {
    title: 'Merci pour votre commande !',
    text: 'Nous avons bien reçu votre commande et vous contacterons prochainement avec tous les détails de livraison.',
    backHome: "Retour à l'accueil",
  },
  news: {
    title: 'Actualités',
    readMore: 'Lire la suite',
    empty: 'Aucun article pour le moment.',
  },
  promotions: {
    title: 'Offres en cours',
    validUntil: "Valable jusqu'au",
    empty: 'Aucune offre en cours actuellement.',
    code: 'Code',
  },
  contact: {
    title: 'Contact',
    intro: 'Vous avez des questions sur nos produits ou souhaitez une fabrication sur mesure ? Écrivez-nous.',
    name: 'Nom',
    email: 'Adresse e-mail',
    phone: 'Téléphone (facultatif)',
    message: 'Votre message',
    send: 'Envoyer le message',
    success: 'Merci pour votre message ! Nous vous répondrons dans les plus brefs délais.',
    error: "Le message n'a pas pu être envoyé. Veuillez réessayer plus tard.",
    phoneLabel: 'Téléphone',
    emailLabel: 'E-mail',
  },
  footer: {
    impressum: 'Mentions légales',
    datenschutz: 'Politique de confidentialité',
    agb: 'CGV',
    followUs: 'Suivez-nous',
    contact: 'Contact',
  },
  common: {
    loading: 'Chargement …',
    error: "Une erreur s'est produite.",
    backHome: "Retour à l'accueil",
  },
}

const dictionaries: Record<Locale, Dictionary> = { de, fr }

export function t(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale]
}

export function formatPrice(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function formatDate(value: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}
