# Etappe4 – Ergebnisse sofort aus letztem Abruf anzeigen

> Inline-Umsetzung mit superpowers:executing-plans; TDD und abschließende unabhängige Prüfung. Nutzer bestätigt Etappe3 und beauftragt Etappe4 einschließlich zwischengespeicherter Ergebnisse während langer Ladezeit.

**Goal:** Übersicht sofort mit dem letzten passenden Datenstand zeigen und im Hintergrund aktualisieren, ohne alte Ergebnisse als frisch auszugeben.
**Architecture:** Begrenzte lokale Ergebnissnapshots pro API, Spieltag und Wettbewerb. Hook hydriert synchron, aktualisiert weiter über die bestehende API, erhält gute Daten bei Fehler/Teilfehler und reagiert auf Online-/Sichtbarkeitswechsel. Keine Service-Worker-Datenänderung.
**Tech Stack:** Bestehendes React/TypeScript/localStorage/Vitest/.NET, keine zusätzlichen Dienste oder Abhängigkeiten.
**Spec:** Nutzerauftrag15.11.2026 und Etappe4 im Hauptplan. Der ausdrückliche Wunsch nach gespeichertem letztem Abruf erweitert die bisherige Grenze zu Offline-Daten: klar gekennzeichnete Gerätesnapshots sind jetzt beauftragt. AGENTS-Verbot von Live-Daten im Service Worker bleibt erhalten.
**Base:** d7d72c6, veröffentlichte App21ea918; Branch fix/iphone-stage-4.

## Konkretes Verhalten / Grenzen

- Gespeicherte öffentliche Übersichtsdaten werden direkt beim Rendern angezeigt, auch nach App-Neustart. Datum und Wettbewerbe müssen zum aktuellen Abruf passen; niemals gestrige Spiele als heutigen Spieltag anzeigen.
- Jede erfolgreiche Wettbewerbsantwort mit eigenem Zeitpunkt speichern; fehlgeschlagene Wettbewerbe nicht überschreiben. Bei Teilfehlern nur passende vorhandene Daten ergänzen und kenntlich machen. Leere erfolgreiche Antwort ersetzt alte Spiele korrekt.
- Maximal48Stunden seit Abruf,160 Wettbewerbseinträge und1.5Mio Zeichen; beschädigter, blockierter oder voller Speicher darf weder Einstellungen löschen noch die App blockieren. Datenquellen getrennt halten.
- Bestehender Rhythmus30s live/2min sonst erhalten; keine zusätzlichen Daueranfragen. Online-Rückkehr und Sichtbarwerden lösen zeitnah eine Aktualisierung aus; laufende Anfragen nicht vervielfachen. Abgebrochene/überholte Antworten dürfen nichts mehr speichern.
- Zeitstempel für gespeicherte Daten inkl.Datum, klare Aktualisiert-/Offline-/Fehlermeldung. Gespeicherte laufende Spiele erhalten keine frische Live-Pulsanzeige. Alter Datenstand bleibt beim manuellen Aktualisieren sichtbar.
- Sichtbare manuelle Aktualisierung; Wiederholen nach Fehler auch mit vorhandenen Daten. Ohne Snapshot nach8s längerer Ladehinweis. Offline ohne Snapshot ehrlich anzeigen.
- Automatischen Wechsel zum nächsten Tag nur nach erfolgreichem frischem Abruf ohne Teilfehler durchführen; keine Sprünge aufgrund alter/leerer/fehlgeschlagener Daten.
- Gilt für Ergebnisübersicht. Detailprofile verwenden weiterhin ihre bestehenden Abrufe und erhalten den funktionierenden Rückweg. Kein Datenanbieter-/Tarifwechsel und kein künstliches Wachhalten.

## Untersuchung

Aktuell nur Komponenten-State, daher nach Neustart leer. Backend cached bereits, fragt bis6 Quellen parallel ab und wartet auf alle Ergebnisse. Hosting render.yaml Free. Warmer Live-Test15.11.:health0.28/0.11s;20 Standardwettbewerbe0.20/0.10s,0 Teilfehler. Kein kalter Start reproduziert; Ruhezustand als plausible zusätzliche Ursache, nicht nachgewiesene alleinige Ursache. Render:https://render.com/docs/free beschreibt Spin-down nach15min.

## Task1 – Snapshots und Abruflebenszyklus

- [x] Neue sportsScoreCache.ts mit validierter/begrenzter Speicherung implementieren, erst Verhaltensfälle schreiben und scheitern sehen.
- [x] useSportsScores synchron hydrieren; passende Daten bei Transport-/Teilfehler behalten; Abbruch, Ablauf, Datum/Quelle/Selektion, Offline/Online/Sichtbarkeit und Speicherfehler testen.
- [x] Snapshot-Kennzeichnung und konservativen ältesten Datenstand im Hook liefern; keine Cachelogik in generische API- oder Service-Worker-Fetchpfade aufnehmen.

## Task2 – Verständliche Zustände und Bedienung

- [x] SportsWidget: gespeicherten Stand, Aktualisierung, Fehler/Teilfehler/offline/kein Snapshot verständlich DE/EN anzeigen; manuell aktualisieren und wiederholen. Bestehende Teilfehlertexte bei erhaltenen Daten präzisieren.
- [x] Automatisches Datumsspringen gegen Cache/Fehler/Offline sperren. Speicherhydrierung, echte leere Antwort und angehaltene Anfrage in Interaktionstests prüfen.
- [x] Mobile/Desktop/Einbettungen, Themes, vorhandene Rückwege und lokale Einstellungen erhalten. Browser mit kontrolliert langsamer/fehlgeschlagener Verbindung prüfen; keine reale iOS-Abnahme behaupten.

## Task3 – Abschluss/CP4

- [x] npm test, npm run build, dotnet build backend/App.Api; git diff --check.
- [x] Unabhängige Prüfung, Snapshot-Vorschau, Commit/Release-Checkpoint und Hauptplan aktualisieren.
- [x] Nach konkreter Nutzerfreigabe veröffentlicht und Live-Version erfolgreich geprüft.
- [ ] iPhone-Abnahme und ursprüngliche Probleme abschließend bestätigen.

## Technischer Stand / Prüfnachweise

- Neue sportsScoreCache.ts speichert öffentliche Ergebnisübersichten; keine Änderungen an Service Worker, Backend, Hosting oder Datenanbieter. Begrenzte und validierte Einträge nach Quelle/Spieltag/Wettbewerb; ursprüngliche Abrufzeit bleibt bei Reads und Fehlern erhalten.
- Task1 RED: neue Cache-Schnittstelle zunächst leer,10/14 Verhaltenstests fehlgeschlagen. Danach14/14 grün. Task2 RED:4 Cache-/Datums-Interaktionstests fehlgeschlagen; nach Umsetzung grün. Details in .superpowers/sdd/2026-11-15-iphone-stage-4/.
- Gesamtsuite npm test:405 Vitest +5 Runtime =410 bestanden,15 Vitest-Dateien. Ausgangsstand392,18 neue Tests. Frontend-Build erfolgreich:69 Module,index-BNN962qi.js,index-DFdZWV-M.css. Bekannter config.js-Hinweis unverändert. Backend-Build erfolgreich:0 Warnungen/Fehler.
- Browser mit kontrollierten Testdaten: Bei35s Antwortverzögerung sind gespeicherte2:1 sofort vorhanden (Alter und Aktualisierung sichtbar, keine Live-Pulsanzeige); nach Antwort3:1. Transportfehler erhält2:1 und sichtbare Wiederholen-Aktion. Offline mit Snapshot erhält2:1; Wiederverbindung lädt3:1. Offline ohne Snapshot wird ehrlich DE/EN angezeigt. Teilfehler erhält passende alte Ergebnisdaten. Einstellungen während ausstehendem Erstabruf erreichbar.
- Browser-Cache-UI bei320/393/1280px ohne Überlauf; beide Einbettungen320px/0px Außenpadding mit sichtbaren Ergebnissen.8s-Ladehinweis im Browser sichtbar. Echter iPhone-/Safari-/VoiceOver-/Schrift-/Tastaturtest bleibt Gerätecheckpoint.
- Unabhängige Codeprüfung durch verfügbares Ausweichmodell erfolgreich, keine wesentlichen Befunde. Der erste Reviewer konnte wegen Nutzungslimit nicht prüfen; diese fehlgeschlagene Prüfung wird nicht als Nachweis gezählt.
- Grenze: Eine neue Version kann frühere ungespeicherte Abrufe nicht rückwirkend speichern. Der erste erfolgreiche Abruf füllt den Speicher; erster Start ohne passenden Snapshot kann weiterhin auf die API warten. Andere Detailprofile bleiben bei ihren bestehenden Abrufen.
- Entscheidungen: maximal48h alte öffentliche Ergebnisse, konservativer ältester Zeitstempel bei gemischten Antworten; erfolgreicher leerer Wettbewerb ersetzt alte Spiele. Ein Speicherproblem beeinträchtigt nur die Persistenz, nicht aktuelle Ergebnisse oder Einstellungen.
- Nächster Schritt:iPhone-CP4 durchführen. Etappe4 nach ausdrücklicher Freigabe erfolgreich veröffentlicht.

Lokaler Implementierungscommit:793ebc1700df159cd951c9ec82de8f2e9d4fee49. Vorschau:C:/Users/amirh/Documents/ChatGPT/Live Scores/stage4-cache-preview.jpg. Fehlerzustand:stage4-error-preview.jpg. Release freigegeben und veröffentlicht; iPhone-Endabnahme weiter offen.

## Release

Am15.11.2026 nach Nutzerfreigabe „ja“ veröffentlicht:b130cf6e77cb1a3d7a967100d79237c0b77abee7. Actions-Run43723774486 completed/success: https://github.com/amirhossin27-dev/live-scores/actions/runs/43723774486 . Live-HTML,Worker und Assets200; Workerkennung entspricht Release. Reale API-Antwort mit3 Wettbewerben/8 Spielen durch tatsächliche Cachefunktionen im Testspeicher vollständig wiederhergestellt. CP4-Geräteabnahme offen, Prüffolge im Hauptplan.
