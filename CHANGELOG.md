# Changelog

Was sich auf vincent-hellmann.com (vh.dominikdill.com) getan hat — neueste Einträge zuerst. Dieses Protokoll steht im Büro unter **Neuerungen** (`/office/neuerungen`).

## 19.08.2026 — Wareneingang mit Lieferschein

- **Eine Lieferung ist mehr als „dazubekommen".** Sie hat einen Lieferanten, ein Datum, mehrere Posten und ein Papier, das man später wiederfindet — beim Prüfen der Rechnung, bei einer Reklamation, bei der Frage „wann kam das eigentlich?". Als fünf einzelne Bestandskorrekturen gebucht, hängt der Lieferschein an keiner davon.
- **Neu unter Werkstatt → Wareneingang**: Lieferant, Datum, Lieferscheinnummer, die gelieferten Posten mit Mengen — und der **Lieferschein als Foto oder PDF**. Der Zettel im Karton ist in zwei Wochen weg; gebraucht wird er genau dann, wenn die Rechnung kommt und die Mengen nicht stimmen. Fotografiert wird beim Auspacken, und weil das in der Werkstatt passiert, geht das Bild über dieselbe Warteschlange wie das Belegfoto — ohne Netz bleibt es im Gerät und geht später von selbst raus.
- **Der Weg von der Nachbestellliste ist durchgehend**: Bei „Unterwegs" führt ein Knopf direkt zum Wareneingang, vorbelegt mit Lieferant und den Posten, die dort als bestellt vermerkt sind. Gebucht wird in einem Zug: Bestand rauf, Bewegung im Verlauf (mit Nummer, Lieferant und Lieferschein), Merker „nachbestellt" weg.
- **Gebucht wird genau einmal.** Wer später die Lieferscheinnummer nachträgt, erhöht den Bestand nicht ein zweites Mal. Eine falsch gebuchte Menge wird am Posten korrigiert — dann steht im Verlauf, dass korrigiert wurde, statt dass eine Zahl still eine andere wird.
- Die schnelle Korrektur am Posten („verbraucht", „dazubekommen") bleibt, wofür sie gedacht ist: Berichtigungen, nicht Lieferungen.

## 19.08.2026 — Nachbestellen: vom Mindestbestand zur Anfrage

- **Der Mindestbestand wurde bisher nur angezeigt.** Der Schritt danach fing wieder bei null an: Wer liefert das, wie war die Artikelnummer, wie viel nehmen wir? Neu unter **Werkstatt → Nachbestellen**: alles Knappe, nach Lieferant sortiert, mit Bestand, Mindestbestand, Fehlmenge und einem Vorschlag für die Bestellmenge.
- **Ein Knopf schickt die Anfrage raus** — an die E-Mail-Adresse des Lieferanten, im Briefbogen des Hauses, mit Mengen und Artikelnummern. Bewusst eine *Anfrage* nach Preis und Liefertermin und keine Bestellung: Beides steht noch nicht fest, und eine Bestellung mit falschem Preis ist eine Reklamation in spe. Wer beim Lieferanten anruft oder in dessen Portal bestellt, drückt stattdessen „Anderswo bestellt — nur vermerken".
- **Was bestellt ist, steht unter „Unterwegs"** und nicht mehr auf der Liste. Zwischen „bestellt" und „liegt im Regal" vergehen Tage, in denen der Bestand weiter unter dem Mindestbestand steht — ohne diesen Merker stünde dieselbe Anfrage jeden Morgen wieder da, und irgendwann läge alles doppelt im Lager. Sobald die Lieferung als „Dazubekommen" gebucht wird, verschwindet der Eintrag von selbst.
- **Das Büro meldet sich, wenn etwas knapp wird** — einmal am Tag, alle Posten in einer Meldung, mit dem Weg direkt auf die Nachbestellliste. Was schon bestellt ist, zählt dabei nicht mit.
- Am Posten stehen dafür zwei neue Angaben: die **übliche Bestellmenge** (leer heißt: auf das Doppelte des Mindestbestands auffüllen) und die **Artikelnummer beim Lieferanten**, damit dort niemand suchen muss.

## 19.08.2026 — Fremdleistung je Variante, Bestand korrigierbar

- **Auch die Fremdleistung hängt jetzt an der Variante.** Verzinken wird nach Gewicht abgerechnet, Beschichten nach Fläche — ein großes Stück kostet dort mehr Farbe und mehr Geld. Mit einem gemeinsamen Preis rechnete die Kalkulation das kleine Stück zu teuer und das große zu billig, und ausgerechnet beim großen fällt es ins Gewicht. Im Büro steht das unter demselben Umschalter wie die Stückliste: Grundlage, dann jede Variante; ohne eigene Angabe gilt weiter die Grundlage.
- **Der Bestand lässt sich korrigieren, mit Grund.** Zwei Meter Schweißdraht für eine Reparatur außerhalb eines Auftrags, ein verschnittenes Blech, eine Lieferung, für die es noch keinen Beleg gibt: Am Inventarposten wird jetzt die **Veränderung** gebucht — „2, verbraucht" — statt den neuen Stand auszurechnen und ins Feld zu schreiben. Genau beim Abziehen im Kopf entstehen die Zahlendreher, die eine Inventur später mühsam wieder einfängt.
- **Jede Bewegung bleibt stehen**: wie viel, warum, wann, von wem und wie viel danach übrig war. Auch das automatische Abbuchen beim Fertigmelden eines Auftrags schreibt sich dort hinein — sonst stünde im Verlauf nur die Handarbeit und der größte Teil fehlte. Rutscht der Bestand rechnerisch unter null, bleibt das so stehen und die Seite sagt, was es bedeutet: Es wurde mehr verbraucht als je gebucht — da fehlt ein Wareneingang, oder es ist Zeit für eine Inventur.

## 19.08.2026 — Stückliste und Arbeitszeit je Variante

- **Bisher galt eine Stückliste für den ganzen Artikel.** Ein Kübel in 100 × 50 braucht aber mehr Blech als derselbe in 60 × 30 — und dauert länger. Die gemeinsame Liste rechnete für den einen zu wenig und für den anderen zu viel; die Bestandswarnung war damit in beiden Fällen wertlos, und die Auslastung sagte für beide Größen dieselbe Stundenzahl.
- **Jede Variante kann jetzt ihre eigene Liste und ihre eigene Arbeitszeit haben.** Im Büro unter Artikel steht oben ein Umschalter: Grundlage, dann jede Variante. Solange eine Variante nichts Eigenes hat, gilt die Grundlage — bei Farbvarianten ist das der Normalfall, und niemand pflegt dieselbe Liste dreimal. Ein Knopf legt eine eigene Liste an (mit der Grundlage als Anfang), ein zweiter macht das wieder rückgängig.
- **Auftrag und Auslastung rechnen mit der bestellten Variante.** Aus einer Bestellung über das große Stück entsteht ein Auftrag mit dem Material des großen Stücks und dessen Stundenzahl. Auch die Kalkulation im Büro zeigt Einsatz und Preisvorschlag jetzt je Variante, gegen deren eigenen Preis.
- **Die Bestellposition merkt sich, welche Variante gemeint war** — nicht nur ihren Namen. Der ist übersetzt und änderbar; wer eine Variante umbenennt, hätte sonst alle alten Bestellungen von ihrer Stückliste abgeschnitten.

## 19.08.2026 — Aufgeräumte Kopfleiste, sichtbares Kundenkonto, Wochenstunden

- **Die Kopfleiste stand voll.** Neun Punkte nebeneinander, „Next Concept" und „Über uns" brachen auf zwei Zeilen um, und die Navigation saß irgendwo zwischen Schriftzug und Warenkorb statt in der Mitte. Jetzt liegen die Produktwelten unter **Kollektion** in einem Aufklappmenü — dort wächst künftig jede neue Kategorie, statt die Leiste zu verbreitern —, und drei Spalten halten Schriftzug links, Navigation mittig und die Zeichen rechts. Am Handy stehen die Kategorien eingerückt unter „Kollektion", damit nichts hinter einem zweiten Tipp verschwindet.
- **Das Kundenkonto hat endlich einen Weg.** Das Portal gab es längst — nur führte kein sichtbarer Link dorthin: Wer die Bestellmail nicht mehr hatte, kam nicht hinein. Jetzt steht es als Zeichen in der Kopfleiste, als Punkt im Handy-Menü und als Zeile im Fuß. Angemeldet wird dort mit der E-Mail-Adresse und einem sechsstelligen Code, ohne Passwort.
- **Die Werkstattstunden stehen jetzt je Woche.** Die Werkstatt läuft neben einem Hauptberuf: In der einen Woche sind zwanzig Stunden drin, in der nächsten fünf, im Urlaub keine. Eine feste Wochenzahl war genau dann falsch, wenn es darauf ankommt. In der Auslastung trägt jede Woche ihre eigene Zahl — leeres Feld heißt „es gilt die Voreinstellung", eine Null heißt „diese Woche geht nichts", und die Antwort „Platz ist ab KW …" richtet sich danach.

## 19.08.2026 — Sechs Lücken im Büro geschlossen

- **Zahlungseingänge kommen aus dem Kontoauszug** (Geld → Zahlungseingänge). Datei aus dem Onlinebanking wählen — CSV oder CAMT.053 —, und zu jeder Zahlung steht ein Vorschlag da: Rechnungsnummer im Verwendungszweck ist der sichere Fall (dafür schreibt der GiroCode sie hinein), sonst entscheiden Betrag und Name. Gibt es zwei offene Rechnungen über denselben Betrag, wird **nicht geraten** — lieber einmal von Hand zuordnen als einmal die falsche Rechnung abhaken. Ein Klick setzt die Rechnung auf bezahlt, und was daran hängt, läuft von selbst weiter. Dieselbe Datei zweimal einzulesen schadet nichts.
- **Stornieren ist ein Knopf.** An der gestellten Rechnung steht „Stornieren"; das legt die Gegenrechnung an — dieselben Positionen mit umgedrehtem Vorzeichen, Verweis aufs Original, beide zeigen aufeinander. Im Factur-X trägt sie den Typcode 381, sonst käme sie bei der Plattform als zweite Forderung an. Vorher musste die Gegenrechnung von Hand getippt werden, obwohl das Formular selbst auf sie verwies.
- **Auslastung je Woche** (Werkstatt → Auslastung): zugesagte Fertigungsstunden gegen die Werkstattzeit, sechzehn Wochen weit. Oben die Frage vom Telefon als Feld — „wie viele Stunden braucht das neue Stück?" — und darunter die erste Woche, in der so viel frei ist. Die Zeit kommt aus der Fertigungszeit der Artikel und steht am Auftrag.
- **Nachkalkulation** (Geld → Nachkalkulation): abgeschlossene Aufträge mit Wert, Einsatz und Deckung, dazu die Artikel sortiert nach Abweichung. Oben steht das Stück, das regelmäßig mehr Stunden frisst als kalkuliert. Aufträge ohne erfasste Zeit zählen nicht mit und werden genannt — sonst wäre die Auswertung geschönt.
- **Wiedervorlagen** (Kundschaft → Wiedervorlagen, dazu am Partner und am Auftrag): „Herrn Müller im Oktober wegen des zweiten Kübels anrufen." Am fälligen Tag meldet sich das Büro aufs Handy, mit dem Wortlaut statt mit einer Zahl.
- **Angebote im Kundenportal**: ansehen als PDF und annehmen. Wer ein Angebot bekommen hat, kommt jetzt auch ins Portal — vorher zählte das nicht als Vorgang und der Anmeldecode blieb aus. Die Annahme wird mit Zeitpunkt, Name und Weg festgehalten; ein Auftrag entsteht bewusst nicht von selbst, den Termin sagt die Werkstatt zu.
- **Plateforme Agréée** steht jetzt in den Einstellungen, mit Stand der Anmeldung. Bis sie auf „angemeldet" steht, erinnert die Übersicht daran: Ab dem 1. September 2026 müssen E-Rechnungen über eine zugelassene Plattform ankommen. Lesen und Schreiben kann das Büro längst — die Anmeldung ist eine Unterschrift und kein Programm.

## 19.08.2026 — Drei Mails ohne Briefbogen

- **Die Eingangsbestätigung beim Kauf auf Rechnung und die beiden Code-Mails** (Kasse, Kundenportal) bauten ihr HTML von Hand: ohne Logo, ohne Corten-Strich, ohne die Pflichtangaben im Fuß. Jetzt laufen alle drei über denselben Briefbogen wie die Bestellbestätigung.
- **Die Eingangsbestätigung trägt jetzt Zahlen**: Positionen, Summe mit enthaltener Steuer, Lieferadresse, Link auf den Bestellstand. Vorher stand dort ein Satz, und wer wissen wollte, worüber die angekündigte Rechnung lauten würde, musste auf sie warten.
- **Die Code-Mails kommen in der Sprache an**, in der die Kundschaft gerade auf der Seite steht. Dasselbe gilt für den Link auf den Bestellstand — der zeigte bisher immer auf die deutsche Seite.

## 19.08.2026 — Rechnungsversand braucht kein Postfach mehr

- **Ohne eingerichtetes Postfach blockierte der Versand** — die erste echte Rechnung blieb an „Es ist kein Postfach eingerichtet" hängen. Jetzt fällt der Versand auf den normalen Mailweg zurück (SMTP, dieselbe Absenderadresse wie Bestellbestätigungen). Ist ein Postfach eingerichtet, läuft es weiter darüber — dann liegt die Rechnung als Kopie in „Gesendet", und Antworten landen dort, wo sie gelesen werden. Das Versandfenster zeigt in beiden Fällen, mit welchem Absender die Mail rausgeht.

## 19.08.2026 — Kauf auf Rechnung im Shop

- **Die Kasse bietet jetzt zwei Wege**: PayPal (sobald eingerichtet) und **Kauf auf Rechnung per Überweisung** — der funktioniert ohne jeden Zahlungsdienst. Der Kunde bekommt die Rechnung per E-Mail, mit GiroCode zum Scannen; gefertigt wird nach Zahlungseingang.
- **Eine Rechnungs-Bestellung ist Projektgeschäft mit Shop-Herkunft.** Jedes Stück entsteht ohnehin einzeln: Es entsteht sofort der Fertigungsauftrag mit dem Zahlplan vom Artikel (Anzahlung, Zwischenrechnung), die Anzahlungsrechnung liegt dem Büro als Entwurf vor — dieselbe Maschinerie, kein zweiter Rechnungsweg. Artikel ohne Zahlplan bekommen eine vollständige Rechnung als Entwurf. Die Preise stehen dabei netto am Auftrag, sonst schlüge die Rechnung die Steuer doppelt drauf; Versand und Rabatt kommen als eigene Positionen mit.
- **Der Kunde wird als Geschäftspartner angelegt** (gefunden über die bestätigte E-Mail-Adresse) — damit hat die Rechnung aus dem Büro eine Empfängeradresse und das Kundenportal findet die Vorgänge.
- **Bezahlt heißt bezahlt:** Setzt das Büro die Anzahlung (oder die vollständige Rechnung) auf „bezahlt", springt die Bestellung auf „Bezahlt" — Bestätigungsmail, Fertigungsstart, Ausbuchen der Lagerware, wie bei PayPal auch.
- Direkt nach der Bestellung geht eine kurze Eingangsbestätigung raus: „Die Rechnung folgt per E-Mail." In den AGB (drei Sprachen) steht der neue Weg mit drin.

## 19.08.2026 — Die Kasse bestätigt die E-Mail-Adresse, bevor sie bestellt

- **Erst der Code, dann die Bestellung.** Beim Klick auf „Zahlungspflichtig bestellen" schickt die Kasse einen sechsstelligen Code an die angegebene Adresse; erst mit dem eingetragenen Code entsteht die Bestellung und geht es weiter zu PayPal. An dieser einen Adresse hängt alles — Bestätigung, Versandmeldung, der Zugang zum Kundenportal. Ein Tippfehler hieße: Der Kunde bekommt nichts davon, und wer die vertippte Adresse wirklich besitzt, könnte im Portal eine fremde Bestellung samt Anschrift sehen.
- **Wer bestätigt hat, ist damit im Kundenportal angemeldet** — derselbe Nachweis, dieselbe Sitzung. Und umgekehrt: Wer schon angemeldet ist, sieht in der Kasse keinen Code-Schritt. Beim zweiten Einkauf innerhalb von 30 Tagen fällt der Schritt also weg.

## 19.08.2026 — Anmelden mit Benutzernamen

- **Das Werkstatt-Tablet braucht keine eigene E-Mail-Adresse mehr.** Konten lassen sich jetzt mit einem Benutzernamen anlegen — „werkbank" statt einer erfundenen Adresse. Das Anmeldefeld ist eines für beides: Wer seine E-Mail tippt, kommt genauso herein wie wer den Benutzernamen tippt. Ein Konto ohne E-Mail verzichtet dafür auf „Passwort vergessen" — das Zurücksetzen übernimmt dann die Benutzerverwaltung.

## 19.08.2026 — Das Kundenportal

- **Kundschaft sieht jetzt ihre Vorgänge selbst.** Unter „Meine Bestellungen" stehen nach der Anmeldung per E-Mail-Code nicht mehr nur Shop-Bestellungen, sondern auch die Aufträge aus dem Projektgeschäft — mit Stand („in Fertigung"), Fertigstellungstermin, Auftragswert und dem, was davon schon bezahlt ist. Rechnungen lassen sich als PDF herunterladen, samt GiroCode. Laufendes steht oben, Abgeschlossenes gesammelt darunter — wer nachschauen will, was er vor zwei Jahren bestellt hat, findet es trotzdem.
- **Der Satz, wegen dem es das Portal gibt:** „Ihre Anzahlung steht noch aus. Die Fertigung beginnt, sobald die Zahlung eingegangen ist." Genau deswegen rufen Leute an — jetzt steht die Antwort da, bevor die Frage kommt. Freundlich formuliert: Das ist keine Mahnung, die geht ihren eigenen Weg.
- **Wem was gehört, entscheidet eine einzige Datei** (`lib/portalDaten.ts`) — für die Seite genauso wie für den PDF-Abruf. Entwürfe und alles Interne (Kosten, Material, Zeiten, Notizen) bleiben draußen; eine fremde Rechnungsnummer antwortet mit „nicht gefunden", nicht mit „nicht erlaubt". Auch Projektkunden ohne Shop-Bestellung bekommen jetzt einen Anmeldecode — vorher stand genau diese Kundschaft vor einer Tür, die es für sie nicht gab.
- **Dabei einen stillen Fehler gefunden, der alle PDF-Routen betraf:** PDFKit suchte seine eingebauten Schriftmaße im Next-Bundle und fand sie nicht — jede über die Website ausgelieferte Rechnung wäre ein leerer 404 gewesen, obwohl dieselbe Funktion in Skripten lief. PDFKit bleibt jetzt außerhalb des Bundles.

## 19.08.2026 — Rollen, und eine Navigation, die man wiederfindet

- **Rollen lassen sich jetzt im Büro anlegen.** Unter Einstellungen → Benutzer stehen alle Rollen mit ihren Rechten zum Anhaken; eine neue Rolle darf zunächst nur das Büro öffnen, alles Weitere wird bewusst dazugegeben. Bisher gab es dafür nur „Inhaber" und „Redaktion" — wer eine Werkstattrolle ohne Umsätze wollte, hätte ins Admin-Panel wechseln müssen und wusste das nicht. Die Inhaberrolle bleibt unangetastet: Sie darf alles, weil sie an ihrem Schlüssel erkannt wird — das ist der Weg zurück, falls sich jemand beim Umbauen aussperrt.
- **Was jemand nicht darf, sieht er auch nicht.** Die Navigation zeigt nur noch die Bereiche, für die das Recht da ist — und die Übersicht ebenso: Eine Werkstattrolle sieht Aufträge und Inventar, aber keine Jahresumsätze und keine offenen Rechnungen. Ein Menüpunkt, der beim Antippen „nicht erlaubt" sagt, ist ein Versprechen, das keines war. Der Schutz selbst sitzt weiterhin an den Schnittstellen; hier geht es um Ordnung.
- **Die Leiste oben ist jetzt nach Arbeitsbereichen gruppiert.** Kundschaft, Werkstatt, Geld, Sonstiges — vier Knöpfe, die beim Drüberfahren aufklappen, statt achtzehn Punkte, die seitlich aus dem Bild liefen. Dieselbe Ordnung hatte das Blatt am Handy schon; gesucht wird ohnehin nicht alphabetisch, sondern nach „wo war das mit den Rechnungen".

## 19.08.2026 — Der Auftrag sagt, woran es hängt

- **Zahlungsstand am Auftrag.** Über dem Formular steht jetzt, was eingegangen ist und was aussteht, mit jeder Rechnung des Auftrags in einer Zeile. Und der Satz, den sonst niemand zieht: Wird nicht gezahlt, wird nicht gearbeitet — die Fertigstellung verschiebt sich um genau die Tage, die das Geld ausbleibt. Ein Knopf trägt den neuen Termin ein. **Verschoben wird also sichtbar und von Hand**: Ein zugesagtes Datum, das sich still ändert, ist schlimmer als eines, das sich sichtbar ändert — der Kunde hat den alten im Kalender und muss es von einem Menschen erfahren.
- **Bei offener Anzahlung wird erinnert, nicht gemahnt.** Vorher ist nichts geleistet, und wer noch überlegt, bekommt keine Mahngebühr. Bleibt sie länger offen als in den Einstellungen hinterlegt (Vorgabe: 21 Tage), fragt das Büro nach dem Werkstattplatz — irgendwann muss die Entscheidung fallen, sonst blockiert ein Auftrag die Reihe, den es vielleicht gar nicht gibt.
- **In der Auftragsliste steht „wartet auf Zahlung"** statt nur „überfällig". Das sind zwei verschiedene Dinge: Beim einen ist die Werkstatt zu spät, beim anderen wartet sie zu Recht.
- Gerechnet wird das im Gerät, aus dem Bestand, der ohnehin dort liegt — die Leiste steht damit auch in der Werkstatt ohne Netz.

## 19.08.2026 — Der QR-Code auf der Rechnung

- **Zahlen ohne Abtippen.** Unter der Bankverbindung steht jetzt ein GiroCode: Kamera drauf, die Banking-App schlägt Empfänger, Betrag und Verwendungszweck fertig vor. 22 Zeichen IBAN abzutippen bedeutet sonst, dass eine falsche Ziffer als Rückfrage zurückkommt — und bei einer Anzahlung, die vor dem Fertigungsbeginn eingehen soll, ist das der Unterschied zwischen „heute Abend" und „nächste Woche".
- **Lieber keiner als ein falscher.** Fehlt die IBAN oder passt sie nicht ins Format, erscheint schlicht kein Code. Ein QR-Code mit falschen Daten sieht vertrauenswürdig aus und führt zu einer Zahlung, die niemand erwartet hat. Auf Angeboten steht ohnehin keiner — dort ist noch nichts fällig.

## 19.08.2026 — Rechnungen entstehen von selbst, verschickt werden sie von Hand

- **Drei Auslöser, drei Entwürfe.** Wer in Stufen zahlt, bekommt die Rechnungen nicht mehr abgetippt: Die Anzahlung entsteht mit dem Auftrag, die Zwischenrechnung, sobald am Meilenstein ein Datum steht, die Schlussrechnung, wenn der Auftrag auf „Fertig" springt. Jede davon liegt als **Entwurf** in der Liste, mit einer Meldung aufs Handy — abgeschickt wird sie von Hand. Ein versehentlich gesetzter Status kostet damit einen Entwurf und keine Rechnung beim Kunden.
- **Die Schlussrechnung zieht die Vorstufen einzeln ab**, mit Nummer, Datum und ihrer Umsatzsteuer. Das ist der Teil, an dem es teuer wird: Ohne benannten Abzug ist dieselbe Steuer zweimal erklärt, und beim Finanzamt zählt die höhere. 1000 € Auftrag, 30 % Anzahlung, 20 % Zwischenrechnung ergeben eine Schlussrechnung über 500 € netto — mit beiden Vorstufen sichtbar auf dem Blatt.
- **Die Anteile stehen am Auftrag**, nicht mehr nur am Artikel. Sie werden bei der Anlage vom Artikel abgeschrieben (über Anfrage und Angebot) und danach nicht mehr nachgeführt: Was mit der Kundschaft vereinbart wurde, darf sich nicht ändern, weil jemand Monate später den Artikel im Shop anfasst. Ab der ersten gestellten Rechnung sind sie festgeschrieben.
- **Fertigmelden blieb hängen — behoben.** Beim Umstellen eines Auftrags auf „Fertig" schrieb das Abbuchen des Materials an denselben Auftrag zurück, aber auf einer zweiten Datenbankverbindung: Die wartete auf die Sperre der ersten, die erste auf das Ende des Abbuchens. Aufgefallen ist das erst beim Nachmessen mit einem echten Durchlauf.

## 19.08.2026 — Bezahlt wird über PayPal

- **Stripe ist raus.** Karte, Apple Pay und Klarna liefen bisher über Stripe, PayPal stand als zweite Zahlart daneben. Geblieben ist PayPal — und darüber lässt sich ebenfalls mit Karte oder Lastschrift zahlen, auch ohne PayPal-Konto. Die Kasse fragt deshalb nicht mehr nach der Zahlungsart: Es gibt nur noch einen Weg. **Wer nicht alles auf einmal zahlen will, vereinbart das mit PayPal** — späteres Zahlungsziel oder Raten; beim Betrieb kommt der Betrag trotzdem als ganzer an. Die Teilzahlung finanziert damit PayPal und nicht die Werkstatt. Der Webhook-Endpunkt entfällt ersatzlos — die Zahlung wird beim Rücksprung auf die Danke-Seite eingezogen, das braucht keinen Rückruf von außen.
- **Bestellungen aus der Stripe-Zeit bleiben, wie sie sind.** Anbieter, Session- und Zahlungsnummer stehen weiter an der Bestellung; sie sind der Beleg dafür, welche Zahlung damals wozu gehörte. Nur die Zugangsdaten fallen aus der Datenbank — Schlüssel zu einem Konto, das niemand mehr benutzt, gehören dort nicht herum.
- **Wenn die Bezahlung nicht eingerichtet ist, sagt die Kasse das jetzt.** Vorher führte der Bestellknopf ins Leere und meldete „bitte versuchen Sie es erneut" — was nicht half, weil ein zweiter Versuch genauso scheitert. Jetzt steht der Hinweis schon bei der Zahlungsart, und der Knopf lässt sich gar nicht erst drücken.

## 19.08.2026 — Das Büro arbeitet jetzt auch ohne Netz

- **Live: Was einer ändert, sehen die anderen sofort.** Das Büro hält eine offene Verbindung zum Server. Legt jemand am Rechner einen Auftrag an, steht er eine Sekunde später auf dem Tablet in der Werkstatt — ohne Nachladen, ohne Antippen. Gemeldet wird am Datenmodell und nicht in den Formularen: Ob die Änderung aus dem Büro kommt, aus der Website-Verwaltung, aus einer Shop-Bestellung, von Stripe oder vom KI-Zugang, macht keinen Unterschied.
- **Und vor allem: Das Büro geht ohne Netz auf.** Der Bestand — Belege, Rechnungen, Angebote, Aufträge, Bestellungen, Anfragen, Inventar, Partner, Artikel, Inventur — liegt jetzt im Gerät. Die Seiten rechnen daraus: Der Wechsel zwischen Filtern ist ohne Wartezeit, das Blättern durch den Kalender auch, und in der Werkstatt steht alles da, wo vorher eine Fehlerseite war. Eine Leiste über den Seiten sagt, von wann der Stand ist — ein alter Stand ist brauchbar, ein alter Stand, der sich für den aktuellen ausgibt, ist gefährlich.
- **Eingaben gehen auch ohne Netz nicht verloren.** Beleg fotografieren, Uhr starten und stoppen, Inventur zählen, Partner anlegen: Alles steht augenblicklich da und geht raus, sobald wieder Netz ist. Der Reihe nach, denn ein Beleg kann auf einen Lieferanten verweisen, den es beim Server noch gar nicht gibt. Oben steht, wie viel noch wartet. Die Zeiterfassung schickt ihren eigenen Zeitpunkt mit — sonst stünde in der Buchung die Stunde, in der das Netz wiederkam, statt der, in der gearbeitet wurde.
- **Beim Abmelden ist alles weg.** Seit das Büro offline arbeitet, liegen Umsätze, Belege und Kundendaten im Gerät. Beim Abmelden werden sie gelöscht, samt zwischengespeicherter Seiten — ein Tablet in der Werkstatt soll nichts mit sich herumtragen, nachdem sich jemand abgemeldet hat.
- **Einstellungen, Integrationen und Benutzer stehen jetzt im Büro.** Bisher führte jeder Weg zu Zugangsdaten, Postfächern oder Konten über die Website-Verwaltung — mitten aus dem Büro heraus in eine andere Oberfläche. Jetzt ist das Admin-Panel nur noch für die öffentliche Website da. Die Formulare entstehen dabei aus derselben Feldbeschreibung, die Payload selbst verwendet: Kommt dort ein Feld dazu, erscheint es hier von selbst. Passwörter bleiben verdeckt, aufdeckbar und kopierfähig. Zwei Sperren sind eingebaut, damit sich niemand aussperrt: Man kann sich nicht selbst löschen, und der letzte Inhaber bleibt Inhaber.
- **Website und Büro laufen getrennt.** Bisher teilten sie sich einen Prozess: Ein Fehler im Büro riss den Shop mit, und ein Ausrollen legte beides zugleich still. Jetzt laufen zwei Container aus demselben Abbild — einer bedient Kundschaft, einer das Büro. Für alle Beteiligten bleibt es dieselbe Adresse, dieselbe Anmeldung, dieselbe Datenbank; wer wohin geleitet wird, entscheidet Traefik. Was es genau einmal geben darf — Migrationen, nächtliche Sicherung, Erinnerungen —, erledigt weiterhin nur die Website-Seite, sonst käme jede Erinnerung zweimal aufs Handy. Und weil eine Änderung oft dort entsteht, wo niemand einen Draht offen hält (eine bezahlte Bestellung etwa), reichen sich die beiden Live-Meldungen über die Datenbank durch. Das kann Postgres von Haus aus; es braucht keinen Nachrichtendienst und keine Verbindung zwischen den Containern.
- **Nebenbei behoben.** Die gelockerte Sicherheitsrichtlinie fürs Admin-Panel war nie in Kraft — bei mehreren passenden Regeln gewinnt in Next die spätere, und der Auffangpfad stand unten. In der Entwicklungsumgebung antwortete jede Seite mit 500, weil der Takt für eine Laufzeit übersetzt wurde, in der er gar nicht läuft. Und der Zwischenspeicher fürs Arbeiten ohne Netz sah zwar gefüllt aus, gab aber nichts heraus — zwei Kleinigkeiten beim Nachschlagen, in der Summe kein einziges geladenes Skript; vier Ansichten blieben deshalb ohne Netz leer. Und Sicherungsarchive landeten beim Entwickeln in der Versionsverwaltung.

## 18.08.2026 — Pflichten, Geld und die Dinge hinter dem Happy Path

- **Elektronische Rechnung.** Frankreich verlangt ab dem 1. September 2026, dass Unternehmen E-Rechnungen empfangen können; das Ausstellen folgt gestaffelt. Ausgangsrechnungen entstehen deshalb jetzt als **Factur-X**: ein PDF/A-3, in dem dieselbe Rechnung zusätzlich als XML nach EN 16931 steckt. Das Blatt sieht aus wie vorher, die Maschine liest die Daten — und beides kommt aus denselben Feldern, damit PDF und XML nie auseinanderlaufen. Neu dafür: IBAN, die Option „TVA d'après les débits", SIRET und TVA-Nummer des Kunden, Bestellnummer, Leistungsdatum. Fehlt etwas, sagt es die Rechnungsseite, bevor eine Plattform sie zurückweist. Die Anbindung an eine Plateforme Agréée bleibt eine Vertragsfrage.
- **Elektronische Rechnungen werden auch gelesen, nicht nur geschrieben.** Kommt ein Beleg als PDF mit eingebetteter Rechnungs-XML (Factur-X, ZUGFeRD, XRechnung), übernimmt das Büro Lieferant, Nummer, Datum, Zahlungsziel und Beträge unverändert von dort — exakt, sofort und ohne KI. Claude schaut sich nur noch an, was keine XML mitbringt: Fotos, Kassenbons, eingescannte Papierrechnungen. Nebenbei ist damit die Empfangspflicht ab September 2026 erfüllt.
- **Widerrufsrecht und die Seiten, die dem Shop fehlten.** Es gab Impressum, Datenschutz und AGB — aber keine Widerrufsbelehrung, kein Muster-Widerrufsformular, nichts zu Versand und Zahlung. Alles drei ist jetzt da, dreisprachig, mit Entwürfen zum Loslegen. Wichtig für die Werkstatt ist der zweite Teil der Belehrung: Bei einem nach Kundenvorgabe gefertigten Einzelstück besteht kein Widerrufsrecht — aber nur, wenn es ausdrücklich dasteht. In der Kasse wird beides bestätigt, bevor bestellt wird, und mit Zeitpunkt an der Bestellung festgehalten. Der Knopf heißt jetzt „Zahlungspflichtig bestellen".
- **Sicherung auf die NAS.** Bisher sicherte ein Nebencontainer die Datenbank in ein Volume auf demselben Server — die Bilder gar nicht. Jetzt packt die App selbst ein Archiv aus Datenbank **und** Mediathek und schiebt es per Samba oder WebDAV auf den Netzwerkspeicher. Im Büro steht, wann zuletzt gesichert wurde, und ein Knopf macht es sofort. In jedem Archiv liegt eine Anleitung zum Zurückspielen — im Ernstfall liest niemand mehr Dokumentation.
- **Der Server taktet sich selbst.** Kein Cron, kein zweiter Container, keine Umgebungsvariable: Die Anwendung läuft ohnehin durch und sieht jede Minute nach, ob etwas ansteht. Wie oft tatsächlich gearbeitet wird, steht im Admin unter **Integrationen → Takt** und greift binnen einer Minute — ohne Neustart und ohne Zugriff auf den Server. Viertelstündlich prüft das System, was ansteht: nächtliche Sicherung, Aufräumen kurzlebiger Daten, und die Meldung, wenn Sicherung oder Postfach-Abruf stillstehen. **Fällige Belege** gehören dazu: Steht auf einer Eingangsrechnung ein Zahlungsziel — die KI liest es beim Erfassen mit —, meldet sich das Büro ab drei Tagen vorher jeden Tag, bis der Beleg auf „bezahlt" steht. Vorher bleibt es still.
- **Mahnen und nachfassen.** An einer offenen Rechnung führt ein Knopf zur nächsten Stufe: Zahlungserinnerung ohne Kosten, Mahnung mit der gesetzlichen Pauschale von 40 €, letzte Mahnung mit Frist. Welche dran ist, weiß das Büro selbst. Angebote merken sich beim Verschicken den Tag und melden sich nach einer Woche ohne Antwort — die Hälfte der Aufträge entscheidet sich daran, ob jemand anruft.
- **Newsletter.** Anmeldung im Fuß jeder Seite, Bestätigung per Mail, Abmeldung mit einem Klick, Versand aus dem Büro mit Testlauf davor. Bei Einzelstücken ist die Liste der Interessierten das wertvollste Gut — bisher gab es sie nicht. Und die **Kundenstimmen** füllen sich endlich von selbst: Zwei Wochen nach dem Versand fragt eine Mail nach ein paar Sätzen, genau einmal; was zurückkommt, liegt zur Prüfung im Admin statt sofort auf der Website.
- **Die Werkstatt rechnet mit.** Material und Dienstleister waren erfasst, die Arbeitszeit nicht — also die größte Position. Am Auftrag steht jetzt eine Stoppuhr (großer Knopf, auch mit Handschuhen), Zeit lässt sich nachtragen, und daraus entstehen Lohnkosten neben Material und Fremdleistung. Am Artikel dieselbe Rechnung vor dem Verkauf, samt Preisvorschlag; liegt der Website-Preis unter dem Einsatz, steht das da. Dazu ein **Kalender**, der Fertigstellungen, Liefertermine, ablaufende Angebote und fällige Belege auf ein Blatt legt, und ein **Lieferschein** zum Mitgeben — bei Montagen zugleich das Abnahmeprotokoll.
- **Bilder in der Größe, die das Gerät braucht.** Fünf Zuschnitte statt drei, alle als WebP, ausgeliefert per `srcset`. Vorher lud ein Handy dieselbe Datei wie ein 4K-Bildschirm. Vorhandene Bilder werden einmalig mit `pnpm bilder-neu` nachgerechnet.
- **Anmelden mit Face ID, Fingerabdruck oder Geräte-PIN.** Statt langem Passwort plus Code aus der Authenticator-App: ein Knopf, ein Blick aufs Gerät, drin. Der Schlüssel entsteht im Gerät und verlässt es nie; er lässt sich nicht abtippen und nicht auf einer gefälschten Seite eingeben. Eingerichtet wird das je Benutzer unter **Mein Konto**, so wie die Zwei-Faktor-Anmeldung — und ein Passkey ersetzt sie, denn er ist bereits beides: das Gerät, das man hat, und das Gesicht, das man ist. Die Anmeldung mit Passwort bleibt als Rückweg.
- **Anmeldung gilt jetzt eine Woche und verlängert sich, solange sie benutzt wird** — statt zwei Stunden. Payloads Standard ist für ein Redaktionssystem gedacht; auf einem Werkstatt-Tablet hieß er: dreimal am Tag neu anmelden, jedes Mal mit Code aus der Authenticator-App. Das führt am Ende nur dazu, dass jemand die Zwei-Faktor-Anmeldung abschaltet. Wer täglich arbeitet, bleibt angemeldet; ein Gerät, das eine Woche liegen bleibt, nicht. Ein Ausrollen überlebt die Anmeldung — das Token hängt am Serverschlüssel, nicht am Container. Wer ein Gerät verliert, ändert das Passwort: Damit sind alle Anmeldungen ungültig, auch die per Passkey.
- **Passwörter und Schlüssel sind in der Verwaltung verdeckt.** SMTP, Postfächer, Stripe, PayPal, Anthropic, MCP, Facebook und der NAS-Zugang standen bisher im Klartext auf dem Bildschirm. Jetzt sind sie maskiert wie ein Passwort, mit einem Knopf zum Aufdecken und einem zum Kopieren — denn getippt werden solche Werte nie, sie werden kopiert.
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
