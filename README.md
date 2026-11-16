# Live Scores

Eigenstaendige iPhone-Web-App und eingebettete Dashboard-Ansicht. Die App ist die fuehrende Quelle der Oberflaeche; das Company Dashboard zeigt die veroeffentlichte Version und enthaelt keine zweite Kopie dieser Ansicht.

- App: https://amirhossin27-dev.github.io/live-scores/
- Kompakt: https://amirhossin27-dev.github.io/live-scores/?embed=1&view=compact&lang=de
- Repository: https://github.com/amirhossin27-dev/live-scores

## Lokal starten

Voraussetzungen: Node.js 24+, .NET SDK 10.

```powershell
npm ci
dotnet run --project backend/App.Api --urls http://localhost:5181
# In einem zweiten Terminal:
npm run dev
```

Die lokale App nutzt die API automatisch. Fuer eine andere Adresse: `.env.example` nach `.env.local` kopieren und VITE_API_BASE_URL setzen.

## Pruefen

```powershell
npm test
npm run build
dotnet build backend/App.Api -c Release
```

## Kostenlos veroeffentlichen

GitHub Actions prueft Tests und Builds und veroeffentlicht `main` ueber GitHub Pages. Ein erstes Render-Deployment braucht einen persoenlichen Render-Login und die Verbindung dieses Repositories.

[API kostenlos bei Render bereitstellen](https://render.com/deploy?repo=https://github.com/amirhossin27-dev/live-scores)

Die Datei `render.yaml` legt ausschliesslich einen Service im Tarif **free** an, ohne Datenbank, Disk oder kostenpflichtige Zusatzdienste. Render kann nach Inaktivitaet schlafen; der erste Abruf braucht dann laenger. Das Stundenkontingent wird mit anderen kostenlosen Services im Workspace geteilt. Bei Erreichen eines kostenlosen Limits koennen Dienste pausieren. Kein Tarifupgrade ohne ausdrueckliche Zustimmung.

Nach dem Deployment die tatsaechliche `https://...onrender.com`-Adresse in `public/config.js` unter `apiBaseUrl` eintragen und committen. Diese Datei enthaelt nur oeffentliche Konfiguration, niemals Tokens oder Passwoerter. Die App wird automatisch neu veroeffentlicht. CORS ist auf `https://amirhossin27-dev.github.io` begrenzt; fuer andere Frontends `ALLOWED_ORIGINS` in Render anpassen.

## iPhone

App-Link in Safari oeffnen, Teilen -> Zum Home-Bildschirm -> ggf. Als Web-App oeffnen. Jede App hat ein eigenes Manifest, Icon und einen eigenen Service-Worker-Bereich. Der Offline-Cache speichert nur die Oberflaeche, niemals Live-Daten. Internet bleibt fuer Kurse/Ergebnisse erforderlich.

## Dashboard-Einbettung

Das Dashboard verwendet `?embed=1&view=compact&lang=de&theme=dark&parentOrigin=<Dashboard-Origin>`. Ohne `view=compact` erscheint die volle Ansicht. Elternfenster und App kommunizieren nur mit konkreter Herkunft, niemals mit `*`. Das Dashboard prueft sowohl Origin als auch das sendende iframe; Hoehen sind auf 240..2200 Pixel begrenzt. Der Host bietet immer einen separaten App-Link als Ausweichmoeglichkeit.

## Push-Mitteilungen

Bei Tor, aberkanntem Tor, Roter und Gelb-Roter Karte in Favoritenspielen (Fussball) schickt ein Cloudflare Worker (`worker/`, Gratistarif) eine Web-Push-Mitteilung, auch bei geschlossener App. Er prueft jede Minute per Cron, weckt Render nur rund um die Anstosszeiten und speichert Abos, Favoriten und Spielstaende in einem Durable Object. Auf dem iPhone geht das ab iOS 16.4 und nur in der vom Home-Bildschirm geoeffneten App. Einschalten unter Einstellungen; die Statuszeile darunter zeigt, ob der Waechter laeuft und das Geraet registriert ist.

Einmalige Einrichtung:

```powershell
cd worker
npm ci
npx wrangler login              # eigenes, kostenloses Cloudflare-Konto
npm run vapid                   # erzeugt das Schluesselpaar
npx wrangler secret put VAPID_PRIVATE_KEY   # privaten JWK einfuegen, nie committen
# oeffentlichen Schluessel in wrangler.jsonc (vars.VAPID_PUBLIC_KEY) eintragen
npm run deploy
```

Danach `pushWorkerUrl` (die `https://...workers.dev`-Adresse) und `vapidPublicKey` in `public/config.js` eintragen. Pruefen: `GET <pushWorkerUrl>/health` zeigt den letzten Cron-Lauf. Tests: `npm test --prefix worker`.

## Einstellungen und Daten

Favoriten, Watchlist und Zeichnungen bleiben im jeweiligen Browser; kein Login und keine geraeteuebergreifende Synchronisation. Die API liest ausschliesslich oeffentliche Sport-/Marktdaten. Keine Firmenkonten, Mitarbeiterdaten, Datenbanken oder geheimen Schluessel aus dem Company Dashboard sind enthalten. Die bisherigen teils inoffiziellen Datenquellen koennen Anfragen begrenzen oder ausfallen; Verfuegbarkeit und Echtzeit sind nicht garantiert.

## Herkunft

Gezielte Auskopplung der vorhandenen Live Scores-Funktionen aus dem Company Dashboard (Stand 14.11.2026). Kuenftige Aenderungen erfolgen hier. Eine gemeinsame Daten-API allein uebertraegt keine UI-Aenderungen; die Dashboard-Einbettung tut dies nach Veroeffentlichung und Neuladen.
