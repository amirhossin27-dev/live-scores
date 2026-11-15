# Kompakt – Korrektur der Designabweichung, 15.11.2026

## Auftrag und aktueller Stand

Nutzer beanstandet: veröffentlichte Oberfläche sieht deutlich schlechter als gewählter Entwurf „1 Kompakt“ aus. Fortsetzung mit „Mach weiter“ bestätigt. Referenz bleibt der bereits gewählte Originalentwurf; keine neue Designrichtung.

- Referenz:C:/Users/amirh/Documents/ChatGPT/Live Scores/design-proposals/compact-scores.html.
- Veröffentlicht:d885e055ee22d47fc5c1b949f9d13657b9b7c52e nach ausdrücklicher Nutzerfreigabe. Branch fix/compact-design-fidelity, Codeaead97a9e80dccd12a3a77e2d6ce7f398f4b94e4. Basis308276c; Release-Nachweis zusätzlich lokal dokumentiert.
- Direkter Vergleich:C:/Users/amirh/Documents/ChatGPT/Live Scores/compact-design-comparison.jpg. Links Original, rechts echte App mit denselben7Beispielspielen und demselben Datum bei393px/750px. Rahmen für Vergleich, keine Änderung am Originalfragment. Icons werden in der Testhülle als SVG gerendert; kein neuer Icon-Dienst/keine Produktionsabhängigkeit.
- Echte API-Daten:C:/Users/amirh/Documents/ChatGPT/Live Scores/compact-design-actual.jpg.

## Ursache und Korrektur

Die vorige Umsetzung übernahm Anordnung/Funktionen, ließ aber wesentliche alte Sport-/Buttonstyles wirksam. Beispielsweise dunkler Datumshintergrund, schwerere Namen/Zähler, rote Live-Werte und große/versale Ligaköpfe. Funktions- und Geometrieprüfungen ersetzten den fehlenden direkten visuellen Vergleich nicht. Verantwortung liegt in der Umsetzung/Abnahme, nicht beim Nutzerentwurf.

- [x] Originalquelle direkt mit bisheriger App bei identischen Daten verglichen.
- [x] Neue scoped compactOverview.css: Originalpalette, Schriftgewichte, Kontrollen,60px Teamzeilen, kleinere sichtbare Ligabänder, blaue Livezeiten/neutrale Spielstände und Favoritenfarbe übernehmen; alte kompakte Teilregeln aus sports.css herausnehmen.
- [x] Datum ohne großen Hintergrund, Icon davor, einzeilige Originalbeschriftung; gerahmte Lupe. Favoritenfilter ohne zusätzliche Stern-Dekoration.
- [x] Werkzeugleiste mit Thema-Icon/12px sichtbarem Wert; echte native16px-Auswahl darüber erhält Tastaturbedienung und vermeidet iOS-Fokuszoom. Gespeicherte DE/EN/Auto/Hell/Dunkel-Werte bleiben erhalten.
- [x] Anstehende Spiele zeigen zwei neutrale Gedankenstriche; Quelle0:0 bleibt verborgen. Fehlende Embleme erhalten ein initiales Platzhalterkästchen, vorhandene Embleme unverändert.
- [x] Wettbewerb-/Tabellen-/Favoritenfunktionen erhalten. Ligabänder sichtbar30px, Bedientasten44px inklusive freiem Raum darüber. Daraus folgt zwischen Wettbewerben4px zusätzlicher Abstand gegenüber dem einfachen Mockup; keine überlappenden Spielziele.
- [x] Footer inklusive Safe Area weiterhin tatsächlich messen/reservieren. Keine Änderungen an Datenhooks, Cache, API, Backend, Hosting oder Service Worker.

## Nachweise und offener Checkpoint

- Datum-/Platzhaltertests zuerst RED, dann GREEN. Bestehende reine Text-Erwartungen für Stern-Dekoration/Gestern/Morgen an vereinbartes Aussehen angepasst; Zählung/Datum/Abrufe/Rückwege weiterhin geprüft.
- npm test:414 Vitest in16 Dateien +5 Runtime=419 bestanden. npm run build erfolgreich:71Module/index-B64se_5g.js/index-Bnmw6Toz.css. dotnet build backend/App.Api erfolgreich,0 Warnungen/Fehler. git diff --check sauber.
- Browser: Original und App393px direkt nebeneinander. Erste Spielzeile oben175px/Höhe60px und Leiste58px identisch. Bei320px verfügbare/Scrollbreite308/308; letzte Spielzeile endet570.09px, Leiste beginnt592px. Datum in schmaler Einbettung gekürzt und vollständig lesbar. Beide Einbettungen ohne globale Leiste, lokale Einstellungen/Fokus geprüft. Hell/Dunkel und echte API-Daten geprüft.
- Echte iPhone-Systemränder, Bildschirmtastatur und größere Systemschrift bleiben Geräteprüfung. Kein Browsernachweis als iOS-Abnahme ausgegeben.
- Direkter Vergleich gezeigt und vom Nutzer zur Veröffentlichung freigegeben; korrigierter Stand veröffentlicht und live visuell geprüft. Nächster Schritt: echte iPhone-Abnahme. Funktionsprüfung und visuellen Referenzabgleich künftig gemeinsam erhalten.

## Abschlussprüfung

- Unabhängige Prüfung von tatsächlichem Vergleichsbild, Originalquelle und Code abgeschlossen: keine Critical-/Important-Befunde. Palette, Schriftgewichte, Datum, Filterlinie,60px Zeilen und Fußleiste sichtbar mit Vorlage abgeglichen. Zusätzliche Wettbewerbsaktionen und4px Abstand zwischen Ligen für44px Touchziele explizit geprüft.
- Reviewer hat keine eigenen Tests/Browserläufe ausgeführt und kein iOS/helles Theme/Desktop unabhängig abgenommen. Die oben dokumentierten automatischen und Browserprüfungen stammen aus der Umsetzung.
- Nutzer hat nach Vorlage des direkten Vergleichs die Veröffentlichung mit „ja“ freigegeben. Die exakt gezeigte Korrektur ist als d885e05 veröffentlicht; Nachweise unten.


## Veröffentlichung der Designkorrektur – 15.11.2026

- Nutzerfreigabe: „ja“ auf die konkrete Frage zur Veröffentlichung des rechts gezeigten korrigierten Stands im direkten Originalvergleich.
- Normaler Fast-Forward-Push ohne Force von2d37566 auf d885e055ee22d47fc5c1b949f9d13657b9b7c52e. Enthält ausschließlich die gezeigte Korrektur aead97a und lokale Prüfdokumentation.
- GitHub Actions:https://github.com/amirhossin27-dev/live-scores/actions/runs/43753428594 – completed/success. Tests, Backend-Release-Build, Frontend-Build und Pages-Deployment erfolgreich.
- Öffentliche App https://amirhossin27-dev.github.io/live-scores/ HTTP200. HTML referenziert index-B64se_5g.js und index-Bnmw6Toz.css; beide HTTP200 und identisch zum lokal freigegebenen Build. sw.js HTTP200; CACHE exakt live-scores-d885e055ee22d47fc5c1b949f9d13657b9b7c52e.
- Zusätzlich tatsächliche öffentliche Mobilansicht393×852 im Browser visuell geprüft, echte Ergebnisse geladen: transparenter Datumshintergrund, Teamnamen Gewicht400, Ligakopf12px, erste Spielzeile y175/Höhe60px, untere Leiste58px, keine horizontale Überschreitung393/393. Screenshot:C:/Users/amirh/Documents/ChatGPT/Live Scores/compact-design-published.jpg. Keine echte iOS-Geräteabnahme behauptet.
- Nächster Gerätecheckpoint: App auf dem iPhone vollständig schließen und online vom Home-Bildschirm öffnen. Falls noch die vorherige Darstellung erscheint, nach kurzem Online-Start nochmals schließen/öffnen; keine Neuinstallation nötig. Gestaltung gegen gewählte Vorlage, Suche mit Tastatur/Profilrückweg, untere Werkzeuge und letzte Spielzeile in Hoch-/Querformat prüfen. Größere Systemschrift/native Safe Areas weiter offen.
- Rückfallpunkt:dokumentierte vorige Veröffentlichung2d37566. Keine Backend-/Hosting-/Tarif- oder Datenstrategieänderung.
