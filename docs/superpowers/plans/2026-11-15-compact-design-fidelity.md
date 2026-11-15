# Kompakt – Korrektur der Designabweichung, 15.11.2026

## Auftrag und aktueller Stand

Nutzer beanstandet: veröffentlichte Oberfläche sieht deutlich schlechter als gewählter Entwurf „1 Kompakt“ aus. Fortsetzung mit „Mach weiter“ bestätigt. Referenz bleibt der bereits gewählte Originalentwurf; keine neue Designrichtung.

- Referenz:C:/Users/amirh/Documents/ChatGPT/Live Scores/design-proposals/compact-scores.html.
- Live weiterhin2d375660ce8820e16ef7cab0082c57f654af734f. Korrektur nur lokal, Branch fix/compact-design-fidelity, Codeaead97a9e80dccd12a3a77e2d6ce7f398f4b94e4. Basis308276c (lokale Release-Dokumentation).
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
- Nächster Schritt: direkten Vergleich zur visuellen Beurteilung zeigen; korrigierten Stand erst anschließend veröffentlichen. Nicht noch einmal allein aufgrund grüner Funktionstests freigeben.

## Abschlussprüfung

- Unabhängige Prüfung von tatsächlichem Vergleichsbild, Originalquelle und Code abgeschlossen: keine Critical-/Important-Befunde. Palette, Schriftgewichte, Datum, Filterlinie,60px Zeilen und Fußleiste sichtbar mit Vorlage abgeglichen. Zusätzliche Wettbewerbsaktionen und4px Abstand zwischen Ligen für44px Touchziele explizit geprüft.
- Reviewer hat keine eigenen Tests/Browserläufe ausgeführt und kein iOS/helles Theme/Desktop unabhängig abgenommen. Die oben dokumentierten automatischen und Browserprüfungen stammen aus der Umsetzung.
- Keine Änderung oder Veröffentlichung nach diesem lokalen Checkpoint ohne vorherige Vorlage des direkten Vergleichs. Aktuelle öffentliche Version bleibt2d37566.
