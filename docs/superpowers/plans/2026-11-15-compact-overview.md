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

- [ ] Neue Verhaltensprüfungen zuerst:fehlende große Header/Update-Aktion, untere persistierte Sprache/Themewerte, Einstellungen öffnen/schließen/Fokus; Embed ohne globale Leiste mit lokalem Zugriff.
- [ ] Neue Suchprüfung zuerst:initial verborgen, Öffnen fokussiert, bewusstes Schließen leert Suchzustand; Reiter/Datum bleiben; vorhandene Profil-Rückkehrtests erhalten.
- [ ] App/Widget/Leiste und Suche minimal umsetzen; nur bisher immer sichtbare Suchzugriffe in Tests explizit öffnen. Sichtbarer Titelblock entfällt, zugängliche Überschrift/Bezeichnung bleibt.
- [ ] Gezielte Tests grün; Datenhooks/Cache bleiben unverändert.

## Task2 – Kompakte Gestaltung und Geometrie

Files:app.css,sports.css,sportsSearch.css; SportsSearch.tsx für verfügbaren Popupraum.

- [ ] Alte Header-Styles entfernen; oben Datum/Heute/Lupe, darunter Unterstrichfilter. Embleme und Spielzeilen erhalten.
- [ ] Untere feste Leiste folgt Inhaltsbreite und Safe Area; gemessene Höhe als Platzhalter reservieren. Sprache44px, Theme kurz Auto/Hell/Dunkel, Einstellungen44px.
- [ ] Nur kleinen Datenstand unten; keine zusätzliche Poll-Zeile. Warnungen bei echten Fehler-/Offline-/alten Zuständen erhalten. Suche im VisualViewport begrenzen; auf Touchgeräten bei Texteingabe Werkzeuge nicht darüberlegen.
- [ ] Browser320/393px, Querformat, Desktop, beide Embeds, Themes/DEEN, lange Liste und kontrolliert ausstehende Antwort prüfen; Screenshot sichern. Echte iOS-Tastatur bleibt Gerätecheckpoint.

## Task3 – Abschluss

- [ ] npm test; npm run build; dotnet build backend/App.Api; git diff --check.
- [ ] Gesamten Diff unabhängig prüfen lassen, wesentliche Befunde beheben; keine unnötige weitere Reviewrunde.
- [ ] Spec/Plan/Checkpoint und lokale Commits sichern; konkrete Vorschau zur Veröffentlichung vorlegen. Kein Push/Deploy vor Freigabe.
