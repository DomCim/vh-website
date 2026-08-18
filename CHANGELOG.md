# Changelog

Was sich auf vincent-hellmann.com (vh.dominikdill.com) getan hat — neueste Einträge zuerst. Dieses Protokoll steht im Büro unter **Neuerungen** (`/office/neuerungen`).

## 18.08.2026 — Pflichten, Geld und die Dinge hinter dem Happy Path

- **Elektronische Rechnung.** Frankreich verlangt ab dem 1. September 2026, dass Unternehmen E-Rechnungen empfangen können; das Ausstellen folgt gestaffelt. Ausgangsrechnungen entstehen deshalb jetzt als **Factur-X**: ein PDF/A-3, in dem dieselbe Rechnung zusätzlich als XML nach EN 16931 steckt. Das Blatt sieht aus wie vorher, die Maschine liest die Daten — und beides kommt aus denselben Feldern, damit PDF und XML nie auseinanderlaufen. Neu dafür: IBAN, die Option „TVA d'après les débits", SIRET und TVA-Nummer des Kunden, Bestellnummer, Leistungsdatum. Fehlt etwas, sagt es die Rechnungsseite, bevor eine Plattform sie zurückweist. Die Anbindung an eine Plateforme Agréée bleibt eine Vertragsfrage.
- **Widerrufsrecht und die Seiten, die dem Shop fehlten.** Es gab Impressum, Datenschutz und AGB — aber keine Widerrufsbelehrung, kein Muster-Widerrufsformular, nichts zu Versand und Zahlung. Alles drei ist jetzt da, dreisprachig, mit Entwürfen zum Loslegen. Wichtig für die Werkstatt ist der zweite Teil der Belehrung: Bei einem nach Kundenvorgabe gefertigten Einzelstück besteht kein Widerrufsrecht — aber nur, wenn es ausdrücklich dasteht. In der Kasse wird beides bestätigt, bevor bestellt wird, und mit Zeitpunkt an der Bestellung festgehalten. Der Knopf heißt jetzt „Zahlungspflichtig bestellen".
- **Sicherung auf die NAS.** Bisher sicherte ein Nebencontainer die Datenbank in ein Volume auf demselben Server — die Bilder gar nicht. Jetzt packt die App selbst ein Archiv aus Datenbank **und** Mediathek und schiebt es per Samba oder WebDAV auf den Netzwerkspeicher. Im Büro steht, wann zuletzt gesichert wurde, und ein Knopf macht es sofort. In jedem Archiv liegt eine Anleitung zum Zurückspielen — im Ernstfall liest niemand mehr Dokumentation.
- **Ein Wartungslauf, der nachhält.** Viertelstündlich prüft das System, was ansteht: nächtliche Sicherung, Aufräumen kurzlebiger Daten, und die Meldung, wenn Sicherung oder Postfach-Abruf stillstehen. **Fällige Belege** gehören dazu: Steht auf einer Eingangsrechnung ein Zahlungsziel — die KI liest es beim Erfassen mit —, meldet sich das Büro ab drei Tagen vorher jeden Tag, bis der Beleg auf „bezahlt" steht. Vorher bleibt es still.
- **Mahnen und nachfassen.** An einer offenen Rechnung führt ein Knopf zur nächsten Stufe: Zahlungserinnerung ohne Kosten, Mahnung mit der gesetzlichen Pauschale von 40 €, letzte Mahnung mit Frist. Welche dran ist, weiß das Büro selbst. Angebote merken sich beim Verschicken den Tag und melden sich nach einer Woche ohne Antwort — die Hälfte der Aufträge entscheidet sich daran, ob jemand anruft.
- **Newsletter.** Anmeldung im Fuß jeder Seite, Bestätigung per Mail, Abmeldung mit einem Klick, Versand aus dem Büro mit Testlauf davor. Bei Einzelstücken ist die Liste der Interessierten das wertvollste Gut — bisher gab es sie nicht. Und die **Kundenstimmen** füllen sich endlich von selbst: Zwei Wochen nach dem Versand fragt eine Mail nach ein paar Sätzen, genau einmal; was zurückkommt, liegt zur Prüfung im Admin statt sofort auf der Website.
- **Die Werkstatt rechnet mit.** Material und Dienstleister waren erfasst, die Arbeitszeit nicht — also die größte Position. Am Auftrag steht jetzt eine Stoppuhr (großer Knopf, auch mit Handschuhen), Zeit lässt sich nachtragen, und daraus entstehen Lohnkosten neben Material und Fremdleistung. Am Artikel dieselbe Rechnung vor dem Verkauf, samt Preisvorschlag; liegt der Website-Preis unter dem Einsatz, steht das da. Dazu ein **Kalender**, der Fertigstellungen, Liefertermine, ablaufende Angebote und fällige Belege auf ein Blatt legt, und ein **Lieferschein** zum Mitgeben — bei Montagen zugleich das Abnahmeprotokoll.
- **Bilder in der Größe, die das Gerät braucht.** Fünf Zuschnitte statt drei, alle als WebP, ausgeliefert per `srcset`. Vorher lud ein Handy dieselbe Datei wie ein 4K-Bildschirm. Vorhandene Bilder werden einmalig mit `pnpm bilder-neu` nachgerechnet.
- **Absicherung**: CSP, HSTS und die übrigen Sicherheits-Kopfzeilen; Bremsen an MCP-, MFA- und Kassen-Endpunkt; abgelaufene Anmeldecodes und altes Mailprotokoll werden aufgeräumt. Dazu Tests für die Rechenwege mit Geld — Steuer, Nachlass, Factur-X-Summen —, denn dort fällt ein Fehler erst beim Steuerberater auf.

## 18.08.2026 — Das Büro: Betrieb, Postfach und Meldungen aufs Handy

- **Ein eigener Arbeitsplatz für den Betrieb.** Unter `/office` gibt es jetzt eine zweite Oberfläche neben der Website-Verwaltung — ruhiger, größer, fürs Handy gemacht und als App installierbar. Die Anmeldung ist dieselbe wie im Admin, inklusive Zwei-Faktor. Damit ist die Trennung klar: Die Website-Verwaltung ist für alles da, was nach außen geht, das Büro für alles, was niemand von außen sieht. Belege, Bestellungen, Aufträge und Zahlen stehen deshalb nur noch dort, und zwar an genau einer Stelle.
- **Angebot, Auftrag, Rechnung an einem Faden.** Angebote entstehen mit Positionen, Steuer und zugesagter Fertigungszeit; ihre Nummer bekommen sie erst beim Versenden, damit verworfene Entwürfe keine Lücke in der Reihe hinterlassen. Ein angenommenes Angebot wird per Klick zum Fertigungsauftrag oder zur Rechnung — ohne die Positionen ein zweites Mal einzutippen. Bezahlte Shop-Bestellungen legen ihren Auftrag von selbst an, mit dem Preis von der Website; fertige Werkstattstücke bekommen keinen, die liegen ja schon da.
- **Das System weiß jetzt, was ein Stück braucht.** Zu jedem Artikel lassen sich Material mit Menge und externe Dienstleister hinterlegen — Verzinkerei, Beschichter, Laserschneider, mit Kosten je Stück und Vorlaufzeit. Daraus rechnet das Büro den Einsatz je Stück gegen den Website-Preis. Kommt eine Bestellung herein, steht am Auftrag, ob alles im Haus ist und was nachbestellt werden muss — bevor die Kundschaft wartet. Abgebucht wird das Material erst beim Fertigmelden.
- **Postfach im Büro.** Mehrere E-Mail-Konten lesen, beantworten, Anhänge öffnen und aufräumen, ohne ein anderes Programm zu starten. Gelesen wird direkt beim Anbieter — was hier gelöscht wird, ist auch am Rechner weg —, Antworten gehen mit der Adresse des jeweiligen Postfachs raus und landen als Kopie in „Gesendet". Aus einer Anfrage führt ein Klick ins fertig vorbereitete Antwortfenster.
- **Ausgangsprotokoll.** Bestellbestätigungen, Zugangscodes und Versandmails gehen automatisch raus, und bisher sah sie niemand. Jetzt steht in einer Liste, was verschickt wurde, an wen und ob der Mailserver es angenommen hat. Auf die Frage „ich habe nie eine Bestätigung bekommen" gibt es damit eine Antwort statt eines Achselzuckens.
- **Meldungen aufs Handy.** Ist das Büro als App abgelegt, meldet es neue Bestellungen, neue Anfragen und Mails, die nicht zugestellt werden konnten — auch neue Post im Postfach. Wer in der Werkstatt steht, muss dafür nicht mehr alle zehn Minuten nachschauen.
- **Belege abfotografieren statt abtippen.** Eingangsrechnungen werden im Büro hochgeladen und von Claude ausgelesen — Lieferant, Datum, Netto, Steuer, Brutto stehen dann schon da und müssen nur bestätigt werden. Der Scan bleibt am Eintrag hängen, denn ohne Beleg zählt die Buchung beim Finanzamt nicht. Am Jahresende gibt es einen Auszug für den Steuerberater: Einnahmen, Ausgaben, Belege — fertig.
- **Inventar und Inventur zu Ende gebaut**: Posten anlegen und ändern, Mindestbestände im Blick, und die Inventur bringt die Zählliste mit allen Posten und ihrem Soll-Bestand fertig mit. Beim Abschließen wandern die gezählten Mengen ins Inventar, danach ist der Lauf gesperrt.
- Dazu die Geschäftspartner-Kartei für Lieferanten, Kunden und Dienstleister sowie Bestellungen und Anfragen mit Status, Sendungsnummer und interner Notiz.

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
