# Etappe 3 – kompakte iPhone-Oberfläche

> Umsetzung inline mit superpowers:executing-plans. Nutzer hat CP2 als besser bestätigt und Etappe 3 mit konkreten Ergänzungen freigegeben. Alle lokalen Änderungen bis zum Veröffentlichungscheckpoint fertigstellen.

**Goal:** Die bestehenden Inhalte ohne seitliches Abschneiden auf dem iPhone lesen und bedienen.
**Architecture:** React/CSS und bisherige Detailnavigation erhalten. Mobile Matchzeilen mit zwei Mannschaftszeilen; flüssiges Spielfeld statt fester Mindestbreite; Ersatzbänke bei Platzmangel untereinander.
**Tech Stack:** Bestehender React/TypeScript/Vite/Vitest/.NET-Stack, keine neuen Abhängigkeiten.
**Spec:** Nutzerauftrag im Chat vom 15.11.2026 plus Etappe 3 im Plan 2026-11-14-iphone-usability.md. Die konkrete kompakte Richtung ersetzt die allgemeinere Auswahlrunde: beide Teams bleiben auf einem Spielfeld sichtbar, die bestehende App-Struktur bleibt erhalten.
**Base:** 4fd1052 (ausgelieferte App 6622942 plus lokale Release-Dokumentation).

## Entwurf und Abwägung

- Vollständiges Spielfeld an verfügbare Breite anpassen; keine neue Team-Umschaltung und kein horizontales Scrollen für Aufstellung/Ersatzbank. Mindesthöhe erhält Platz für fünf Spieler in einer Reihe. Ersatzbänke untereinander statt winziger zweispaltiger Zeilen.
- Mobile Übersicht: Zeitpunkt, zwei Teamzeilen mit Emblem, zugehörige Tore, separater Favoritenstern. Lange Namen dürfen umbrechen. Desktop behält seine Zeile.
- Header: 28px zusätzlicher oberer Innenabstand mobil statt 16px (12px mehr); Safe Area weiterhin addieren. Detailkopf entsprechend 12px mehr Komfortabstand. In Einbettungen keine zusätzlichen Geräteränder.
- Installationsbutton, Hilfestatus, Hilfe-Markup und ungenutzte Styles vollständig entfernen. Bestehende installierte PWA bleibt lauffähig.
- Footertexte in Deutsch und Englisch samt leerem Footer entfernen. Reale Verbindungs-/API-Fehler bleiben sichtbar.
- Mobile Suche in voller Breite mit 16px Eingabeschrift und 44px Höhe; Hauptfilter sichtbar beschriften; primäre Ziele 44px. Explizite Auswahl Automatisch/Hell/Dunkel statt verborgenem Dreifachwechsel. Heute-Rücksprung bei anderem Datum; vorhandenen Hinweis bei automatischem Wechsel erhalten.
- Bestehende Einstellungen sind bereits nach Reihenfolge und Sportarten gruppiert; diese Struktur erhalten und Touchflächen verbessern.

## Globale Grenzen / Review-Fokus

Standalone und beide Embed-Modi; DE/EN; Hell/Dunkel/Automatisch; keine neuen Dienste, API- oder Cacheänderungen. Echter iOS-Safe-Area-/Tastatur-/VoiceOver-Test bleibt Nutzercheckpoint.
Prüfbreiten 320, 375, 393, 430, 768 und Desktop; Landschaft 852×393; lange Namen, fünf Spieler je Reihe, fehlende Embleme, Gelb/Rot/Tore, vergrößerter Text. Alle Profil- und Nationalteamaktionen erhalten.

## Task 1 – Rahmen und Übersicht

- [x] Bestehende mobile Geometrie festhalten: Header16px, Embleme display:none, Aufstellung min-width480/Bank500.
- [x] App.tsx/app.css: Installationshilfe und Footer entfernen; Abstand/Touchziele; explizite Themeauswahl.
- [x] SportsWidget.tsx/sports.css/sportsSearch.css: kompakte Teamzeilen, Embleme sichtbar, mobile Suche/Filter/Heute, gut getrennte 44px Touchziele.
- [x] Neue Datum-Rücksprunginteraktion gezielt prüfen, bestehende Tests ausführen; entfallene reine Textanzeige durch Browserprüfung statt Implementierung spiegelnder Tests absichern.

## Task 2 – Aufstellung

- [x] sportsLineup.css: feste Mindestbreiten entfernen; kompakte Spielerkarten, Informationen und Ersatzbank an verfügbaren Platz anpassen. SideDrawer.css/sportsDetailPanel.css: Detailinhalt und Kopf auf kurze/schmale Fenster abstimmen.
- [x] Browser mit kontrollierten 5er-Reihen/langen Namen und vorhandenen Profilaktionen vor/nach Änderung prüfen. Kein CSS-Quelltexttest als Ersatz für echte Geometrie.
- [x] Kompakte Vorschau und Ist-Geometrie dokumentieren; bei Kollisionen Ursache beheben.

## Task 3 – Abschluss/CP3

- [x] npm test, npm run build, dotnet build backend/App.Api; git diff --check.
- [x] Ganze Änderung prüfen lassen; lokale Commits und Hauptplan aktualisieren.
- [x] Konkrete mobile Vorschau lokal gesichert und zur Abnahme vorbereitet.
- [ ] Veröffentlichung nach Nutzercheckpoint; anschließend iPhone-Abnahme.

## Nachweise / Wiederaufnahme

- Finale Suite: 387 Vitest +5 Runtime =392 bestanden; 13 Vitest-Dateien. Zwei neue Heute-Rücksprungfälle DE/EN zuerst am fehlenden Button fehlgeschlagen und danach bestanden. Bestehende Favoritenzähltests auf die neue sichtbare Beschriftung angepasst; erster Build fand zwei fehlerhafte Test-Optionsschlüssel, korrigiert. Finale Builds erfolgreich.
- npm run build: index-DHgv4Yub.js, index-CJ_t62AQ.css; 68 Module. Bekannter config.js-Hinweis unverändert. dotnet build backend/App.Api:0 Warnungen/Fehler.
- Browser kontrollierte Fünferreihen:320/375/393/430/768/1280px, keine abgeschnittenen oder überlappenden Spielerziele, kein horizontaler Überlauf in Spielfeld/Ersatzbank/Seite. Spieleraktionen mindestens44px hoch. Bei393px vorher348→480px Spielfeld und348→500px Ersatzbank; jetzt356→356px für beide.
- Tatsächliche Übersicht/API: Embleme laden; alle sechs Breiten ohne Zeilenüberlauf. Header mobil28 statt16px. Mobile Suche16px Eingabeschrift und44px Höhe; Hauptaktionen mindestens44px. Sprach-/Themewechsel, Heute-Rücksprung und Einstellungen-Fertig geprüft.
- Voll-/Kompakteinbettung bei320px:0px Außenpadding, kein App-Header, kein Seitenüberlauf. Querformat852×393: Ersatzbank erreichbar, Ausgang bleibt oben bei28px/44px Höhe.
- Unabhängige Prüfung des gesamten Produktionsdiffs: keine wesentlichen Befunde. Keine API-, Backend-, Dienst- oder Cacheänderung.
- Vorschau: C:/Users/amirh/Documents/ChatGPT/Live Scores/stage3-preview.jpg (links echte Übersichtsdaten, rechts kontrollierte Aufstellungs-Testdaten). Einzelbilder stage3-overview.jpg und stage3-lineup.jpg.
- Ruling: Mobile Regeln bis900px statt nur600px, damit iPhone-Querformat ebenfalls44px Ziele/16px Suche und den zusätzlichen oberen Abstand erhält. Kosten: Auch schmale Desktopfenster nutzen diese kompaktere Anordnung.
- Geräteabnahme offen: echte Safe Areas, Bildschirmtastatur, VoiceOver, vergrößerte Schrift. Browserbelege ersetzen diese Prüfung nicht.
- Noch keine Veröffentlichung von Etappe3. Nächster Schritt: konkrete Vorschau/Release-Checkpoint abnehmen, dann freigegebene Version veröffentlichen und CP3 auf dem iPhone prüfen.
