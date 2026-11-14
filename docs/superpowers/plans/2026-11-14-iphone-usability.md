# iPhone-Bedienbarkeit – Etappenplan für Live Scores

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the approved stages task-by-task. Steps use checkbox syntax for tracking. Execute only the next agreed stage, record evidence, then return to the user checkpoint.

**Goal:** Die vom Home-Bildschirm gestartete App auf dem iPhone 15 komfortabel bedienen und jede Unteransicht ohne Neustart verlassen können.
**Architecture:** React/TypeScript und die bestehende gemeinsame Oberfläche bleiben erhalten. Zuerst werden App-Rahmen und Detailfenster korrigiert; anschließend werden die bereits vorhandenen Rückwege vereinheitlicht und ihr Zustand erhalten.
**Tech Stack:** React 19, TypeScript, Vite, Vitest/Testing Library; .NET-Backend; GitHub Pages und vorhandene Render-API.
**Spec:** Die Abschnitte Zielbild, Grenzen und Navigation dieses Dokuments bilden den vorläufigen Entwurf. Der Nutzer hat den Plan und den Start von Etappe 1 mit „passt, go!“ freigegeben.
**Stand:** 14.11.2026, Etappe 1 lokal umgesetzt und technisch geprüft; iPhone-Abnahme offen.
**Repository:** https://github.com/amirhossin27-dev/live-scores
**Analysierte Basis:** main, Commit 905999b356228f6745cdd2f55fd66d326c7d43ad.
**Live-App:** https://amirhossin27-dev.github.io/live-scores/

## Status und Wiederaufnahme

| Checkpoint | Stand | Ergebnis |
| --- | --- | --- |
| CP0 – Bestandsaufnahme | Erledigt, iOS-Reproduktion offen | Quellcode und veröffentlichte App bei 393 × 852 geprüft |
| CP1 – Sichere Ränder und Ausgänge | Technisch geprüft; iPhone-Abnahme offen | Kopf und Schließen/Zurück auf dem iPhone erreichbar |
| CP2 – Durchgängige Navigation | Geplant | Jeder Weg führt kontrolliert eine Ebene zurück |
| CP3 – Mobile Bedienung | Vorschlag | Größere Ziele, übersichtliche Werkzeuge, klare Einstellungen |
| CP4 – Datenzustände und Veröffentlichung | Geplant | Verlässliche Rückmeldungen und dokumentierte iPhone-Abnahme |

**Aktueller nächster Schritt:** Etappe 1 zur Veröffentlichung abstimmen, danach auf dem iPhone 15 testen. Anschließend Etappe 2.
**Fortsetzungsauftrag:** „Lies diesen Etappenplan, prüfe den aktuellen Repository-Stand und fahre mit dem ersten freigegebenen, offenen Checkpoint fort.“
**Arbeitsverzeichnis:** C:/Users/amirh/Documents/ChatGPT/Live Scores
**Lokaler Stand:** Das Arbeitsverzeichnis war bei der Analyse leer. Noch kein Checkout, keine Codeänderungen, keine Builds oder Tests ausgeführt.
**Vor Fortsetzung:** Git-Status, Branch und neuen main-Stand prüfen; bestehende Änderungen bewahren. Den Plan in den künftigen Checkout übernehmen, nicht durch erneutes Klonen überschreiben.

Nach jeder Etappe ergänzen:
- Datum, Branch/Commit und tatsächlich geänderte Dateien.
- Automatische Prüfergebnisse und manuell geprüfte Wege.
- Vorschau-/Release-Adresse, soweit vorhanden.
- Ergebnis des iPhone-Tests und Rückmeldung des Nutzers.
- Offene Punkte, getroffene Entscheidungen und genau einen nächsten Arbeitsschritt.
- Status: geplant / in Arbeit / technisch geprüft / iPhone-Abnahme offen / abgenommen.

## CP0 – Erkenntnisse und Beleggrenzen

### Bestätigt im Code

1. index.html nutzt viewport-fit=cover und die transparente iOS-Statusleiste.
2. src/app.css verwendet mobil max(12px, env(safe-area-inset-top)). Das hält einen Mindestabstand ein, addiert aber keinen zusätzlichen Komfortabstand unter der Safe Area.
3. src/components/SideDrawer.css setzt den Detailhintergrund fest auf den ganzen Bildschirm. Der Kopf hat feste 20px Innenabstand und berücksichtigt keine Safe-Area-Werte.
4. SideDrawer.tsx bietet ein × zum vollständigen Schließen; die Fläche ist laut CSS 34 × 34px groß. Der Einstieg in MatchView erhält kein onBack.
5. TeamProfile, PlayerProfile und MatchLayers haben bereits teilweise beschriftete Rückwege. Diese liegen im scrollenden Inhalt. Navigation ist zwischen mehreren lokalen Zuständen verteilt.
6. MatchLayers bewahrt unterliegende Inhalte und deren Scrollposition bereits teilweise. Darauf aufbauen.
7. DatePicker hat keine ausdrückliche Abbrechen-/Schließen-Aktion. Einstellungen haben „Fertig“ am Ende und einen umschaltbaren Symbolknopf.
8. Der Kopf zeigt „Aufs iPhone“ auch in der bereits installierten App.
9. Kleine Ziele im Code: Favoritensterne, Tagespfeile, Tabellenform und Kalender. Die Oberfläche ist funktional reichhaltig, auf dem Telefon aber sehr dicht.
10. Fehler-, Leer- und Aktualisierungszustände existieren bereits. Diese verbessern, nicht parallel neu implementieren.

### Beobachtet an der veröffentlichten App

- Übersicht, Spiel und Teamansicht bei Browserfenster 393 × 852 geöffnet.
- Einstieg Übersicht → Spiel: nur × im Detailkopf, kein beschriftetes Zurück.
- Spiel → Team: „Zurück zum Spiel“ vorhanden; Rückkehr funktioniert im Prüf-Browser.
- × bringt die Übersicht zurück.
- Der Nutzer bestätigt: Die Probleme treten in der App vom Home-Bildschirm auf.

**Grenze:** Kein Zugriff auf ein echtes iPhone oder iOS-Simulator. Die genaue Überdeckung des × durch Statusleiste/Dynamic Island ist eine durch Code und Nutzerbericht gut begründete Ursache, noch kein direkt reproduzierter iOS-Befund. Browserbreite allein prüft weder iOS-Safe-Area-Werte noch Standalone-Verhalten.

## Zielbild und Vorgehenswahl

**Empfehlung:** Bestehende App in getrennten, prüfbaren Etappen verbessern.
- Nur zusätzliche Ränder und ein größeres × wären günstig, lösen aber die uneinheitlichen Rückwege nicht vollständig.
- Etappenweise Verbesserung behebt die beiden konkreten Probleme zuerst und lässt danach Platz für Nutzerfeedback.
- Ein kompletter Umbau mit neuer Navigation oder Frameworkwechsel wäre deutlich größer und ist durch die bisherigen Befunde nicht erforderlich.

Der Nutzer hat das etappenweise Vorgehen bestätigt.

**Zielverhalten:**
- Bedienelemente liegen in Hoch- und Querformat außerhalb der Systembereiche, mit zusätzlichem sichtbarem Abstand.
- Jede Detailansicht hat einen beschrifteten, beim Scrollen erreichbaren Rückweg.
- „Zurück“ führt genau eine Ebene zurück. „Zur Übersicht“ schließt die gesamte Detailkette.
- Laden, fehlende Daten und Fehler dürfen den Rückweg niemals blockieren.
- Datum, Filter, Suchtext, relevante Reiter und Scrollposition bleiben bei der Rückkehr erhalten.
- Bestehende Gestaltung und Funktionsumfang bleiben Ausgangspunkt.

## Grenzen und Projektregeln

- Standalone-, vollständige Dashboard-Einbettung und Kompaktmodus erhalten.
- Keine Zugangsdaten ins Frontend oder in public/config.js.
- Keine kostenpflichtigen Dienste oder Änderungen am Render-Free-Tarif.
- Live-Daten niemals im Service Worker speichern; reale API-Ausfälle sichtbar lassen.
- Deutsch und Englisch sowie helles, dunkles und automatisches Design berücksichtigen.
- Vor Abschluss einer Umsetzung: npm test, npm run build und dotnet build backend/App.Api.
- Kein automatisches Veröffentlichen während der Planphase. Änderungen an main lösen laut README die Veröffentlichung aus.
- Keine Neuinstallation der iPhone-App als Standardlösung verlangen; dabei könnten lokale Einstellungen verloren gehen.
- Neue Hauptnavigation am unteren Rand, Konten, Synchronisation, Push-Mitteilungen und neue Datenanbieter sind nicht Teil dieses Plans.

## Navigation: vollständige Prüfliste

| Einstieg / Ansicht | Erwartete Aktion |
| --- | --- |
| Übersicht → Spiel | „Zurück“ zur gleichen Ergebnisliste mit Datum, Filter und Position |
| Übersicht → Wettbewerb | „Zurück“ zur gleichen Ergebnisliste |
| Spiel → Team/Nationalteam → Spieler/Trainer | Jeweils genau eine Ebene zurück |
| Tabelle/Turnierbaum/Top Scorers → Team/Spieler | Zur aufrufenden Ansicht mit Reiter und Auswahl zurück |
| Team → anderes Team / Transfer → Spieler oder Verein | Tatsächlichen Besuchspfad rückwärts durchlaufen |
| Team/Spieler/Tabellenform → weiteres Spiel | Spiel schließen und Ursprung unverändert zeigen |
| Suche → Verein/Nationalteam/Spieler/Trainer → weitere Details | Schrittweise zurück; am Ursprung Suchbegriff und Ergebnisfilter behalten |
| Einstellungen | Sichtbares „Fertig“ bzw. „Zurück“ ohne bis ans Ende scrollen zu müssen |
| Datumsauswahl | „Abbrechen“ schließt ohne Datumsänderung |
| Installationshilfe | Klar sichtbares „Schließen“ |
| Alle Lade-/Fehler-/Leerzustände | Derselbe unabhängige Rückweg bleibt erreichbar |
| Externe Nachrichten-/Übertragungslinks | Separat öffnen, App-Zustand bei Rückkehr erhalten |

## Etappe 1 – Sichere Ränder und sofort erreichbare Ausgänge

**Zweck:** Die beiden akuten Bedienprobleme zunächst am App-Rahmen beheben.
**Betroffene Dateien:** src/app.css, src/App.tsx, src/components/SideDrawer.tsx, src/components/SideDrawer.css; Aufrufer in MatchDetails.tsx, CompetitionPanel.tsx, SportsSearch.tsx. index.html nur ändern, falls die Geräteprüfung das erfordert.

- [x] Arbeitskopie auf eigenem Branch vorbereiten, Ausgangsstand und vorhandene Tests erfassen.
- [x] Im Hauptkopf und in Detailfenstern Safe Area plus zusätzlichen Komfortabstand einführen; Entwurfswert oben 16px zusätzlich, unten 12px. Querformat berücksichtigt links/rechts ebenfalls Systemränder.
- [x] Detailkopf unabhängig vom Inhalt scrollbar halten; kleine Bildschirmhöhe und eingeblendete Tastatur prüfen.
- [x] Schließen-Aktion auf mindestens 44 × 44 CSS-Pixel vergrößern und mobil beschriften. An den Einstiegen zur Übersicht einen klaren Rückweg anbieten.
- [x] Vorhandene tieferliegende Rückwege bis Etappe 2 erhalten; vollständiges Schließen nicht fälschlich als „eine Ebene zurück“ beschriften.
- [x] Bestehende Einbettungen auf unerwünschte zusätzliche Ränder prüfen.
- [x] Gezielte Regressionstests in neuer src/components/SideDrawer.test.tsx und vorhandenen SportsWidget.test.tsx / SportsSearch.test.tsx ergänzen: Ausgang im Lade- und Fehlerfall, Schließen führt zur Ursprungsliste.
- [x] Automatische Projektprüfungen und Browserprüfung ausführen.
- [ ] Echte Safe Areas, Tastatur und größere Schrift auf dem iPhone prüfen.

**CP1 – Gemeinsame Abnahme:** Vom Home-Bildschirm starten, Spiel und Liga öffnen, lange Inhalte scrollen, zurückkehren; Hoch-/Querformat. Kopf und Ausgänge sind erreichbar, keine Überdeckung oder horizontales Scrollen der gesamten Seite.
**Nächster Schritt:** Erst nach Rückmeldung zu Abstand und Erreichbarkeit Etappe 2 abschließen.

## Etappe 2 – Einheitliche Rückwege in jeder Tiefe

**Zweck:** Verlässliche Navigation durch die gesamte App, einschließlich seltener Pfade.
**Betroffene Dateien:** SideDrawer.tsx; MatchDetails.tsx / MatchLayers; TeamProfile.tsx; PlayerProfile.tsx; CompetitionPanel.tsx; SportsSearch.tsx; Standings.tsx, TopScorers.tsx und TableForm.tsx als Navigationsaufrufer; DatePicker.tsx; SportsWidget.tsx; bei Bedarf eine kleine gemeinsame Navigationskomponente im bestehenden Komponentenbereich.

- [ ] Die Prüfliste oben vollständig auf konkrete Aufrufer abbilden.
- [ ] Einheitlichen Vertrag zwischen aktiver Detailansicht und Kopf umsetzen: Zielbeschriftung, eine Ebene zurück, gesamte Kette schließen. Die aktuelle Ansicht bestimmt den Rückschritt; keine Suche nach „irgendeinem“ Zurück-Button im DOM.
- [ ] Bestehendes MatchLayers-Verhalten und lokale Historien zusammenführen oder anschließen; Zustände unterliegender Ansichten erhalten. Technische Wahl anhand der vollständigen Aufruferliste treffen, ohne einen Frameworkwechsel einzuführen.
- [ ] Beim Öffnen aktuelle Scrollposition sichern, neue Ansicht oben beginnen lassen; bei Zurück Position und gewählten Reiter wiederherstellen.
- [ ] Fokus ins aktive Fenster setzen, Fokus im modalen Fenster halten, Hintergrundbedienung sperren; nach Schließen Fokus zum Auslöser zurückgeben.
- [ ] Einstellungen und Kalender mit ausdrücklich erreichbarem Ausgang ergänzen; Installationshilfe einbeziehen.
- [ ] Späte Datenantworten dürfen geschlossene Ansichten nicht erneut öffnen. Rückwege auch bei ausstehender/fehlgeschlagener Anfrage testen.
- [ ] Navigationstests mit kontrollierten Daten ergänzen: Spiel → Team → Spieler → Zurück → Team → Zurück → Spiel → Übersicht; Wettbewerb → Team → Spiel; Suche → Profil → Team → zurück zur Suche; Kalender abbrechen; Einstellungen verlassen.
- [ ] Wiederholtes Öffnen/Schließen, schnelle Rückschritte, unbekannte Teams/Spieler und keine Ergebnisse prüfen.
- [ ] Projektprüfungen und mobile Sichtprüfung ausführen.

**CP2 – Gemeinsame Abnahme:** Alle Pfade der Navigationsliste funktionieren ohne App-Neustart. Zurück springt nie unbeabsichtigt mehrere Ebenen; Filter, Datum, Suchtext und Position bleiben erhalten.
**Abgrenzung:** Ein eigener In-App-Rückweg ist verbindlich. Browser-History/Swipe-Gesten sind keine Voraussetzung und dürfen diesen nicht ersetzen. Falls History-Anbindung später ergänzt wird, muss sie getrennt gegen Verlassen der App und doppelte Rückschritte getestet werden.

## Etappe 3 – Spürbar angenehmere mobile Bedienung

**Zweck:** Weniger Fehlklicks und schneller zu den relevanten Ergebnissen.
**Betroffene Dateien:** App.tsx, app.css, SportsWidget.tsx, sports.css, SportsSearch.tsx / sportsSearch.css, DatePicker.tsx / DatePicker.css, SportsTabs.tsx sowie betroffene Profil-Styles.

Vor der Umsetzung dieser Etappe eine kompakte Vorher-/Nachher-Vorschau zur gemeinsamen Auswahl erstellen.

- [ ] „Aufs iPhone“ in bereits installierter Standalone-App ausblenden; Hilfe über Einstellungen erreichbar lassen. Desktop und Safari nicht anhand der Bildschirmbreite allein als installierte App behandeln.
- [ ] Sprache und Darstellung eindeutig bedienbar machen; „Automatisch / Hell / Dunkel“ als verständliche Auswahl vorschlagen.
- [ ] Suchfeld auf Mobilgeräten mit genügend Platz platzieren; sinnvolle Eingabeschrift und Verhalten mit iPhone-Tastatur prüfen.
- [ ] Hauptfilter „Alle“, „Live“, „Favoriten“ sichtbar beschriften; Zähler verständlich halten.
- [ ] Primäre Touch-Flächen auf mindestens 44 × 44 CSS-Pixel bringen, ohne dass Favoritenstern und Spielöffnung sich überlagern.
- [ ] Lange Mannschaftsnamen und dichte Detailreiter lesbarer darstellen; Tabellen dürfen gezielt seitlich scrollen, die ganze Seite nicht.
- [ ] Sichtbaren Sprung zu „Heute“ ergänzen; automatischen Wechsel zum nächsten Spieltag entweder klar erklären oder nach gemeinsamem Entscheid deaktivieren.
- [ ] Einstellungen in sinnvolle Gruppen gliedern, Abschlussaktion oben erreichbar halten; bestehende Wettbewerbsreihenfolge/Favoriten erhalten.
- [ ] VoiceOver-Beschriftungen, Fokus, Kontrast und vergrößerte Schrift kontrollieren.
- [ ] Vorhandene Interaktionstests gezielt erweitern und Projektprüfungen ausführen.

**CP3 – Gemeinsame Abnahme:** Auf dem iPhone ein Spiel finden, favorisieren, Datum ändern, zu heute zurückkehren, Teamdetails lesen und Einstellungen verlassen. Entscheidend sind Verständlichkeit und Treffgenauigkeit, nicht nur das Aussehen.
**Priorisierung:** Neue dauerhafte untere Navigation nur aufnehmen, wenn die Vorschau einen konkreten Nutzen zeigt; derzeit zurückgestellt.

## Etappe 4 – Datenzustände, Gesamttest und Veröffentlichung

**Zweck:** Auch bei langsamer Verbindung verständlich bleiben und Verbesserungen zuverlässig aufs iPhone bringen.
**Betroffene Dateien nach Bedarf:** SportsWidget.tsx, sportsHooks.ts, SportsSearch.tsx, App.tsx, main.tsx, vorhandene Tests, README.md. vite.config.ts nur bei einem nachgewiesenen Update-Problem ändern.

- [ ] Vorhandene Zustände vereinheitlichen: lädt, keine Spiele, offline, Teilfehler, alte Daten nach Aktualisierungsfehler.
- [ ] Bereits geladene Ergebnisse sichtbar behalten und mit Aktualisierungszeit sowie verständlicher Warnung kennzeichnen.
- [ ] „Erneut versuchen“ und manuelles Aktualisieren dort ergänzen, wo sie fehlen; Rückweg unabhängig vom Netz lassen.
- [ ] Standalone, Safari, Desktop sowie volle und kompakte Dashboard-Einbettung testen.
- [ ] Deutsch/Englisch, Hell/Dunkel/Automatisch, Hoch-/Querformat, größere Schrift, Tastatur und Offline-/Wiederverbindungsfall prüfen.
- [ ] npm test, npm run build und dotnet build backend/App.Api erfolgreich ausführen; Ergebnisse und Commit im Plan notieren.
- [ ] Änderungen vor Veröffentlichung konkret vorführen und gemeinsamen Release-Checkpoint abwarten.
- [ ] Nach vereinbarter Veröffentlichung GitHub-Actions-Ergebnis und Live-Version prüfen; neu gestartete Home-Bildschirm-App auf aktuelle Oberfläche kontrollieren.
- [ ] Favoriten und Einstellungen dürfen beim Update nicht zurückgesetzt werden; keine Live-Daten in Offline-Cache aufnehmen.
- [ ] Frühere funktionierende Version als Rückfallpunkt dokumentieren.

**CP4 – Abschluss:** Nutzer bestätigt die zwei ursprünglichen Probleme auf seinem iPhone 15 als behoben; alle vereinbarten Navigationswege sind abgenommen und die geprüfte Version ist veröffentlicht.

## Review-Fokus: fünf kritische Fälle

1. iOS-Standalone mit Systemrändern – Layoutprüfung in Etappe 1 auf echtem Gerät.
2. Tief verschachtelte Navigation – Zustandserhaltung und genau ein Rückschritt in Etappe 2.
3. Langsame/fehlgeschlagene Antworten beim Zurückgehen – Tests in Etappe 2 und 4.
4. iPhone-Tastatur/Querformat/große Schrift – Ausgänge weiterhin erreichbar in Etappe 1 und 3.
5. Dashboard und bestehende Installation nach Update – Modi und lokaler Datenbestand in Etappe 4.

## Quellen

- Projektregeln: https://github.com/amirhossin27-dev/live-scores/blob/main/AGENTS.md
- App-Rahmen: https://github.com/amirhossin27-dev/live-scores/blob/main/src/app.css
- Detailfenster: https://github.com/amirhossin27-dev/live-scores/blob/main/src/components/SideDrawer.tsx
- Detail-Layout: https://github.com/amirhossin27-dev/live-scores/blob/main/src/components/SideDrawer.css
- Navigation: https://github.com/amirhossin27-dev/live-scores/blob/main/src/features/overview/MatchDetails.tsx
- Safe-Area-Grundlagen: https://webkit.org/blog/7929/designing-websites-for-iphone-x/

## Arbeitsstand Etappe 1 – 14.11.2026

- Checkout: C:/Users/amirh/Documents/ChatGPT/Live Scores/app
- Branch: fix/iphone-stage-1, Basis 905999b.
- Sichtbare Ausgänge in Spiel, Wettbewerb und Suchprofilen; 44px Mindesthöhe.
- Systemabstände mit zusätzlichem Innenabstand; Detailkopf bleibt auch im kurzen Querformat außerhalb des scrollenden Inhalts.
- Baseline 358 Vitest + 5 Runtime-Tests bestanden. Elf neue Regressionstests zuerst fehlgeschlagen, danach bestanden; Endstand 369 Vitest + 5 Runtime = 374 bestanden.
- npm run build erfolgreich. Hinweis: config.js bleibt absichtlich extern und wird nicht gebündelt.
- dotnet build backend/App.Api erfolgreich, 0 Warnungen/Fehler.
- Browser: 393x852 und 852x393, Ausgang 44px hoch, Rückkehr zur Übersicht funktioniert; kein horizontaler Seitenüberlauf. Beide Embed-Modi ohne zusätzlichen Außenabstand (0px).
- Kein echtes iOS-Gerät verfügbar: Safe-Area-Wirkung, Bildschirmtastatur und vergrößerte Schrift noch abnehmen.
- Separate Review wegen Nutzungslimit ausgefallen; eigener Diff-Review erfolgt. Keine unabhängige Review behaupten.
- Entscheidung: frischer separater Checkout statt zusätzlichem Worktree; gesamte Detailkette ausdrücklich „Zur Übersicht“/„Zu den Suchergebnissen“, Einzelschritte erst Etappe 2.
- Noch nicht veröffentlicht. Nächster Schritt: Veröffentlichung dieser Etappe vereinbaren, dann iPhone-Abnahme CP1.
