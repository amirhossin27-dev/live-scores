# Kompakte Ergebnisübersicht – Umsetzungsplan

> Inline-Ausführung mit superpowers:executing-plans und TDD; eine unabhängige Abschlussprüfung. Nutzer hat den schriftlichen Entwurf mit „mach weiter ja“ freigegeben.

**Goal:**Gewählte Variante Kompakt mit mehr sichtbaren Spielen, einklappbarer Suche und erreichbaren unteren Werkzeugen umsetzen.
**Architecture:**App behält persistierte Sprach-/Themewerte und reicht deren Bedienelemente als ReactNode an SportsWidget. SportsWidget besitzt Datum, Filter, Suchöffnung und Wettbewerbseinstellungen; eine kleine untere Leistenkomponente misst ihren reservierten Platz. Bestehende Such-/Kalender-/Detailkomponenten und Datenhooks weiterverwenden.
**Tech Stack:**React/TypeScript/CSS/Vitest/Vite/.NET unverändert.
**Spec:**docs/superpowers/specs/2026-11-15-compact-overview-design.md, am15.11.2026 freigegeben.
**Base:**c392cf1, letzte Live-Version b130cf6. Branch feat/compact-overview.

## Global Constraints

Standalone und beide Einbettungen, DE/EN, Automatisch/Hell/Dunkel erhalten; kein API-/Backend-/Hosting-/Service-Worker-/Cacheumbau. Normale manuelle Aktualisieren-Aktion entfernen, Fehler-Retry erhalten.44px effektive Touchziele und Safe Areas erhalten. Erst lokale Umsetzung/Prüfung/Vorschau; Veröffentlichung bleibt eigener Checkpoint.

## Review Focus

- Untere Leiste darf bei langen Ergebnissen/großer Schrift/Safe Area keine letzte Zeile verdecken; Höhe messen und reservieren.
- Mobile Suche bei Bildschirmtastatur: verfügbaren VisualViewport-Raum berücksichtigen, keine unzugänglichen unteren Treffer.
- Suche → Profil → Zurück erhält Suchzustand; bewusstes Einklappen verwirft Suche und fokussiert Lupe. Datum/Filter unverändert.
- Einbettungen ohne globale Leiste müssen Wettbewerbseinstellungen weiterhin erreichen; Hostoptionen behalten.
- Cache-/Fehlerhinweise und automatische Updates müssen nach Entfernung des normalen Update-Buttons erreichbar/ehrlich bleiben; kein Layoutsprung bei jedem Poll.

## Task1 – Verhalten und Komponenten

Files:src/App.tsx; neue src/features/overview/SportsUtilityBar.tsx; SportsWidget.tsx; SportsSearch.tsx; Tests App.test.tsx/SportsWidget.test.tsx/SportsSearch.test.tsx.
Interfaces:SportsWidget bekommt optional appearanceControls?:ReactNode; ohne diese bleibt Zugriff auf lokale Wettbewerbseinstellungen in der Toolbar. SportsUtilityBar({status:ReactNode,children:ReactNode,onHeightChange:(height:number)=>void}) misst die eigene Höhe. SportsSearch erhält autoFocus?:boolean und onCollapse?:()=>void, ansonsten bisheriger Vertrag.

- [x] Neue Verhaltensprüfungen zuerst:fehlende große Header/Update-Aktion, untere persistierte Sprache/Themewerte, Einstellungen öffnen/schließen/Fokus; Embed ohne globale Leiste mit lokalem Zugriff.
- [x] Neue Suchprüfung zuerst:initial verborgen, Öffnen fokussiert, bewusstes Schließen leert Suchzustand; Reiter/Datum bleiben; vorhandene Profil-Rückkehrtests erhalten.
- [x] App/Widget/Leiste und Suche minimal umsetzen; nur bisher immer sichtbare Suchzugriffe in Tests explizit öffnen. Sichtbarer Titelblock entfällt, zugängliche Überschrift/Bezeichnung bleibt.
- [x] Gezielte Tests grün; Datenhooks/Cache bleiben unverändert.

## Task2 – Kompakte Gestaltung und Geometrie

Files:app.css,sports.css,sportsSearch.css; SportsSearch.tsx für verfügbaren Popupraum.

- [x] Alte Header-Styles entfernen; oben Datum/Heute/Lupe, darunter Unterstrichfilter. Embleme und Spielzeilen erhalten.
- [x] Untere feste Leiste folgt Inhaltsbreite und Safe Area; gemessene Höhe als Platzhalter reservieren. Sprache44px, Theme kurz Auto/Hell/Dunkel, Einstellungen44px.
- [x] Nur kleinen Datenstand unten; keine zusätzliche Poll-Zeile. Warnungen bei echten Fehler-/Offline-/alten Zuständen erhalten. Suche im VisualViewport begrenzen; auf Touchgeräten bei Texteingabe Werkzeuge nicht darüberlegen.
- [x] Browser320/393px, Querformat, Desktop, beide Embeds, Themes/DEEN, lange Liste und kontrolliert ausstehende Antwort prüfen; Screenshot sichern. Echte iOS-Tastatur bleibt Gerätecheckpoint.

## Task3 – Abschluss

- [x] npm test; npm run build; dotnet build backend/App.Api; git diff --check.
- [x] Gesamten Diff unabhängig prüfen lassen, wesentliche Befunde beheben; keine unnötige weitere Reviewrunde.
- [x] Spec/Plan/Checkpoint und lokale Commits sichern; konkrete Vorschau zur Veröffentlichung vorlegen. Kein Push/Deploy vor Freigabe.

## Lokaler Checkpoint – 15.11.2026

- Schriftlicher Entwurf durch „mach weiter ja“ freigegeben; lokal vollständig umgesetzt. Branch feat/compact-overview, Basis c392cf1, Layout01b02e2; Suchfilterkorrektur siehe letzten fix-Commit. Noch nicht gepusht/veröffentlicht. Live bleibt b130cf6.
- Oben nur Datum/Kalender/Lupe und gemeinsame Unterstrichfilter. Sichtbare Titelblöcke/normaler Refresh entfallen. Suche explizit einklappbar; vorhandene Profilrückwege erhalten.
- Unten persistierte Sprache/Darstellung sowie Wettbewerbseinstellungen; tatsächliche Leistenhöhe inklusive Safe Area reserviert. Nachweis lange Liste: letzte Zeile endet783px, Leiste beginnt795px. Körper-Mindestbreite in beiden Stylesheets entfernt:320px Browser/308px verfügbar nun308px Scrollbreite.
- Browserprüfung320/393px,852x393 und1280px; beide Einbettungen ohne globale Leiste mit lokalem Einstellungszugang. DE/EN, Hell/Dunkel; Auto über native gespeicherte Auswahl/System-CSS erhalten. Kalender/Datum, Fokus nach Fertig/Detailausgang, gesperrter Hintergrund, gespeicherte Sofortanzeige bei35s ausstehender Antwort und Fehler mit Retry geprüft. Echte API-Daten im normalen Einstieg geladen.
- Unabhängige Abschlussprüfung: ein wesentlicher Befund. Bei geringer Höhe war der weiterwirkende Suchtyp ausgeblendet. Jetzt native44px Auswahl und scrollbar bleibendes Popup; Regression bei VisualViewport-Verkleinerung zuerst fehlgeschlagen, danach bestanden. Kurzes Querformat852x320 im Browser mit Wechsel Vereine→Alle bestätigt. Keine Critical-/Minor-Befunde. Keine zweite Reviewrunde.
- Finale Nachweise: npm test417 bestanden (412 Vitest in16 Dateien +5 Runtime); npm run build erfolgreich (70 Module, index-DQUnLPAW.js/index-OMhM-wsu.css); dotnet build backend/App.Api erfolgreich,0 Warnungen/Fehler; git diff --check sauber. config.js bleibt absichtlich extern.
- Entscheidungen: tatsächliche Leistenhöhe messen statt feste Annahme (zusätzliche kleine ResizeObserver-Komponente); Datenhooks/API/Cache bleiben unverändert (erster Abruf ohne Snapshot bleibt netzabhängig). Zugängliche Überschriften bleiben ohne sichtbaren Titelblock.
- Vorschau mit echten API-Daten: C:/Users/amirh/Documents/ChatGPT/Live Scores/compact-overview-preview.jpg. Lokale App: http://localhost:5190/ . QA/Protokolle für Wiederaufnahme: app/.superpowers/sdd/2026-11-15-compact-overview/ . Diese bewusst behalten, weil Nutzer fortsetzbare Checkpoints wünscht.
- Offener Gerätecheckpoint nach Veröffentlichung: Home-Bildschirm-App auf iPhone15 starten, Sprache/Theme unten, letzte Zeile, Kalender, Suche→Profil→Zurück und Suchkategorien bei offener Tastatur testen. Hoch-/Querformat, native Safe Areas und größere Schrift noch nicht real auf iOS abgenommen.
- Genau nächster Schritt: konkrete Vorschau zur Veröffentlichung freigeben lassen. Danach normaler Fast-Forward-Push ohne Force nach main, Actions/Live-Assets/Worker nachweisen und iPhone-Abnahme durchführen. Keine Backend-/Tarif-/Hostingänderung.
## Veröffentlichung – 15.11.2026

- Nutzerfreigabe: „ja“ auf die konkrete Frage zur Veröffentlichung der fertigen Kompakt-Vorschau.
- Normaler Fast-Forward-Push ohne Force nach main. Veröffentlichter Commit:2d375660ce8820e16ef7cab0082c57f654af734f (Layout01b02e2, Suchfilterkorrektur358414f, Prüfdokumentation2d37566).
- GitHub Actions:https://github.com/amirhossin27-dev/live-scores/actions/runs/43730946637 – completed/success. Tests, Backend-Release-Build, Frontend-Build und Pages-Deployment erfolgreich.
- Live-App:https://amirhossin27-dev.github.io/live-scores/ – HTTP200. HTML referenziert index-DQUnLPAW.js und index-OMhM-wsu.css; beide HTTP200 und identisch zum geprüften lokalen Build. sw.js HTTP200; CACHE exakt live-scores-2d375660ce8820e16ef7cab0082c57f654af734f.
- Keine Backend-/Tarif-/Hostingänderung. Rückfallpunkt vor Kompaktlayout: veröffentlichte Cache-Version b130cf6e77cb1a3d7a967100d79237c0b77abee7.
- Genau nächster Schritt / Gerätecheckpoint: App auf dem iPhone vollständig schließen und online vom Home-Bildschirm öffnen. Falls zunächst die vorige Oberfläche erscheint, nach kurzem Online-Start nochmals schließen/öffnen; keine Neuinstallation nötig. Datum/Filter, Suchöffnung und Suchkategorien bei Tastatur, Profil→Zurück, untere Werkzeuge und letzte Spielzeile in Hoch-/Querformat prüfen. Systemränder und größere Schrift bleiben echte Geräteabnahme; Veröffentlichung allein ist keine Nutzerabnahme.

## Nachfolgende Designkorrektur

Nutzer beanstandet am15.11.2026 den visuellen Abstand zur gewählten Vorlage. Lokale Korrektur/ursächliche Analyse und direkter Originalvergleich unter docs/superpowers/plans/2026-11-15-compact-design-fidelity.md. Codeaead97a;419 Tests und Builds bestanden, unabhängiger Bild-/Codeabgleich ohne wesentliche Befunde. Noch nicht veröffentlicht. Dies ist der aktuell nächste Checkpoint vor weiterer iPhone-Abnahme.
