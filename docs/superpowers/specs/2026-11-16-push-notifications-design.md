# Push-Mitteilungen bei Toren und Roten Karten – Design

Stand: 16.11.2026 · Status: von Amir freigegeben (16.11.2026)

## Absicht

Amir will auf dem iPhone sofort erfahren, wenn in einem seiner Favoriten-Spiele ein Tor fällt oder jemand vom Platz fliegt. Das soll auch funktionieren, wenn Live Scores im Hintergrund liegt oder gar nicht geöffnet ist. Er soll nicht mehr nachschauen müssen.

## Ziele

- Mitteilung auf dem iPhone bei **Tor** und **Roter Karte** (inkl. Gelb-Rot), auch bei geschlossener App.
- Nur für **Favoriten**: Spiele mit Stern (`dwh.sports.favorites.v1`) und alle Spiele von Wettbewerben mit Stern (`dwh.sports.favoriteCompetitions.v1`).
- Die Mitteilung kommt etwa 1–2 Minuten nach dem Ereignis, so schnell, wie die Datenquelle es liefert.
- Ein Tipp auf die Mitteilung öffnet Live Scores.
- In der App ein Schalter zum An- und Abschalten.
- Ausfälle bemerkbar machen: eine **Statuszeile** in der App (Amirs Entscheidung, 16.11.2026). Einen Test-Push vor dem Spiel hat Amir verworfen.
- Komplett kostenlos.

## Nicht-Ziele

- Keine Mitteilungen zu Anpfiff, Halbzeit, Abpfiff, Gelben Karten oder Auswechslungen, auch keine Bestätigung vor dem Spiel.
- Keine anderen Sportarten (Basketball, Motorsport, Kampfsport, US-Sport). Nur Fußball-Wettbewerbe des Katalogs.
- Keine Mitteilungen für Nicht-Favoriten.
- Kein Login, keine geräteübergreifende Synchronisation der Favoriten. Jedes Gerät meldet seine eigenen Favoriten.
- Keine Mitteilungen in der Dashboard-Einbettung (`?embed=1`). Dort gibt es weder Service Worker noch Schalter.
- Keine automatische Bereitstellung des Workers über GitHub Actions in dieser Runde.

## Anti-Ziele (das wäre ein Fehlschlag, auch wenn es technisch läuft)

- **Stiller Ausfall:** Amir verlässt sich darauf, und beim wichtigen Spiel kommt nichts, ohne dass er es merkt.
- **Spam:** dieselbe Mitteilung doppelt, oder eine Flut beim ersten Abruf eines schon laufenden Spiels.
- **Kosten:** kein bezahlter Tarif, keine Kreditkarte, Render bleibt auf `free`.
- **Secrets im Frontend:** Der private VAPID-Schlüssel liegt nur als Worker-Secret. In `public/config.js` steht höchstens der öffentliche Schlüssel und die Worker-Adresse.
- Live-Daten im Service Worker cachen (verboten laut AGENTS.md).

## Rahmenbedingungen

- **iPhone:** Web Push geht ab iOS 16.4 und nur, wenn Live Scores als Web-App auf dem Home-Bildschirm installiert ist. Die Erlaubnis muss durch einen Tipp des Nutzers angefragt werden.
- **Frontend:** React/Vite, GitHub Pages, `sw.js` wird in `vite.config.ts` als Text erzeugt.
- **Backend:** C#-API auf Render `free`. Schläft nach ca. 15 Min. ohne Aufruf, ein Kaltstart dauert bis zu ca. 1 Minute, kein fester Speicher, Rate-Limit 240 Aufrufe/Minute pro IP.
- **Datenquelle:** `GET /api/sports/scores?competitions=…&date=YYYYMMDD` liefert je Spiel `status` (`scheduled|live|finished|postponed|canceled`), `statusText` (Minute bei Live) und je Seite `score`, `redCards` und `yellowRedCards`. `GET /api/sports/match?competition=…&id=…` liefert `events` mit Torschützen und Spielern mit Platzverweis (`goal|penalty|own-goal|red|yellow-red`).
- **Cloudflare Workers Free:** Cron höchstens jede Minute, KV mit 1.000 Schreibvorgängen pro Tag (deshalb nur bei Änderungen schreiben).

## Ansätze

| | A) Cloudflare Worker als Wächter (**gewählt**) | B) Alles im Render-Backend |
|---|---|---|
| Zuverlässigkeit | Cron jede Minute, schläft nie | Schläft ein, braucht externen Dauer-Ping |
| Speicher | Abo und Favoriten dauerhaft in KV | Nach Neustart oder Deploy weg, Ausfall unbemerkt |
| Render-Kontingent | Weckt Render nur um Anstoßzeiten | Dauerbetrieb, ca. 730 von 750 Gratis-Stunden |
| Neue Konten | Cloudflare (gratis) | Ping-Dienst (gratis) |
| Code | Zusätzlicher TypeScript-Baustein, zweite Bereitstellung | Alles in C#, fertige Web-Push-Bibliothek |

Verworfen: **GitHub Actions als Wächter**, weil geplante Läufe oft 10–30 Minuten zu spät kommen. **ntfy-App statt Web Push**, weil das eine zweite App bräuchte und ein Tipp nicht Live Scores öffnet.

**Amir hat A gewählt**, weil ein stiller Ausfall das Schlimmste wäre und A dafür am wenigsten anfällig ist.

## Wie es funktioniert

```
iPhone (installierte Web-App)
  │  1. Schalter „Mitteilungen“ an → Erlaubnis → PushSubscription
  │  2. PUT /subscription { subscription, favorites, favoriteCompetitions }
  ▼
Cloudflare Worker  ──(KV: Abos, Favoriten, Tagesplan, letzter Stand)
  │  Cron jede Minute:
  │   – Gibt es gerade ein Favoritenspiel im Zeitfenster? Nein → fertig (kein Aufruf an Render)
  │   – Ja → GET Render /api/sports/scores für die betroffenen Wettbewerbe
  │   – Mit letztem Stand vergleichen → Ereignis? → Web Push an alle Abos, die dieses Spiel als Favorit haben
  ▼
Apple Push Service → iPhone zeigt die Mitteilung, auch bei geschlossener App
```

### Frontend (App)

- **Schalter „Mitteilungen bei Toren & Roten Karten“** im bestehenden Werkzeug- bzw. Einstellungsbereich, nur außerhalb von `embed`.
  - Läuft die Seite nicht als installierte Web-App oder fehlt Push-Unterstützung: Der Schalter ist deaktiviert und zeigt einen kurzen Hinweis („Zum Home-Bildschirm hinzufügen, dann hier einschalten“ bzw. „Ab iOS 16.4“).
  - Erlaubnis verweigert: Hinweis, dass sie in den iOS-Einstellungen freigegeben werden kann.
  - Einschalten: Erlaubnis anfragen, `pushManager.subscribe` mit dem öffentlichen VAPID-Schlüssel aus `config.js`, Abo und Favoriten an den Worker senden.
  - Ausschalten: Abo kündigen und `DELETE /subscription` an den Worker.
- **Statuszeile** unter dem Schalter, wenn Mitteilungen an sind. Sie fragt beim Öffnen der App und beim Öffnen der Einstellungen den Worker ab, z. B. „Wächter aktiv vor 1 Min · dieses Gerät registriert · 2 Favoritenspiele heute“.
  - Warnung in Rot, wenn der letzte Cron-Lauf länger als 5 Minuten her ist, das Gerät beim Worker unbekannt ist, der Tagesplan von heute fehlt oder der Worker nicht erreichbar ist.
  - Ist das Gerät unbekannt, meldet die App es sofort neu an, soweit die Erlaubnis noch besteht.
- **Favoriten-Abgleich:** Bei jeder Änderung der Sterne und bei jedem App-Start schickt die App ihre aktuellen Favoriten an den Worker, wenn Mitteilungen an sind. So heilt sich ein verlorenes oder abgelaufenes Abo beim nächsten Öffnen selbst.
- **`sw.js`:** bekommt `push`-Handler (`showNotification`) und `notificationclick`-Handler (bestehendes Fenster fokussieren oder App öffnen). An Caching und Fetch-Logik ändert sich nichts.
- **`public/config.js`:** zusätzlich `pushWorkerUrl` und `vapidPublicKey`, beide öffentlich.

### Worker (neuer Ordner `worker/` im Repo)

- **Endpunkte:**
  - `PUT /subscription`: Abo speichern bzw. aktualisieren, mit Favoriten. Schlüssel ist ein Hash des Push-Endpunkts.
  - `DELETE /subscription`: Abo entfernen.
  - `POST /subscription/status` mit dem Push-Endpunkt des Geräts: Status für die Statuszeile, also ob das Gerät registriert ist, Zeit des letzten Cron-Laufs, ob der heutige Tagesplan steht, Anzahl Favoritenspiele heute und letzter Datenfehler. Kein Zeitstempel pro Minute in KV: Den Zeitpunkt des letzten Cron-Laufs bestimmt der Builder so, dass das Schreiblimit hält, z. B. höchstens alle 5 Minuten schreiben.
  - `GET /health`: Status für Amir (letzter erfolgreicher Abruf, Anzahl Abos, letzter Fehler).- **Schutz:** CORS nur für `https://amirhossin27-dev.github.io` (plus localhost für Entwicklung). Push-Endpunkte nur von bekannten Push-Diensten (`web.push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com`, Windows-Push). Höchstens 10 Abos, Favoritenlisten werden begrenzt. Das reicht für eine private App. Ein Login ist Nicht-Ziel.
- **Tagesplan:** Einmal früh am Tag sowie nach jeder Favoriten-Änderung holt der Worker die Spiele des Tages für alle relevanten Fußball-Wettbewerbe (Favoriten-Wettbewerbe plus Wettbewerbe der Favoriten-Spiele). Er speichert Anstoßzeiten und Spiel-IDs in KV. Nur dafür wird Render außerhalb der Spielzeiten geweckt.
- **Zeitfenster:** Ein Spiel wird von 3 Minuten vor Anstoß bis zum Status `finished`/`postponed`/`canceled` abgefragt, höchstens bis Anstoß + 4 Stunden.
- **Ereignis-Erkennung:** Vergleich mit dem zuletzt gespeicherten Stand je Spiel:
  - `score` einer Seite steigt → **Tor** (ein Ereignis pro Treffer, auch wenn zwei zwischen zwei Abrufen fallen).
  - `score` einer Seite sinkt → **Tor aberkannt** (z. B. VAR).
  - `redCards` oder `yellowRedCards` einer Seite steigt → **Rote Karte** bzw. **Gelb-Rot**.
  - **Erster Kontakt** mit einem schon laufenden Spiel (z. B. Stern während des Spiels gesetzt) speichert nur den Stand und meldet nichts.
- **Text der Mitteilung** (Deutsch):
  - Tor: Titel „⚽ Tor für Bayern“, Text „Bayern 2:1 Dortmund · 67' · Musiala“
  - Rot: Titel „🟥 Rot für Dortmund“, Text „Bayern 2:1 Dortmund · 71' · Spielername“
  - Gelb-Rot: Titel „🟨🟥 Gelb-Rot für Dortmund“, sonst wie Rot.
  - Tor aberkannt: Titel „Tor aberkannt“, Text „Bayern 1:1 Dortmund · 69'“
  - Den Spielernamen holt der Worker nur bei einem Ereignis über `/api/sports/match`. Klappt das nicht, geht die Mitteilung ohne Namen raus.
  - Ein `tag` je Spiel und Ereignis verhindert Doppel-Anzeigen, falls ein Push doppelt zugestellt wird.
- **Speichern:** KV wird nur bei Änderungen geschrieben (neuer Stand, neues Abo, Tagesplan), damit das Gratislimit von 1.000 Schreibvorgängen pro Tag reicht.
- **Kaltstart von Render:** Der erste Abruf vor Anstoß darf bis zu ca. 1 Minute dauern. Bis die Daten da sind, wird nichts gemeldet und nichts verworfen.
- **Ausfall sichtbar machen:** Liefert Render während eines laufenden Favoritenspiels länger als 10 Minuten keine Daten, schickt der Worker **eine** Mitteilung: „Live-Daten gerade nicht erreichbar – Mitteilungen können fehlen.“ Sobald wieder Daten kommen, folgt eine Entwarnung, und die zwischenzeitlichen Tore werden aus dem Unterschied gemeldet.
- **Abgelaufene Abos:** Antwortet der Push-Dienst mit 404/410, wird das Abo gelöscht.
- **Web Push:** VAPID (ES256) und Verschlüsselung nach RFC 8291 (`aes128gcm`) mit WebCrypto. Eine fertige Bibliothek ist erlaubt, wenn sie in Workers läuft.

### Einrichtung (einmalig, durch Amir)

1. Kostenloses Cloudflare-Konto anlegen.
2. Im Repo `npx wrangler login` ausführen (öffnet den Browser zur Anmeldung).
3. Den Rest (KV anlegen, VAPID-Schlüssel erzeugen, Secret setzen, Deploy, `config.js` ergänzen) übernimmt Claude mit Amirs Freigabe.
4. Auf dem iPhone die App öffnen, Schalter einschalten, Erlaubnis geben.

## Tests

- Unit-Tests (Vitest) im Worker für:
  - Ereignis-Erkennung (Tor, mehrere Tore, aberkannt, Rot, Gelb-Rot, erster Kontakt, Spielende)
  - Zeitfenster und Tagesplan
  - Textbau
  - Abo-Validierung
  - Status-Antwort
  - Verschlüsselung gegen die Testvektoren aus RFC 8291
- Frontend-Tests für die Zustände des Schalters und den Favoriten-Abgleich.
- `npm test`, `npm run build` und `dotnet build backend/App.Api` laufen wie bisher grün.
- **Ende-zu-Ende:** Ein Test-Push über einen nur lokal oder per Secret erreichbaren Weg, danach ein echtes Spiel mit Stern auf Amirs iPhone.

## Dem Builder überlassen

- Genauer Ort und Aussehen des Schalters im bestehenden Werkzeugbereich, passend zum aktuellen Design.
- Struktur der KV-Schlüssel und des Worker-Codes.
- Welches Datum (UTC oder Europe/Berlin) für den Tagesplan bei Spielen um Mitternacht abgefragt wird. Spiele über Mitternacht dürfen nicht verloren gehen.
- Ob `notificationclick` direkt das Spiel öffnet, falls die App einen passenden Link schon kann, sonst die Startansicht.
- Verhalten bei Elfmeterschießen (Stand-Änderungen dort nicht als Tor melden, falls sie in `score` auftauchen).

### Vom Builder-Check geklärt (Claudes Calls)

- Im Plan ersetzt ein SQLite-basiertes Durable Object den KV-Speicher. Es ist konsistent, verhindert damit Doppel-Mitteilungen bei überlappenden Läufen und hat im Gratistarif ein deutlich höheres Schreiblimit. Wo hier „KV“ steht, ist dieser Speicher gemeint.

- KV wird nur bei Zustandswechseln geschrieben, kein Zeitstempel pro Minute. Überlappende Cron-Läufe und verzögert sichtbare KV-Werte dürfen keine Doppel-Mitteilungen erzeugen; die Speicherwahl muss das abfangen.
- Platzverweise werden über die Summe `redCards + yellowRedCards` je Seite erkannt. Deutet ESPN eine Rote nachträglich in Gelb-Rot um, gibt es keine zweite Mitteilung.
- Ein Wettbewerb in `failed` der `/scores`-Antwort zählt als „keine Daten“.
- Sind 10 Abos erreicht, fliegt das am längsten nicht gesehene raus. Die App zeigt einen Fehler, wenn das Speichern scheitert.
- Ob die Gratisgrenzen von Cloudflare (CPU pro Aufruf, KV-Schreiben) reichen, wird früh mit einem Prototyp geprüft.

## Calls, die ich (Claude) gemacht habe – bitte prüfen

- „Tor aberkannt“ wird gemeldet.
- Gelb-Rot zählt als Rote Karte und wird als „Gelb-Rot“ gekennzeichnet.
- Eine Ausfall-Mitteilung nach 10 Minuten ohne Daten während eines Favoritenspiels.
- Nur Fußball, nur Deutsch.
- Höchstens 10 Geräte.
