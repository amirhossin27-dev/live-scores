# Kompakte Ergebnisübersicht – schriftlicher Entwurf

Stand: 15.11.2026. Gewählte Richtung:„1 Kompakt“. Schriftlicher Entwurf vom Nutzer mit „mach weiter ja“ freigegeben. Lokale Umsetzung folgt dem separaten Umsetzungsplan; Veröffentlichung nach eigenem Checkpoint.

## Ziel und Ausgangspunkt

Die Ergebnisse sollen früher auf dem Bildschirm beginnen und mehr Platz erhalten. Der Nutzer möchte den großen Header vollständig entfernen, Sprache/Darstellung nach unten verschieben und Kalender, Suche und Ergebnisfilter kompakter gestalten. Ein normaler manueller Aktualisieren-Button wird nicht mehr benötigt.

Die ausgewählte Vorschau steht unter C:/Users/amirh/Documents/ChatGPT/Live Scores/design-proposals/compact-scores.html, Variante „Kompakt“. Sie verwendet Beispielspiele und Platzhalterembleme. Die echte App behält ihre vorhandenen Mannschaftsembleme und Daten.

## Betrachtete Varianten und Auswahl

- **Kompakt – vom Nutzer gewählt:** Datum plus Lupe und schmale Filterzeile oben; globale Werkzeuge unten. Die Suche benötigt zum Öffnen einen Tipp, dafür bleibt im Normalzustand mehr Platz für Ergebnisse.
- **Suche sichtbar:** Suchfeld ständig eingeblendet; Werkzeuge unter den Filtern im oberen Bedienblock. Bequemer bei häufiger Suche, höherer Platzbedarf.
- **Daumennavigation:** Ergebnisfilter am unteren Rand; Sprache/Darstellung unter „Mehr“. Gute Erreichbarkeit mit einer Hand, zusätzliche Ebene für seltene Einstellungen.

## Gewählter Bildschirm

1. **Oben:**eine kompakte Zeile mit vorherigem Tag, anklickbarem Datum/Kalender, nächstem Tag, „Heute“ bei abweichendem Datum und einer Lupe. Der vorhandene Systemabstand bleibt erhalten. Datum und Schaltflächen passen auch auf schmale Bildschirme.
2. **Darunter:**„Alle“, „Live“ und „Favoriten“ als schmale gemeinsame Filterzeile mit verständlichen Zählern. Aktiver Filter durch Akzent und Unterstreichung erkennbar; keine großen einzelnen Pillen.
3. **Danach:**direkt die Wettbewerbe und Spiele. Beide sichtbaren Titelblöcke (Logo/„Deine Übersicht“/„Live Scores“ sowie „Sport“/zweite „Live Scores“-Überschrift) entfallen. Die App bleibt über Dokumenttitel und zugängliche Bezeichnungen erkennbar.
4. **Unten:**eine schmale, beim Scrollen erreichbare Werkzeugleiste mit kleinem Datenstand sowie Sprache, Darstellung und Wettbewerbseinstellungen. Sie liegt oberhalb des iPhone-Systembereichs und reserviert ihren Platz, sodass keine Ergebniszeile verdeckt wird.

## Verhalten

- **Suche:**Die Lupe öffnet eine Eingabezeile und setzt den Fokus in das Suchfeld. Die bestehende Suche nach Spielern, Trainern, Vereinen und Nationalteams bleibt erhalten; sie wird nicht auf eine Filterung der angezeigten Spiele reduziert. Die Suchansicht behält beim Öffnen/Schließen eines Profils Text, Ergebnisart und Fokus. Bewusstes Einklappen leert Suche/Treffer und gibt den Fokus zur Lupe zurück. Datum und Ergebnisfilter bleiben dabei erhalten.
- **Kalender:**Bestehender Kalender, Tagespfeile und „Heute“-Rücksprung bleiben erhalten. Abbrechen ändert das Datum nicht. Auf sehr schmalen Flächen darf die Datumsbeschriftung kürzer werden, ohne das Datum unverständlich abzuschneiden.
- **Sprache/Darstellung:**Unten dieselben gespeicherten Einstellungen wie bisher; Sprache DE/EN, Darstellung Automatisch/Hell/Dunkel. Die sichtbare Kurzform „Auto“ ist zulässig, die zugängliche Beschriftung bleibt eindeutig.
- **Wettbewerbe:**Die Schaltfläche unten öffnet die vorhandenen Wettbewerbseinstellungen mit Reihenfolge und Auswahl; „Fertig“ schließt sie. Ergebnisfilter und Datum bleiben erhalten. Während eines Detaildialogs sind die Werkzeuge im Hintergrund gesperrt.
- **Aktualisierung:**Der normale Update-Button entfällt. Die bestehende Automatik bleibt:beim Öffnen, bei Rückkehr in die sichtbare App und nach Wiederverbindung; etwa alle 30 s bei Live-Spielen, sonst alle 2 min. Solange die gesamte App/Seite verborgen ist, starten keine weiteren regelmäßigen Ergebnisabrufe. Eine gezielte „Erneut versuchen“-Aktion darf ausschließlich im Fehlerzustand erhalten bleiben.
- **Datenstand:**Passende gespeicherte Ergebnisse erscheinen sofort. Der normale Stand wird klein unten angezeigt; Hintergrundaktualisierung beansprucht keine zusätzliche Zeile und verschiebt die Spielpositionen nicht. Gespeicherte/alte Daten werden als solche mit ursprünglichem Datum/Zeitpunkt erkennbar; Offline-, Teilfehler- und Ausfallhinweise bleiben sichtbar. Der erste Abruf ohne Snapshot darf weiterhin einen verständlichen Ladezustand zeigen.

## Von mir ergänzte Ausgestaltung und Grenzen

- Die untere Leiste bleibt auf dem iPhone erreichbar, ohne Inhalte zu überdecken; Suche/Treffer haben bei geöffneter Tastatur ausreichend Platz. Safe Areas und Querformat werden berücksichtigt.
- Optisch kleinere Symbole erhalten wirksame Tippflächen von mindestens 44×44 CSS-Pixeln. Tastaturbedienung und Fokusmarkierungen bleiben erhalten.
- Dieselbe kompakte Grundstruktur gilt auch auf größeren Standalone-Bildschirmen und folgt dort den Inhaltsrändern. Neue zusätzliche Navigationsebenen werden nicht eingeführt.
- Voll-/Kompakteinbettungen behalten die vom Host vorgegebenen Sprach-/Themeoptionen und 0 px äußeren Geräterand. Sie erhalten keine globale App-Werkzeugleiste; ihre Wettbewerbseinstellungen bleiben über einen kompakten lokalen Zugriff erreichbar.
- Bestehende Detailnavigation, responsive Aufstellung, Favoriten, Cachegrenzen und lokale Einstellungen bleiben erhalten. Keine Änderung an API, Backend, Hosting, Kosten oder Service-Worker-Datenstrategie.

## Abnahme des später umgesetzten Entwurfs

- Kein sichtbarer App-Header oder normaler Update-Button; Spiele folgen unmittelbar nach Datum und Filtern.
- Suche öffnen, Treffer/Profil öffnen, zurückkehren und einklappen funktioniert mit nachvollziehbarem Fokus und unverändertem Ergebnisfilter/Datum.
- Untere Werkzeuge, Wettbewerbseinstellungen und letzte Spiele sind erreichbar; nichts wird durch Leiste, Systembereich oder Tastatur verdeckt.
- Gespeicherte Ergebnisse, automatische Updates, Offline-/Teilfehlerhinweise und Rückwege bleiben funktionsfähig.
- 320/393 px, iPhone-Querformat, Desktop, beide Einbettungen, DE/EN und alle Darstellungsoptionen werden geprüft; echte iPhone-Systemränder/Tastatur bleiben ein Gerätecheckpoint.

**Nächster Schritt:** Nach ausdrücklicher Freigabe am15.11.2026 veröffentlicht und live geprüft (2d37566); siehe Release-Checkpoint im Umsetzungsplan. Jetzt echte iPhone-Abnahme von Tastatur/Systemrändern/größerer Schrift.


**Aktueller Release-Checkpoint:** Nach beanstandeter Designabweichung wurde die tatsächliche Originalvorlage direkt mit der App verglichen und korrigiert. Vom Nutzer freigegebene Designkorrektur d885e05 am15.11.2026 veröffentlicht und öffentlich visuell geprüft; nächster Schritt echte iPhone-Abnahme. Details:docs/superpowers/plans/2026-11-15-compact-design-fidelity.md.


## Nutzerabnahme – 15.11.2026

- Nutzer bestätigt nach Veröffentlichung und Aufforderung zum Vergleich auf dem iPhone: „passt alles“.
- Aktuelle veröffentlichte Version:d885e055ee22d47fc5c1b949f9d13657b9b7c52e. Die beauftragte Verbesserungsrunde einschließlich korrigierter Gestaltung „1 Kompakt“ ist damit praktisch abgenommen und abgeschlossen.
- Keine weitere App-Änderung oder Veröffentlichung aus dieser Rückmeldung abgeleitet. Abnahme ausschließlich lokal dokumentiert.
- Die pauschale Nutzerbestätigung ist keine Messdokumentation für jede Kombination von iOS-Version, VoiceOver, Systemschriftgröße oder Bildschirmorientierung. Solche vertieften Prüfungen bleiben bei Bedarf möglich und blockieren diesen Abschluss nicht.
- Nächster sinnvoller Schritt: App im Alltag nutzen; nur bei neuem konkretem Feedback eine gezielte weitere Änderung beauftragen. Für Fortsetzung aktuelle Abnahme und Live-Version lesen, keine erledigten Etappen erneut starten.
