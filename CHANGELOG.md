# Changelog

Was sich auf vincent-hellmann.com (vh.dominikdill.com) getan hat — neueste Einträge zuerst. Dieses Protokoll ist im Admin unter **Changelog** einsehbar.

## 17.08.2026 — Verwaltung als App installierbar

- Der Admin (/admin) lässt sich jetzt als App auf den Home-Bildschirm legen: iPhone/iPad über Safari „Teilen → Zum Home-Bildschirm", Android/Desktop-Chrome über „App installieren".
- Eigenes App-Icon („VH"-Monogramm mit Corten-Strich), startet im Vollbild ohne Browser-Leisten.

## 17.08.2026 — Corten-Striche unter Überschriften

- Überschriften tragen jetzt einen feinen Strich in Corten-Bronze, der nach rechts weich ausläuft — je größer die Überschrift, desto länger der Strich (zentrierte Titel laufen zu beiden Seiten aus).
- Angewendet auf Startseiten-Abschnitte (inkl. der kleinen Etiketten wie „Maßanfertigung") und die Seitentitel von News, Referenzen, Über uns, Aktionen, Kontakt und Kategorien.

## 17.08.2026 — Elegantere Diashow & Bronze-Akzent

- Hero-Diashow mit filmischer Kamerablende (1,4 s): Das neue Bild setzt sanft auf, Titel laufen aus einer Maske ein, die Unterzeile folgt versetzt.
- Punkte unter dem Slider durch schmale Balken ersetzt — der aktive füllt sich über die Anzeigedauer, man sieht, wann gewechselt wird.
- Dezentere Pfeile (schlanke Chevrons statt Kreis-Buttons); nach manuellem Blättern startet der Automatik-Takt neu.
- Neue Akzentfarbe **Bronze/Corten** (greift das Material der Arbeiten auf): feine Punkte im Laufband, Hover-Zustände, Warenkorb-Badge, Rubrik-Etiketten, Zeitleiste. Kauf-Buttons bleiben schwarz und wechseln beim Überfahren auf Bronze. Aktions-Banner und Rabatte bleiben rot.

## 17.08.2026 — Farb-Choreografie von Header & Startseite

- Der Header übernimmt auf der Startseite den Farbton des oberen Bildrands des aktiven Hero-Bildes; Logo und Navigation wechseln je nach Helligkeit auf Weiß.
- Unter dem Hero „strahlt" die Farbe des unteren Bildrands auf die Seite ab und läuft weich ins Weiß aus — bei jedem Bild automatisch in dessen Farbe.
- Feinschliff: echte Kantenfarben (Durchschnitt der obersten/untersten Pixelzeilen), Abdunklung des Bildes eingerechnet, Verlauf endet sicher vor dem Laufband.

## 17.08.2026 — Kasse, PayPal, Steuern, Redaktion

- Zahlungsart (Karte/PayPal) ist vor dem Bestellen sichtbar wählbar; Button und Hinweis passen sich an.
- Bei PayPal kommt die Lieferadresse aus dem PayPal-Konto; abweichende Adresse optional per Häkchen. Die von PayPal bestätigte Adresse wird in der Bestellung gespeichert.
- TVA-Ausweis: Firmenangaben (SIRET, TVA-Nr., Steuersatz) in den Site-Einstellungen; Bestellmails weisen die enthaltene Steuer aus und tragen die Pflichtangaben im Fuß.
- News, Produkte und Projekte erzeugen ihre URL (Slug) jetzt automatisch aus dem Titel — Feld einfach leer lassen.
- Editor mit fest angepinnter Werkzeugleiste — deutlich angenehmer am Handy.
- Deployment: TRANSLATE_EN-Schalter wird korrekt durchgereicht; PayPal-/Instagram-Zugänge auch per Umgebungsvariable möglich.

## 17.08.2026 — Reichweite & Präsentation

- Neue Referenzen-Seite (Projekte für Kommunen, Gewerbe, Privat) mit Filter und Teaser auf der Startseite.
- Über-uns-Seite mit Werkstatt-Geschichte und Zeitleiste.
- Kundenstimmen auf Startseite und Produktseiten (nur echte Stimmen eintragen!).
- Optionales Video im Hero-Slider.
- Ratgeber-Rubrik in den News inkl. zwei Startartikeln (DE/FR).
- Instagram-Autopost zusätzlich zu Facebook; Pinterest-Verifizierung hinterlegbar.
- Premium-Scroll-Animationen (sanftes Scrollen, Text-Reveals, Laufband, mitdenkender Header).

## 17.08.2026 — Englisch, SEO & Betrieb

- Englisch als dritte Sprache (Inhalte werden beim Deploy automatisch eingespielt).
- SEO-Paket: Sitemap, robots.txt, hreflang, strukturierte Daten für Produkte/Artikel, Open-Graph-Bilder.
- Produktanfrage-Formular direkt am Artikel („auf Anfrage").
- Versand-Mail mit Sendungsverfolgung beim Umstellen auf „Versendet".
- PayPal als zweite Zahlart.
- Betrieb: Gesundheits-Endpunkt, tägliche Datenbank-Backups (14 Tage), Überwachung per Home Assistant.

## 17.08.2026 — Start der neuen Website

- Kompletter Neuaufbau als eigene, selbst verwaltete Website: Design 1:1 an die bestehende Seite angelehnt (Logo-Schriftzug, Navigation, Hero-Slider, dunkler Footer).
- Admin-Backend unter /admin: Produkte, Kategorien, News, Aktionen, Bestellungen, Bilder, Seiteninhalte, rechtliche Texte — alles selbst pflegbar, dreisprachig (DE/FR/EN).
- Online-Shop mit Warenkorb, Stripe-Kartenzahlung, Versandkosten je Artikel und Abholoption.
- Aktionen mit Rabattcodes und Banner auf der Startseite.
- Facebook-Autopost für News-Beiträge.
- Zugänge (SMTP, Stripe, PayPal, Facebook/Instagram) bequem im Admin unter Integrationen pflegbar.
- Betrieb per Docker hinter Traefik, automatischer Image-Build über GitHub Actions, persistente Bilder und Datenbank.
