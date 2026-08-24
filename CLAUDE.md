# Arbeitsweise in diesem Repository

Diese Datei gilt für Claude. Sie sagt, wo Arbeit hingeht und was vor dem
Abgeben erledigt sein muss. Alles Fachliche steht im README, alles Offene in
HANDOVER.md, alles Geschehene in `src/neuerungen.ts`.

## Branches

Drei Ebenen, und jede hat genau eine Aufgabe:

```
claude/<thema>   →   develop   →   main
   (Arbeit)        (Sammlung)    (veröffentlicht)
```

**`claude/<thema>` — hier wird gearbeitet.** Ein Branch je Aufgabe, abgezweigt
von `develop`.

**`develop` — hier wird gesammelt und im Container ausprobiert.** Fertige
Arbeit kommt hierher, und zwar laufend. Was auf `develop` liegt, ist fertig,
geprüft und wartet nur noch auf das Wort zum Veröffentlichen.

Dazu gehört seit 08/2026 (Entscheidung Dominik) ein Schritt, den es vorher
nicht gab: **`develop` wird als Abbild gebaut und gestartet** — auf dem
Firmenrechner mit Docker Desktop, siehe `ENTWICKLUNG.md`. Der Grund ist eine
Lücke, die zweimal Geld gekostet hat: Geprüft wurde bis dahin der Quelltext,
nicht der Weg, den der Betrieb wirklich geht. Ein Containerstart gegen eine
**leere** Datenbank fällt durch eine Migration, die eine Spalte vergisst; ein
Volume, das im Stack fehlt, fällt beim zweiten Ausrollen auf, wenn die Dateien
weg sind. Beides sieht man nur, wenn man es einmal tut. Was Migrationen,
Volumes oder den Containerstart anfasst, gehört deshalb dort durchgespielt,
bevor es nach `main` geht.

Ein Branch, der nach `develop` gemerged ist, **wird gelöscht** — örtlich und
am Server. Seine Commits leben in `develop` weiter; ein zweiter Name für
dieselbe Arbeit stiftet nur Verwirrung darüber, welcher Stand gilt.

**`main` — nur auf ausdrückliches Wort.** Nach `main` wird gezogen, wenn
Dominik **„veröffentlichen"** sagt, und sonst nie. Nicht, weil es fertig
aussieht, nicht, weil die Tests grün sind, nicht nebenbei am Ende einer
Aufgabe.

Der Grund ist handfest: Ein Push auf `main` baut über
`.github/workflows/docker.yml` ein neues Abbild und schiebt es nach
`ghcr.io/domcim/vh-website:latest`. `main` ist damit keine Sammelstelle,
sondern eine Veröffentlichung. Wann der Betrieb ein neues Abbild bekommt,
entscheidet der Betrieb.

Darin liegt der eigentliche Gewinn der drei Ebenen: **Ausliefern und Arbeiten
sind entkoppelt.** Solange alles Fertige auf `develop` liegt, kann jederzeit
veröffentlicht werden — mitten in einer laufenden Aufgabe, ohne auf sie zu
warten, und ohne dass halb Fertiges mitgeht. Umgekehrt darf an einem Feature
wochenlang gearbeitet werden, ohne dass es irgendetwas aufhält. Ohne diese
Trennung hinge jede Auslieferung am Takt der Arbeit und jede Arbeit am Takt
der Auslieferung.

Nie mit Gewalt auf einen Branch schreiben, an dem jemand anderes hängt: kein
`--force`, kein Rebase auf fremden Branches, kein Umschreiben von Verlauf, der
schon draußen ist.

## Vor dem Abgeben

```bash
pnpm typecheck && pnpm lint && pnpm exec playwright test
```

Alle drei, jedes Mal, und zwar bevor gepusht wird — nicht danach. Schlägt
etwas fehl, das mit der eigenen Änderung nichts zu tun hat, gehört das in die
Antwort und nicht ins Schweigen.

**Die Prüfung macht Claude, nicht GitHub.** Der Workflow
`.github/workflows/ci.yml` wird **nicht** angestoßen — weder vor einem Merge
noch sonst. Er läuft nur von Hand, und zwar aus einem handfesten Grund: Das
Actions-Kontingent war schon zweimal aufgebraucht, und danach steht auch das
Ausrollen still, weil derselbe Topf das Docker-Abbild baut. Ein Lauf zur
Beruhigung kostet Minuten, die im Ernstfall fehlen.

Was hier läuft, ist deshalb die Prüfung — nicht ein Vorlauf zu einer zweiten.
Lässt sich ein Teil davon in der Arbeitsumgebung nicht fahren (die Rauchtests
brauchen einen laufenden Server samt Datenbank), dann steht **das** in der
Antwort: welche Prüfungen liefen, welche nicht und warum. Nicht geprüft und
ehrlich gesagt ist besser als ein Lauf, den niemand bestellt hat.

Nach Änderungen an einer Collection zusätzlich:

```bash
pnpm generate:types
pnpm payload migrate:create <name>     # Migration und Schnappschuss mitcommitten
```

**Die Migration muss laufen, bevor der neue Code Verkehr bekommt.** In
Produktion tut das der Containerstart; wer eine Collection anlegt, die der
Abgleich abfragt, sperrt sonst das ganze Büro aus, weil jede Abfrage auf eine
fehlende Tabelle läuft.

## Neuerungen (das Änderungsprotokoll)

Jede Änderung, die jemand merkt, bekommt einen Eintrag in **`src/neuerungen.ts`**
— neueste zuerst, mit der nächsthöheren `nummer` und `datum: null`. Das Datum
setzt der Server beim ersten Einspielen, also am Tag des Ausrollens; ein
Abschnitt „Noch nicht ausgerollt" gibt es nicht mehr, weil ein Eintrag genau
dann im Büro steht, wenn die Fassung läuft, die ihn mitbringt.

Gelesen wird das im Büro unter `/office/neuerungen`, und zwar von jemandem, der
den Code nicht sieht: Es zählt, was sich für den Betrieb ändert und warum —
nicht, welche Dateien angefasst wurden.

Die Anzeige kennt genau zwei Auszeichnungen: `**fett**` und Backticks um Pfade.
Kein Kursiv, keine Links, keine Tabellen — was sie nicht kennt, steht als
Zeichen mitten im Satz.

**Nummern sind stabil.** An ihnen hängt `users.neuerungGesehen`, also der
Banner im Büro. Einen Eintrag, der schon draußen ist, nicht erweitern: Was
danach kommt, bekommt einen eigenen.

## Ton

Deutsch, in ganzen Sätzen, aus der Sicht des Betriebs. Das gilt für Commits,
für Kommentare im Code und für den Changelog. Kommentare erklären, **warum**
etwas so ist — was der Code tut, steht im Code. Wo eine Entscheidung einmal
falsch getroffen wurde, gehört das dazu: Der nächste soll den Weg nicht noch
einmal gehen.
