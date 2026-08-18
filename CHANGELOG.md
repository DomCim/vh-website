# Changelog

Was sich auf vincent-hellmann.com (vh.dominikdill.com) getan hat — neueste Einträge zuerst. Dieses Protokoll ist im Admin unter **Changelog** einsehbar.

## 18.08.2026 — Verwaltung per KI, Kundenportal und Einzelfertigung

- **Die Verwaltung per Claude kann jetzt fast alles**, was auch das Admin-Panel kann: Referenzen, Kundenstimmen, Kategorien, Anfragen und die Seitentexte kamen dazu, News und Produkte lassen sich auch lesen, ändern und löschen. Neu ist der Sprachschalter an jedem Werkzeug — französische und englische Fassungen entstehen jetzt im selben Zug, und eine Prüfung zeigt, was noch fehlt. Gelöscht wird nur nach ausdrücklicher Bestätigung.
- **Zugang bequemer und sicherer**: Die Schlüssel für den KI-Zugang werden im Admin unter „Integrationen" erzeugt, die fertige Verbindungsadresse steht daneben zum Kopieren. Zusätzlich gibt es einen Nur-Lese-Schlüssel für Auswertungen, mit dem sich nichts ändern lässt. Bilder lassen sich per Link direkt hochladen — auch große Werkstattaufnahmen bis 150 MB.
- **Zwei-Faktor-Anmeldung fürs Backend**: zusätzlich zum Passwort ein Code aus einer Authenticator-App, mit Ersatzcodes für den Notfall.
- **Anfragen gehen nicht mehr verloren.** Kontakt- und Produktanfragen landen jetzt in einer eigenen Verwaltung mit Status und Notizfeld — vorher gab es nur eine E-Mail, und wenn die unterging, war der Kontakt weg. Dazu Spam-Schutz am Formular.
- **Kundschaft sieht ihren Bestellstand selbst**: Aus jeder Bestellbestätigung führt ein Link auf eine Statusseite; unter „Konto" gibt es die vollständige Übersicht nach Anmeldung mit einem sechsstelligen Code per E-Mail (bewusst kein Klick-Link, den Outlook vorab aufruft). Die Bestellbestätigung bringt außerdem die **Rechnung als PDF** mit.
- **Einzelfertigung ist jetzt überall sichtbar.** Jedes Stück entsteht einzeln — deshalb steht am Artikel eine Fertigungszeit, ein Hinweis auf die Handarbeit begleitet Kauf und Bestätigung, und Bestellungen haben den neuen Zwischenstand **„In Fertigung"** samt eigener E-Mail. Bisher hörte die Kundschaft zwischen Zahlung und Versand wochenlang nichts. Fertige Stücke aus der Werkstatt sind als sofort lieferbar gekennzeichnet und verschwinden nach dem Verkauf automatisch.
- **Neue Seite Maßanfertigung** mit Maßen, Wunschfarbe und Skizzen-Upload — bei Einzelfertigung der eigentliche Weg zum Auftrag.
- **Suche auf der Website** über Produkte, Referenzen, News und Rubriken; Referenzen und Produkte verweisen jetzt gegenseitig aufeinander („Verwendete Arbeiten" bzw. „So sieht das in echt aus").
- Kleinkram: Sendungsnummer wird beim Umstellen auf „Versendet" zuverlässig mitgeschickt, strukturierte Daten für Referenzen und die Werkstatt, optionale cookiefreie Besucherstatistik ohne Banner.

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
