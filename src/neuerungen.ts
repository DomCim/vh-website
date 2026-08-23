import type { Neuerung } from './lib/neuerungen'

/**
 * Die Neuerungen — was im Büro unter „Neuerungen" zu lesen ist.
 *
 * **Diese Datei ist die Quelle.** Beim Start spielt der Server sie in die
 * Sammlung `changelog` ein (siehe `lib/neuerungenEinspielen.ts`); von dort
 * kommt sie über den Abgleich ins Gerät. Ein Eintrag, der hier steht, ist
 * damit genau dann im Büro zu lesen, wenn die Fassung, die ihn mitbringt,
 * auch wirklich läuft — „geschrieben" und „ausgerollt" gehen nicht mehr
 * auseinander, und niemand muss hinterher ein Datum nachtragen.
 *
 * **Regeln beim Ergänzen** (die Nummer trägt den Banner, siehe
 * `lib/neuerungen.ts`):
 *
 *  - Neueste zuerst, oben. Neuer Eintrag = nächsthöhere `nummer`.
 *  - `datum: null` lassen — es wird beim ersten Einspielen gesetzt.
 *  - Nummern sind stabil. Einen Eintrag, der schon draußen ist, nicht
 *    erweitern: Was danach kommt, bekommt einen eigenen.
 *  - Geschrieben wird für den Betrieb, nicht für den Code: was sich ändert
 *    und warum, nicht welche Dateien angefasst wurden.
 *  - Als Auszeichnung gibt es zwei Zeichen: `**fett**` und Backticks um
 *    Pfade und Dateinamen. Sonst nichts — kein Kursiv, keine Links, keine
 *    Überschriften. Was der Umsetzer nicht kennt, steht als Sternchen im
 *    Text, und genau das ging hier vorher schief.
 */
export const NEUERUNGEN: Neuerung[] = [
  {
    nummer: 56,
    datum: null,
    titel: 'Farbe in den Listen: was drängt, sieht man jetzt im Vorbeigehen',
    punkte: [
      {
        text: '**Es gab den farbigen Streifen schon** — als schmalen Balken links an jeder Listenzeile, mit rot für „überfällig", bronze für „offen" und grün für „erledigt". Benutzt wurde er an genau zwei Stellen; rot und grün kamen in der ganzen Anwendung kein einziges Mal vor. Er stand seit Monaten im Stylesheet und wartete.',
      },
      {
        text: '**Jetzt gilt er überall, und er heißt überall dasselbe:** rot = etwas ist über der Zeit, bronze = wartet auf uns, grün = erledigt, blau = ungelesen. Wo keine Zeile Vorrang vor der anderen hat — Artikel, Partner, Inventar —, bleibt es bewusst schlicht. Eine Farbe, die je nach Liste etwas anderes sagt, wäre schlechter als gar keine.',
      },
      {
        text: '**Blau ist neu dazugekommen.** Die drei anderen sind belegt, und „ungelesen" ist keines davon: Das ist kein Zustand eines Vorgangs, sondern einer der Aufmerksamkeit. Mit einer geliehenen Farbe hieße Bronze im Postfach etwas anderes als im Kassenbuch.',
      },
      {
        text: '**Am Handy wird aus jeder Zeile eine Karte** — abgesetzte Fläche, gerundete Ecken, der Balken an der Kante, und die Fläche nimmt den Farbton schwach mit auf. So sieht man beim Scrollen, wo die Roten liegen. Am Rechner bleibt die dichte Liste: Dort will man viel auf einmal sehen, und Einzelkarten kosteten ein Drittel der Einträge je Bildschirm.',
      },
      {
        text: '**Für Karten, die für eine einzelne Sache stehen**, gibt es dieselbe Aussage an der Oberkante statt an der Seite — ein Balken über die ganze Breite. Zwei Formen, eine Sprache: Der Streifen läuft am Auge entlang, während man eine Liste hinunterliest; der Balken oben überspannt eine Karte und sagt schon vor dem ersten Wort, worum es steht.',
      },
    ],
  },
  {
    nummer: 55,
    datum: null,
    titel: 'Das Postfach am Handy: Uhrzeit, volle Breite, eine Leiste',
    punkte: [
      {
        text: '**In der Liste steht jetzt, wann.** Bisher stand dort stur das Datum — auch bei einer Mail von vor zwei Stunden, und man rechnete im Kopf nach, ob „22.08." nun heute ist. Jetzt gilt: heute die Uhrzeit, gestern **Gestern 17:00**, in der laufenden Woche der Wochentag mit Uhrzeit, älteres wie gehabt das Datum. Der vollständige Zeitpunkt steht im Tooltip und in der geöffneten Nachricht.',
      },
      {
        text: '**Die geöffnete Nachricht läuft am Handy bis an den Rand.** Eine fremde Mail bringt ihr eigenes Layout mit, oft eine Tabelle mit fester Breite. In einer Karte mit Polsterung und Rahmen blieben auf einem üblichen Telefon keine 340 Pixel übrig — der Inhalt wurde seitlich scrollbar oder briefmarkenklein. Am Rechner bleibt die Karte: Dort wäre die volle Breite das andere Extrem.',
      },
      {
        text: '**Aus fünf Kästchen wird eine Leiste.** Die Handlungen über der Mail standen jede in einem eigenen Rahmen nebeneinander und sahen mehr nach Formular aus als nach Werkzeug. Jetzt liegen sie in einem Balken, wie man es aus jedem Mailprogramm kennt: **Antworten** beschriftet, daneben Ungelesen und Löschen als Zeichen.',
      },
      {
        text: '**Markieren und Verschieben liegen hinter „⋯".** Sie kosten dort einen Tipp mehr und nehmen der Zeile dafür die Unruhe — am Telefon der Unterschied zwischen einer Leiste und zwei.',
      },
      {
        text: '**„Neu" und „markiert" stehen jetzt vorn als Zeichen** — ein Punkt heißt ungelesen, ein Fähnchen heißt vorgemerkt. Als beschriftete Pillen brauchten sie rechts je gut neunzig Pixel; zusammen mit Zeit und „⋯" blieb dem Absender ein Drittel der Zeile, und „Kundenservice IONOS" wurde mitten im Wort abgeschnitten. Vorn kosten beide zusammen vierzehn Pixel, und die Namen beginnen alle auf derselben Linie.',
      },
    ],
  },
  {
    nummer: 54,
    datum: null,
    titel: 'Jeder Artikel war unter jeder Kategorie erreichbar',
    punkte: [
      {
        text: '**Aufgefallen beim Nachsehen zu Googles „Duplikat"-Meldung.** Der Gartensessel steht in `Möbel` — erreichbar war er aber unter jeder Kategorie, die es gibt: unter `Outdoor`, unter `Pflanzen`, sogar unter `Maschinenbau`. Bei vierzehn Kategorien sind das vierzehn Adressen für dieselbe Seite, und das mal jeden Artikel mal drei Sprachen.',
      },
      {
        text: '**Woran es lag.** Die Artikelseite prüfte zwei Dinge: Gibt es die Kategorie? Gibt es den Artikel? Nie aber, ob die beiden zusammengehören. Eine erfundene Kategorie fiel durch, eine echte nicht — obwohl ein Artikel zu genau einer gehört.',
      },
      {
        text: '**Warum es niemand gemerkt hat.** Der Hinweis für Suchmaschinen, welche Adresse die maßgebliche ist, zeigte seit jeher auf die richtige. Google hat still hinter uns aufgeräumt und den Rest verworfen — die Meldung „Duplikat" war der einzige Hinweis darauf, dass etwas nicht stimmt. Wer dagegen über so einen Link kam, sah einen Gartensessel mit „Maschinenbau" im Weg darüber.',
      },
      {
        text: '**Jetzt wird umgeleitet, nicht abgewiesen.** Steht die falsche Kategorie in der Adresse, landet man dauerhaft bei der richtigen. Abzuweisen wäre der schlechtere Weg: Solche Adressen stehen in Suchergebnissen und in fremden Verweisen, und die sollen weiter ankommen — nur eben an der einen Adresse, die gilt.',
      },
    ],
  },
  {
    nummer: 53,
    datum: null,
    titel: 'Gelöschte Mails landen jetzt wirklich im Papierkorb',
    punkte: [
      {
        text: '**Der Fehler, wie Dominik ihn gemeldet hat:** Eine Mail im Postfach löschen — sie verschwindet aus dem Eingang. Seite neu laden — sie ist wieder da. Und im Papierkorb lag sie nie.',
      },
      {
        text: '**Woran es lag.** Beim Löschen wurde der Ordner mit dem eingestellten Namen gesucht, in der Voreinstellung „Trash". Heißt er beim Anbieter anders — `INBOX.Trash`, `Papierkorb`, `Gelöschte Objekte` —, dann gab es diesen Ordner gar nicht, und das Verschieben scheiterte. Der Fehlschlag wurde stillschweigend aufgefangen: Die Mail bekam nur eine Markierung, und eine Markierung entfernt nichts. Nach außen meldete das Büro trotzdem „hat geklappt", deshalb nahm die Liste die Zeile heraus.',
      },
      {
        text: '**Jetzt wird gefragt statt geraten.** Der Mailserver weiß selbst, welcher seiner Ordner der Papierkorb ist, und sagt es auf Nachfrage — unabhängig davon, wie er heißt. Nur wenn er das nicht tut, gilt der eingestellte Name, und auch der erst, wenn es den Ordner wirklich gibt. Fehlt er ganz, wird er angelegt.',
      },
      {
        text: '**Und wenn doch etwas schiefgeht, steht es da.** Bisher hieß es „Das hat nicht geklappt" — die nutzloseste aller Antworten, denn woran es lag, wusste nur der Mailserver. Jetzt steht der Grund in der Meldung, etwa dass kein Ordner „Papierkorb" gefunden wurde. Dann weiß man sofort, wo man nachsieht.',
      },
      {
        text: '**Dieselbe Falle gab es beim Ordner „Gesendet" schon einmal**, dort wurde sie längst beseitigt — nur eben an einer Stelle und nicht an beiden. Beide Ordner werden jetzt über denselben Weg bestimmt, damit das nicht ein drittes Mal auseinanderläuft.',
      },
    ],
  },
  {
    nummer: 52,
    datum: null,
    titel: 'Versandkosten und Rückgabefrist stehen jetzt im Suchergebnis',
    punkte: [
      {
        text: '**Googles Prüfwerkzeug bemängelte drei Angaben am Artikel** — Versandkosten, Rückgabebedingungen und den Beginn der Preisgültigkeit. Alle drei waren als „optional" gekennzeichnet, und genau das führt in die Irre: Optional sind sie für die Prüfung, nicht für die Anzeige. Ohne sie bleibt unter dem Treffer die Zeile leer, in der bei anderen „Kostenloser Versand" oder „14 Tage Rückgabe" steht, und im Merchant Center gilt eine fehlende Rückgabebedingung als Mangel am ganzen Konto.',
      },
      {
        text: '**Jetzt stehen sie da, und zwar mit den echten Zahlen.** Die Versandkosten sind die des Artikels — dieselbe Zahl, die auch die Kasse berechnet. Wer hier großzügig aufrundete, produzierte eine Abweichung zwischen Auszeichnung und Seite, und die kostet im Zweifel das ganze Suchergebnis samt Preis.',
      },
      {
        text: '**Geliefert wird nach Frankreich, Deutschland, Österreich und in die Schweiz.** Das stand bisher nirgends im System: Das Länderfeld in der Kasse ist freier Text mit einem Vorschlag je nach Sprache. Für eine Suchmaschine muss es konkret sein.',
      },
      {
        text: '**Rückgabe innerhalb von 14 Tagen, die Rücksendung zahlt der Kunde** — genau so, wie es in der Widerrufsbelehrung steht. Beides muss zusammenpassen: Was dort nicht ausdrücklich dasteht, gilt nicht, gleich was ausgezeichnet ist.',
      },
      {
        text: '**Digitale Ware bekommt keine Rückgabefrist versprochen.** Dort erlischt das Widerrufsrecht mit der Lieferung, eine 14-Tage-Zusage wäre schlicht falsch. Das entscheidet dasselbe Häkchen, an dem auch die Kasse hängt.',
      },
      {
        text: '**Sternebewertungen fehlen weiterhin — das ist richtig so.** Google vermisst „review" und „aggregateRating". Beides ist längst eingebaut und erscheint von selbst, sobald zu einem Artikel eine freigegebene Kundenstimme mit Sternen vorliegt. Erfundene Bewertungen gibt es nicht, auch nicht für ein hübscheres Suchergebnis.',
      },
    ],
  },
  {
    nummer: 51,
    datum: null,
    titel: 'Drei Seiten haben Google erzählt, sie seien die Startseite',
    punkte: [
      {
        text: '**Google meldete „Duplikat".** Die Search Console schrieb, einige Seiten würden nicht aufgenommen — unter anderem, weil Google eine andere Seite für maßgeblich hält als wir. Nachgemessen: `/news`, `/aktionen` und `/kontakt` trugen in ihrem Quelltext die Angabe, die eigentliche Adresse sei die Startseite. In allen drei Sprachen, also neun Adressen.',
      },
      {
        text: '**Sie standen gleichzeitig in der Sitemap.** Wir haben Google also gesagt „nimm diese Seiten auf", und die Seiten selbst haben widersprochen. Das Ergebnis ist, dass sie gar nicht aufgenommen wurden — wer bei Google „Vincent Hellmann Kontakt" sucht, hat die Seite nie gefunden.',
      },
      {
        text: '**Auffallen konnte das niemandem.** Die Seiten sehen richtig aus, laden normal und sind im Browser von einer gesunden Seite nicht zu unterscheiden. Die Angabe steht unsichtbar im Quelltext, und sie war nirgends falsch eingetragen — sie fehlte, und dann gilt die der Startseite.',
      },
      {
        text: '**Jetzt haben die drei eine eigene Überschrift, eine eigene Beschreibung und den Verweis auf sich selbst** — samt Hinweis auf die französische und englische Fassung. Warenkorb, Kasse und Newsletter-Seite hatten dasselbe Problem; die gehören ohnehin nicht in eine Suchmaschine und sind jetzt ausdrücklich ausgenommen.',
      },
      {
        text: 'Eine Prüfung holt künftig die Sitemap und vergleicht jede Adresse mit dem, was die Seite über sich selbst behauptet. Beim nächsten Mal fällt so etwas beim Entwickeln auf und nicht Monate später in einer Mail von Google.',
      },
    ],
  },
  {
    nummer: 50,
    datum: null,
    titel: 'Gelöscht ist nicht mehr weg — es gibt einen Papierkorb',
    punkte: [
      {
        text: '**Für den Betrieb ändert sich nichts.** Der Knopf heißt weiter „Löschen", der Datensatz verschwindet sofort aus jeder Liste, aus der Suche und vom Handy. Es gibt keine zweite Frage und keine Wahl zwischen „archivieren" und „löschen" — sobald man die hätte, zögerte man an jedem Knopf.',
      },
      {
        text: '**Dahinter wird nichts mehr weggeworfen.** Was gelöscht wird, wandert in den Papierkorb und lässt sich in der Website-Verwaltung wiederherstellen — bei jeder Sammlung im Reiter „Papierkorb". Das gilt für Artikel, Kategorien, News, Referenzen, Kundenstimmen, Aktionen, Bilder, Anfragen, Angebote, Aufträge, Bestellungen, Belege, Kontobewegungen, Inventar, Inventuren, Wareneingänge, Partner, Kundenmappen, Werkstattdateien, Wiedervorlagen und Newsletter-Anmeldungen.',
      },
      {
        text: '**Warum das die bessere Sicherung ist.** Für „einer hat sich verklickt" war bisher nur die nächtliche Sicherung da, und die ist das falsche Werkzeug: Sie dreht die Zeit für alle zurück, um einen Datensatz zu retten — der Artikel käme wieder, aber jede Bestellung seit der Nacht wäre weg. Ein Papierkorb holt genau das eine zurück und lässt alles andere in Ruhe.',
      },
      {
        text: '**Der URL-Pfad wird beim Löschen wieder frei.** Ein weggeworfener Artikel „gartentisch" blockiert seinen Namen nicht: Legt jemand ihn neu an, bekommt er wieder `gartentisch` und nicht wortlos `gartentisch-2`. Wird der alte später zurückgeholt und der Name ist inzwischen vergeben, bekommt der zurückgeholte den nächsten freien — was steht, geht vor.',
      },
      {
        text: '**Geleert wird von Hand.** Eine Automatik, die den Papierkorb nach ein paar Wochen ausräumt, führte genau den Verlust wieder ein, den er abschaffen soll. Und wenn jemand nach Datenschutzrecht die Löschung seiner Daten verlangt, muss das ohnehin ein Mensch entscheiden — in der Verwaltung gibt es dafür „endgültig löschen".',
      },
      {
        text: '**Eine Kategorie mit Artikeln bleibt stehen.** Das war beim endgültigen Löschen schon so und gilt jetzt auch fürs Wegwerfen — sonst zeigten die Artikel darin auf etwas, das niemand mehr sieht.',
      },
    ],
  },
  {
    nummer: 49,
    datum: null,
    titel: 'Die Datenschutzerklärung sagt, was die Statistik wirklich tut',
    punkte: [
      {
        text: '**Ein Satz stimmte seit der neuen Besuchsansicht nicht mehr.** In der Datenschutzerklärung stand, die Zahlen würden „ausschließlich zusammengefasst" ausgewertet. Seit die Statistik einzelne Besuchswege zeigt, ist das nicht mehr die ganze Wahrheit — erhoben wird zwar nichts Neues, aber der Satz beschreibt die Auswertung, und die hat sich geändert.',
      },
      {
        text: '**Jetzt steht dort, was passiert:** zusammengefasst ausgewertet, und zusätzlich sichtbar, welche Seiten innerhalb eines Besuchs nacheinander aufgerufen wurden. Dazu der Grund, warum trotzdem niemand erkennbar ist — die Prüfsumme trägt keinen Namen und wechselt täglich. In allen drei Sprachen.',
      },
    ],
  },
  {
    nummer: 48,
    datum: null,
    titel: 'In der Statistik stehen jetzt nur noch echte Besucher',
    punkte: [
      {
        text: '**Zwei Drittel der Besucher waren wir selbst.** Von 75 Besuchern der letzten dreißig Tage kamen 48 aus den Vereinigten Staaten, fast alle mit nur einer Seite und ohne Herkunft. Das sah nach Bots aus, war aber die eigene Qualitätsprüfung: Vor jedem Ausrollen wird die laufende Website mit einem ferngesteuerten Browser durchgeklickt, und der zählt mit wie jeder andere Besucher.',
      },
      {
        text: '**Das ist schlimmer als gar keine Zahl**, denn man liest sie ja und schließt etwas daraus. „Nur eine Seite: 62 %" hieß in Wahrheit „unsere Prüfläufe rufen eine Seite auf", und „die meisten kommen aus den USA" hieß gar nichts. Ab jetzt zählt ein ferngesteuerter Browser nicht mehr mit — gefiltert wird beim Zählen und nicht beim Auswerten, damit später niemand etwas herausrechnen muss.',
      },
      {
        text: '**Die alten Zahlen bleiben, wie sie sind.** Was einmal gezählt wurde, lässt sich nicht rückwirkend aussortieren; die Werte werden also erst mit den Tagen sauber. In den einzelnen Besuchen sieht man den Unterschied sofort — ein Prüflauf geht auf eine Seite und ist weg, ein Mensch geht weiter.',
      },
    ],
  },
  {
    nummer: 47,
    datum: null,
    titel: 'Statistik: umschalten statt scrollen',
    punkte: [
      {
        text: '**Die einzelnen Besuche lagen hinter einem Knopf ganz unten.** Man musste also bis ans Ende der Zahlen scrollen, um zu erfahren, dass es die andere Ansicht überhaupt gibt — und wer es nicht wusste, fand sie nie. Jetzt stehen **Zusammenfassung** und **Einzelne Besuche** oben nebeneinander, gleich über der Zeitraum-Wahl.',
      },
      {
        text: '**Der Zeitraum wandert beim Umschalten mit.** Wer sich dreißig Tage angesehen hat und dann wissen will, wer da einzeln kam, meint dieselben dreißig Tage. Ihn dabei stillschweigend auf sieben zurückzusetzen, wäre die Art Kleinigkeit, aus der falsche Schlüsse entstehen.',
      },
    ],
  },
  {
    nummer: 46,
    datum: null,
    titel: 'Die Statistik zeigt jetzt einzelne Besuche',
    punkte: [
      {
        text: '**Bisher standen dort nur Summen.** „Zwölf kamen von Google", „`/outdoor` wurde dreißigmal gesehen" — das sagt, wie viel los war, aber nicht, was einer getan hat. Die Frage, die man sich beim Zusehen wirklich stellt, ist eine andere: Der eine, der gestern Abend über Google kam — hat der die Gartenbank angesehen und dann aufgehört, oder ist er bis zur Anfrage gegangen?',
      },
      {
        text: '**Unter Statistik steht jetzt „Einzelne Besuche".** Je Besuch eine Zeile: wann, woher (Google, Instagram, ein Newsletter oder direkt eingetippt), von welchem Gerät und aus welchem Land — und darunter der Weg über die Seite in der Reihenfolge, in der er gegangen wurde. Die Seite, auf der jemand ankam, ist hervorgehoben: Sie ist die interessantere Hälfte, denn sie sagt, was ihn hergeführt hat.',
      },
      {
        text: '**Am Besucher ändert sich dadurch nichts.** Kein Cookie, keine Kennung auf seinem Gerät, kein Einwilligungsbanner — es wird nichts zusätzlich erhoben. Die Angaben liegen längst in der Besucherzählung auf dem eigenen Server; sie wurden bisher nur nicht so gelesen. Wer dort steht, bleibt namenlos: Die Kennung unterscheidet zwei Besuche voneinander und sonst nichts.',
      },
      {
        text: '**Eingerichtet werden muss dafür einmal etwas.** Die Ereignisse liegen in einer eigenen Datenbank neben der Zählung, und der Server kommt dort erst hin, wenn beide im selben Netz stehen; die Adresse gehört dann in die Website-Verwaltung unter Integrationen. Solange das nicht geschehen ist, sagt die Seite das und die gewohnten Zahlen laufen unberührt weiter. Wie es geht, steht in der Anleitung unter „Einzelne Besuche".',
      },
    ],
  },
  {
    nummer: 45,
    datum: null,
    titel: 'Das Büro sagt selbst, wenn es etwas Neues gibt',
    punkte: [
      {
        text: '**Neuerungen standen bisher da und warteten darauf, dass jemand nachsieht.** Getan hat das niemand — man öffnet keine Seite, um zu erfahren, ob es etwas zu erfahren gibt. Jetzt erscheint oben im Büro ein schmaler Hinweis, sobald eine neue Fassung ausgerollt ist: was zuletzt dazugekommen ist und wie viel es insgesamt ist. Ein Tipp führt zur Seite, das Kreuz räumt ihn weg.',
      },
      {
        text: '**Gelesen ist gelesen — auf allen Geräten.** Das Büro merkt sich am Konto, bis wohin gelesen wurde, nicht am Gerät. Wer am Rechner nachgesehen hat, bekommt am Tablet nicht dasselbe noch einmal vorgesetzt. Auf der Seite bleibt für diesen Besuch gekennzeichnet, was neu war — ein Hinweis, der verschwindet, ohne dass man sieht wofür, wäre die schlechtere Hälfte davon.',
      },
      {
        text: '**Die Seite selbst liest sich jetzt.** Vorher war sie eine Wand: vierundvierzig Fassungen und dreihundert Absätze am Stück, mit Sternchen und Schrägstrichen mitten im Text, weil die Darstellung nur Fettung kannte. Jetzt hängt jede Fassung mit ihrem Datum an einer Zeitleiste, nach Monaten gruppiert; der erste Satz eines Punktes steht als Überschrift darüber, und Erläuterungen rücken eine Ebene ein. Die drei jüngsten Fassungen und alles Neue stehen offen da, ältere klappt man auf.',
      },
      {
        text: '**Und sie sind jetzt auch ohne Netz da.** Die Einträge liegen in der Datenbank statt in einer Datei im Abbild und kommen über denselben Abgleich ins Gerät wie Aufträge, Belege und Meldungen. Ein Eintrag erscheint an dem Tag, an dem die Fassung wirklich läuft — geschrieben und ausgerollt gehen damit nicht mehr auseinander, und niemand muss hinterher ein Datum nachtragen.',
      },
    ],
  },
  {
    nummer: 44,
    datum: null,
    titel: 'Dateien im Shop, Fehler melden, Komma in jedem Zahlenfeld',
    punkte: [
      {
        text: '**Nach dem Ausrollen war die Bestellseite nicht erreichbar und der Abgleich im Büro hakte.** Ursache war eine vergessene Spalte: Zur digitalen Ware kamen drei Felder ins Datenmodell, die Migration legte nur zwei an. Weil die Datenbankabfragen jede Spalte aufzählen, schlug daraufhin **jede** Abfrage auf die Bestellungen fehl — nicht nur die, die das neue Feld braucht. Behoben; eine neue Bestellung war in dieser Zeit nicht möglich.',
      },
      {
        text: '**Der Besucherverlauf lässt sich endlich am Handy lesen.** Die Werte hingen an einem Anhang, den nur ein Mauszeiger hervorholt — am Handy erschien schlicht nichts. Dreißig Balken, und auf dem Gerät, an dem man sie ansieht, war kein einziger Wert lesbar. Jetzt zeigt Antippen den Tag und die Zahl in der Zeile darunter, an einer festen Stelle statt in einem Kästchen, das den Nachbarbalken verdeckt. Darunter stehen die Zahlen zusätzlich als aufklappbare Tabelle — kopierbar und für Vorleser lesbar.',
      },
      {
        text: '**In der Auslastung steht jetzt, um wie viel eine Woche überbucht ist.** Bisher hieß es bei jeder vollen Woche „voll", ob sie punktgenau ausgelastet war oder fünf Stunden zu viel trug — der Balken ist bei 100 % abgeschnitten und sah in beiden Fällen gleich aus. Das ist aber genau der Unterschied zwischen „geht gerade noch" und „da muss etwas weichen".',
      },
      {
        text: '**Wer die Website mit der Tastatur bedient, sieht jetzt, wo er ist.** Bisher ersetzten die Formulare den Fokusrahmen des Browsers durch einen Farbwechsel am Feldrand — ein Strich von einem Pixel, bei dem man beim Durchtabben die Spur verliert; Knöpfe und Links hatten gar keine eigene Gestaltung. Jetzt liegt ein bronzefarbener Ring um das, was gerade dran ist. **Nur bei Tastaturbedienung**: Wer mit der Maus klickt, bekommt ihn nicht zu sehen.',
      },
      {
        text: '**Wer sich das Büro vorlesen lässt, hört jetzt auch die Rückmeldungen.** „Gespeichert", „Gemerkt — geht raus, sobald wieder Netz da ist", „Das hat nicht geklappt": Diese Zeilen standen zwar sichtbar da, wurden aber nicht angesagt. In einundvierzig Formularen war das so — beim Anmelden, im Postfach, an jeder Rechnung, an jedem Auftrag. Am meisten fehlte es beim Erfassen in Reihe, wo diese eine Zeile die einzige Auskunft ist, dass etwas angelegt wurde.',
      },
      {
        text: '**Der Shop kann jetzt Dateien verkaufen.** Ein Artikel lässt sich als **digitale Ware** kennzeichnen; die dazugehörigen Dateien kreuzt man unter Werkstattdateien an. Der Anlass war handfest: Auf Etsy steht ein Bauplan als Download und hatte drei Leute im Warenkorb — hier ging das bis jetzt nicht.',
      },
      {
        text: '**Für den Kunden fällt weg, was keinen Sinn hat.** Kein Versand, und bei einem Korb voller Dateien auch keine Anschrift. Dafür kommt ein Haken dazu: Digitale Inhalte werden sofort bereitgestellt, und damit erlischt das Widerrufsrecht — das muss ausdrücklich verlangt werden, sonst entsteht gar keine Bestellung. Festgehalten wird es mit Zeitpunkt an der Bestellung, getrennt vom Verzicht bei Einzelanfertigung, weil es ein anderer Grund ist.',
      },
      {
        text: '**Geliefert wird ab „bezahlt", und keinen Schritt früher.** Die Links stehen in der Bestellbestätigung und auf der Bestellseite. Vorher steht dort der Grund und kein leerer Fleck. Sie gelten ein Jahr und werden bei jedem Aufruf der Bestellseite neu erzeugt; eine stornierte Bestellung liefert nichts mehr.',
      },
      {
        text: '**Dateien gibt es nur gegen PayPal, nicht auf Rechnung.** Liegt eine Datei im Korb, steht der Kauf auf Rechnung gar nicht erst zur Wahl. Der Grund ist handfest: Eine Datei lässt sich nicht zurückholen, und der Status **„In Fertigung"** gibt sie frei — bei einem Stück Stahl ist das richtig, bei einem Bauplan bedeutet er nichts. Ein unbedachter Klick im Büro hätte die Datei ohne Geldeingang ausgeliefert. Nebenbei entfällt damit die Kette aus Anzahlung, Zwischen- und Schlussrechnung, die an einem Bauplan ohnehin Papier ohne Gegenstand wäre.',
      },
      {
        text: '**Die gekauften Dateien stehen jetzt direkt im Kundenkonto**, mit Name und Bestellnummer. Vorher führte der Weg über die Bestellseite — ein Klick, der nichts beantwortet für jemanden, der genau deswegen ins Konto geht.',
      },
      {
        text: '**Die Widerrufsbelehrung hat einen Absatz dazu bekommen**, in allen drei Sprachen. Er muss noch in den veröffentlichten Text übernommen werden — die Entwürfe im Code sind nicht das, was auf der Website steht.',
      },
      {
        text: '**Eine Frage für die Kanzlei, nicht für den Code:** Digitale Leistungen an Verbraucher im EU-Ausland werden im Land des Kunden besteuert, nicht am Betriebssitz. Bis 10.000 € Jahresumsatz aus solchen Verkäufen bleibt der französische Satz; darüber führt der Weg über die OSS-Meldung. Bei einzelnen Bauplänen ist das unkritisch, aber es sollte jemand wissen, bevor es mehr wird.',
      },
      {
        text: '**Beim Melden stand im Feld „Wo war das?" immer „/office".** Egal, von welcher Seite man kam. Der Grund: Das Büro wechselt die Seite im Browser, ohne die Seite neu zu laden — die Herkunftsangabe des Browsers bleibt dabei auf dem stehen, womit alles einmal geladen wurde. Jetzt bringt der Punkt „Fehler melden" selbst mit, wo man gerade war.',
      },
      {
        text: '**Im Büro lässt sich jetzt ein Fehler melden — mit Foto.** Unter **Sonstiges → Fehler melden** stehen drei Felder: worum es geht, was passiert ist, und wo. Dazu bis zu fünf Fotos vom Handy. Daraus wird ein Eintrag im Repository, den sich jemand ansieht. Die Antwort ist die Nummer des Eintrags samt Link.',
      },
      {
        text: '**Was niemand aus dem Kopf weiß, trägt die Seite selbst bei:** die Seite, auf der es passiert ist, das Gerät, die laufende Fassung, der Name und der Zeitpunkt. Genau diese Angaben fehlen sonst, wenn jemand Wochen später nachsehen will. Die Seite steht sichtbar im Formular und lässt sich ändern — wer von der Inventarliste kommt, aber die Bestellung meint, schreibt es hin.',
      },
      {
        text: '**Melden darf jeder, der im Büro angemeldet ist.** Bewusst ohne eigenes Recht: Eine Hürde vor „hier stimmt was nicht" bekommt man nie wieder weg, und gemeldet wird dann gar nicht mehr, sondern beim nächsten Treffen erzählt.',
      },
      {
        text: '**Eingeschaltet wird es in den Einstellungen.** Unter Integrationen → Fehlermeldungen gehören das Repository und ein Zugangswort von GitHub hin. Steht dort nichts, sagt die Seite das und bietet gar nicht erst einen Knopf an, der ins Leere führt. Die Fotos liegen dabei **nicht** in der Mediathek bei den Produktbildern, sondern geschützt — sichtbar sind sie nur über einen unterschriebenen Link im Eintrag. Ein Foto zurückziehen heißt: die Datei löschen, dann ist der Link sofort tot.',
      },
      {
        text: '**Ohne Netz geht das Melden nicht**, und das ist anders als im übrigen Büro. Eine Meldung, die schweigend in der Warteschlange liegt, hilft niemandem — und die Nummer des Eintrags ist der halbe Zweck.',
      },
      {
        text: '**Im Büro ließ sich in kein Zahlenfeld ein Komma eintragen — das ist behoben.** Betroffen war nicht nur der Wert je Einheit im Inventar, sondern **jedes** Zahlenfeld: Einzelpreis und Steuersatz in Angebot und Rechnung, Anzahlungs- und Zwischenprozente am Auftrag, Kosten je Dienstleister, Beträge am Beleg, Mengen bei Wareneingang und Inventur. Wer „0," tippte, sah augenblicklich wieder „0" — das Komma verschwand, bevor die nächste Ziffer kam. Damit war seit Wochen kein Betrag mit Cent und keine Menge mit Nachkommastelle eingebbar. Aufgefallen ist es niemandem, weil ein runder Betrag richtig aussieht.',
      },
      {
        text: '**Jetzt geht beides, Komma und Punkt.** Auch ein deutscher Tausenderpunkt wird verstanden, wenn ein Komma dabei ist („1.000,50"). Angezeigt wird mit Komma, so wie hier geschrieben wird. Ein leeres Feld bleibt leer und wird nicht stillschweigend zu einer Null — beim Mindestbestand ist das der Unterschied zwischen „keine Meldung" und „meld dich sofort".',
      },
      {
        text: '**Beim Nachsehen kamen vier weitere Felder derselben Art heraus.** In den **Einstellungen** betraf es Stundensatz, Steuersatz, Wunschaufschlag und Stammkapital — ein französischer Steuersatz von 5,5 % war schlicht nicht einzugeben, und ein halb getipptes „19," stand als „NaN" im Feld. Am **Auftrag** ließ sich die Fertigungszeit nur in vollen Stunden schätzen, obwohl halbe vorgesehen waren. In der **Auslastung** galt dasselbe für beide Stundenfelder.',
      },
      {
        text: '**Auch die Maßanfertigungs-Anfrage auf der Website war betroffen.** Wer „120,5" als Breite eintrug, dessen Anfrage erreichte die Werkstatt **ohne Maß** — je nach Browser kam das Komma gar nicht erst an oder wurde zu einem ungültigen Wert. Im Formular sah dabei alles richtig aus, gemerkt hätte es niemand.',
      },
      {
        text: '**Der Lieferant lässt sich jetzt direkt beim Posten anlegen.** In der Auswahl „Bezogen von" steht ganz unten **+ Neuer Lieferant**. Ein Klick klappt ein Namensfeld auf, Enter legt an, und der neue Lieferant ist sofort ausgewählt. Bisher hieß das: Formular verlassen, unter Partner anlegen, zurücknavigieren. Verloren ging dabei nichts, aber der Faden riss — und nach zweimal Hüpfen greift man zur Tabelle. Anschrift und Steuernummer lassen sich später unter Partner nachtragen.',
      },
      {
        text: '**Neben dem Speichern steht „& nächster Posten".** Er legt an und stellt sofort ein leeres Formular hin, behält aber **Art, Einheit, Lagerort und Lieferant** stehen. Bei zwanzig Schraubensorten ändern sich damit vier Felder je Posten statt zehn, und es gibt keinen Sprung auf die Detailseite und zurück. Eine Zeile meldet, was angelegt wurde und wie viele es in dieser Runde waren. Wer nur einen Posten erfasst, nimmt „Speichern & schließen" daneben.',
      },
      {
        text: '**Das Lager ist jetzt auch über den KI-Assistenten zu erreichen.** Neu sind: einen Posten vollständig lesen, einen anlegen, Stammdaten ändern und Bestand buchen. Gedacht ist das vor allem für die **erstmalige Übernahme** einer gewachsenen Liste — einmal ansagen statt zweihundertmal ein Formular ausfüllen. Danach wird wieder im Büro erfasst.',
      },
      {
        text: '**Bestand wird auch dort nur gebucht, nie gesetzt.** Der Assistent gibt an, was sich **verändert** — „2 Meter verbraucht" —, und muss einen Grund nennen. Daraus entsteht dieselbe Zeile im Bestandsverlauf wie bei jeder Korrektur im Büro. Die Menge einfach zu überschreiben kann er gar nicht: Genau dieses Loch hatte der Verlauf schon einmal, und wer nachrechnete, fand die Lücken ausgerechnet dort, wo am meisten korrigiert wird.',
      },
      {
        text: '**Ein Lieferantenname, den es nicht gibt, wird abgewiesen.** Der Assistent legt Geschäftspartner nicht nebenbei an — ein Tippfehler brächte sonst still einen zweiten Händler in die Kartei, und aufgefallen wäre es erst bei der nächsten Bestellanfrage.',
      },
      {
        text: '**Gelöschte Kategorien kamen beim Ausrollen zurück — der Grund ist behoben.** Das Startskript erkannte eine eingerichtete Datenbank ausgerechnet daran, ob die Beispielkategorie „Outdoor Möbel" existiert. Genau die war im Büro gelöscht worden, weil sie leer war. Damit hielt das Skript die volle Datenbank für leer und legte die Beispielkategorien wieder an — eine Entscheidung, die jemand getroffen hatte, wurde vom Server zurückgenommen. Jetzt merkt sich der Server in seinem eigenen Merkzettel, dass er hier schon war; ersatzweise zählt, ob überhaupt eine Kategorie, ein Artikel oder ein Benutzer dasteht. An Beispielinhalten hängt die Frage nicht mehr.',
      },
    ],
  },
  {
    nummer: 43,
    datum: '2026-08-23',
    titel: 'Die Aktion führt zur Ware, die Fragen bekommen eine Seite, die Sprache zieht ins Feld',
    punkte: [
      {
        text: '**Die Sprachwahl in den Einstellungen sitzt jetzt am Feld statt über der Seite.** Bisher stand ein Schalter ganz oben und legte die ganze Ansicht um. Weil es Anschrift, Bankverbindung und Zugangsdaten nur einmal gibt, verschwand beim Umschalten die halbe Liste — und über dem Pinterest-Code stand eine Sprachwahl, die ihn nichts angeht. Jetzt zeigt die Übersicht **immer alles**, und die Sprachwahl erscheint erst, wenn man einen Eintrag öffnet, der wirklich etwas zu übersetzen hat.',
      },
      {
        text: '**In der Übersicht steht, welche Sprachen gepflegt sind.** Bei allem Übersetzbaren stehen statt „eingerichtet" die drei Kürzel **DE FR EN** — die gepflegten grün, die fehlenden blass. Damit sieht man auf einen Blick, wo noch etwas fehlt, ohne dreimal umzuschalten.',
      },
      {
        text: '**Was es nur einmal gibt, bleibt sichtbar und bearbeitbar.** Es trägt in einer fremden Sprache den Vermerk „gilt für alle Sprachen" und wird immer in die deutsche Fassung geschrieben. Früher war es schlicht weg.',
      },
      {
        text: '**Gespeichert wird jetzt in einem Zug.** Wer am Slogan die französische und die englische Fassung ändert und einmal auf Speichern drückt, bekommt beide gespeichert — vorher ging pro Speichern nur eine Sprache.',
      },
      {
        text: '**Die Sprachwahl im Büro zeigte die falsche Sprache als gewählt.** In den Einstellungen und bei den Rechtstexten war der **aktive** Knopf blass und die **inaktiven** hatten eine Fläche — genau verkehrt herum. Wer „Französisch" hervorgehoben sah, war in Wahrheit auf Deutsch und wunderte sich, warum Felder auftauchen, die es nur einmal gibt. Jetzt ist der gewählte Reiter bronze hinterlegt, wie überall sonst im Büro.',
      },
      {
        text: '**Nach dem Bestellen wird gefragt, ob Google um eine Bewertung bitten darf.** Auf der Bestätigungsseite steht dafür ein Absatz in unseren eigenen Worten und ein Knopf. Sagt der Kunde ja, meldet sich Google einige Wochen nach der voraussichtlichen Lieferung mit zwei Fragen; die Antworten zählen als **Verkäuferbewertung im Merchant Center**. Die Frage steht auf beiden Wegen — nach PayPal wie nach dem Kauf auf Rechnung.',
      },
      {
        text: '**Das Google-Skript wird erst nach der Zustimmung geladen.** Wer nicht drückt, bekommt von Google nichts zu sehen: kein Skript, kein Aufruf, nichts. Das war die Bedingung — diese Website setzt kein Cookie und braucht deshalb kein Einwilligungsbanner, und das sollte so bleiben. Die Ausnahme in der Sicherheitsrichtlinie gilt ausschließlich für die Bestätigungsseiten, nicht für die übrige Website.',
      },
      {
        text: '**Eingeschaltet wird es mit einer Zahl.** In der Website-Verwaltung unter Integrationen → Google Kundenrezensionen gehört die **Händler-ID** aus dem Merchant Center hin, dazu die übliche Lieferzeit in Tagen (Vorgabe 28 — Google braucht ein Datum, um zu wissen, wann es fragen darf). Steht dort nichts, passiert nichts. Das ist zugleich der Ausschalter.',
      },
      {
        text: '**Vor dem Einschalten gehört ein Absatz in die Datenschutzerklärung** — dass bei Zustimmung E-Mail-Adresse, Bestellnummer und voraussichtliches Lieferdatum an Google übermittelt werden. Der Text liegt bereit und wird nachgezogen.',
      },
      {
        text: '**Die häufigen Fragen haben jetzt eine eigene Seite.** Sie standen bisher nur ganz unten unter „Maßanfertigung" — dort waren sie entstanden, dort blieben sie. Nur handelt kaum eine davon von einer Maßanfertigung: Fertigungszeit, Farben, Cortenstahl, Versandkosten, Abholung, Rückgabe. Wer eine solche Frage hatte, musste sie ausgerechnet auf der Seite suchen, auf der er sie am wenigsten vermutet. Jetzt gibt es sie unter **/faq**, in allen drei Sprachen, verlinkt im Fußbereich jeder Seite.',
      },
      {
        text: '**Auf der Startseite stehen die ersten vier Fragen offen da.** Wer wissen will, wie lange eine Fertigung dauert oder ob man abholen kann, bekommt die Antwort, ohne erst irgendwo hinzuklicken; darunter führt ein Verweis zu allen Fragen. Unter „Maßanfertigung" bleiben sie ebenfalls stehen — wer gerade das Formular ausfüllt, fragt sich genau dort, wie lange es dauert.',
      },
      {
        text: '**Gepflegt wird weiterhin an einer Stelle.** Im Büro unter Einstellungen → Häufige Fragen. Was dort steht, erscheint auf allen drei Seiten gleichzeitig; die Auszeichnung für Suchmaschinen sitzt nur auf der neuen Seite, damit nicht zwei Seiten um denselben Treffer streiten. Die Seite steht in der Sitemap und ist auch in der Datei verlinkt, die KI-Diensten das Haus erklärt.',
      },
      {
        text: '**Der Rabatt ist jetzt in der Sprache des Hauses ausgezeichnet.** Die erste Fassung schrieb ihn in rote Kästen und färbte auch den Preis rot — das sah aus wie ein Prospekt, und im dunklen Thema sprangen bei vier Kacheln acht rote Signale gleichzeitig. Jetzt steht über dem Preis der Name der Aktion in gesperrten Versalien mit dem auslaufenden **Corten-Strich** darunter, so wie unter jeder Überschrift der Seite. Am Bild sitzt in der Übersicht ein **Etikett** mit dem Prozentsatz: heller Grund, dünne Bronzelinie, abgerückt vom Rand. Der Preis selbst ist wieder schwarz — dass etwas günstiger ist, sagt der durchgestrichene Betrag daneben.',
      },
      {
        text: '**Die Frist steht dort, wo sie hingehört.** Auf der Artikelseite steht neben Name und Prozentsatz auch, bis wann die Aktion läuft. In der Übersicht bleibt sie weg: Dieselbe Frist zwölfmal untereinander sagt niemandem etwas, und die Kachel soll den Artikel zeigen.',
      },
      {
        text: '**Die Aktionsseite führt jetzt zur Ware.** „40 % Rabatt auf alle Outdoor-Möbel“ stand da — und wer daraufdrückte, bei dem passierte nichts. Jetzt stehen unter jeder Aktion die Stücke, die dazugehören, als Kacheln mit Streichpreis. Bezieht sich die Aktion auf **eine** Kategorie, führt außerdem das Plakat selbst dorthin; bei mehreren gibt es kein eindeutiges Ziel, dann sind die Kacheln der Weg.',
      },
      {
        text: '**Gezeigt wird genau, was auch rabattiert wird.** Die Auswahl folgt derselben Regel wie der Warenkorb. Eine Aktion, die für bestimmte Kategorien gelten soll und keine nennt, zeigt deshalb **nichts** statt alles — sonst stünde das ganze Sortiment als reduziert da, während die Kasse nichts abzieht.',
      },
    ],
  },
  {
    nummer: 42,
    datum: '2026-08-22',
    titel: 'Sichtbare Rabatte, gestaltbare Rechtstexte und eine schärfere Übersetzungsprüfung',
    punkte: [
      {
        text: '**Eine Aktion steht jetzt am Preis.** Der Sommer-Sale war richtig eingerichtet und die Kasse zog die 40 % auch ab — nur sah man davon nichts: Auf der Übersicht stand am Sofa unverändert **1.990 €**, und der Rabatt tauchte erst im Warenkorb auf. Wer nicht auf gut Glück etwas hineinlegte, erfuhr nie davon. Jetzt trägt die Kachel ein Band mit dem Prozentsatz, und am Preis steht der Aktionspreis mit dem durchgestrichenen alten daneben. Auf der Artikelseite kommen Name der Aktion und das Datum dazu, bis zu dem sie läuft.',
      },
      {
        text: '**Google bekommt den Aktionspreis mit.** Im Produktdatenfeed steht der reguläre Preis weiterhin als Preis und der rabattierte als **Aktionspreis** — samt Zeitraum. So zeigt Google Shopping den Streichpreis, statt eine Preisabweichung zu melden. Dasselbe gilt für die Artikelseite, deren Auszeichnung sonst einen anderen Preis genannt hätte als die Seite selbst.',
      },
      {
        text: '**Zwei Fälle bleiben bewusst ohne Streichpreis.** Ein Stück **auf Anfrage** hat keinen Preis und damit keine Ersparnis. Und ein Rabatt mit **Gutscheincode** gilt erst nach Eingabe im Warenkorb — vorab angeschrieben wäre er jedem versprochen, der den Code gar nicht hat. Ebenso zeigt ein Rabatt über einen **festen Betrag** keinen Streichpreis: Er gilt dem ganzen Warenkorb, nicht dem einzelnen Stück.',
      },
      {
        text: '**Zur Erinnerung, weil es hier auffiel:** Eine Aktion auf eine Oberkategorie greift **nicht** für die Unterkategorien. Wer alle Outdoor-Stücke meint, muss Möbel, Pflanzen und Feuer einzeln auswählen — an der Kasse war das schon immer so, jetzt sieht man es auch.',
      },
      {
        text: '**Versand und Zahlung nennen jetzt beide Zahlungswege.** In der Vorlage für den Rechtstext stand, bezahlt werde über PayPal — mehr nicht. An der Kasse steht der **Kauf auf Rechnung** aber bei jedem Artikel zur Wahl, und bei Einzelanfertigungen verteilt sich der Betrag auf **Anzahlung** mit der Auftragsbestätigung, **Zwischenrechnung** beim erreichten Fertigungsabschnitt und **Schlussrechnung** vor der Auslieferung. Ein Zahlungsweg, der auf der Rechtsseite fehlt, ist im Streitfall keiner. Alle drei Sprachen beschreiben jetzt dasselbe. Die bereits veröffentlichten Texte werden gesondert nachgezogen.',
      },
      {
        text: '**Die Übersetzungsprüfung findet jetzt, was sie bisher übersah.** Sie meldete „alles übersetzt", während vier Artikel eine französische Beschreibung von 250 Zeichen trugen, wo im Deutschen 2.300 standen — und zwei davon sogar denselben Text: Eine Fahrrad-Wandhalterung wurde auf Französisch und Englisch als beleuchtetes Herz beschrieben, monatelang. Geprüft werden jetzt auch die Beschreibungen, und zwar auf dreierlei: ob sie **auffällig kürzer** sind als das Original, ob ihnen dessen **Zwischenüberschriften und Aufzählungen** fehlen, und ob **zwei Einträge wortgleich** sind. „Auffällig" heißt dabei hinsehen, nicht wegwerfen.',
      },
      {
        text: '**Der KI-Assistent bekommt die Übersetzungsregeln vorab.** In den Hausregeln steht jetzt ein eigener Abschnitt: die Gliederung des Originals übernehmen, gefüllt ist nicht übersetzt, vor dem Schreiben das Original lesen, welche Begriffe stehen bleiben (NEXT CONCEPT, Cimatron, Corten, RAL) — und dass ein Artikel mit Varianten Titel und Bezeichnungen in einem Zug braucht.',
      },
      {
        text: '**Sechs fehlende Werkzeuge für den KI-Assistenten.** Aufgefallen ist eines: Bei einer Aktion „gilt für bestimmte Kategorien" verriet die Liste nicht, für welche — wer sie ändern wollte, musste raten. Beim Nachsehen kamen fünf weitere heraus. Neu sind: eine Aktion, eine Kategorie, einen Geschäftspartner und eine Kundenstimme einzeln lesen; eine Wiedervorlage abhaken; und eine leere Kategorie entfernen.',
      },
      {
        text: '**Die Sterne einer Kundenstimme waren für den Assistenten unsichtbar.** Sie kamen heute Nachmittag dazu und fehlten in der Schnittstelle — weder lesbar noch setzbar. Dabei entscheiden sie mit darüber, ob im Google-Ergebnis eine Sternebewertung erscheint.',
      },
      {
        text: '**Rechtstexte lassen sich gestalten.** Impressum, AGB und Widerrufsbelehrung waren bisher eine Wand aus Absätzen. Jetzt gibt es Zwischenüberschriften, Aufzählungen und Fettes — mit vier Zeichenfolgen, die über den Feldern zum Aufklappen erklärt sind: **## Überschrift**, **### kleinere**, **- Punkt einer Aufzählung** und zwei Sternchen für **fett**. Alles Übrige bleibt Absatz. Wer nichts davon braucht, tippt weiter einfach Text.',
      },
      {
        text: '**Dasselbe gilt für Artikelbeschreibungen und alles, was der KI-Assistent schreibt.** Eine per Assistent übersetzte Beschreibung wurde bisher zur Textwüste, wo die deutsche Zwischenüberschriften und eine Aufzählung hatte. Jetzt kommt die Gliederung mit.',
      },
      {
        text: '**Der KI-Assistent kann die Rechtstexte endlich lesen und schreiben.** Bisher bekam er beim Lesen den rohen Textbaum — für ein einziges Impressum mehrere Bildschirmseiten unlesbares Zeug —, und zum Schreiben hätte er ihn genauso wieder aufbauen müssen. Jetzt geht lesbarer Text hinein und heraus, mit denselben vier Zeichenfolgen wie im Büro.',
      },
    ],
  },
  {
    nummer: 41,
    datum: '2026-08-22',
    titel: 'Drei Sprachen im Büro, Bilder mit Gedächtnis und eine Adresse je Artikel',
    punkte: [
      {
        text: '**Die Einstellungen lassen sich im Büro in allen drei Sprachen pflegen.** Bisher schrieb das Büro immer die deutsche Fassung — auch dann, wenn jemand die häufigen Fragen, den Untertitel oder die SEO-Standardtexte auf Französisch pflegen wollte. Gemerkt hat man es nicht: Das Formular sah gleich aus, und der französische Text landete stillschweigend im deutschen Feld. Jetzt steht die Sprachwahl über den Feldern. In einer fremden Sprache erscheinen **nur** die Felder, die es je Sprache gibt — Anschrift, Bankverbindung und Stundensatz bleiben unter Deutsch, denn die gibt es nur einmal. Bei den Integrationen gibt es keine Sprachwahl, dort ist nichts zu übersetzen.',
      },
      {
        text: '**Eine leere Übersetzung sieht jetzt leer aus.** Wo noch nichts übersetzt ist, zeigte das Formular bisher den deutschen Text — es sah aus, als sei übersetzt, und beim Speichern stand der deutsche Text als französischer fest.',
      },
      {
        text: '**Eine Oberkategorie zeigt nicht mehr alles doppelt.** Auf „Outdoor" standen die drei Kacheln Möbel, Pflanzen und Feuer — und darunter noch einmal sämtliche Stücke aus allen dreien. Jetzt zeigt eine Kategorie ihre Unterkategorien und die Artikel, die wirklich in ihr liegen. Wer tiefer will, tippt eine Kachel an; dafür sind sie da.',
      },
      {
        text: '**Jeder Artikel hat wieder genau eine Adresse.** Das war der eigentliche Schaden hinter der Dopplung: Ein Sofa aus „Möbel" wurde auf der Outdoor-Seite unter `/outdoor/…` verlinkt statt unter `/moebel/…`. Beide Adressen lieferten dieselbe Seite und erklärten sich obendrein jeweils selbst für die maßgebliche — für Google zwei Seiten mit gleichem Inhalt, die sich gegenseitig die Bedeutung wegnehmen. Alte Links bleiben gültig und führen weiter zum Ziel, zählen aber nicht mehr als eigene Seite.',
      },
      {
        text: '**Leere Kategorien lassen sich per KI-Assistent entfernen.** Bisher gab es dafür kein Werkzeug — anlegen und ändern ging, wegräumen nicht. Wie beim Löschen eines Artikels ist es zweistufig: Der erste Aufruf zeigt nur, was passieren würde. Liegen noch Artikel darin, wird nichts gelöscht, sondern gesagt, dass sie zuerst umgehängt gehören; Unterkategorien rücken eine Ebene nach oben, und auch das steht vorher da.',
      },
      {
        text: '**Ein Artikel mit Varianten lässt sich per KI-Assistent übersetzen.** Bisher ging das nicht: Titel und Variantenbezeichnung sind beide Pflicht und beide übersetzbar, und bei einem Artikel ohne französische Fassung fehlten beide. Damit lief jeder Weg ins Leere — das eine Werkzeug scheiterte am Titel, das andere an den Bezeichnungen. Jetzt lassen sich beide in einem Zug setzen. Aufgefallen beim Übersetzen des Brasero mit seinen sechs Größen.',
      },
      {
        text: '**Rechtstexte stehen jetzt im Büro.** Unter Sonstiges → Rechtstexte lassen sich Impressum, Datenschutzerklärung, AGB, Widerrufsbelehrung, Muster-Widerrufsformular sowie Versand & Zahlung bearbeiten — **in allen drei Sprachen**, mit der Sprachwahl über den Feldern. Bisher ging das nur in der Website-Verwaltung, in einer anderen Oberfläche und für jede Sprache einzeln. Zu jedem Text steht ein Verweis auf die Seite, auf der er draußen erscheint.',
      },
      {
        text: '**Die Entwürfe lassen sich mit einem Knopf einspielen.** Widerrufsbelehrung, Muster-Formular sowie Versand & Zahlung gab es als Vorlage schon lange — aber nur über ein Kommando am Server. Genau deshalb blieben diese beiden Seiten leer, bis das Merchant Center darüber stolperte. Jetzt genügt ein Knopf. Geschrieben wird nur dort, wo noch nichts steht: Eine eigene Fassung ist geprüft, der Entwurf ist es nicht.',
      },
      {
        text: '**Bilder bleiben im Browser, statt bei jedem Besuch neu zu laden.** Die Bilder kamen bisher ohne jede Angabe dazu, wie lange sie aufgehoben werden dürfen — der Browser lud sie deshalb bei **jedem** Seitenaufruf vollständig neu. Auf der Startseite ist das über ein Megabyte, bei jedem einzelnen Besuch derselben Person. Jetzt darf er sie ein Jahr behalten. Wer ein Bild austauscht, bekommt automatisch eine neue Adresse; es kann also niemand ein altes Bild zu sehen bekommen.',
      },
      {
        text: '**Der Produktdatenfeed reicht nicht mehr die Originalfotos hinaus.** Google lud für jeden Eintrag die Archivdatei herunter — beim Coeur 5,9 MB. Jetzt geht die Fassung mit derselben Auflösung hinaus, die nur 122 KB wiegt.',
      },
      {
        text: '**Google darf die Produktbilder endlich holen.** Die Bilder der Artikel werden unter `/api/media/…` ausgeliefert — und genau dieser Bereich war für Suchmaschinen gesperrt, weil dort auch Bestellungen, Postfach und Zugänge liegen. Aufgefallen ist es nie, denn die Seiten selbst waren ja zu sehen; nur die Bilder darin nicht. Bemerkt hat es erst das Merchant Center, und dort betraf es **alle 19 Artikel**: Ohne Bild kein Eintrag bei Google Shopping, und in der Bildersuche stand ohnehin nichts. Die Bilder sind jetzt ausdrücklich freigegeben, alles andere hinter `/api/` bleibt gesperrt.',
      },
      {
        text: '**Der Versand steht im Produktfeed — für Frankreich, Deutschland und Österreich.** Ohne Versandangabe weist Google für ein Zielland nicht einzelne Artikel ab, sondern alle. Die Angabe kommt aus derselben Zahl, die auch die Kasse berechnet, und gilt für alle drei Länder gleich — weil der Shop es so hält: ein fester Betrag je Stück, ohne Blick auf die Anschrift. Wo nichts hinterlegt ist, steht ausdrücklich „0,00 €", denn dann ist es versandkostenfrei und keine fehlende Angabe. Eine eigene Versandregel im Merchant Center braucht es dadurch nicht.',
      },
      {
        text: '**Kein Eintrag im Produktfeed bleibt ohne Beschreibung.** Bei sieben von neunzehn Stücken stand im Feed eine leere Beschreibung — bei allen, für die im Büro nie eine Kurzbeschreibung eingetragen wurde. Google verlangt eine und hätte diese Einträge abgewiesen; gemerkt hätte man es erst an einer roten Datenquelle. Fehlt sie, steht jetzt der Artikelname darin. Das ist eine Notlösung und kein Ersatz: Betroffen sind die **Rennradwandhalterung** und der **Brasero** in allen sechs Größen. Eine Kurzbeschreibung dort nachzutragen lohnt doppelt, denn sie steht auch auf der Artikelseite.',
      },
    ],
  },
  {
    nummer: 40,
    datum: '2026-08-22',
    titel: 'Gefunden werden: Sterne, häufige Fragen, Shopping-Einträge und ein schnellerer erster Besuch',
    punkte: [
      {
        text: '**Sterne im Google-Ergebnis.** Kundinnen und Kunden können ihrer Stimme nach der Lieferung freiwillig Sterne geben — der Text bleibt die Hauptsache, die Sterne sind ein Zusatz. Auf der Artikelseite stehen sie über dem Zitat, und im Google-Ergebnis erscheint der Durchschnitt als Sternebewertung. Gerechnet wird nur mit dem, was wirklich vergeben wurde; eine Stimme ohne Sterne zählt gar nicht mit.',
      },
      {
        text: '**Häufige Fragen.** Unter Website-Einstellungen lassen sich Fragen und Antworten pflegen. Sie erscheinen aufklappbar auf der Seite „Maßanfertigung" — und ausgezeichnet für Google, das sie unter dem Treffer anzeigt und damit doppelt so viel Platz in der Ergebnisliste einnimmt. Anlegen geht auch per KI-Assistent: `faq_liste`, `faq_ergaenzen` und `faq_setzen`.',
      },
      {
        text: '**Der Weg im Suchergebnis.** Unter Artikeln, News-Beiträgen und Referenzen steht bei Google jetzt der Pfad („Kollektion › Pflanzkübel") statt der nackten Adresse. Man sieht vor dem Klick, wo man landet.',
      },
      {
        text: '**Der erste Besuch ist eine halbe Sekunde schneller.** An jeder Seite hing eine Kopfzeile, mit der der Browser vor dem Weitermachen erst noch die Helligkeitseinstellung nachreichen sollte — und weil er sie beim allerersten Aufruf noch nicht mitgeschickt hatte, warf er die begonnene Verbindung weg und fing von vorn an. Gemessen waren das **rund 0,6 Sekunden**, und zwar genau bei dem Besucher, der frisch über Google kommt. Die Kopfzeile gilt jetzt nur noch für die Verwaltung, wo sie hingehört. Im Messwerkzeug von Google stieg die Leistungsnote der Startseite dadurch von **93 auf 97**, der größte Bildaufbau von 2,9 auf 2,5 Sekunden.',
      },
      {
        text: '**Neues wird gemeldet, statt auf Besuch zu warten.** Bisher stand ein neuer Beitrag in der Sitemap und wartete darauf, dass ein Suchdienst vorbeischaut — bei einer kleinen Seite können das Tage sein, und dann ist die Aktion vorbei, über die er berichtet. Jetzt geht in dem Moment, in dem ein Artikel, eine Referenz, eine Kategorie oder ein veröffentlichter Beitrag gespeichert wird, eine Meldung an die Suchdienste hinaus. Gelöschtes wird ebenso gemeldet, damit es nicht wochenlang als Fehlerseite im Verzeichnis steht. Google macht dabei nicht mit, Bing schon — und hinter der Websuche von ChatGPT steht Bing.',
      },
      {
        text: '**Eine Seite für die Sprachmodelle.** Unter `/llms.txt` steht ab jetzt in schlichtem Text, wer wir sind, was wir fertigen und wo was zu finden ist — Sortiment, lieferbare Stücke mit Preis, häufige Fragen, Referenzen und die letzten Beiträge. Wenn ChatGPT, Claude oder Perplexity nach Stahlmöbeln gefragt werden und dabei auf uns stoßen, lesen sie sonst unser HTML mit allem Beiwerk und setzen sich das Wesentliche selbst zusammen. Die Datei pflegt sich von selbst aus der Datenbank und gibt es in allen drei Sprachen.',
      },
      {
        text: '**Das Sortiment bei Google Shopping.** Es gibt jetzt einen Produktdatenfeed unter `/feed/produkte.xml`, mit dem sich das Sortiment im Google Merchant Center hinterlegen lässt — dort erscheinen die Stücke in den kostenlosen Shopping-Einträgen, mit Bild, Preis und Verfügbarkeit und ohne Anzeigenbudget. Der Feed pflegt sich selbst: Preisänderung, neues Bild, ausverkauft — beim nächsten Abruf stimmt es, ohne dass jemand eine Tabelle hochlädt. Jede Größe steht mit ihrem eigenen Preis darin, die Größen eines Stücks bleiben aber als Familie zusammen. Stücke auf Anfrage und Stücke ohne Bild bleiben draußen, weil Google sie ohnehin zurückweist. Wie das Konto eingerichtet wird, steht in der Anleitung.',
      },
      {
        text: '**Google und Bing bestätigen.** Zwei neue Felder in den Website-Einstellungen für die Nachweise der Search Console und der Bing Webmaster Tools — damit lässt sich einsehen, mit welchen Suchanfragen Menschen auf der Seite landen. Bing steht dabei auch hinter der Websuche von ChatGPT.',
      },
    ],
  },
  {
    nummer: 39,
    datum: '2026-08-22',
    titel: 'Kein Seed mehr beim Ausrollen',
    punkte: [
      {
        text: '**Ein Ausrollen bringt keine Beispielinhalte mehr zurück.** Bisher sah der Startlauf bei jedem Ausrollen nach, ob Referenzen, Ratgeber-Beiträge oder „Über uns" fehlen — und legte sie wieder an. Wer eine Beispiel-Referenz gelöscht hatte, weil sie nicht zum Betrieb gehört, hatte sie am nächsten Tag wieder dastehen. Jetzt gilt: Ist die Datenbank eingerichtet, wird nichts mehr angefasst. Nachtragen lässt sich weiterhin, aber nur ausdrücklich.',
      },
    ],
  },
  {
    nummer: 38,
    datum: '2026-08-22',
    titel: 'Empfänger mit Vorschlägen, Kopie und Blindkopie, und der Zähler fürs Postfach',
    punkte: [
      {
        text: '**Empfänger vorschlagen statt tippen.** Wer im Postfach eine Mail schreibt, bekommt beim Tippen im Feld „An" Vorschläge aus den Geschäftspartnern — gesucht wird in Name und Adresse, angezeigt werden Name, Adresse und Art (Kunde, Lieferant). Gewählte Empfänger stehen als Plättchen mit ihrem **Namen** da und lassen sich einzeln wegnehmen; die Rücktaste im leeren Feld nimmt das letzte. Das läuft aus dem Bestand im Gerät, also auch ohne Netz und ohne Wartezeit.',
      },
      {
        text: '**Kopie und Blindkopie.** Über dem Betreff steht jetzt „Kopie (CC) & Blindkopie (BCC)" zum Aufklappen — mit denselben Vorschlägen und Plättchen. Steht schon etwas drin, ist der Bereich von selbst offen: Ein Empfänger, den man nicht sieht, ist der gefährlichste von allen. Die Blindkopie bleibt für die Empfänger unsichtbar, steht aber in der eigenen Kopie unter „Gesendet" — dort will man später wissen, wer sie bekommen hat.',
      },
      {
        text: '**Am Telefon gehen die Auswahllisten beim Mailschreiben wieder auf.** Größe, Überschrift und Strich ließen sich beim Schreiben einer Mail am Handy antippen, ohne dass sich etwas rührte — am Rechner ging alles. Ursache war die Beschriftung „Nachricht" über dem Schreibfeld: Ein Tipp irgendwo in eine Beschriftung reicht der Browser an das zugehörige Eingabefeld weiter, und dort landete er statt auf der Liste.',
      },
      {
        text: '**Gelesen ist gelesen — auf jedem Gerät.** Der Zähler an der Navigation hängt jetzt daran, ob wirklich noch etwas ungelesen ist, und nicht daran, ob jemand hingesehen hat. Wer die Mail am Handy im Mailprogramm liest, bei dem verschwindet der Zähler im Büro von allein; wer eine Mail im Büro öffnet, bei dem gilt sie auch am Handy als gelesen, und der Zähler geht sofort weg. Wer das Postfach nur aufmacht und die Mail ungelesen lässt, behält seinen Zähler — Ansehen ist kein Lesen. Gezählt wird dabei allein der Posteingang: Eine Mail, die ungelesen in einen Ordner wandert, ist einsortiert und nimmt den Zähler mit.',
      },
    ],
  },
  {
    nummer: 37,
    datum: '2026-08-22',
    titel: 'Mails wie geschrieben, der Corten-Strich im Schreibfeld und die Meldung über neue Post',
    punkte: [
      {
        text: '**Die Meldung über neue Post sagt jetzt, von wem sie ist.** Statt „Neue Post für Info · Eine ungelesene Nachricht" steht dort der Absender und der Betreff der jüngsten ungelesenen Mail — daran erkennt man, ob man das Handy aus der Tasche holen muss. Liegt mehr als eine bereit, steht die Zahl dahinter.',
      },
      {
        text: '**Antippen führt endlich ins Postfach.** Wer die Meldung am Telefon antippte, landete auf der Seite, auf der er ohnehin schon stand: Die App kann sich in einer installierten Fassung nicht von außen umleiten lassen. Jetzt sagt die Meldung der App, wohin sie gehen soll, und die geht selbst.',
      },
      {
        text: '**Neue Post steht als Zähler an der Navigation.** Unter Kundschaft → Postfach erscheint ein Zähler, sobald Post da ist, die noch niemand angesehen hat — wie bei Anfragen, Rechnungen und Belegen. Er verschwindet, sobald man ins Postfach sieht.',
      },
      {
        text: '**Der Corten-Strich im Schreibfeld.** In der Leiste steht jetzt „Strich" mit vier Spielarten: **Fein**, **Mittel**, **Kräftig** und **Quer** über die ganze Breite. Gedacht als Trennung vor der Signatur oder zwischen zwei Abschnitten. Was man wählt, sieht man beim Schreiben genauso, wie es beim Empfänger ankommt.',
      },
      {
        text: '**Überschriften in Mails tragen ihren Strich von selbst.** Wer „Überschrift 1" oder „Überschrift 2" wählt, bekommt darunter den Corten-Strich der Website — lang unter der großen, kurz unter der kleinen. Das ist dieselbe Handschrift wie auf Angebot, Rechnung und Website; von Hand nachlegen muss man nichts mehr.',
      },
      {
        text: '**Fehlt die Kopie in „Gesendet", steht es im Ausgangsprotokoll.** Bisher stand ein solcher Fehlschlag nur im Serverprotokoll, wo niemand nachsieht, der gerade eine Mail vermisst. Jetzt steht der Grund beim betreffenden Eintrag unter Postfach → Ausgangsprotokoll.',
      },
      {
        text: '**Mails kommen so an, wie sie geschrieben wurden.** Vier Zeilen untereinander standen beim Empfänger mit einer Leerzeile dazwischen, weil jedes Mailprogramm Absätzen seinen eigenen Abstand gibt — und die Leerzeile, die man vor der Grußformel wirklich getippt hatte, fehlte dafür. Beides steht jetzt fest in der Mail: eng, wo eng geschrieben wurde, und eine Leerzeile, wo eine gemacht wurde.',
      },
      {
        text: '**Der Briefkopf bleibt auch im dunklen Mailprogramm sichtbar.** Wer seine Mails dunkel liest, bekam einen schwarzen Schriftzug auf schwarzem Grund — das Logo war schlicht weg. Die Mail sagt jetzt ausdrücklich, dass sie hell gemeint ist, und das Logo bringt seinen hellen Grund im Bild mit. Damit steht der Kopf auch dort, wo ein Programm sich um Angaben nicht schert.',
      },
      {
        text: '**„Gesendet" bekommt seine Kopie.** Verschickte Mails landeten nicht im eigenen Ordner „Gesendet", wenn der beim Anbieter anders heißt als in den Einstellungen eingetragen — und das blieb stumm. Der Ordner wird jetzt beim Anbieter erfragt statt geraten; klappt die Ablage trotzdem nicht, steht es nach dem Senden als Hinweis da, statt dass man die Mail Wochen später vergeblich sucht.',
      },
      {
        text: '**Die Rechtsform steht einmal unter der Mail, nicht zweimal.** In der Fußzeile stand „Next-Concept SAS SAS au capital de 1 000 €" und „RCS RCS Strasbourg", weil Name und Rechtsform beide die Angabe trugen. Doppeltes wird jetzt erkannt und weggelassen — auf Mails wie auf Rechnungen.',
      },
    ],
  },
  {
    nummer: 36,
    datum: '2026-08-22',
    titel: 'Die Sprache des Besuchers und Kleingedrucktes im Schreibfeld',
    punkte: [
      {
        text: '**Kleingedrucktes im Schreibfeld.** Neben der Überschriften-Liste steht jetzt eine zweite mit der Schriftgröße: **Klein** oder **Normal**. Gedacht für das, was unter eine Mail gehört, aber nicht ins Auge springen soll — Signatur, Pflichtangaben, ein Hinweis zur Zahlungsfrist. Die kleine Schrift ist ein Vielfaches der normalen und keine feste Punktzahl: Wer beim Empfänger die Schrift größer gestellt hat, bekommt auch das Kleingedruckte größer und nicht stur winzig. Nebenbei sind die Listen auf Deutsch beschriftet — aus „Heading 1" wird „Überschrift 1", und die Größenliste heißt „Größe" statt ein zweites Mal „Normal".',
      },
      {
        text: '**Die Website spricht die Sprache des Besuchers.** Wer `vincent-hellmann.com` ohne Sprachkürzel aufruft, kam bisher immer auf der deutschen Fassung an — auch die Kundschaft aus Frankreich, die den Umweg über das kleine FR oben rechts erst finden musste. Jetzt entscheidet die Spracheinstellung des Browsers: Französisch eingestellt heißt französische Seite, Englisch heißt englische. Wer eine Sprache eingestellt hat, die wir nicht anbieten — Italienisch etwa —, bekommt Englisch; damit ist ihm eher gedient als mit Deutsch. Auf Deutsch landet nur, wer gar keine Sprache mitschickt. Wer die Sprache oben rechts von Hand wählt, dessen Wahl gilt ab da und wird ein Jahr lang gemerkt — sie schlägt auch die Einstellung des Browsers. Adressen mit Sprachkürzel bleiben unangetastet: Ein weitergegebener Link auf `/fr/kontakt` öffnet beim Empfänger die französische Seite, egal was sein Browser sagt. Nach der Region wird bewusst **nicht** geschaut — sonst bekäme der deutsche Kunde im Frankreichurlaub Französisch vorgesetzt.',
      },
    ],
  },
  {
    nummer: 35,
    datum: '2026-08-22',
    titel: 'Abnahme mit Unterschrift, Monatspaket für die Kanzlei, Wischgesten — und Dateien an den Zulieferer',
    punkte: [
      {
        text: '**Zeichnungen an den Zulieferer schicken — angekreuzt statt hochgeladen.** Am Artikel steht neben jeder Werkstattdatei ein Kästchen: ankreuzen, Adresse eintippen, abschicken. Der Laserschneider bekommt eine Mail mit je einem Abhol-Link, vierzehn Tage gültig, ohne Passwort und ohne Konto. Eine Notiz für die Mail lässt sich dazuschreiben — Werkstoff, Stückzahl, was eben dazugehört. Wer die Mail lieber selbst formuliert, lässt das Adressfeld leer und bekommt nur die Links zum Weitergeben. Der Empfänger holt dabei immer den Stand von jetzt: Wird die Zeichnung im Haus überarbeitet, führt derselbe Link zur neuen Fassung — anders als beim Anhang, der ab dem Absenden veraltet. Und die Datei bleibt, wo sie hingehört; es entsteht keine zweite Fassung im Haus. Zurückziehen lässt sich ein verschickter Link nicht, wohl aber die Datei löschen oder ersetzen — beides wirkt sofort. Die Kästchen sieht nur, wer Aufträge bearbeiten darf.',
      },
      {
        text: '**Abnahme mit Unterschrift auf dem Telefon.** Beim Kunden vor Ort: Auftrag öffnen, „Abnahme mit Unterschrift" antippen, der Kunde unterschreibt mit dem Finger. Daraus entsteht das Abnahmeprotokoll — der Lieferschein mit der Unterschrift, Name, Ort und Uhrzeit — als PDF bei den Dateien des Auftrags. Ab da läuft die Gewährleistung, und bei Streit liegt das eine Blatt vor, das zählt. Eine Abnahme lässt sich nicht überschreiben; das braucht Netz, weil das Protokoll am Server entsteht.',
      },
      {
        text: '**Textbausteine: „::" tippen, Baustein wählen, fertig.** Grußformeln, Zahlungshinweise, Gewährleistungstexte — einmal anlegen unter Einstellungen → Integrationen, dann in jedem Schreibfeld (Mail, Versandfenster, Newsletter) mit „::" abrufen. Weitertippen filtert die Auswahl.',
      },
      {
        text: '**Wiederkehrende Belege legen sich selbst an.** Miete, Internet, Versicherung: Am Beleg „monatlich", „vierteljährlich" oder „jährlich" wählen — zum nächsten Termin steht der Folgebeleg von selbst da, unbezahlt und mit Meldung aufs Telefon; nur der neue Scan ist nachzureichen. Beenden: am jüngsten Beleg wieder auf „einmalig" stellen.',
      },
      {
        text: '**Das Monatspaket für den Steuerberater auf Knopfdruck.** Im Steuer-Export gibt es jetzt den Monatsblick: ein ZIP mit der Buchungsliste, den Scans aller Ausgabenbelege und den Rechnungs-PDFs des Monats — herunterladen oder direkt an die Kanzlei mailen. Die Kanzlei-Adresse wird einmal unter Einstellungen → Integrationen → E-Mail-Versand hinterlegt. Fehlen zu Ausgaben die Scans, sagt das System es dazu, bevor der Steuerberater nachfragt. Ist das Paket zu groß für einen Mail-Anhang, bekommt die Kanzlei stattdessen die Buchungsliste plus einen Abhol-Link — vierzehn Tage gültig, ohne Konto und ohne Passwort, denn der Link trägt seine eigene fälschungssichere Signatur.',
      },
      {
        text: '**Versandfenster und Newsletter schreiben im gestalteten Schreibfeld.** Wo bisher ein nacktes Textfeld stand, ist jetzt dasselbe Schreibfeld wie beim Mailschreiben: fett, Farbe, Aufzählung, Link. Im Versandfenster für Angebot, Rechnung und Mahnung steht die Signatur beim Öffnen gleich mit im Feld — was man sieht, geht raus, nichts wird mehr stillschweigend angehängt. Beim Newsletter gilt dasselbe; „Aus einem Beitrag übernehmen" füllt das Feld wie gewohnt vor. Die Farbwahl für Schrift und Hervorhebung hat jetzt eine überschaubare Palette; das erste Feld heißt **Standard** und legt bewusst keine Farbe fest — der Text folgt damit dem hellen oder dunklen Thema und bleibt auf dem Briefbogen schwarz. Gleich daneben steht der Corten-Ton der Website, damit Hervorhebungen in Mails dieselbe Handschrift tragen wie die Seite.',
      },
      {
        text: '**Mails und Wiedervorlagen lassen sich wischen.** In der Postliste heißt nach links wischen „in den Papierkorb", nach rechts „gelesen/ungelesen umdrehen" — wie in jeder Mail-App. Dazu hat jede Zeile einen „⋯"-Knopf: markieren, löschen oder in einen anderen Ordner verschieben, ohne die Mail zu öffnen. Bei den Wiedervorlagen gilt dasselbe: links löschen, rechts abhaken. Das Scrollen bleibt ungestört — die erste Bewegung entscheidet, ob gewischt oder gescrollt wird.',
      },
      {
        text: '**Die Signatur lässt sich gestalten.** Das Signatur-Feld am Postfach ist jetzt dasselbe Schreibfeld wie beim Mailschreiben: fett, Farbe, Link — statt nacktem Text. Bestehende Klartext-Signaturen bleiben gültig und werden beim Öffnen zu Absätzen; wer die Signatur leert, bekommt wieder den automatischen Rückfall aus Absendername und Kontaktdaten.',
      },
      {
        text: '**Feinschliff am Handy.** Knöpfe mitten in Formularen nehmen die volle Breite — ein schmaler Knopf zwischen Feldern war ein kleines Ziel für den Daumen. Datumsfelder sehen aus wie alle anderen Felder (vorher zeichnete das iPhone sie mit eigener Höhe und mittigem Text), und Platzhaltertexte sind dezenter.',
      },
      {
        text: '**Ziehen zum Aktualisieren — die Geste, die jede App am Handy kann.** Als installierte App gibt es keinen Neuladen-Knopf des Browsers; wer wissen wollte, ob etwas Neues da ist, musste den kleinen Abgleichpunkt oben rechts treffen. Jetzt genügt es, ganz oben auf einer Seite nach unten zu ziehen: Ein kleiner Kreis kommt hervor, ab der Schwelle wird er bronze, loslassen stößt den Abgleich an — Wartendes geht raus, Neues kommt herein. Die Seite wird dabei bewusst nicht hart neu geladen: Das Büro lebt aus dem Bestand im Gerät, und man bleibt, wo man war. „Bestand neu holen" in den Einstellungen bleibt daneben bestehen — das ist das Reparaturwerkzeug für den Fall, dass etwas fehlt, und wirft alles weg und holt es von vorn.',
      },
    ],
  },
  {
    nummer: 34,
    datum: '2026-08-21',
    titel: 'ERP-Audit: Storno, Rechte, Partnerkette, MCP-Härtung — und die Meldungsglocke',
    punkte: [
      {
        text: '**Ein Storno drückte den Umsatz doppelt — jetzt zählt er richtig.** Beim Stornieren entsteht eine Gegenrechnung mit negativen Beträgen, das Original wird als „storniert" markiert. Die Übersicht und der Steuer-Export zählten aber nur die Gegenrechnung und ließen das Original weg: Der Betrag fehlte zweimal statt einmal. Jetzt erscheinen beide Belege — sie heben sich auf, und der Steuerberater sieht das Paar mit Kennzeichnung. Die Gegenrechnung steht dafür nicht mehr bei den offenen Posten und wird nicht mehr angemahnt: Aus einem Storno ist nichts zu zahlen.',
      },
      {
        text: '**Jeder sieht nur noch seine Bereiche im Gerät.** Das Büro spielt seinen Datenbestand aufs Gerät, damit es ohne Netz arbeitet. Bisher bekam jeder, der das Büro öffnen durfte, dabei alles — auch Rechnungen, Belege und Kontobewegungen; ausgeblendet war nur die Anzeige. Jetzt entscheiden die Rechte, was überhaupt ins Gerät kommt, und wem ein Recht entzogen wird, dessen Gerät leert die betroffenen Bereiche beim nächsten Abgleich von selbst.',
      },
      {
        text: '**Wer Rechnungen schreiben darf, darf sie jetzt auch verschicken.** Der Dokumentversand fragte für alles dasselbe Recht „Anfragen bearbeiten" — wer nur Anfragen beantwortete, konnte damit Mahnungen verschicken, und wer Rechnungen schreiben durfte, konnte sie nicht versenden. Jetzt gehört zum Angebot das Angebotsrecht, zu Rechnung und Mahnung das Rechnungsrecht, zu Bestätigung und Lieferschein das Auftragsrecht.',
      },
      {
        text: '**Partner einmal anlegen, überall auswählen.** Angebot, Auftrag und Rechnung haben jetzt einen Auswähler für den Geschäftspartner. Auswählen übernimmt Name und Anschrift, bei der Rechnung auch SIRET und TVA — dieselben Angaben mussten bisher bis zu viermal getippt werden. Mit der Verknüpfung weiß das Versandfenster endlich die Mailadresse von selbst, die Vorgänge erscheinen im Kundenportal, und Statusmeldungen gehen in der Sprache des Partners hinaus — die sich am Partner jetzt auch einstellen lässt.',
      },
      {
        text: '**„Angebot schreiben" aus einer Anfrage nimmt die Angaben mit.** Name und Produkt stehen schon drin, und das Angebot merkt sich seine Anfrage. Das ist mehr als Bequemlichkeit: Über diese Verbindung findet der spätere Auftrag seinen Zahlplan — Anzahlung und Zwischenrechnung liefen im Projektgeschäft bisher gar nicht erst an, weil die Verbindung nie gesetzt wurde.',
      },
      {
        text: '**Entwürfe lassen sich verwerfen.** Ein Angebots- oder Rechnungsentwurf ohne Nummer ließ sich bisher weder löschen noch stornieren — er stand für immer in der Liste und zählte ewig als Arbeit. Jetzt gibt es den Knopf „Entwurf verwerfen". Was eine Nummer hat, bleibt wie gehabt: Das wird storniert oder abgelehnt, nicht gelöscht.',
      },
      {
        text: '**Verlorene Angebote bekommen ein Ende.** Der Knopf „Abgelehnt" schließt ein versendetes Angebot ab — vorher blieb es ewig auf „versendet" stehen, und das automatische Nachfassen erinnerte immer weiter.',
      },
      {
        text: '**Doppelt getippt legt nichts mehr doppelt an.** Wer bei „Auftrag anlegen" oder „Rechnung daraus" zweimal drückte, bekam zwei Aufträge mit zwei Nummern. Jetzt führt der zweite Druck zum bestehenden Vorgang.',
      },
      {
        text: '**Abholbestellungen lassen sich abschließen.** Der Abschluss verlangte eine Sendungsnummer — die es bei Abholung nicht gibt. Solche Bestellungen standen für immer auf „bezahlt" oder „in Fertigung".',
      },
      {
        text: '**Der Lieferant am Lagerposten wird wieder gespeichert.** Das Feld „Bezogen von" ging beim Speichern verloren; deshalb stand in der Nachbestellliste alles unter „Ohne Lieferant" und die Bestellanfrage wusste keine Adresse.',
      },
      {
        text: '**Der Bestandsverlauf ist lückenlos.** Inventurabschluss und das Bearbeiten-Formular änderten den Bestand bisher wortlos — ausgerechnet die größten Korrekturen fehlten im Verlauf. Jetzt hinterlässt jede Bestandsänderung ihre Zeile mit Grund. Und ein geleertes Mindestbestand-Feld heißt wieder „keiner" statt „null".',
      },
      {
        text: '**Kleinigkeiten mit Wirkung.** Belege über 0,00 Euro (Gutschrift, Ersatzlieferung) werden angenommen. Die E-Rechnungs-Felder auf der Rechnung zeigen sich nur noch bei Geschäftskunden statt als Dauerblock. Der Link „Zur Bestellung" am Auftrag führt wieder ins Büro. Ein vertippter Status wird an der Tür abgewiesen statt in die Datenbank durchgereicht.',
      },
      {
        text: '**Der KI-Zugang (MCP) ist dichter und kann mehr.** Die Bankverbindung und der Stundensatz sind für den Assistenten gesperrt — auch lesend: Eine präparierte Mail, die ihn überredet, die IBAN auf den Rechnungen zu „korrigieren", läuft jetzt ins Leere, und er meldet den Versuch. Dateiabrufe gehen nur noch nach draußen, nicht mehr an interne Dienste. Jeder Schreibzugriff steht im Protokoll. Fehler kommen als verständliche Antwort statt als Absturz. Und der Assistent kann jetzt auch fürs Büro arbeiten: Wiedervorlagen anlegen, Partner ändern, Angebots- und Rechnungsentwürfe vorbereiten — ohne Nummer und ohne Versand, das bleibt beim Menschen.',
      },
      {
        text: '**Ein Rechnungsentwurf war vorbereitet, die Meldung kam aufs Handy — und in der Rechnungsliste stand nichts.** Der Entwurf lag die ganze Zeit in der Datenbank; das Gerät konnte ihn nur nie mehr sehen. Das Büro führt seinen Bestand im Gerät mit und fragt den Server jedes Mal „was hat sich seit meinem Stand getan?". Der Entwurf entsteht aber innerhalb des Schreibvorgangs, der den Auftrag auf „fertig" setzt, und gemeldet wurde er, bevor dieser Vorgang abgeschlossen war. Das Gerät fragte genau in diesem Fenster — ausgelöst von der Meldung selbst, die man ja antippt —, bekam nichts und merkte sich trotzdem den neuen Zeitpunkt. Der lag nach dem Entwurf, und damit fiel der für immer durch das Raster.',
        unter: [
          { text: '**Drei Dinge dagegen.** Der gemerkte Stand liegt jetzt eine Minute zurück: Doppelt gelieferte Datensätze sind folgenlos, weil das Gerät sie nach ihrer Kennung ablegt — ein verlorener ist es nicht. Meldung und Live-Signal zur Stufenrechnung gehen erst hinaus, wenn der Entwurf wirklich festgeschrieben ist; scheitert der Vorgang, kommt gar keine Meldung mehr statt einer über etwas, das es nicht gibt. Und die Materialbuchung setzt ihr Kennzeichen in derselben Zeile mit, statt hinterher noch einmal zu schreiben — dieser zweite, ungesicherte Schreibvorgang konnte den ganzen Vorgang samt Entwurf zurückrollen.' },
          { text: '**Was schon verloren ist, kommt zurück.** Die Geräte drehen ihre Stände einmalig um eine Woche zurück und holen sich damit, was ihnen fehlt. Wer es von Hand braucht: unter Einstellungen → Dieses Gerät steht jetzt „Bestand neu holen" — das holt alles noch einmal, ohne abzumelden.' },
        ],
      },
      {
        text: '**Meldungen bleiben stehen: eine Glocke oben in der Kopfleiste.** Bisher war jede Meldung ein Ruf ins Leere. Wer sie im Vorbeigehen wegwischte oder dessen Handy gerade aus war, konnte nirgends nachsehen, was da stand — ausgerechnet die Meldungen, die etwas wollen, verschwanden am leichtesten. Jetzt legt das Büro jede Meldung ab, bevor sie hinausgeht, und zwar alle: neue Anfrage, bezahlte Bestellung, fälliger Beleg, überfällige Rechnung, knapper Bestand, fehlgeschlagene Mail. Die Glocke zeigt die ungelesenen, ein Tipp öffnet die letzten zwanzig, ein Tipp auf eine Meldung führt dorthin, wo sie hingehört, und hakt sie ab. Die ganze Liste steht unter Sonstiges → Meldungen.',
        unter: [
          { text: 'Die Liste liegt auf dem Server und kommt über den Abgleich ins Gerät: auf jedem Gerät dieselbe, auch ohne Netz lesbar, und „gelesen" gilt überall. Gelesenes wird nach 30 Tagen aufgeräumt, alles Übrige nach 90 — eine Liste, die nur wächst, liest bald niemand mehr.' },
          { text: 'Die Probemeldung aus den Einstellungen steht bewusst nicht darin: „kommt an" ist eine Prüfung des Geräts und keine Meldung über den Betrieb.' },
        ],
      },
      {
        text: '**Die Navigation zeigt jetzt an, wo Arbeit liegt.** Ein bronzener Zähler an Rechnungen, Belegen, Anfragen, Nachbestellen und Wiedervorlagen — am Handy an den fünf Reitern unten und im aufgeklappten Blatt, am Rechner an den Gruppen und ihren Punkten. Gezählt wird ausdrücklich Arbeit und nicht Gelesenes: ein Zähler, der durchs Hinsehen verschwindet, sagt nichts darüber, ob noch etwas zu tun ist. Bei den Rechnungen zählen die Entwürfe mit — genau die, von denen bisher nur eine Meldung erzählte.',
        unter: [
          { text: 'Die Regeln dafür stehen an einer Stelle, aus der auch die Übersicht rechnet. Zwei Zahlen für dieselbe Sache gehen sonst irgendwann auseinander, und dann glaubt man keiner von beiden.' },
        ],
      },
      {
        text: '**Die Meldung zur Stufenrechnung sagt jetzt, was zu tun ist.** Vorher: „Schlussrechnung vorbereitet — Auftrag AU-2026-0001: Entwurf über 149,24 € netto liegt bereit." Man erfuhr nicht, für wen, nicht, dass nichts hinausgeht, ohne dass jemand sie verschickt, und die Zahl stimmte nicht einmal zuverlässig mit dem Entwurf überein: Genannt wurde der geplante Anteil aus dem Zahlplan, auf der Schlussrechnung steht aber der volle Betrag, solange die Anzahlung selbst noch als Entwurf herumliegt. Jetzt steht dort „Entwurf: Schlussrechnung für Familie Dill" — „Entwurf" vorn, weil auf dem Sperrbildschirm nur der Anfang ankommt — und darunter Auftrag, Stück, der Betrag, der wirklich auf dem Blatt steht, und der Satz „Bitte prüfen und verschicken — von allein geht sie nicht raus."',
        unter: [
          { text: 'In der Rechnungsliste tragen Entwürfe ihre Stufe dort, wo sonst die Nummer steht: „Anzahlung · Familie Dill" statt dreimal „Entwurf · Famili…", das am Handy ohnehin abgeschnitten war. Und sie stehen jetzt oben statt ganz unten — sortiert wurde nur nach dem Rechnungsdatum, das ein Entwurf noch gar nicht hat, und so landete ausgerechnet das Blatt, das noch Arbeit ist, unter allen Rechnungen des Jahres.' },
        ],
      },
      {
        text: '**Ein schmaler Streifen in Hintergrundfarbe lag oben und an den Seiten des Büros.** Der Browser gibt dem Körper von sich aus 8 Pixel Rand; auf der Website nimmt Tailwind ihn weg, das Büro bringt sein eigenes Stylesheet mit und hatte ihn noch — dieselbe Lücke wie damals beim `box-sizing`. Die Kopfleiste klebte deshalb nicht am oberen Rand, sondern 8 Pixel darunter und 8 Pixel schmaler als der Bildschirm. Nebenbei sind damit 16 Pixel Breite dazugekommen, was auf manchen Geräten die Kacheln von einer auf zwei Spalten bringt.',
      },
      {
        text: '**Die obere Leiste im Büro sagt am Handy, wo man ist.** Vorher stand dort ein Schriftzug, der zur Übersicht verlinkt — die unten schon der erste Tab ist — und „Abmelden". Zusammen mit dem Sicherheitsrand des Geräts kostete das rund ein Viertel des Bildschirms für nichts, was man dort braucht. Jetzt trägt die Leiste den Namen der offenen Seite, und die Überschrift im Inhalt entfällt dafür: unterm Strich weniger Leiste **und** eine Zeile mehr Inhalt. „Abmelden" ist ins Blatt „Sonstiges" gewandert, der Schriftzug bleibt am Rechner.',
        unter: [
          { text: 'Der Name wird aus der Überschrift der Seite gelesen, nicht aus einer Liste „Pfad → Name". Eine solche Liste müsste jede Seite kennen und liefe bei jeder neuen aus dem Takt; bei Detailseiten stünde dort „Auftrag" statt „Auftrag AU-2026-0001".' },
          { text: 'Ohne Skript passiert nichts: Dann bleibt die Überschrift stehen, wo sie war. Ausgeblendet wird sie erst, wenn der Name oben wirklich angekommen ist.' },
        ],
      },
      {
        text: '**Der Abgleich hat jetzt einen festen Platz.** Ein Punkt oben rechts: grau heißt ohne Netz, bronze heißt „geht noch raus", rot heißt „der Server hat etwas zurückgewiesen". Antippen zeigt den Klartext. Die Meldeleiste über dem Inhalt bleibt für den Störfall — der Punkt steht immer an derselben Stelle, und man lernt hinzuschauen, statt eine Zeile zu suchen, die meistens fehlt.',
      },
      {
        text: '**Am Handy lief die unterste Karte im Büro unter die Tableiste.** Die Regel, die dafür Platz schafft, gab es längst — sie stand im Stylesheet nur an der falschen Stelle: oberhalb der allgemeinen Regel für denselben Bereich. Beide sprechen dieselbe Klasse an, und bei Gleichstand gewinnt die spätere. Am Handy blieb es deshalb bei 64 statt 122 Pixeln Polster. Am Rechner fiel das nie auf, weil es dort keinen Sicherheitsrand gibt und die Leiste 55 Pixel misst — auf einem iPhone kommen 34 Pixel dazu, die Leiste wird 89 Pixel hoch, und „Aufträge" verschwand zu 17 Pixeln darunter. Nachgemessen mit nachgestelltem Rand, vorher und nachher; Rechner, Tablet und der Fall mit offener Tastatur gegengeprüft.',
      },
      {
        text: '**Die Website hat ein eigenes Zeichen fürs Browsertab.** Sie hatte nie eins — im Tab stand die graue Weltkugel, auf dem Startbildschirm eines iPhones ein Bildschirmfoto der Seite. Ausgerechnet das, was Kundschaft sieht, war das einzige ohne; Admin und Büro hatten längst welche. Jetzt trägt sie dasselbe VH-Monogramm mit Corten-Strich.',
        unter: [
          { text: '**In zwei Zuschnitten, und das ist der Punkt.** Der Zuschnitt von Admin und Büro ist für 192 Pixel gezeichnet; bei 16 Pixeln im Tab wird daraus ein grauer Fleck, weil die Striche schmaler als ein Pixel sind. Fürs Tab gibt es deshalb eine kräftigere Zeichnung, deren Maße alle auf dem Pixelraster liegen — dadurch wird jeder Strich genau zwei Pixel breit und voll deckend statt halb. Der Corten-Strich fällt dort weg: 0,3 Pixel sind kein Strich mehr, sondern eine schmutzige Zeile. Auf dem Startbildschirm, wo Platz ist, steht er wieder drin.' },
          { text: 'Vier Fassungen, weil jede woanders gebraucht wird: SVG fürs Tab (in jeder Größe scharf), PNG als Rückfall, eine echte `favicon.ico` mit 16, 32 und 48 Pixeln für alles, was stur die Wurzel abfragt (Feedleser, Vorschaudienste), und das Apple-Touch-Icon für den Startbildschirm.' },
        ],
      },
    ],
  },
  {
    nummer: 33,
    datum: '2026-08-20',
    titel: 'Übergabemappe, Unterlagen am Vorgang, eigene Adresse',
    punkte: [
      {
        text: '**In der robots.txt stand als Sitemap-Adresse `http://localhost:3000`.** Aufgefallen beim Umzug. Die Datei wurde beim Bauen festgelegt — und beim Bauen gibt es die Serveradresse noch nicht, die steht erst im Stack. Google liest die robots.txt als Erstes und findet dort den Wegweiser zur Sitemap; dieser zeigte auf eine Adresse, die kein Suchdienst der Welt abrufen kann. Die Sitemap selbst war immer richtig, nur der Weg dorthin nicht. Sie wird jetzt bei jedem Abruf gerechnet. Das ist der einzige Fall dieser Art: Alle öffentlichen Seiten entstehen ohnehin je Abruf, ihre kanonischen Links waren korrekt — nachgemessen an einem Abbild, das wie in der CI ohne die Variable gebaut wurde.',
      },
      {
        text: '**Die Seite zieht auf ihre eigene Adresse.** Maßgeblich ist ab jetzt `https://vincent-hellmann.com` — ohne `www`. Die anderen beiden Domains (.de und .fr) und alle `www`-Schreibweisen leiten dauerhaft dorthin um, mit Pfad. Nur eine Adresse deshalb, weil sich dieselben Inhalte unter mehreren sonst bei Google die Sichtbarkeit teilen, statt sie zu bündeln — und weil Anmeldung, Warenkorb und Übergabelinks an Cookies hängen, die je Adresse gelten: Wer sich auf `.de` anmeldet und auf `.com` weiterklickt, wäre dort wieder ausgeloggt. Kanonische Links, hreflang, Sitemap und robots.txt richten sich automatisch danach. Der Umzug samt Reihenfolge, NPM-Einstellungen und dem, was dabei ungültig wird (Passkeys, offene Anmeldungen, schon verschickte Übergabelinks), steht im README unter „Domains".',
      },
      {
        text: '**Am Rechner lief „Kollektion" in den Schriftzug hinein.** Genau an der Schwelle, ab der die Navigation erscheint (1280 Pixel), ging es um 33 Pixel nicht aus: Schriftzug 286, Navigation 658, Werkzeuge 257, dazu zweimal 32 Pixel Abstand. Ein Raster gibt dann nicht nach — es lässt die mittlere Spalte über die äußere laufen. Weil eine Grafik mit fester Höhe nicht schmaler wird, gibt jetzt der Abstand nach: bis 1400 Pixel knapp bemessen, darüber wieder weit. Gemessen in allen drei Sprachen, bei jeder Breite von 1280 bis 1536 — vorher 1 Pixel Luft, jetzt mindestens 30.',
      },
      {
        text: '**Unterlagen hängen jetzt am Vorgang, nicht nur am Artikel.** Anfrage, Angebot und Auftrag haben einen eigenen Block „Unterlagen zum Vorgang" — mit allem, was dazugehört, auch dem, was über eine Übergabemappe hereinkam. Wer in der Werkstatt am Auftrag steht, sucht dort und nicht in einer Mappe, an die sich niemand erinnert. Von jedem Vorgang aus lässt sich mit einem Tipp eine Übergabemappe anlegen; der Geschäftspartner kommt mit.',
      },
      {
        text: '**Die Kundschaft kann im Portal nachreichen und abholen.** Unter jedem Auftrag steht „Unterlagen": Dateien hochladen — mehrere auf einmal, bis 500 MB je Stück — und herunterladen, was Vincent freigegeben hat. Der Übergabelink bleibt für die, die noch kein Konto haben. Zugeklappt, bis jemand hineinsieht: Bei einer Shop-Bestellung gibt es keine Unterlagen, und ein leerer Kasten unter jedem Auftrag wäre nur Grundrauschen. Eine nachgereichte Datei meldet sich per Push.',
      },
      {
        text: '**Beigestelltes Material bei Lohnfertigung.** Der Kunde schickt sein Blech, wir schneiden und kanten — das Zeug war nie im eigenen Lager. Ein Häkchen am Materialposten sagt das jetzt, und dreierlei folgt daraus: Beim Fertigmelden wird **nichts** vom Bestand abgezogen (sonst rutscht er bei jedem Lohnauftrag ins Minus), in der Nachkalkulation kostet es **null** (sonst sähe ausgerechnet der Auftrag ohne Einkauf nach einem Verlustgeschäft aus), und die Nachbestellung meldet dafür keinen Bedarf. Auf dem Lieferschein steht es trotzdem — getrennt von den Positionen, unter „Von Ihnen beigestelltes Material": Wer die Ware annimmt, soll nicht den Empfang von etwas quittieren, das ihm ohnehin gehört.',
      },
      {
        text: '**Übergabemappe: Unterlagen gehen in beide Richtungen.** Bei Lohnfertigung kommen die Daten **vor** der Entscheidung — Zeichnung, Stückzahl, Werkstoff, und erst danach sagt man zu oder ab. Per Mail ging das schlecht: Anhänge sind begrenzt, eine Revision überschreibt nichts, und am Ende liegen drei Fassungen in drei Postfächern. Jetzt gibt es je Vorgang einen Ordner mit Link und Passwort.',
        unter: [
          { text: '**Die Mappe hängt an einem Geschäftspartner oder einer Anfrage**, nie in der Luft — daraus entsteht auch ihre Bezeichnung von selbst. Angebot und Auftrag kommen dazu, sobald aus der Anfrage etwas wird; die Anker wandern an jede Datei mit, damit die Zeichnung später dort steht, wo die Werkstatt sucht.' },
          { text: '**Link und Passwort, sieben Tage gültig.** Der Link allein genügt nicht — er wandert durch Postfächer und steht danach in irgendeinem Verlauf. Das Passwort ist eines zum Durchsagen (ohne I, l, O, 0, 1) und steht **einmal** im Büro; gespeichert ist nur ein Abdruck. Wer nachliefern will, bekommt einen neuen Link auf dieselbe Mappe — der alte wird davon nicht ungültig, er läuft nur aus. Zurückziehen geht jederzeit und wirkt sofort, auch bei bestehender Sitzung.' },
          { text: '**Beide Richtungen in einer Ansicht.** Der Auftraggeber legt seine Zeichnungen ab und lädt herunter, was für ihn bereitliegt: Fertigungszeichnung zur Freigabe, Prüfprotokoll, Messschrieb. Was im Haus entsteht, ist dabei voreingestellt **nicht** sichtbar — erst ein ausdrückliches „Freigeben" schickt es hinaus. Was der Auftraggeber selbst hochgeladen hat, sieht er immer.' },
          { text: '**Mehrere Dateien auf einmal, bis 500 MB je Datei.** Ausgewählt wird alles zusammen, hochgeladen wird nacheinander mit Fortschrittsbalken je Datei — so ist zwischendurch immer etwas fertig, und ein Abbruch kostet nicht alles. Die Datei geht unverpackt hinaus und wird stückweise auf die Platte geschrieben, statt vollständig im Arbeitsspeicher zu landen.' },
          { text: '**Zeichnungen, CAD-Dateien, PDF, Bilder und Archive kommen durch**, alles andere nicht — mit dem Hinweis, es zu packen. Der Ordner steht im Netz; was der Browser selbst ausführen würde, gibt es dort gar nicht erst. Heruntergeladen wird immer als Anhang und unter dem Namen, unter dem die Datei hereinkam.' },
          { text: '**Ordner wie am Artikel**: „Zeichnungen", „Stückliste", „Freigaben", „Fotos" stehen als Vorschlag bereit. Ein leerer Ordner bleibt bestehen — er sagt dem Auftraggeber, was erwartet wird. Beim Umbenennen ziehen die Dateien mit; ein Ordner mit Inhalt lässt sich nicht löschen.' },
          { text: 'Eine neue Datei in der Mappe meldet sich per Push — bei Lohnfertigung wartet jemand auf eine Zusage.' },
        ],
      },
      {
        text: '**Varianten behalten ihre Kennung, egal wie sie heißen.** An dieser Kennung hängt alles, was zu einer Variante gehört: Stückliste, Fremdleistung, Arbeitszeit, die Werkstattdateien samt Ordnern und die Bestellungen. Der KI-Zugang schrieb die Variantenliste bisher ohne Kennungen — Payload vergab dann neue, und ein bloßes Umbenennen hängte Stückliste und Zeichnungen lautlos ab. Jetzt wird zugeordnet: über die Kennung, sonst über den bisherigen Namen, sonst über die Position in der Liste (der Fall beim Übersetzen, wo sich jeder Name ändert). `produkt_lesen` gibt die Kennung mit aus, damit man sie eindeutig ansprechen kann.',
      },
      {
        text: '**Eine Teiländerung nimmt nichts mehr weg.** Die Büro-Schnittstellen bauten aus der Anfrage einen vollständigen Datensatz und schrieben ihn — beim Anlegen richtig, beim Ändern eine Falle: Wer nur `{ id, status: \'bezahlt\' }` schickte, löschte damit sämtliche Rechnungspositionen, und wer nur Positionen schickte, stellte eine gestellte Rechnung auf „Entwurf" zurück. Beim Ändern bleibt jetzt weg, wonach niemand gefragt hat — bei Rechnung, Angebot und Auftrag. Eine mitgeschickte leere Liste zählt weiter als Ansage: Wer alle Positionen löschen will, kann das.',
      },
      {
        text: '**Der Warenkorb war am Handy aus dem Bild gelaufen.** Die Kopfleiste stand auch am Telefon im Raster mit zwei gleich breiten Außenspalten — der Schriftzug ist aber rund 230 Pixel breit, und die fünf Zeichen rechts brauchten mehr als ihre Hälfte. Was nicht hineinpasste, lief nach rechts hinaus; zuletzt ausgerechnet der Knopf, an dem das Geld hängt. Am Handy ist es jetzt eine schlichte Reihe: Schriftzug, Suche, Warenkorb, Menü. Sprache und Konto sind ins Menü gewandert — beides braucht man selten mitten im Stöbern.',
      },
      {
        text: '**„In den Warenkorb" war im dunklen Thema unlesbar**: heller Knopf mit weißer Schrift. Die Schriftfarbe stand in der gemeinsamen Zeile, die Hintergrundfarbe erst in der Fallunterscheidung — und damit lief sie nicht mit um. Beide Fälle tragen ihre Schriftfarbe jetzt selbst.',
      },
      {
        text: '**Das Kundenportal sieht wieder nach Website aus.** Die Corten-Striche unter den Überschriften fehlten dort als einziger Seite — jetzt trägt die Hauptüberschrift denselben Strich wie überall, und jeder Abschnitt seinen kleinen.',
      },
      {
        text: '**Begrüßung mit Namen.** Wir wissen, wer da ist: Der Name kommt vom Geschäftspartner, ersatzweise aus der Bestellung. Steht dort nichts, bleibt die Zeile weg — eine erfundene Anrede ist schlimmer als keine. Die E-Mail-Adresse steht weiter darunter; sie beantwortet die Frage, in welchem Konto man gerade steckt.',
      },
      {
        text: '**Ein Rechenfehler im Portal, der Kundschaft erschreckt hat:** Beim Auftrag stand die Nettosumme, daneben aber der **brutto** bezahlte Betrag aus den Rechnungen. Bei 20 % Steuer las sich das als „1.492,50 €, davon 1.791,00 € bezahlt" — es sah aus, als hätte man zu viel überwiesen. Beide Zahlen sind jetzt brutto, so wie alles andere auf der Seite.',
      },
    ],
  },
  {
    nummer: 32,
    datum: '2026-08-20',
    titel: 'Schriftzug folgt dem Hero, nicht dem Thema',
    punkte: [
      {
        text: '**Über einem hellen Hero-Bild war der Schriftzug im dunklen Thema unsichtbar.** Die Kopfleiste nimmt über dem Hero die Farbe des Bildes an — welche Schrift darauf lesbar ist, hängt damit am Bild und nicht daran, ob das Gerät hell oder dunkel eingestellt ist. Abgedeckt war bisher nur der Fall „dunkles Bild"; beim hellen blieb die helle Schrift des dunklen Themas stehen und stand auf hellem Grund. Vorher fiel das nicht auf, weil das Logo ein schwarzes Bild war und sich um Themen nicht scherte.',
      },
    ],
  },
  {
    nummer: 31,
    datum: '2026-08-20',
    titel: 'Bauunterlagen an der Variante, Bilder auf den Papieren, Zeichen in der Leiste',
    punkte: [
      {
        text: '**Jede Artikelvariante trägt ihre Bauunterlagen bei sich.** Laserdatei, Fräsprogramm, Zusammenbauzeichnung, NC-Code — was zum Bauen gebraucht wird, lag bisher in einem Ordner auf einem Rechner, den einer kennt. Jetzt hängt es an der Variante, die es betrifft: Ein Kübel in 100 × 50 hat eine andere Laserdatei als derselbe in 60 × 30, und wo beide zusammenliegen, wird irgendwann das falsche Blech geschnitten.',
      },
      {
        text: '**Mit echten Ordnern**, die man selbst anlegt und umbenennt — Fräsen, Laser, Zusammenbau, NC stehen als Vorschlag bereit, ein Tipp legt sie an. Ein Ordner bleibt auch leer bestehen, damit man die Struktur vorbereiten und danach füllen kann. Beim Umbenennen ziehen die Dateien mit; ein Ordner mit Inhalt lässt sich nicht löschen.',
      },
      {
        text: '**Die Werkstatt kommt unter Werkstatt → Unterlagen an die Dateien**, ohne Preise ändern zu dürfen: Artikel suchen, Variante wählen, herunterladen. Heruntergeladen wird unter dem Namen, unter dem die Datei hereinkam.',
      },
      {
        text: '**Die Dateien liegen nicht offen im Netz.** Anders als die Bilder der Website sind sie nur nach Anmeldung im Büro erreichbar — eine Laserdatei unter einer ratbaren Adresse ist die Arbeit von Wochen, frei zum Mitnehmen. Abgelegt werden sie neben den Bildern, damit die nächtliche Sicherung sie mitnimmt.',
      },
      {
        text: '**Auf Angebot, Auftragsbestätigung, Lieferschein und Rechnung steht jetzt ein kleines Bild neben der Position.** Wer packt oder baut, sieht sofort, worum es geht, statt eine Textzeile zu entziffern. Dafür trägt jede Position einen freiwilligen Artikelbezug — aus einer Shop-Bestellung kommt er von selbst, von Hand geschriebene Positionen können ihn wählen. An Beschreibung und Beträgen ändert er nichts; die Beschreibung bleibt, was auf dem Papier steht.',
      },
      {
        text: '**Im Büro steht das Bild in der Artikelliste und an jeder Position.** „Kübel groß" und „Kübel klein" unterscheiden sich sonst durch ein Wort.',
      },
      {
        text: '**Jeder Navigationspunkt hat sein eigenes Zeichen, und die Farbe kommt vom Arbeitsbereich**: Blau ist Kundschaft, Bronze ist Werkstatt, Grün ist Geld, Violett der Rest. Nach ein paar Tagen greift man nach dem Fleck, ohne zu lesen. Farbe allein wäre zu grob, Form allein bei achtzehn Punkten zu fein — zusammen genügt beides sich.',
      },
    ],
  },
  {
    nummer: 30,
    datum: '2026-08-19',
    titel: 'Neues Erscheinungsbild, dunkles Thema, Bedienung am Daumen',
    punkte: [
      {
        text: '**Knöpfe sahen nicht nach Knöpfen aus.** Von fünf Varianten war genau eine als Bedienelement erkennbar; „leise" und „schmal" trugen denselben feinen Strich wie eine Tabellenlinie — 1,3:1 Kontrast, und das Auge las sie als Beschriftung. Jetzt gibt es drei Stufen, die man aus zwei Metern Abstand unterscheidet: **primär** gefüllt in Bronze (genau eine je Seite — die Haupthandlung), **sekundär** mit eigener Fläche und kräftigem Rahmen, **beiläufig** als unterstrichener Text. Rot bleibt dem Wegnehmen vorbehalten und wird nie zur gefüllten Hauptfläche, damit „löschen" nie wie der Vorschlag aussieht.',
      },
      {
        text: '**Alles Anfassbare ist jetzt mindestens 44 Pixel hoch** — Knöpfe, Felder, Menüpunkte. Bedient wird das an der Werkbank, mit Handschuh oder fettigem Finger, und nicht mit der Maus am Schreibtisch. Dazu gibt es endlich eine sichtbare Tastaturmarkierung; bisher hatten nur Eingabefelder eine.',
      },
      {
        text: '**Listen liest man jetzt im Vorbeigehen**: ein schmaler Farbstreifen links an der Zeile (rot überfällig, bronze offen, grün erledigt), Zahlen in der Nebenzeile hervorgehoben und untereinander bündig, Karten mit weichem Schatten statt bloßem Strich. Bronze heißt ab sofort überall dasselbe: hier bist du, hier handelst du.',
      },
      {
        text: '**Dunkles Thema für Büro und Website**, nach der Einstellung des Geräts. Das ist keine Umkehrung: Bronze wird heller und trägt dunkle Schrift — weiß auf Bronze kommt im Dunkeln auf 2,9:1 und ist schlicht nicht lesbar. Wo im Hellen ein Schatten die Karte anhebt, tut das im Dunkeln eine hellere Fläche; der Fußbereich der Website bleibt der dunkelste Block der Seite, sonst stünde sie auf dem Kopf. Auch die Adressleiste des Browsers zieht mit.',
      },
      {
        text: '**Der Schriftzug „Vincent Hellmann" steckt jetzt als echtes SVG im Markup** und nimmt die Schriftfarbe an. Vorher lag er als Bild darin und musste mit `invert(1)` umgefärbt werden — aus Schwarz wurde damit Weiß, aus jedem anderen Wert sein Gegenteil, und mit zwei Themen wären daraus vier Sonderfälle geworden.',
      },
      {
        text: '**Die Hauptaktion klebt am Handy dort, wo der Daumen liegt.** Lag „Wareneingang buchen" unter dem Formular, war sie schon bei zwei Positionen aus dem Bild — tippen, scrollen, suchen, tippen. Jetzt steht in jedem großen Formular genau eine primäre Aktion in einer Leiste am unteren Rand: Rechnung, Angebot, Auftrag, Beleg, Bestellung, Artikel, Partner, Inventar, Inventur, Wareneingang, Newsletter, Einstellungen.',
      },
      {
        text: '**Geht die Bildschirmtastatur auf, verschwindet die untere Leiste.** Sonst klebt sie je nach Browser über dem Feld, in das gerade getippt wird; die Hauptaktion rutscht dabei aus dem Kleben zurück in den Fluss, statt über der Tastatur zu schweben.',
      },
      {
        text: '**Unten stehen jetzt die vier Arbeitsbereiche** — Kundschaft, Werkstatt, Geld, Sonstiges —, und jeder öffnet sein eigenes Blatt. Vorher lagen dort vier feste Ziele und ein „Mehr", hinter dem alle achtzehn Punkte auf einmal standen: eine Wand aus Kästchen, durch die man scrollen musste, um an die Einstellungen zu kommen. Die Leiste bleibt über dem Blatt stehen, ein zweiter Tipp wechselt direkt in den nächsten Bereich.',
      },
    ],
  },
  {
    nummer: 29,
    datum: '2026-08-19',
    titel: 'Wareneingang mit Lieferschein',
    punkte: [
      {
        text: '**Eine Lieferung ist mehr als „dazubekommen".** Sie hat einen Lieferanten, ein Datum, mehrere Posten und ein Papier, das man später wiederfindet — beim Prüfen der Rechnung, bei einer Reklamation, bei der Frage „wann kam das eigentlich?". Als fünf einzelne Bestandskorrekturen gebucht, hängt der Lieferschein an keiner davon.',
      },
      {
        text: '**Neu unter Werkstatt → Wareneingang**: Lieferant, Datum, Lieferscheinnummer, die gelieferten Posten mit Mengen — und der **Lieferschein als Foto oder PDF**. Der Zettel im Karton ist in zwei Wochen weg; gebraucht wird er genau dann, wenn die Rechnung kommt und die Mengen nicht stimmen. Fotografiert wird beim Auspacken, und weil das in der Werkstatt passiert, geht das Bild über dieselbe Warteschlange wie das Belegfoto — ohne Netz bleibt es im Gerät und geht später von selbst raus.',
      },
      {
        text: '**Der Weg von der Nachbestellliste ist durchgehend**: Bei „Unterwegs" führt ein Knopf direkt zum Wareneingang, vorbelegt mit Lieferant und den Posten, die dort als bestellt vermerkt sind. Gebucht wird in einem Zug: Bestand rauf, Bewegung im Verlauf (mit Nummer, Lieferant und Lieferschein), Merker „nachbestellt" weg.',
      },
      {
        text: '**Gebucht wird genau einmal.** Wer später die Lieferscheinnummer nachträgt, erhöht den Bestand nicht ein zweites Mal. Eine falsch gebuchte Menge wird am Posten korrigiert — dann steht im Verlauf, dass korrigiert wurde, statt dass eine Zahl still eine andere wird.',
      },
      {
        text: 'Die schnelle Korrektur am Posten („verbraucht", „dazubekommen") bleibt, wofür sie gedacht ist: Berichtigungen, nicht Lieferungen.',
      },
    ],
  },
  {
    nummer: 28,
    datum: '2026-08-19',
    titel: 'Nachbestellen: vom Mindestbestand zur Anfrage',
    punkte: [
      {
        text: '**Der Mindestbestand wurde bisher nur angezeigt.** Der Schritt danach fing wieder bei null an: Wer liefert das, wie war die Artikelnummer, wie viel nehmen wir? Neu unter **Werkstatt → Nachbestellen**: alles Knappe, nach Lieferant sortiert, mit Bestand, Mindestbestand, Fehlmenge und einem Vorschlag für die Bestellmenge.',
      },
      {
        text: '**Ein Knopf schickt die Anfrage raus** — an die E-Mail-Adresse des Lieferanten, im Briefbogen des Hauses, mit Mengen und Artikelnummern. Bewusst eine **Anfrage** nach Preis und Liefertermin und keine Bestellung: Beides steht noch nicht fest, und eine Bestellung mit falschem Preis ist eine Reklamation in spe. Wer beim Lieferanten anruft oder in dessen Portal bestellt, drückt stattdessen „Anderswo bestellt — nur vermerken".',
      },
      {
        text: '**Was bestellt ist, steht unter „Unterwegs"** und nicht mehr auf der Liste. Zwischen „bestellt" und „liegt im Regal" vergehen Tage, in denen der Bestand weiter unter dem Mindestbestand steht — ohne diesen Merker stünde dieselbe Anfrage jeden Morgen wieder da, und irgendwann läge alles doppelt im Lager. Sobald die Lieferung als „Dazubekommen" gebucht wird, verschwindet der Eintrag von selbst.',
      },
      {
        text: '**Das Büro meldet sich, wenn etwas knapp wird** — einmal am Tag, alle Posten in einer Meldung, mit dem Weg direkt auf die Nachbestellliste. Was schon bestellt ist, zählt dabei nicht mit.',
      },
      {
        text: 'Am Posten stehen dafür zwei neue Angaben: die **übliche Bestellmenge** (leer heißt: auf das Doppelte des Mindestbestands auffüllen) und die **Artikelnummer beim Lieferanten**, damit dort niemand suchen muss.',
      },
    ],
  },
  {
    nummer: 27,
    datum: '2026-08-19',
    titel: 'Fremdleistung je Variante, Bestand korrigierbar',
    punkte: [
      {
        text: '**Auch die Fremdleistung hängt jetzt an der Variante.** Verzinken wird nach Gewicht abgerechnet, Beschichten nach Fläche — ein großes Stück kostet dort mehr Farbe und mehr Geld. Mit einem gemeinsamen Preis rechnete die Kalkulation das kleine Stück zu teuer und das große zu billig, und ausgerechnet beim großen fällt es ins Gewicht. Im Büro steht das unter demselben Umschalter wie die Stückliste: Grundlage, dann jede Variante; ohne eigene Angabe gilt weiter die Grundlage.',
      },
      {
        text: '**Der Bestand lässt sich korrigieren, mit Grund.** Zwei Meter Schweißdraht für eine Reparatur außerhalb eines Auftrags, ein verschnittenes Blech, eine Lieferung, für die es noch keinen Beleg gibt: Am Inventarposten wird jetzt die **Veränderung** gebucht — „2, verbraucht" — statt den neuen Stand auszurechnen und ins Feld zu schreiben. Genau beim Abziehen im Kopf entstehen die Zahlendreher, die eine Inventur später mühsam wieder einfängt.',
      },
      {
        text: '**Jede Bewegung bleibt stehen**: wie viel, warum, wann, von wem und wie viel danach übrig war. Auch das automatische Abbuchen beim Fertigmelden eines Auftrags schreibt sich dort hinein — sonst stünde im Verlauf nur die Handarbeit und der größte Teil fehlte. Rutscht der Bestand rechnerisch unter null, bleibt das so stehen und die Seite sagt, was es bedeutet: Es wurde mehr verbraucht als je gebucht — da fehlt ein Wareneingang, oder es ist Zeit für eine Inventur.',
      },
    ],
  },
  {
    nummer: 26,
    datum: '2026-08-19',
    titel: 'Stückliste und Arbeitszeit je Variante',
    punkte: [
      {
        text: '**Bisher galt eine Stückliste für den ganzen Artikel.** Ein Kübel in 100 × 50 braucht aber mehr Blech als derselbe in 60 × 30 — und dauert länger. Die gemeinsame Liste rechnete für den einen zu wenig und für den anderen zu viel; die Bestandswarnung war damit in beiden Fällen wertlos, und die Auslastung sagte für beide Größen dieselbe Stundenzahl.',
      },
      {
        text: '**Jede Variante kann jetzt ihre eigene Liste und ihre eigene Arbeitszeit haben.** Im Büro unter Artikel steht oben ein Umschalter: Grundlage, dann jede Variante. Solange eine Variante nichts Eigenes hat, gilt die Grundlage — bei Farbvarianten ist das der Normalfall, und niemand pflegt dieselbe Liste dreimal. Ein Knopf legt eine eigene Liste an (mit der Grundlage als Anfang), ein zweiter macht das wieder rückgängig.',
      },
      {
        text: '**Auftrag und Auslastung rechnen mit der bestellten Variante.** Aus einer Bestellung über das große Stück entsteht ein Auftrag mit dem Material des großen Stücks und dessen Stundenzahl. Auch die Kalkulation im Büro zeigt Einsatz und Preisvorschlag jetzt je Variante, gegen deren eigenen Preis.',
      },
      {
        text: '**Die Bestellposition merkt sich, welche Variante gemeint war** — nicht nur ihren Namen. Der ist übersetzt und änderbar; wer eine Variante umbenennt, hätte sonst alle alten Bestellungen von ihrer Stückliste abgeschnitten.',
      },
    ],
  },
  {
    nummer: 25,
    datum: '2026-08-19',
    titel: 'Aufgeräumte Kopfleiste, sichtbares Kundenkonto, Wochenstunden',
    punkte: [
      {
        text: '**Die Kopfleiste stand voll.** Neun Punkte nebeneinander, „Next Concept" und „Über uns" brachen auf zwei Zeilen um, und die Navigation saß irgendwo zwischen Schriftzug und Warenkorb statt in der Mitte. Jetzt liegen die Produktwelten unter **Kollektion** in einem Aufklappmenü — dort wächst künftig jede neue Kategorie, statt die Leiste zu verbreitern —, und drei Spalten halten Schriftzug links, Navigation mittig und die Zeichen rechts. Am Handy stehen die Kategorien eingerückt unter „Kollektion", damit nichts hinter einem zweiten Tipp verschwindet.',
      },
      {
        text: '**Das Kundenkonto hat endlich einen Weg.** Das Portal gab es längst — nur führte kein sichtbarer Link dorthin: Wer die Bestellmail nicht mehr hatte, kam nicht hinein. Jetzt steht es als Zeichen in der Kopfleiste, als Punkt im Handy-Menü und als Zeile im Fuß. Angemeldet wird dort mit der E-Mail-Adresse und einem sechsstelligen Code, ohne Passwort.',
      },
      {
        text: '**Die Werkstattstunden stehen jetzt je Woche.** Die Werkstatt läuft neben einem Hauptberuf: In der einen Woche sind zwanzig Stunden drin, in der nächsten fünf, im Urlaub keine. Eine feste Wochenzahl war genau dann falsch, wenn es darauf ankommt. In der Auslastung trägt jede Woche ihre eigene Zahl — leeres Feld heißt „es gilt die Voreinstellung", eine Null heißt „diese Woche geht nichts", und die Antwort „Platz ist ab KW …" richtet sich danach.',
      },
    ],
  },
  {
    nummer: 24,
    datum: '2026-08-19',
    titel: 'Sechs Lücken im Büro geschlossen',
    punkte: [
      {
        text: '**Zahlungseingänge kommen aus dem Kontoauszug** (Geld → Zahlungseingänge). Datei aus dem Onlinebanking wählen — CSV oder CAMT.053 —, und zu jeder Zahlung steht ein Vorschlag da: Rechnungsnummer im Verwendungszweck ist der sichere Fall (dafür schreibt der GiroCode sie hinein), sonst entscheiden Betrag und Name. Gibt es zwei offene Rechnungen über denselben Betrag, wird **nicht geraten** — lieber einmal von Hand zuordnen als einmal die falsche Rechnung abhaken. Ein Klick setzt die Rechnung auf bezahlt, und was daran hängt, läuft von selbst weiter. Dieselbe Datei zweimal einzulesen schadet nichts.',
      },
      {
        text: '**Stornieren ist ein Knopf.** An der gestellten Rechnung steht „Stornieren"; das legt die Gegenrechnung an — dieselben Positionen mit umgedrehtem Vorzeichen, Verweis aufs Original, beide zeigen aufeinander. Im Factur-X trägt sie den Typcode 381, sonst käme sie bei der Plattform als zweite Forderung an. Vorher musste die Gegenrechnung von Hand getippt werden, obwohl das Formular selbst auf sie verwies.',
      },
      {
        text: '**Auslastung je Woche** (Werkstatt → Auslastung): zugesagte Fertigungsstunden gegen die Werkstattzeit, sechzehn Wochen weit. Oben die Frage vom Telefon als Feld — „wie viele Stunden braucht das neue Stück?" — und darunter die erste Woche, in der so viel frei ist. Die Zeit kommt aus der Fertigungszeit der Artikel und steht am Auftrag.',
      },
      {
        text: '**Nachkalkulation** (Geld → Nachkalkulation): abgeschlossene Aufträge mit Wert, Einsatz und Deckung, dazu die Artikel sortiert nach Abweichung. Oben steht das Stück, das regelmäßig mehr Stunden frisst als kalkuliert. Aufträge ohne erfasste Zeit zählen nicht mit und werden genannt — sonst wäre die Auswertung geschönt.',
      },
      {
        text: '**Wiedervorlagen** (Kundschaft → Wiedervorlagen, dazu am Partner und am Auftrag): „Herrn Müller im Oktober wegen des zweiten Kübels anrufen." Am fälligen Tag meldet sich das Büro aufs Handy, mit dem Wortlaut statt mit einer Zahl.',
      },
      {
        text: '**Angebote im Kundenportal**: ansehen als PDF und annehmen. Wer ein Angebot bekommen hat, kommt jetzt auch ins Portal — vorher zählte das nicht als Vorgang und der Anmeldecode blieb aus. Die Annahme wird mit Zeitpunkt, Name und Weg festgehalten; ein Auftrag entsteht bewusst nicht von selbst, den Termin sagt die Werkstatt zu.',
      },
      {
        text: '**Plateforme Agréée** steht jetzt in den Einstellungen, mit Stand der Anmeldung. Bis sie auf „angemeldet" steht, erinnert die Übersicht daran: Ab dem 1. September 2026 müssen E-Rechnungen über eine zugelassene Plattform ankommen. Lesen und Schreiben kann das Büro längst — die Anmeldung ist eine Unterschrift und kein Programm.',
      },
    ],
  },
  {
    nummer: 23,
    datum: '2026-08-19',
    titel: 'Drei Mails ohne Briefbogen',
    punkte: [
      {
        text: '**Die Eingangsbestätigung beim Kauf auf Rechnung und die beiden Code-Mails** (Kasse, Kundenportal) bauten ihr HTML von Hand: ohne Logo, ohne Corten-Strich, ohne die Pflichtangaben im Fuß. Jetzt laufen alle drei über denselben Briefbogen wie die Bestellbestätigung.',
      },
      {
        text: '**Die Eingangsbestätigung trägt jetzt Zahlen**: Positionen, Summe mit enthaltener Steuer, Lieferadresse, Link auf den Bestellstand. Vorher stand dort ein Satz, und wer wissen wollte, worüber die angekündigte Rechnung lauten würde, musste auf sie warten.',
      },
      {
        text: '**Die Code-Mails kommen in der Sprache an**, in der die Kundschaft gerade auf der Seite steht. Dasselbe gilt für den Link auf den Bestellstand — der zeigte bisher immer auf die deutsche Seite.',
      },
    ],
  },
  {
    nummer: 22,
    datum: '2026-08-19',
    titel: 'Rechnungsversand braucht kein Postfach mehr',
    punkte: [
      {
        text: '**Ohne eingerichtetes Postfach blockierte der Versand** — die erste echte Rechnung blieb an „Es ist kein Postfach eingerichtet" hängen. Jetzt fällt der Versand auf den normalen Mailweg zurück (SMTP, dieselbe Absenderadresse wie Bestellbestätigungen). Ist ein Postfach eingerichtet, läuft es weiter darüber — dann liegt die Rechnung als Kopie in „Gesendet", und Antworten landen dort, wo sie gelesen werden. Das Versandfenster zeigt in beiden Fällen, mit welchem Absender die Mail rausgeht.',
      },
    ],
  },
  {
    nummer: 21,
    datum: '2026-08-19',
    titel: 'Kauf auf Rechnung im Shop',
    punkte: [
      {
        text: '**Die Kasse bietet jetzt zwei Wege**: PayPal (sobald eingerichtet) und **Kauf auf Rechnung per Überweisung** — der funktioniert ohne jeden Zahlungsdienst. Der Kunde bekommt die Rechnung per E-Mail, mit GiroCode zum Scannen; gefertigt wird nach Zahlungseingang.',
      },
      {
        text: '**Eine Rechnungs-Bestellung ist Projektgeschäft mit Shop-Herkunft.** Jedes Stück entsteht ohnehin einzeln: Es entsteht sofort der Fertigungsauftrag mit dem Zahlplan vom Artikel (Anzahlung, Zwischenrechnung), die Anzahlungsrechnung liegt dem Büro als Entwurf vor — dieselbe Maschinerie, kein zweiter Rechnungsweg. Artikel ohne Zahlplan bekommen eine vollständige Rechnung als Entwurf. Die Preise stehen dabei netto am Auftrag, sonst schlüge die Rechnung die Steuer doppelt drauf; Versand und Rabatt kommen als eigene Positionen mit.',
      },
      {
        text: '**Der Kunde wird als Geschäftspartner angelegt** (gefunden über die bestätigte E-Mail-Adresse) — damit hat die Rechnung aus dem Büro eine Empfängeradresse und das Kundenportal findet die Vorgänge.',
      },
      {
        text: '**Bezahlt heißt bezahlt:** Setzt das Büro die Anzahlung (oder die vollständige Rechnung) auf „bezahlt", springt die Bestellung auf „Bezahlt" — Bestätigungsmail, Fertigungsstart, Ausbuchen der Lagerware, wie bei PayPal auch.',
      },
      {
        text: 'Direkt nach der Bestellung geht eine kurze Eingangsbestätigung raus: „Die Rechnung folgt per E-Mail." In den AGB (drei Sprachen) steht der neue Weg mit drin.',
      },
    ],
  },
  {
    nummer: 20,
    datum: '2026-08-19',
    titel: 'Die Kasse bestätigt die E-Mail-Adresse, bevor sie bestellt',
    punkte: [
      {
        text: '**Erst der Code, dann die Bestellung.** Beim Klick auf „Zahlungspflichtig bestellen" schickt die Kasse einen sechsstelligen Code an die angegebene Adresse; erst mit dem eingetragenen Code entsteht die Bestellung und geht es weiter zu PayPal. An dieser einen Adresse hängt alles — Bestätigung, Versandmeldung, der Zugang zum Kundenportal. Ein Tippfehler hieße: Der Kunde bekommt nichts davon, und wer die vertippte Adresse wirklich besitzt, könnte im Portal eine fremde Bestellung samt Anschrift sehen.',
      },
      {
        text: '**Wer bestätigt hat, ist damit im Kundenportal angemeldet** — derselbe Nachweis, dieselbe Sitzung. Und umgekehrt: Wer schon angemeldet ist, sieht in der Kasse keinen Code-Schritt. Beim zweiten Einkauf innerhalb von 30 Tagen fällt der Schritt also weg.',
      },
    ],
  },
  {
    nummer: 19,
    datum: '2026-08-19',
    titel: 'Anmelden mit Benutzernamen',
    punkte: [
      {
        text: '**Das Werkstatt-Tablet braucht keine eigene E-Mail-Adresse mehr.** Konten lassen sich jetzt mit einem Benutzernamen anlegen — „werkbank" statt einer erfundenen Adresse. Das Anmeldefeld ist eines für beides: Wer seine E-Mail tippt, kommt genauso herein wie wer den Benutzernamen tippt. Ein Konto ohne E-Mail verzichtet dafür auf „Passwort vergessen" — das Zurücksetzen übernimmt dann die Benutzerverwaltung.',
      },
    ],
  },
  {
    nummer: 18,
    datum: '2026-08-19',
    titel: 'Das Kundenportal',
    punkte: [
      {
        text: '**Kundschaft sieht jetzt ihre Vorgänge selbst.** Unter „Meine Bestellungen" stehen nach der Anmeldung per E-Mail-Code nicht mehr nur Shop-Bestellungen, sondern auch die Aufträge aus dem Projektgeschäft — mit Stand („in Fertigung"), Fertigstellungstermin, Auftragswert und dem, was davon schon bezahlt ist. Rechnungen lassen sich als PDF herunterladen, samt GiroCode. Laufendes steht oben, Abgeschlossenes gesammelt darunter — wer nachschauen will, was er vor zwei Jahren bestellt hat, findet es trotzdem.',
      },
      {
        text: '**Der Satz, wegen dem es das Portal gibt:** „Ihre Anzahlung steht noch aus. Die Fertigung beginnt, sobald die Zahlung eingegangen ist." Genau deswegen rufen Leute an — jetzt steht die Antwort da, bevor die Frage kommt. Freundlich formuliert: Das ist keine Mahnung, die geht ihren eigenen Weg.',
      },
      {
        text: '**Wem was gehört, entscheidet eine einzige Datei** (`lib/portalDaten.ts`) — für die Seite genauso wie für den PDF-Abruf. Entwürfe und alles Interne (Kosten, Material, Zeiten, Notizen) bleiben draußen; eine fremde Rechnungsnummer antwortet mit „nicht gefunden", nicht mit „nicht erlaubt". Auch Projektkunden ohne Shop-Bestellung bekommen jetzt einen Anmeldecode — vorher stand genau diese Kundschaft vor einer Tür, die es für sie nicht gab.',
      },
      {
        text: '**Dabei einen stillen Fehler gefunden, der alle PDF-Routen betraf:** PDFKit suchte seine eingebauten Schriftmaße im Next-Bundle und fand sie nicht — jede über die Website ausgelieferte Rechnung wäre ein leerer 404 gewesen, obwohl dieselbe Funktion in Skripten lief. PDFKit bleibt jetzt außerhalb des Bundles.',
      },
    ],
  },
  {
    nummer: 17,
    datum: '2026-08-19',
    titel: 'Rollen, und eine Navigation, die man wiederfindet',
    punkte: [
      {
        text: '**Rollen lassen sich jetzt im Büro anlegen.** Unter Einstellungen → Benutzer stehen alle Rollen mit ihren Rechten zum Anhaken; eine neue Rolle darf zunächst nur das Büro öffnen, alles Weitere wird bewusst dazugegeben. Bisher gab es dafür nur „Inhaber" und „Redaktion" — wer eine Werkstattrolle ohne Umsätze wollte, hätte ins Admin-Panel wechseln müssen und wusste das nicht. Die Inhaberrolle bleibt unangetastet: Sie darf alles, weil sie an ihrem Schlüssel erkannt wird — das ist der Weg zurück, falls sich jemand beim Umbauen aussperrt.',
      },
      {
        text: '**Was jemand nicht darf, sieht er auch nicht.** Die Navigation zeigt nur noch die Bereiche, für die das Recht da ist — und die Übersicht ebenso: Eine Werkstattrolle sieht Aufträge und Inventar, aber keine Jahresumsätze und keine offenen Rechnungen. Ein Menüpunkt, der beim Antippen „nicht erlaubt" sagt, ist ein Versprechen, das keines war. Der Schutz selbst sitzt weiterhin an den Schnittstellen; hier geht es um Ordnung.',
      },
      {
        text: '**Die Leiste oben ist jetzt nach Arbeitsbereichen gruppiert.** Kundschaft, Werkstatt, Geld, Sonstiges — vier Knöpfe, die beim Drüberfahren aufklappen, statt achtzehn Punkte, die seitlich aus dem Bild liefen. Dieselbe Ordnung hatte das Blatt am Handy schon; gesucht wird ohnehin nicht alphabetisch, sondern nach „wo war das mit den Rechnungen".',
      },
    ],
  },
  {
    nummer: 16,
    datum: '2026-08-19',
    titel: 'Der Auftrag sagt, woran es hängt',
    punkte: [
      {
        text: '**Zahlungsstand am Auftrag.** Über dem Formular steht jetzt, was eingegangen ist und was aussteht, mit jeder Rechnung des Auftrags in einer Zeile. Und der Satz, den sonst niemand zieht: Wird nicht gezahlt, wird nicht gearbeitet — die Fertigstellung verschiebt sich um genau die Tage, die das Geld ausbleibt. Ein Knopf trägt den neuen Termin ein. **Verschoben wird also sichtbar und von Hand**: Ein zugesagtes Datum, das sich still ändert, ist schlimmer als eines, das sich sichtbar ändert — der Kunde hat den alten im Kalender und muss es von einem Menschen erfahren.',
      },
      {
        text: '**Bei offener Anzahlung wird erinnert, nicht gemahnt.** Vorher ist nichts geleistet, und wer noch überlegt, bekommt keine Mahngebühr. Bleibt sie länger offen als in den Einstellungen hinterlegt (Vorgabe: 21 Tage), fragt das Büro nach dem Werkstattplatz — irgendwann muss die Entscheidung fallen, sonst blockiert ein Auftrag die Reihe, den es vielleicht gar nicht gibt.',
      },
      {
        text: '**In der Auftragsliste steht „wartet auf Zahlung"** statt nur „überfällig". Das sind zwei verschiedene Dinge: Beim einen ist die Werkstatt zu spät, beim anderen wartet sie zu Recht.',
      },
      {
        text: 'Gerechnet wird das im Gerät, aus dem Bestand, der ohnehin dort liegt — die Leiste steht damit auch in der Werkstatt ohne Netz.',
      },
    ],
  },
  {
    nummer: 15,
    datum: '2026-08-19',
    titel: 'Der QR-Code auf der Rechnung',
    punkte: [
      {
        text: '**Zahlen ohne Abtippen.** Unter der Bankverbindung steht jetzt ein GiroCode: Kamera drauf, die Banking-App schlägt Empfänger, Betrag und Verwendungszweck fertig vor. 22 Zeichen IBAN abzutippen bedeutet sonst, dass eine falsche Ziffer als Rückfrage zurückkommt — und bei einer Anzahlung, die vor dem Fertigungsbeginn eingehen soll, ist das der Unterschied zwischen „heute Abend" und „nächste Woche".',
      },
      {
        text: '**Lieber keiner als ein falscher.** Fehlt die IBAN oder passt sie nicht ins Format, erscheint schlicht kein Code. Ein QR-Code mit falschen Daten sieht vertrauenswürdig aus und führt zu einer Zahlung, die niemand erwartet hat. Auf Angeboten steht ohnehin keiner — dort ist noch nichts fällig.',
      },
    ],
  },
  {
    nummer: 14,
    datum: '2026-08-19',
    titel: 'Rechnungen entstehen von selbst, verschickt werden sie von Hand',
    punkte: [
      {
        text: '**Drei Auslöser, drei Entwürfe.** Wer in Stufen zahlt, bekommt die Rechnungen nicht mehr abgetippt: Die Anzahlung entsteht mit dem Auftrag, die Zwischenrechnung, sobald am Meilenstein ein Datum steht, die Schlussrechnung, wenn der Auftrag auf „Fertig" springt. Jede davon liegt als **Entwurf** in der Liste, mit einer Meldung aufs Handy — abgeschickt wird sie von Hand. Ein versehentlich gesetzter Status kostet damit einen Entwurf und keine Rechnung beim Kunden.',
      },
      {
        text: '**Die Schlussrechnung zieht die Vorstufen einzeln ab**, mit Nummer, Datum und ihrer Umsatzsteuer. Das ist der Teil, an dem es teuer wird: Ohne benannten Abzug ist dieselbe Steuer zweimal erklärt, und beim Finanzamt zählt die höhere. 1000 € Auftrag, 30 % Anzahlung, 20 % Zwischenrechnung ergeben eine Schlussrechnung über 500 € netto — mit beiden Vorstufen sichtbar auf dem Blatt.',
      },
      {
        text: '**Die Anteile stehen am Auftrag**, nicht mehr nur am Artikel. Sie werden bei der Anlage vom Artikel abgeschrieben (über Anfrage und Angebot) und danach nicht mehr nachgeführt: Was mit der Kundschaft vereinbart wurde, darf sich nicht ändern, weil jemand Monate später den Artikel im Shop anfasst. Ab der ersten gestellten Rechnung sind sie festgeschrieben.',
      },
      {
        text: '**Fertigmelden blieb hängen — behoben.** Beim Umstellen eines Auftrags auf „Fertig" schrieb das Abbuchen des Materials an denselben Auftrag zurück, aber auf einer zweiten Datenbankverbindung: Die wartete auf die Sperre der ersten, die erste auf das Ende des Abbuchens. Aufgefallen ist das erst beim Nachmessen mit einem echten Durchlauf.',
      },
    ],
  },
  {
    nummer: 13,
    datum: '2026-08-19',
    titel: 'Bezahlt wird über PayPal',
    punkte: [
      {
        text: '**Stripe ist raus.** Karte, Apple Pay und Klarna liefen bisher über Stripe, PayPal stand als zweite Zahlart daneben. Geblieben ist PayPal — und darüber lässt sich ebenfalls mit Karte oder Lastschrift zahlen, auch ohne PayPal-Konto. Die Kasse fragt deshalb nicht mehr nach der Zahlungsart: Es gibt nur noch einen Weg. **Wer nicht alles auf einmal zahlen will, vereinbart das mit PayPal** — späteres Zahlungsziel oder Raten; beim Betrieb kommt der Betrag trotzdem als ganzer an. Die Teilzahlung finanziert damit PayPal und nicht die Werkstatt. Der Webhook-Endpunkt entfällt ersatzlos — die Zahlung wird beim Rücksprung auf die Danke-Seite eingezogen, das braucht keinen Rückruf von außen.',
      },
      {
        text: '**Bestellungen aus der Stripe-Zeit bleiben, wie sie sind.** Anbieter, Session- und Zahlungsnummer stehen weiter an der Bestellung; sie sind der Beleg dafür, welche Zahlung damals wozu gehörte. Nur die Zugangsdaten fallen aus der Datenbank — Schlüssel zu einem Konto, das niemand mehr benutzt, gehören dort nicht herum.',
      },
      {
        text: '**Wenn die Bezahlung nicht eingerichtet ist, sagt die Kasse das jetzt.** Vorher führte der Bestellknopf ins Leere und meldete „bitte versuchen Sie es erneut" — was nicht half, weil ein zweiter Versuch genauso scheitert. Jetzt steht der Hinweis schon bei der Zahlungsart, und der Knopf lässt sich gar nicht erst drücken.',
      },
    ],
  },
  {
    nummer: 12,
    datum: '2026-08-19',
    titel: 'Das Büro arbeitet jetzt auch ohne Netz',
    punkte: [
      {
        text: '**Live: Was einer ändert, sehen die anderen sofort.** Das Büro hält eine offene Verbindung zum Server. Legt jemand am Rechner einen Auftrag an, steht er eine Sekunde später auf dem Tablet in der Werkstatt — ohne Nachladen, ohne Antippen. Gemeldet wird am Datenmodell und nicht in den Formularen: Ob die Änderung aus dem Büro kommt, aus der Website-Verwaltung, aus einer Shop-Bestellung, von Stripe oder vom KI-Zugang, macht keinen Unterschied.',
      },
      {
        text: '**Und vor allem: Das Büro geht ohne Netz auf.** Der Bestand — Belege, Rechnungen, Angebote, Aufträge, Bestellungen, Anfragen, Inventar, Partner, Artikel, Inventur — liegt jetzt im Gerät. Die Seiten rechnen daraus: Der Wechsel zwischen Filtern ist ohne Wartezeit, das Blättern durch den Kalender auch, und in der Werkstatt steht alles da, wo vorher eine Fehlerseite war. Eine Leiste über den Seiten sagt, von wann der Stand ist — ein alter Stand ist brauchbar, ein alter Stand, der sich für den aktuellen ausgibt, ist gefährlich.',
      },
      {
        text: '**Eingaben gehen auch ohne Netz nicht verloren.** Beleg fotografieren, Uhr starten und stoppen, Inventur zählen, Partner anlegen: Alles steht augenblicklich da und geht raus, sobald wieder Netz ist. Der Reihe nach, denn ein Beleg kann auf einen Lieferanten verweisen, den es beim Server noch gar nicht gibt. Oben steht, wie viel noch wartet. Die Zeiterfassung schickt ihren eigenen Zeitpunkt mit — sonst stünde in der Buchung die Stunde, in der das Netz wiederkam, statt der, in der gearbeitet wurde.',
      },
      {
        text: '**Beim Abmelden ist alles weg.** Seit das Büro offline arbeitet, liegen Umsätze, Belege und Kundendaten im Gerät. Beim Abmelden werden sie gelöscht, samt zwischengespeicherter Seiten — ein Tablet in der Werkstatt soll nichts mit sich herumtragen, nachdem sich jemand abgemeldet hat.',
      },
      {
        text: '**Einstellungen, Integrationen und Benutzer stehen jetzt im Büro.** Bisher führte jeder Weg zu Zugangsdaten, Postfächern oder Konten über die Website-Verwaltung — mitten aus dem Büro heraus in eine andere Oberfläche. Jetzt ist das Admin-Panel nur noch für die öffentliche Website da. Die Formulare entstehen dabei aus derselben Feldbeschreibung, die Payload selbst verwendet: Kommt dort ein Feld dazu, erscheint es hier von selbst. Passwörter bleiben verdeckt, aufdeckbar und kopierfähig. Zwei Sperren sind eingebaut, damit sich niemand aussperrt: Man kann sich nicht selbst löschen, und der letzte Inhaber bleibt Inhaber.',
      },
      {
        text: '**Website und Büro laufen getrennt.** Bisher teilten sie sich einen Prozess: Ein Fehler im Büro riss den Shop mit, und ein Ausrollen legte beides zugleich still. Jetzt laufen zwei Container aus demselben Abbild — einer bedient Kundschaft, einer das Büro. Für alle Beteiligten bleibt es dieselbe Adresse, dieselbe Anmeldung, dieselbe Datenbank; wer wohin geleitet wird, entscheidet Traefik. Was es genau einmal geben darf — Migrationen, nächtliche Sicherung, Erinnerungen —, erledigt weiterhin nur die Website-Seite, sonst käme jede Erinnerung zweimal aufs Handy. Und weil eine Änderung oft dort entsteht, wo niemand einen Draht offen hält (eine bezahlte Bestellung etwa), reichen sich die beiden Live-Meldungen über die Datenbank durch. Das kann Postgres von Haus aus; es braucht keinen Nachrichtendienst und keine Verbindung zwischen den Containern.',
      },
      {
        text: '**Nebenbei behoben.** Die gelockerte Sicherheitsrichtlinie fürs Admin-Panel war nie in Kraft — bei mehreren passenden Regeln gewinnt in Next die spätere, und der Auffangpfad stand unten. In der Entwicklungsumgebung antwortete jede Seite mit 500, weil der Takt für eine Laufzeit übersetzt wurde, in der er gar nicht läuft. Und der Zwischenspeicher fürs Arbeiten ohne Netz sah zwar gefüllt aus, gab aber nichts heraus — zwei Kleinigkeiten beim Nachschlagen, in der Summe kein einziges geladenes Skript; vier Ansichten blieben deshalb ohne Netz leer. Und Sicherungsarchive landeten beim Entwickeln in der Versionsverwaltung.',
      },
    ],
  },
  {
    nummer: 11,
    datum: '2026-08-18',
    titel: 'Pflichten, Geld und die Dinge hinter dem Happy Path',
    punkte: [
      {
        text: '**Elektronische Rechnung.** Frankreich verlangt ab dem 1. September 2026, dass Unternehmen E-Rechnungen empfangen können; das Ausstellen folgt gestaffelt. Ausgangsrechnungen entstehen deshalb jetzt als **Factur-X**: ein PDF/A-3, in dem dieselbe Rechnung zusätzlich als XML nach EN 16931 steckt. Das Blatt sieht aus wie vorher, die Maschine liest die Daten — und beides kommt aus denselben Feldern, damit PDF und XML nie auseinanderlaufen. Neu dafür: IBAN, die Option „TVA d\'après les débits", SIRET und TVA-Nummer des Kunden, Bestellnummer, Leistungsdatum. Fehlt etwas, sagt es die Rechnungsseite, bevor eine Plattform sie zurückweist. Die Anbindung an eine Plateforme Agréée bleibt eine Vertragsfrage.',
      },
      {
        text: '**Elektronische Rechnungen werden auch gelesen, nicht nur geschrieben.** Kommt ein Beleg als PDF mit eingebetteter Rechnungs-XML (Factur-X, ZUGFeRD, XRechnung), übernimmt das Büro Lieferant, Nummer, Datum, Zahlungsziel und Beträge unverändert von dort — exakt, sofort und ohne KI. Claude schaut sich nur noch an, was keine XML mitbringt: Fotos, Kassenbons, eingescannte Papierrechnungen. Nebenbei ist damit die Empfangspflicht ab September 2026 erfüllt.',
      },
      {
        text: '**Widerrufsrecht und die Seiten, die dem Shop fehlten.** Es gab Impressum, Datenschutz und AGB — aber keine Widerrufsbelehrung, kein Muster-Widerrufsformular, nichts zu Versand und Zahlung. Alles drei ist jetzt da, dreisprachig, mit Entwürfen zum Loslegen. Wichtig für die Werkstatt ist der zweite Teil der Belehrung: Bei einem nach Kundenvorgabe gefertigten Einzelstück besteht kein Widerrufsrecht — aber nur, wenn es ausdrücklich dasteht. In der Kasse wird beides bestätigt, bevor bestellt wird, und mit Zeitpunkt an der Bestellung festgehalten. Der Knopf heißt jetzt „Zahlungspflichtig bestellen".',
      },
      {
        text: '**Sicherung auf die NAS.** Bisher sicherte ein Nebencontainer die Datenbank in ein Volume auf demselben Server — die Bilder gar nicht. Jetzt packt die App selbst ein Archiv aus Datenbank **und** Mediathek und schiebt es per Samba oder WebDAV auf den Netzwerkspeicher. Im Büro steht, wann zuletzt gesichert wurde, und ein Knopf macht es sofort. In jedem Archiv liegt eine Anleitung zum Zurückspielen — im Ernstfall liest niemand mehr Dokumentation.',
      },
      {
        text: '**Der Server taktet sich selbst.** Kein Cron, kein zweiter Container, keine Umgebungsvariable: Die Anwendung läuft ohnehin durch und sieht jede Minute nach, ob etwas ansteht. Wie oft tatsächlich gearbeitet wird, steht im Admin unter **Integrationen → Takt** und greift binnen einer Minute — ohne Neustart und ohne Zugriff auf den Server. Viertelstündlich prüft das System, was ansteht: nächtliche Sicherung, Aufräumen kurzlebiger Daten, und die Meldung, wenn Sicherung oder Postfach-Abruf stillstehen. **Fällige Belege** gehören dazu: Steht auf einer Eingangsrechnung ein Zahlungsziel — die KI liest es beim Erfassen mit —, meldet sich das Büro ab drei Tagen vorher jeden Tag, bis der Beleg auf „bezahlt" steht. Vorher bleibt es still.',
      },
      {
        text: '**Mahnen und nachfassen.** An einer offenen Rechnung führt ein Knopf zur nächsten Stufe: Zahlungserinnerung ohne Kosten, Mahnung mit der gesetzlichen Pauschale von 40 €, letzte Mahnung mit Frist. Welche dran ist, weiß das Büro selbst. Angebote merken sich beim Verschicken den Tag und melden sich nach einer Woche ohne Antwort — die Hälfte der Aufträge entscheidet sich daran, ob jemand anruft.',
      },
      {
        text: '**Newsletter.** Anmeldung im Fuß jeder Seite, Bestätigung per Mail, Abmeldung mit einem Klick, Versand aus dem Büro mit Testlauf davor. Bei Einzelstücken ist die Liste der Interessierten das wertvollste Gut — bisher gab es sie nicht. Und die **Kundenstimmen** füllen sich endlich von selbst: Zwei Wochen nach dem Versand fragt eine Mail nach ein paar Sätzen, genau einmal; was zurückkommt, liegt zur Prüfung im Admin statt sofort auf der Website.',
      },
      {
        text: '**Die Werkstatt rechnet mit.** Material und Dienstleister waren erfasst, die Arbeitszeit nicht — also die größte Position. Am Auftrag steht jetzt eine Stoppuhr (großer Knopf, auch mit Handschuhen), Zeit lässt sich nachtragen, und daraus entstehen Lohnkosten neben Material und Fremdleistung. Am Artikel dieselbe Rechnung vor dem Verkauf, samt Preisvorschlag; liegt der Website-Preis unter dem Einsatz, steht das da. Dazu ein **Kalender**, der Fertigstellungen, Liefertermine, ablaufende Angebote und fällige Belege auf ein Blatt legt, und ein **Lieferschein** zum Mitgeben — bei Montagen zugleich das Abnahmeprotokoll.',
      },
      {
        text: '**Bilder in der Größe, die das Gerät braucht.** Fünf Zuschnitte statt drei, alle als WebP, ausgeliefert per `srcset`. Vorher lud ein Handy dieselbe Datei wie ein 4K-Bildschirm. Vorhandene Bilder werden einmalig mit `pnpm bilder-neu` nachgerechnet.',
      },
      {
        text: '**Anmelden mit Face ID, Fingerabdruck oder Geräte-PIN.** Statt langem Passwort plus Code aus der Authenticator-App: ein Knopf, ein Blick aufs Gerät, drin. Der Schlüssel entsteht im Gerät und verlässt es nie; er lässt sich nicht abtippen und nicht auf einer gefälschten Seite eingeben. Eingerichtet wird das je Benutzer unter **Mein Konto**, so wie die Zwei-Faktor-Anmeldung — und ein Passkey ersetzt sie, denn er ist bereits beides: das Gerät, das man hat, und das Gesicht, das man ist. Die Anmeldung mit Passwort bleibt als Rückweg.',
      },
      {
        text: '**Anmeldung gilt jetzt eine Woche und verlängert sich, solange sie benutzt wird** — statt zwei Stunden. Payloads Standard ist für ein Redaktionssystem gedacht; auf einem Werkstatt-Tablet hieß er: dreimal am Tag neu anmelden, jedes Mal mit Code aus der Authenticator-App. Das führt am Ende nur dazu, dass jemand die Zwei-Faktor-Anmeldung abschaltet. Wer täglich arbeitet, bleibt angemeldet; ein Gerät, das eine Woche liegen bleibt, nicht. Ein Ausrollen überlebt die Anmeldung — das Token hängt am Serverschlüssel, nicht am Container. Wer ein Gerät verliert, ändert das Passwort: Damit sind alle Anmeldungen ungültig, auch die per Passkey.',
      },
      {
        text: '**Passwörter und Schlüssel sind in der Verwaltung verdeckt.** SMTP, Postfächer, Stripe, PayPal, Anthropic, MCP, Facebook und der NAS-Zugang standen bisher im Klartext auf dem Bildschirm. Jetzt sind sie maskiert wie ein Passwort, mit einem Knopf zum Aufdecken und einem zum Kopieren — denn getippt werden solche Werte nie, sie werden kopiert.',
      },
      {
        text: '**Absicherung**: CSP, HSTS und die übrigen Sicherheits-Kopfzeilen; Bremsen an MCP-, MFA- und Kassen-Endpunkt; abgelaufene Anmeldecodes und altes Mailprotokoll werden aufgeräumt. Dazu Tests für die Rechenwege mit Geld — Steuer, Nachlass, Factur-X-Summen —, denn dort fällt ein Fehler erst beim Steuerberater auf.',
      },
    ],
  },
  {
    nummer: 10,
    datum: '2026-08-18',
    titel: 'Das Büro: Betrieb, Postfach und Meldungen aufs Handy',
    punkte: [
      {
        text: '**Ein eigener Arbeitsplatz für den Betrieb.** Unter `/office` gibt es jetzt eine zweite Oberfläche neben der Website-Verwaltung — ruhiger, größer, fürs Handy gemacht und als App installierbar. Die Anmeldung ist dieselbe wie im Admin, inklusive Zwei-Faktor. Damit ist die Trennung klar: Die Website-Verwaltung ist für alles da, was nach außen geht, das Büro für alles, was niemand von außen sieht. Belege, Bestellungen, Aufträge und Zahlen stehen deshalb nur noch dort, und zwar an genau einer Stelle.',
      },
      {
        text: '**Angebot, Auftrag, Rechnung an einem Faden.** Angebote entstehen mit Positionen, Steuer und zugesagter Fertigungszeit; ihre Nummer bekommen sie erst beim Versenden, damit verworfene Entwürfe keine Lücke in der Reihe hinterlassen. Ein angenommenes Angebot wird per Klick zum Fertigungsauftrag oder zur Rechnung — ohne die Positionen ein zweites Mal einzutippen. Bezahlte Shop-Bestellungen legen ihren Auftrag von selbst an, mit dem Preis von der Website; fertige Werkstattstücke bekommen keinen, die liegen ja schon da.',
      },
      {
        text: '**Das System weiß jetzt, was ein Stück braucht.** Zu jedem Artikel lassen sich Material mit Menge und externe Dienstleister hinterlegen — Verzinkerei, Beschichter, Laserschneider, mit Kosten je Stück und Vorlaufzeit. Daraus rechnet das Büro den Einsatz je Stück gegen den Website-Preis. Kommt eine Bestellung herein, steht am Auftrag, ob alles im Haus ist und was nachbestellt werden muss — bevor die Kundschaft wartet. Abgebucht wird das Material erst beim Fertigmelden.',
      },
      {
        text: '**Postfach im Büro.** Mehrere E-Mail-Konten lesen, beantworten, Anhänge öffnen und aufräumen, ohne ein anderes Programm zu starten. Gelesen wird direkt beim Anbieter — was hier gelöscht wird, ist auch am Rechner weg —, Antworten gehen mit der Adresse des jeweiligen Postfachs raus und landen als Kopie in „Gesendet". Aus einer Anfrage führt ein Klick ins fertig vorbereitete Antwortfenster.',
      },
      {
        text: '**Ausgangsprotokoll.** Bestellbestätigungen, Zugangscodes und Versandmails gehen automatisch raus, und bisher sah sie niemand. Jetzt steht in einer Liste, was verschickt wurde, an wen und ob der Mailserver es angenommen hat. Auf die Frage „ich habe nie eine Bestätigung bekommen" gibt es damit eine Antwort statt eines Achselzuckens.',
      },
      {
        text: '**Meldungen aufs Handy.** Ist das Büro als App abgelegt, meldet es neue Bestellungen, neue Anfragen und Mails, die nicht zugestellt werden konnten — auch neue Post im Postfach. Wer in der Werkstatt steht, muss dafür nicht mehr alle zehn Minuten nachschauen.',
      },
      {
        text: '**Belege abfotografieren statt abtippen.** Eingangsrechnungen werden im Büro hochgeladen und von Claude ausgelesen — Lieferant, Datum, Netto, Steuer, Brutto stehen dann schon da und müssen nur bestätigt werden. Der Scan bleibt am Eintrag hängen, denn ohne Beleg zählt die Buchung beim Finanzamt nicht. Am Jahresende gibt es einen Auszug für den Steuerberater: Einnahmen, Ausgaben, Belege — fertig.',
      },
      {
        text: '**Inventar und Inventur zu Ende gebaut**: Posten anlegen und ändern, Mindestbestände im Blick, und die Inventur bringt die Zählliste mit allen Posten und ihrem Soll-Bestand fertig mit. Beim Abschließen wandern die gezählten Mengen ins Inventar, danach ist der Lauf gesperrt.',
      },
      {
        text: 'Dazu die Geschäftspartner-Kartei für Lieferanten, Kunden und Dienstleister sowie Bestellungen und Anfragen mit Status, Sendungsnummer und interner Notiz.',
      },
    ],
  },
  {
    nummer: 9,
    datum: '2026-08-18',
    titel: 'Verwaltung per KI, Kundenportal und Einzelfertigung',
    punkte: [
      {
        text: '**Die Verwaltung per Claude kann jetzt fast alles**, was auch das Admin-Panel kann: Referenzen, Kundenstimmen, Kategorien, Anfragen und die Seitentexte kamen dazu, News und Produkte lassen sich auch lesen, ändern und löschen. Neu ist der Sprachschalter an jedem Werkzeug — französische und englische Fassungen entstehen jetzt im selben Zug, und eine Prüfung zeigt, was noch fehlt. Gelöscht wird nur nach ausdrücklicher Bestätigung.',
      },
      {
        text: '**Zugang bequemer und sicherer**: Die Schlüssel für den KI-Zugang werden im Admin unter „Integrationen" erzeugt, die fertige Verbindungsadresse steht daneben zum Kopieren. Zusätzlich gibt es einen Nur-Lese-Schlüssel für Auswertungen, mit dem sich nichts ändern lässt. Bilder lassen sich per Link direkt hochladen — auch große Werkstattaufnahmen bis 150 MB.',
      },
      {
        text: '**Zwei-Faktor-Anmeldung fürs Backend**: zusätzlich zum Passwort ein Code aus einer Authenticator-App, mit Ersatzcodes für den Notfall.',
      },
      {
        text: '**Anfragen gehen nicht mehr verloren.** Kontakt- und Produktanfragen landen jetzt in einer eigenen Verwaltung mit Status und Notizfeld — vorher gab es nur eine E-Mail, und wenn die unterging, war der Kontakt weg. Dazu Spam-Schutz am Formular.',
      },
      {
        text: '**Kundschaft sieht ihren Bestellstand selbst**: Aus jeder Bestellbestätigung führt ein Link auf eine Statusseite; unter „Konto" gibt es die vollständige Übersicht nach Anmeldung mit einem sechsstelligen Code per E-Mail (bewusst kein Klick-Link, den Outlook vorab aufruft). Die Bestellbestätigung bringt außerdem die **Rechnung als PDF** mit.',
      },
      {
        text: '**Einzelfertigung ist jetzt überall sichtbar.** Jedes Stück entsteht einzeln — deshalb steht am Artikel eine Fertigungszeit, ein Hinweis auf die Handarbeit begleitet Kauf und Bestätigung, und Bestellungen haben den neuen Zwischenstand **„In Fertigung"** samt eigener E-Mail. Bisher hörte die Kundschaft zwischen Zahlung und Versand wochenlang nichts. Fertige Stücke aus der Werkstatt sind als sofort lieferbar gekennzeichnet und verschwinden nach dem Verkauf automatisch.',
      },
      {
        text: '**Neue Seite Maßanfertigung** mit Maßen, Wunschfarbe und Skizzen-Upload — bei Einzelfertigung der eigentliche Weg zum Auftrag.',
      },
      {
        text: '**Suche auf der Website** über Produkte, Referenzen, News und Rubriken; Referenzen und Produkte verweisen jetzt gegenseitig aufeinander („Verwendete Arbeiten" bzw. „So sieht das in echt aus").',
      },
      {
        text: 'Kleinkram: Sendungsnummer wird beim Umstellen auf „Versendet" zuverlässig mitgeschickt, strukturierte Daten für Referenzen und die Werkstatt, optionale cookiefreie Besucherstatistik ohne Banner.',
      },
    ],
  },
  {
    nummer: 8,
    datum: '2026-08-17',
    titel: 'Verwaltung als App installierbar',
    punkte: [
      {
        text: 'Der Admin (/admin) lässt sich jetzt als App auf den Home-Bildschirm legen: iPhone/iPad über Safari „Teilen → Zum Home-Bildschirm", Android/Desktop-Chrome über „App installieren".',
      },
      {
        text: 'Eigenes App-Icon („VH"-Monogramm mit Corten-Strich), startet im Vollbild ohne Browser-Leisten.',
      },
    ],
  },
  {
    nummer: 7,
    datum: '2026-08-17',
    titel: 'Corten-Striche unter Überschriften',
    punkte: [
      {
        text: 'Überschriften tragen jetzt einen feinen Strich in Corten-Bronze, der nach rechts weich ausläuft — je größer die Überschrift, desto länger der Strich (zentrierte Titel laufen zu beiden Seiten aus).',
      },
      {
        text: 'Angewendet auf Startseiten-Abschnitte (inkl. der kleinen Etiketten wie „Maßanfertigung") und die Seitentitel von News, Referenzen, Über uns, Aktionen, Kontakt und Kategorien.',
      },
    ],
  },
  {
    nummer: 6,
    datum: '2026-08-17',
    titel: 'Elegantere Diashow & Bronze-Akzent',
    punkte: [
      {
        text: 'Hero-Diashow mit filmischer Kamerablende (1,4 s): Das neue Bild setzt sanft auf, Titel laufen aus einer Maske ein, die Unterzeile folgt versetzt.',
      },
      {
        text: 'Punkte unter dem Slider durch schmale Balken ersetzt — der aktive füllt sich über die Anzeigedauer, man sieht, wann gewechselt wird.',
      },
      {
        text: 'Dezentere Pfeile (schlanke Chevrons statt Kreis-Buttons); nach manuellem Blättern startet der Automatik-Takt neu.',
      },
      {
        text: 'Neue Akzentfarbe **Bronze/Corten** (greift das Material der Arbeiten auf): feine Punkte im Laufband, Hover-Zustände, Warenkorb-Badge, Rubrik-Etiketten, Zeitleiste. Kauf-Buttons bleiben schwarz und wechseln beim Überfahren auf Bronze. Aktions-Banner und Rabatte bleiben rot.',
      },
    ],
  },
  {
    nummer: 5,
    datum: '2026-08-17',
    titel: 'Farb-Choreografie von Header & Startseite',
    punkte: [
      {
        text: 'Der Header übernimmt auf der Startseite den Farbton des oberen Bildrands des aktiven Hero-Bildes; Logo und Navigation wechseln je nach Helligkeit auf Weiß.',
      },
      {
        text: 'Unter dem Hero „strahlt" die Farbe des unteren Bildrands auf die Seite ab und läuft weich ins Weiß aus — bei jedem Bild automatisch in dessen Farbe.',
      },
      {
        text: 'Feinschliff: echte Kantenfarben (Durchschnitt der obersten/untersten Pixelzeilen), Abdunklung des Bildes eingerechnet, Verlauf endet sicher vor dem Laufband.',
      },
    ],
  },
  {
    nummer: 4,
    datum: '2026-08-17',
    titel: 'Kasse, PayPal, Steuern, Redaktion',
    punkte: [
      {
        text: 'Zahlungsart (Karte/PayPal) ist vor dem Bestellen sichtbar wählbar; Button und Hinweis passen sich an.',
      },
      {
        text: 'Bei PayPal kommt die Lieferadresse aus dem PayPal-Konto; abweichende Adresse optional per Häkchen. Die von PayPal bestätigte Adresse wird in der Bestellung gespeichert.',
      },
      {
        text: 'TVA-Ausweis: Firmenangaben (SIRET, TVA-Nr., Steuersatz) in den Site-Einstellungen; Bestellmails weisen die enthaltene Steuer aus und tragen die Pflichtangaben im Fuß.',
      },
      {
        text: 'News, Produkte und Projekte erzeugen ihre URL (Slug) jetzt automatisch aus dem Titel — Feld einfach leer lassen.',
      },
      {
        text: 'Editor mit fest angepinnter Werkzeugleiste — deutlich angenehmer am Handy.',
      },
      {
        text: 'Deployment: TRANSLATE_EN-Schalter wird korrekt durchgereicht; PayPal-/Instagram-Zugänge auch per Umgebungsvariable möglich.',
      },
    ],
  },
  {
    nummer: 3,
    datum: '2026-08-17',
    titel: 'Reichweite & Präsentation',
    punkte: [
      {
        text: 'Neue Referenzen-Seite (Projekte für Kommunen, Gewerbe, Privat) mit Filter und Teaser auf der Startseite.',
      },
      {
        text: 'Über-uns-Seite mit Werkstatt-Geschichte und Zeitleiste.',
      },
      {
        text: 'Kundenstimmen auf Startseite und Produktseiten (nur echte Stimmen eintragen!).',
      },
      {
        text: 'Optionales Video im Hero-Slider.',
      },
      {
        text: 'Ratgeber-Rubrik in den News inkl. zwei Startartikeln (DE/FR).',
      },
      {
        text: 'Instagram-Autopost zusätzlich zu Facebook; Pinterest-Verifizierung hinterlegbar.',
      },
      {
        text: 'Premium-Scroll-Animationen (sanftes Scrollen, Text-Reveals, Laufband, mitdenkender Header).',
      },
    ],
  },
  {
    nummer: 2,
    datum: '2026-08-17',
    titel: 'Englisch, SEO & Betrieb',
    punkte: [
      {
        text: 'Englisch als dritte Sprache (Inhalte werden beim Deploy automatisch eingespielt).',
      },
      {
        text: 'SEO-Paket: Sitemap, robots.txt, hreflang, strukturierte Daten für Produkte/Artikel, Open-Graph-Bilder.',
      },
      {
        text: 'Produktanfrage-Formular direkt am Artikel („auf Anfrage").',
      },
      {
        text: 'Versand-Mail mit Sendungsverfolgung beim Umstellen auf „Versendet".',
      },
      {
        text: 'PayPal als zweite Zahlart.',
      },
      {
        text: 'Betrieb: Gesundheits-Endpunkt, tägliche Datenbank-Backups (14 Tage), Überwachung per Home Assistant.',
      },
    ],
  },
  {
    nummer: 1,
    datum: '2026-08-17',
    titel: 'Start der neuen Website',
    punkte: [
      {
        text: 'Kompletter Neuaufbau als eigene, selbst verwaltete Website: Design 1:1 an die bestehende Seite angelehnt (Logo-Schriftzug, Navigation, Hero-Slider, dunkler Footer).',
      },
      {
        text: 'Admin-Backend unter /admin: Produkte, Kategorien, News, Aktionen, Bestellungen, Bilder, Seiteninhalte, rechtliche Texte — alles selbst pflegbar, dreisprachig (DE/FR/EN).',
      },
      {
        text: 'Online-Shop mit Warenkorb, Stripe-Kartenzahlung, Versandkosten je Artikel und Abholoption.',
      },
      {
        text: 'Aktionen mit Rabattcodes und Banner auf der Startseite.',
      },
      {
        text: 'Facebook-Autopost für News-Beiträge.',
      },
      {
        text: 'Zugänge (SMTP, Stripe, PayPal, Facebook/Instagram) bequem im Admin unter Integrationen pflegbar.',
      },
      {
        text: 'Betrieb per Docker hinter Traefik, automatischer Image-Build über GitHub Actions, persistente Bilder und Datenbank.',
      },
    ],
  },]
