# Changelog

Die Einträge stehen seit August 2026 in **`src/neuerungen.ts`** — dort, wo auch
die Regeln zum Ergänzen stehen.

Der Grund für den Umzug: Das Protokoll wird im Büro unter **Neuerungen**
(`/office/neuerungen`) gelesen, und eine Datei hat kein Gedächtnis dafür, wer
sie schon gelesen hat. Aus der Quelle wird beim Start die Sammlung `changelog`
befüllt; das Büro vergleicht sie mit `users.neuerungGesehen` und meldet sich
von selbst, wenn etwas Neues ausgerollt wurde. Die gesammelte Geschichte dieser
Datei ist dabei vollständig mitgezogen.
