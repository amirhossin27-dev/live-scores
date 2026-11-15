# iPhone-Bedienbarkeit – Etappenplan für Live Scores

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the approved stages task-by-task. Steps use checkbox syntax for tracking. Execute only the next agreed stage, record evidence, then return to the user checkpoint.

**Goal:** Die vom Home-Bildschirm gestartete App auf dem iPhone 15 komfortabel bedienen und jede Unteransicht ohne Neustart verlassen können.
**Architecture:** React/TypeScript und die bestehende gemeinsame Oberfläche bleiben erhalten. Zuerst werden App-Rahmen und Detailfenster korrigiert; anschließend werden die bereits vorhandenen Rückwege vereinheitlicht und ihr Zustand erhalten.
**Tech Stack:** React 19, TypeScript, Vite, Vitest/Testing Library; .NET-Backend; GitHub Pages und vorhandene Render-API.
**Spec:** Die Abschnitte Zielbild, Grenzen und Navigation dieses Dokuments bilden den vorläufigen Entwurf. Der Nutzer hat den Plan und den Start von Etappe 1 mit „passt, go!“ freigegeben.
**Stand:** 15.11.2026, Etappen1–3 veröffentlicht; Nutzer bestätigt deutliche Verbesserung. Etappe4 mit Ergebnisspeicher veröffentlicht und geprüft; CP4-Geräteabnahme offen.
**Repository:** https://github.com/amirhossin27-dev/live-scores
**Analysierte Basis:** main, Commit 905999b356228f6745cdd2f55fd66d326c7d43ad.
**Live-App:** https://amirhossin27-dev.github.io/live-scores/

## Status und Wiederaufnahme

| Checkpoint | Stand | Ergebnis |
| --- | --- | --- |
| CP0 – Bestandsaufnahme | Erledigt, iOS-Reproduktion offen | Quellcode und veröffentlichte App bei 393 × 852 geprüft |
| CP1 – Sichere Ränder und Ausgänge | Veröffentlicht; Nutzer bestätigt Funktion | Zusätzliche Gerätefälle wie Tastatur/große Schrift weiter offen |
| CP2 – Durchgängige Navigation | Veröffentlicht; Nutzer bestätigt Verbesserung | Zusatzwunsch Header/kompaktes Layout in Etappe3 aufgenommen |
| CP3 – Mobile Bedienung | Veröffentlicht; Nutzer bestätigt „viel besser“ | Erweiterte iOS-Fälle wie VoiceOver/große Schrift weiter offen |
| CP4 – Datenzustände und Veröffentlichung | Veröffentlicht; Geräteabnahme offen | Sofortige gespeicherte Ergebnisse, Hintergrundaktualisierung; Live-Version b130cf6 |

**Aktueller nächster Schritt:** Veröffentlichte Etappe4 auf dem iPhone einmal erfolgreich Daten laden lassen, App vollständig schließen/öffnen und sofort sichtbaren gespeicherten Stand plus Hintergrundaktualisierung prüfen. Danach CP4-Endabnahme festhalten.
**Fortsetzungsauftrag:** „Lies diesen Etappenplan, prüfe den aktuellen Repository-Stand und fahre mit dem ersten freigegebenen, offenen Checkpoint fort.“
**Arbeitsverzeichnis:** C:/Users/amirh/Documents/ChatGPT/Live Scores
**Lokaler Stand:** Checkout unter app/, Branch fix/iphone-stage-4. Implementierungscommit793ebc1700df159cd951c9ec82de8f2e9d4fee49. Etappe4 veröffentlicht als b130cf6e77cb1a3d7a967100d79237c0b77abee7. Alle Projektprüfungen und Veröffentlichung erfolgreich, Details unten.
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
**Rückmeldung:** Nutzer bestätigte Etappe 1 und gab Etappe 2 frei. Spezifische iOS-Fälle für Tastatur und große Schrift bleiben Teil der weiteren Geräteabnahme.

## Etappe 2 – Einheitliche Rückwege in jeder Tiefe

**Zweck:** Verlässliche Navigation durch die gesamte App, einschließlich seltener Pfade.
**Betroffene Dateien:** SideDrawer.tsx; MatchDetails.tsx / MatchLayers; TeamProfile.tsx; PlayerProfile.tsx; CompetitionPanel.tsx; SportsSearch.tsx; Standings.tsx, TopScorers.tsx und TableForm.tsx als Navigationsaufrufer; DatePicker.tsx; SportsWidget.tsx; bei Bedarf eine kleine gemeinsame Navigationskomponente im bestehenden Komponentenbereich.

- [x] Die Prüfliste oben vollständig auf konkrete Aufrufer abbilden.
- [x] Einheitlichen Vertrag zwischen aktiver Detailansicht und Kopf umsetzen: Zielbeschriftung, eine Ebene zurück, gesamte Kette schließen. Die aktuelle Ansicht bestimmt den Rückschritt; keine Suche nach „irgendeinem“ Zurück-Button im DOM.
- [x] Bestehendes MatchLayers-Verhalten und lokale Historien zusammenführen oder anschließen; Zustände unterliegender Ansichten erhalten. Technische Wahl anhand der vollständigen Aufruferliste treffen, ohne einen Frameworkwechsel einzuführen.
- [x] Beim Öffnen aktuelle Scrollposition sichern, neue Ansicht oben beginnen lassen; bei Zurück Position und gewählten Reiter wiederherstellen.
- [x] Fokus ins aktive Fenster setzen, Fokus im modalen Fenster halten, Hintergrundbedienung sperren; nach Schließen Fokus zum Auslöser zurückgeben.
- [x] Einstellungen und Kalender mit ausdrücklich erreichbarem Ausgang ergänzen; Installationshilfe einbeziehen.
- [x] Späte Datenantworten dürfen geschlossene Ansichten nicht erneut öffnen. Rückwege auch bei ausstehender/fehlgeschlagener Anfrage testen.
- [x] Navigationstests mit kontrollierten Daten ergänzen: Spiel → Team → Spieler → Zurück → Team → Zurück → Spiel → Übersicht; Wettbewerb → Team → Spiel; Suche → Profil → Team → zurück zur Suche; Kalender abbrechen; Einstellungen verlassen.
- [x] Wiederholtes Öffnen/Schließen, schnelle Rückschritte, unbekannte Teams/Spieler und keine Ergebnisse prüfen.
- [x] Projektprüfungen und mobile Sichtprüfung ausführen.

**CP2 – Gemeinsame Abnahme:** Alle Pfade der Navigationsliste funktionieren ohne App-Neustart. Zurück springt nie unbeabsichtigt mehrere Ebenen; Filter, Datum, Suchtext und Position bleiben erhalten.
**Abgrenzung:** Ein eigener In-App-Rückweg ist verbindlich. Browser-History/Swipe-Gesten sind keine Voraussetzung und dürfen diesen nicht ersetzen. Falls History-Anbindung später ergänzt wird, muss sie getrennt gegen Verlassen der App und doppelte Rückschritte getestet werden.

## Etappe 3 – Spürbar angenehmere mobile Bedienung

**Zweck:** Weniger Fehlklicks und schneller zu den relevanten Ergebnissen.
**Betroffene Dateien:** App.tsx, app.css, SportsWidget.tsx, sports.css, SportsSearch.tsx / sportsSearch.css, DatePicker.tsx / DatePicker.css, SportsTabs.tsx sowie betroffene Profil-Styles.

Nutzer hat am15.11.2026 die kompakte Richtung mit konkreten Ergänzungen freigegeben. Die lokale Vorschau wird vor der Veröffentlichung am Checkpoint abgenommen; Umsetzungsplan:2026-11-15-iphone-stage-3.md.

- [x] Nutzeränderung: „Aufs iPhone“ vollständig samt zugehörigem Zustand, Hilfe-Markup und Styles aus dem App-Code entfernen; auch beide Footerhinweise in DE/EN entfernen.
- [x] Sprache und Darstellung eindeutig bedienbar machen; „Automatisch / Hell / Dunkel“ als verständliche Auswahl vorschlagen.
- [x] Suchfeld auf Mobilgeräten mit genügend Platz platzieren; sinnvolle Eingabeschrift und Verhalten mit iPhone-Tastatur prüfen.
- [x] Hauptfilter „Alle“, „Live“, „Favoriten“ sichtbar beschriften; Zähler verständlich halten.
- [x] Primäre Touch-Flächen auf mindestens 44 × 44 CSS-Pixel bringen, ohne dass Favoritenstern und Spielöffnung sich überlagern.
- [x] Lange Mannschaftsnamen und dichte Detailreiter lesbarer darstellen; Tabellen dürfen gezielt seitlich scrollen, die ganze Seite nicht.
- [x] Sichtbaren Sprung zu „Heute“ ergänzen; automatischen Wechsel zum nächsten Spieltag entweder klar erklären oder nach gemeinsamem Entscheid deaktivieren.
- [x] Einstellungen in sinnvolle Gruppen gliedern, Abschlussaktion oben erreichbar halten; bestehende Wettbewerbsreihenfolge/Favoriten erhalten.
- [ ] Echte iOS-Prüfung: VoiceOver und vergrößerte Schrift. Browser-Fokus und Darstellung in Hell/Dunkel kontrolliert.
- [x] Vorhandene Interaktionstests gezielt erweitern und Projektprüfungen ausführen.

**CP3 – Gemeinsame Abnahme:** Auf dem iPhone ein Spiel finden, favorisieren, Datum ändern, zu heute zurückkehren, Teamdetails lesen und Einstellungen verlassen. Entscheidend sind Verständlichkeit und Treffgenauigkeit, nicht nur das Aussehen.
**Priorisierung:** Neue dauerhafte untere Navigation nur aufnehmen, wenn die Vorschau einen konkreten Nutzen zeigt; derzeit zurückgestellt.

## Etappe 4 – Datenzustände, Gesamttest und Veröffentlichung

**Zweck:** Auch bei langsamer Verbindung verständlich bleiben und Verbesserungen zuverlässig aufs iPhone bringen.
**Betroffene Dateien nach Bedarf:** SportsWidget.tsx, sportsHooks.ts, SportsSearch.tsx, App.tsx, main.tsx, vorhandene Tests, README.md. vite.config.ts nur bei einem nachgewiesenen Update-Problem ändern.

- [x] Übersichtszustände für Laden, keine Spiele, offline, Teilfehler und gespeicherte Daten nach Aktualisierungsfehler vereinheitlicht.
- [x] Bereits geladene Ergebnisse auch nach App-Neustart begrenzt auf dem Gerät erhalten, Abrufdatum/Zeit und Warnungen anzeigen; ursprünglicher Zeitpunkt bleibt erhalten.
- [x] Manuelles Aktualisieren, Wiederholen bei vorhandenen Daten und Online-/Vordergrundaktualisierung ergänzen; Rückwege bleiben unabhängig vom Netz.
- [x] Chromium-Browser: Standalone-Oberfläche, Desktop sowie volle/kompakte Einbettung mit gespeicherten Daten geprüft.
- [ ] Echtes iPhone/Safari: gespeicherte Daten und Online-/Offline-Rückkehr abnehmen.
- [x] DE/EN, vorhandene Themes/responsive Struktur, Offline ohne/mit Snapshot, Wiederverbindung und lange Abrufe mit kontrollierten Daten geprüft.
- [ ] Erweiterte Gerätefälle: echte iOS-Systemränder, VoiceOver, größere Schrift und Bildschirmtastatur abschließend prüfen.
- [x] npm test, npm run build und dotnet build backend/App.Api erfolgreich ausführen; Ergebnisse und Commit unten notiert.
- [x] Änderungen konkret vorgeführt; Nutzer hat Veröffentlichung von Etappe4 ausdrücklich mit „ja“ freigegeben.
- [x] GitHub-Actions-Ergebnis und Live-Version nach Veröffentlichung erfolgreich geprüft.
- [ ] Neu gestartete Home-Bildschirm-App und gespeicherte Ergebnisse auf dem iPhone abnehmen.
- [x] Favoriten/Einstellungen erhalten; ausdrücklicher Nutzerauftrag erlaubt jetzt begrenzte Ergebnissnapshots mit Zeitstempel. Keine Live-Daten in den Service Worker aufnehmen.
- [x] Letzte veröffentlichte Etappe3 als Rückfallpunkt dokumentiert:21ea9182a47057173797c6da00d5ef8aad74a363.

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
- Veröffentlicht am 14.11.2026 nach ausdrücklicher Nutzerfreigabe. Commit a5c44ec28c568e10f4d66c9b0aba7965d09d1927; GitHub Actions Run 43626340358 erfolgreich. Live-HTML referenziert die geprüften Assets, Service-Worker-Kennung entspricht diesem Commit. Nächster Schritt: iPhone-Abnahme CP1.

## Arbeitsstand Etappe 2 – 15.11.2026

- Nutzer hat Etappe 1 bestätigt und Etappe 2 mit „passt macht weiter mit etappe 2“ freigegeben.
- Branch: fix/iphone-stage-2. Basis: a5c44ec28c568e10f4d66c9b0aba7965d09d1927. Implementierungscommit: 5ca09f6f831f4b106d0b9d56d482f21fdd338cd9.
- Ein gemeinsamer DetailStack erhält besuchte Ansichten, Reiter, Saison, Turnierrunde und Scrollposition. Jeder Rückschritt folgt dem tatsächlichen Besuchspfad. Der feste Kopf bietet zusätzlich den vollständigen Ausgang.
- Geänderte Bereiche: neue DetailNavigation/useModal/NationalTeamProfile; SideDrawer, MatchDetails, TeamProfile, PlayerProfile, CompetitionPanel, SportsSearch, TopScorers und sportsMatchNav; TableForm/DatePicker; Einstellungen/Installationshilfe in SportsWidget/App; zugehörige Styles und Regressionstests.
- Fokus bleibt im aktiven Fenster; der Hintergrund ist gesperrt. Nach Schließen geht der Fokus zum Auslöser zurück. Verschachtelte Kalender-/Form-Portale gehören zum selben Modalmodell. Portal-Köpfe übernehmen die Safe-Area-Werte des Ursprungs einschließlich 0px in Einbettungen.
- Späte Antworten aus geschlossenen oder verdeckten Ansichten können keine neue aktive Detailansicht öffnen. Match- und Nationalteamauflösung werden beim Verlassen abgebrochen.
- Finale Prüfung nach letzter Codeänderung am 15.11.2026, 00:38:54: npm test erfolgreich, 385 Vitest + 5 Runtime = 390 Tests in 13 Vitest-Dateien. Etappe-1-Basis 374, somit 16 zusätzliche Tests.
- npm run build erfolgreich; index-DwFDAKPG.js, index-Ls9oaT_0.css. Bekannter Hinweis zum absichtlich externen config.js unverändert. dotnet build backend/App.Api erfolgreich, 0 Warnungen/Fehler. git diff --check sauber.
- Unabhängige Code- und Planprüfung abgeschlossen. Ein Befund zur möglichen Wiederöffnung der Tabellenform bei Fokusrückgabe wurde abgesichert und nachgeprüft; keine wesentlichen offenen Befunde. Die zusätzlichen Fokus-Tests bestanden auch vor dieser defensiven Absicherung: dafür wird kein reproduzierter Vorher-Fehlschlag behauptet.
- Browser mit echten API-Daten bei 393×852: Spanien–England → Spanien/Kader → David Raya/Karriere → Arsenal → zurück zu David Raya/Karriere → Spanien/Kader → Spiel → Übersicht. Reiter bleiben erhalten und Fokus kehrt zum ursprünglichen Spiel zurück. Kalender-Abbrechen und Einstellungen-Fertig geprüft.
- Vorschau: C:/Users/amirh/Documents/ChatGPT/Live Scores/stage2-preview.jpg. Ausführlicher Bericht/Protokolle lokal unter app/.superpowers/sdd/2026-11-14-iphone-usability/.
- Etappe 2 nach Nutzerfreigabe „mach das“ am 15.11.2026 veröffentlicht, Details unten. Keine Änderung an Backend, API-Konfiguration oder Service-Worker-Datenstrategie. Rückfallpunkt bleibt veröffentlichte Etappe 1 a5c44ec.
- Entscheidung: besuchte Komponenten bis zum Rückschritt oder Gesamtausstieg gemountet lassen; etwas mehr Speicher während langer Detailketten. Browser-History/Swipe bleibt ausdrücklich außerhalb des Umfangs.

### Zuordnung der Navigationsprüfliste

| Pfad | Konkreter Aufrufer / Umsetzung |
| --- | --- |
| Übersicht → Spiel/Wettbewerb | SportsWidget → MatchDetails/CompetitionPanel → gemeinsamer DetailStack; ursprüngliche Übersicht bleibt bestehen |
| Spiel → Team/Spieler/Trainer | MatchContent, LineupPitch und Ereignisse öffnen TeamProfile/PlayerProfile im gleichen Besuchspfad |
| Nationalteamauflösung | NationalTeamProfile ist eine eigene verlassbare Ansicht einschließlich Laden/Fehler; Abbruch beim Zurückgehen |
| Tabelle/Turnierbaum → Team | Standings-Callbacks in MatchContent/CompetitionContent; Saison, Runde und Tabelle bleiben gemountet |
| Top Scorers → Team/Spieler/Nation | ScorerTable nutzt den aktuellen Navigationskontext; Saison und Sortierung bleiben erhalten |
| Team → anderes Team/Transfers/Kader | TeamContent, Transfers und Squad öffnen Profile über denselben Stack |
| Spieler/Trainer → Verein/Nation | PlayerProfile öffnet mit dem eigenen aktiven Kontext; Karriere/Titel und Gegnerlinks führen tatsächlich zum Profil zurück |
| Team/Spieler/Tabellenform → Spiel | useOpenMatch bindet die Spielöffnung an den besuchten Ursprung; ResolvedMatch lädt innerhalb seiner eigenen Lebensdauer |
| Suche → alle vier Profilarten | SearchRoot mit gleichem DetailStack; Gesamtausstieg erhält Suchtext/Ergebnisfilter und stellt Fokus wieder her |
| Einstellungen | SportsSettings: beschriftetes, oben erreichbares Fertig |
| Kalender | DatePicker: Abbrechen ohne Datumsänderung und Rückgabe des Fokus |
| Installationshilfe | App: ausdrücklich erreichbares Schließen/Close |
| Tabellenform | FormCell: Schließen und eigener Escape-/Fokuszyklus; darunterliegendes Fenster bleibt geöffnet |
| Lade-/Fehler-/Leerzustände | Fester Detailkopf unabhängig vom Dateninhalt; wiederholtes Öffnen/Schließen und verspätete Antworten getestet |
| Externe Nachrichten/Übertragung | Nachrichten bleiben separate Links mit noopener; Übertragungen enthalten aktuell nur Sendertext |

**CP2 bleibt offen:** Die jetzt veröffentlichte App vom Home-Bildschirm auf dem iPhone 15 testen: Spiel → Team → Spieler → Verein und schrittweise zurück, Suche → Trainer → Verein → Suche, Kalender abbrechen, Einstellungen verlassen. Reiter, Datum, Suchbegriff und Scrollposition müssen erhalten bleiben. Hoch-/Querformat, Bildschirmtastatur und größere Schrift auf echtem iOS sind durch den Browsernachweis nicht abgedeckt.

**Genau ein nächster Arbeitsschritt:** Den obigen Geräte-Checkpoint auf dem iPhone durchführen und Rückmeldung festhalten. Erst nach Rückmeldung die Vorschau für Etappe 3 erstellen.

## Veröffentlichung Etappe 2 – 15.11.2026

- Nutzerfreigabe: „mach das“ auf die konkrete Frage nach Veröffentlichung der geprüften Etappe 2.
- Normaler Fast-Forward-Push nach main; kein Force-Push. Veröffentlichter Commit: 6622942aa3b2587e6c4fe2b497452bf15e7abbfa (Implementierung 5ca09f6 plus Checkpoint-Dokumentation).
- GitHub Actions: https://github.com/amirhossin27-dev/live-scores/actions/runs/43696597809 – completed/success. Erneute npm-Tests, Frontend-Build und Backend-Release-Build sowie Pages-Deployment erfolgreich.
- Live geprüft: https://amirhossin27-dev.github.io/live-scores/ liefert HTTP 200 und referenziert index-DwFDAKPG.js / index-Ls9oaT_0.css. Beide Assets liefern HTTP 200. sw.js liefert HTTP 200, CACHE entspricht live-scores-6622942aa3b2587e6c4fe2b497452bf15e7abbfa.
- Die neue Version ist ausgeliefert; damit ist noch keine Geräteabnahme behauptet. App auf dem iPhone vollständig schließen und vom Home-Bildschirm erneut öffnen. Bei zunächst alter Ansicht nach kurzem Online-Start nochmals schließen/öffnen, damit der aktualisierte Service Worker greifen kann. Keine Neuinstallation erforderlich.
- Weiter bei CP2: tiefen Besuchspfad, Suche, Kalender und Einstellungen auf dem iPhone prüfen. Rückmeldung ausstehend; Etappe 3 bleibt bis dahin offen.

## Arbeitsstand Etappe3 – 15.11.2026

- Nutzer bestätigt Etappe2 als besser und gibt Etappe3 mit konkreten Ergänzungen frei. Neuer Branch fix/iphone-stage-3, Basis4fd1052.
- Header mobil12px tiefer (28px Komfortabstand plus Safe Area); Installationsbutton, Hilfecode und beide Footerhinweise vollständig entfernt. Installierte PWA bleibt nutzbar.
- Übersicht mit sichtbaren Emblemen, mobilen Teamzeilen und umbrechenden langen Namen. Aufstellung passt sich der Panelbreite an; Mannschaftsnamen außerhalb des Felds, Ersatzbänke bei Platzmangel untereinander. Keine seitliche Verschiebung nötig.
- Suche mobil in eigener Zeile/16px Eingabeschrift, Hauptfilter sichtbar beschriftet, Heute-Rücksprung und explizite Themeauswahl; primäre Touchziele44px. Regeln bis900px berücksichtigen Querformat. Bestehende Sportarten-/Reihenfolgegruppen in Einstellungen erhalten.
- Nachweise:392 Tests (387 Vitest+5 Runtime), Frontend-/Backend-Build erfolgreich; Backend0 Warnungen/Fehler. Unabhängige Codeprüfung ohne wesentliche Befunde. Browser320–1280px, Einbettungen, Querformat, Profil-/Nationalitätsaktionen und Einstellungen geprüft. Details und Wiederaufnahme in docs/superpowers/plans/2026-11-15-iphone-stage-3.md.
- Vorschau: C:/Users/amirh/Documents/ChatGPT/Live Scores/stage3-preview.jpg. Linke Ansicht echte API-Daten, rechte Ansicht Aufstellungs-Testdaten mit Fünferreihen.
- Etappe3 nach ausdrücklicher Freigabe veröffentlicht; CP3-Geräteabnahme offen. Nächster Schritt: installierte iPhone-App prüfen. Echte Systemränder, Tastatur, VoiceOver und größere Schrift bleiben Geräteabnahme.

## Veröffentlichung Etappe3 – 15.11.2026

- Nutzerfreigabe: „ja“ auf die konkrete Frage zur Veröffentlichung der gezeigten Etappe3-Vorschau.
- Normaler Fast-Forward-Push nach main, kein Force-Push. Veröffentlichter Commit:21ea9182a47057173797c6da00d5ef8aad74a363.
- GitHub Actions:https://github.com/amirhossin27-dev/live-scores/actions/runs/43715149873 – completed/success. Tests, Backend-Release-Build, Frontend-Build und Pages-Deployment erfolgreich.
- Live-HTML und sw.js HTTP200. HTML referenziert index-DHgv4Yub.js und index-CJ_t62AQ.css; beide Assets HTTP200. Service-Worker-Cache exakt live-scores-21ea9182a47057173797c6da00d5ef8aad74a363.
- Gerätecheckpoint CP3: App vollständig schließen und vom Home-Bildschirm online öffnen. Oberen Abstand, entfernten Installationsbutton/Footer, sichtbare Embleme und komplette Aufstellung/Ersatzbank in Hoch-/Querformat prüfen. Falls zunächst alte Ansicht erscheint, nach kurzem Online-Start nochmals schließen/öffnen. Keine Neuinstallation erforderlich.
- Rückfallpunkt: Etappe2, Commit6622942aa3b2587e6c4fe2b497452bf15e7abbfa. Nutzerabnahme CP3 ausstehend; danach Etappe4 mit Datenzuständen und Gesamttest.

## Arbeitsstand Etappe4 – 15.11.2026

- Nutzer bestätigt Etappe3 als „viel besser“ und beauftragt Fortsetzung mit zuletzt gespeicherten Ergebnissen während30s+ Ladezeit. Neuer konkreter Plan:docs/superpowers/plans/2026-11-15-iphone-stage-4.md.
- Branch fix/iphone-stage-4, Basis d7d72c6. Implementierung lokal committed:793ebc1700df159cd951c9ec82de8f2e9d4fee49. Etappe4 nach Nutzerfreigabe veröffentlicht; Details unten.
- Gerätesnapshots der Übersicht je API/Spieltag/Wettbewerb, maximal48h/160 Einträge/1.5Mio Zeichen. Sofortige passende Anzeige, Aktualisierung im Hintergrund; Fehler überschreiben keine guten Daten. Erfolgreiche leere Ergebnisse ersetzen alte Spiele. Bei Teilfehlern konservativer ältester Datenstand; keine frische Live-Pulsanzeige für gespeicherte Werte.
- Manuelle Aktualisierung, Wiederholen, Offlinehinweise, Online-/Vordergrundaktualisierung und längerer Ladehinweis nach8s. Automatische Datumssprünge nur nach frischem erfolgreichem Abruf, nicht bei Cache/Fehler/Offline. Andere Detailabrufe unverändert; Rückwege bleiben bedienbar.
- Geänderte Dateien:sportsScoreCache.ts mit Tests; useSportsScores in sportsHooks.ts mit neuen Hooks-Tests; SportsWidget.tsx/Test und sports.css. Kein Backend-, Hosting-, Tarif- oder Service-Worker-Datencache-Umbau.
- Nachweise:405 Vitest+5 Runtime=410 Tests bestanden in15 Vitest-Dateien. Frontend-Build69 Module,index-BNN962qi.js/index-DFdZWV-M.css. Backend-Build0 Warnungen/Fehler. git diff --check sauber; unabhängige Prüfung ohne wesentliche Befunde.
- Browser mit kontrollierten Testdaten:35s Antwortlatenz bei sofort sichtbarem alten2:1; danach3:1. Fehler mit Wiederholen erhält2:1; Offline-Snapshot erhält2:1, Online-Rückkehr lädt3:1; Offline ohne Snapshot verständlich DE/EN; Teilfehler erhält alten Wettbewerbsstand. Einstellungen beim Erstabruf erreichbar,8s-Hinweis sichtbar.320/393/1280px ohne Überlauf; beide Einbettungen320px mit0px Außenpadding und sichtbarem Snapshot.
- Vorschau:C:/Users/amirh/Documents/ChatGPT/Live Scores/stage4-cache-preview.jpg; Fehlerzustand:stage4-error-preview.jpg. Daten dort kontrollierte Testdaten.
- Diagnosegrenze:warme reale API war schnell (Gesundheit0.28/0.11s,20 Standardwettbewerbe0.20/0.10s). Ein kalter Start wurde nicht gemessen; Render-Free-Ruhezustand ist plausible zusätzliche Ursache laut https://render.com/docs/free . Keine zugesicherte Verkürzung der Netzwerklatenz behaupten.
- Der erste erfolgreiche Abruf mit der neuen Version füllt den Speicher. Ohne passenden Snapshot bleibt ein Erstabruf netzabhängig; Daten älter als48h werden beim Wiederherstellen verworfen. Speicherfehler beeinträchtigen nur Persistenz, nicht Einstellungen oder aktuelle Anzeige.
- Genau ein nächster Schritt:veröffentlichte iPhone-App erfolgreich laden, schließen/öffnen, gespeicherten Stand und Aktualisierung sowie ursprüngliche Bedienprobleme gemeinsam abschließend abnehmen.

## Veröffentlichung Etappe4 – 15.11.2026

- Nutzerfreigabe:„ja“ auf die konkrete Frage nach Veröffentlichung der geprüften Cache-Vorschau.
- Normaler Fast-Forward-Push nach main, kein Force-Push. Veröffentlichter Commit:b130cf6e77cb1a3d7a967100d79237c0b77abee7 (Implementierung793ebc1 plus Checkpoint-Dokumentation).
- GitHub Actions:https://github.com/amirhossin27-dev/live-scores/actions/runs/43723774486 – completed/success. Tests, Backend-Release-Build, Frontend-Build und Pages-Deployment erfolgreich.
- Live-HTML/sw.js HTTP200; HTML referenziert index-BNN962qi.js und index-DFdZWV-M.css, beide Assets HTTP200. Worker-CACHE exakt live-scores-b130cf6e77cb1a3d7a967100d79237c0b77abee7.
- Zusätzlich reale API-Antwort gegen die tatsächliche Cache-Implementierung geprüft, ausschließlich in Testspeicher:3 Wettbewerbe/8 Spiele vollständig gespeichert und wiederhergestellt,0 Teilfehler. Keine gespeicherten Nutzereinstellungen verändert.
- Nächster Gerätecheckpoint:App vollständig schließen und vom Home-Bildschirm neu öffnen; einmal erfolgreiche Ergebnisse abwarten. Danach vollständig schließen/öffnen:passender gespeicherter Stand mit ursprünglichem Zeitstempel muss sofort erscheinen und im Hintergrund aktualisiert werden. Erster Abruf ohne passenden Snapshot kann weiterhin warten.
- CP4 und erweiterte reale iOS-Fälle bleiben bis zur Nutzerbestätigung offen. Alle vier Etappen sind implementiert/veröffentlicht; kein weiteres automatisches Featurepaket beauftragt.
- Rückfallpunkt vor Cache:Etappe3,21ea9182a47057173797c6da00d5ef8aad74a363. Bei weiterem Feedback zuerst diesen Plan und den aktuellen Git-Stand lesen.

## Ergänzung – kompakte Übersicht, 15.11.2026

- Nutzer wählt „1 Kompakt“ und gibt den schriftlichen Entwurf mit „mach weiter ja“ frei. Lokal umgesetzt auf feat/compact-overview, Layout01b02e2 plus Korrektur für Suchkategorien bei wenig Höhe. Live bleibt b130cf6, Veröffentlichung separat offen.
- Große Header entfernt; Datum/Filter kompakt, Suche ausklappbar. Sprache/Darstellung/Einstellungen in gemessener unterer Leiste. Kein normaler manueller Update-Button, Cache/Automatik und Fehler-Retry erhalten.
-417 Tests sowie Frontend-/Backend-Build bestanden. Unabhängige Prüfung: ein wesentlicher Befund zur Suchfilter-Erreichbarkeit behoben und RED→GREEN abgesichert; keine offenen Minor-Befunde. Browser320/393px/Querformat/Desktop/beide Embeds geprüft.
- Fortsetzen bei docs/superpowers/plans/2026-11-15-compact-overview.md, dort alle Nachweise, Commits und Checkpoints. Vorschau: C:/Users/amirh/Documents/ChatGPT/Live Scores/compact-overview-preview.jpg.
- Nächster Schritt: Veröffentlichung der konkreten Vorschau freigeben, dann Actions/Live prüfen und auf echter iPhone-Home-Bildschirm-App Tastatur/Systemränder/größere Schrift abnehmen.
