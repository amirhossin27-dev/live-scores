# Push-Mitteilungen bei Toren und Roten Karten – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das iPhone bekommt Web-Push-Mitteilungen bei Tor, aberkanntem Tor, Roter und Gelb-Roter Karte in Favoritenspielen, auch wenn die App geschlossen ist.

**Architecture:** Ein neuer Cloudflare Worker (`worker/`) mit genau einem SQLite-basierten Durable Object „Watcher“ speichert Abos, Favoriten, Tagesplan und den letzten Spielstand. Ein Cron-Trigger ruft ihn jede Minute auf. Er fragt Render nur für Spiele im Zeitfenster ab, erkennt Ereignisse per Vergleich und schickt verschlüsselte Web-Push-Nachrichten (VAPID + RFC 8291). Die App bekommt einen Schalter, eine Statuszeile, einen Favoriten-Abgleich und Push-Handler im Service Worker.

**Tech Stack:** Cloudflare Workers (Free) + Durable Objects (SQLite) + Cron Trigger, TypeScript, WebCrypto, Vitest; bestehendes React 19/Vite/Vitest im Frontend; C#-Backend bleibt unverändert.

**Spec:** `docs/superpowers/specs/2026-11-16-push-notifications-design.md` (von Amir am 16.11.2026 freigegeben)

**Basis:** Branch `feat/push-notifications` von `fix/compact-design-fidelity` (`1277b18`, neueste Oberfläche). `main` enthält zusätzlich `905999b` (Render-Anbindung). Vor dem Release mit `main` zusammenführen. Das ist ein eigener Schritt mit Amirs Freigabe in Task 7.

## Global Constraints

- **Speicher:** Statt KV wird **ein Durable Object (SQLite-Backend)** genutzt. Grund: KV erlaubt im Gratistarif nur 1.000 Schreibvorgänge pro Tag und ist nur verzögert konsistent; das Durable Object ist konsistent und darf im Gratistarif 100.000 Zeilen pro Tag schreiben. Die Ziele der Spec bleiben gleich.
- Nur Fußball: Wettbewerbs-IDs beginnen mit `soccer/`. Alles andere wird beim Speichern verworfen.
- Ereignisse: `goal`, `goal-cancelled`, `red`, `yellow-red`. Keine weiteren.
- Texte (exakt, Deutsch):
  - Tor: Titel `⚽ Tor für {Team}`
  - Rot: Titel `🟥 Rot für {Team}`
  - Gelb-Rot: Titel `🟨🟥 Gelb-Rot für {Team}`
  - Aberkannt: Titel `Tor aberkannt`
  - Text: `{Heim} {h}:{a} {Gast}`, dann `· {Minute}`, wenn `statusText` nicht leer ist, dann `· {Spieler}`, wenn bekannt
  - Ausfall: Titel `⚠️ Live-Daten gerade nicht erreichbar`, Text `Mitteilungen können fehlen.`
  - Entwarnung: Titel `✅ Live-Daten wieder da`, Text `Mitteilungen laufen wieder.`
- Zeitfenster: von Anstoß − 3 Min. bis `finished|postponed|canceled`, höchstens Anstoß + 4 h.
- Ausfall-Mitteilung nach **10 Minuten** ohne Daten während eines Spiels nach Anstoß, einmal pro Ausfall.
- Statuszeile warnt, wenn der letzte Cron-Lauf **länger als 5 Minuten** her ist.
- Höchstens **10 Abos**. Ist die Grenze voll, wird das am längsten nicht gesehene verdrängt.
- Erlaubte Push-Hosts: `web.push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`. Immer `https`.
- CORS nur für `https://amirhossin27-dev.github.io`, `http://localhost:5180` und `http://127.0.0.1:5180`.
- VAPID-`sub` ist `https://amirhossin27-dev.github.io/live-scores/`, **keine E-Mail-Adresse**.
- Privater VAPID-Schlüssel nur als Worker-Secret `VAPID_PRIVATE_KEY` (JWK). `public/config.js` bekommt nur `pushWorkerUrl` und `vapidPublicKey`.
- Im Service Worker werden keine Live-Daten gecacht. Fetch- und Cache-Logik bleiben unverändert.
- Kein Schalter und keine Synchronisation in `?embed=1`.
- Kein Bezahltarif. Render bleibt `free`.
- Vor jedem Abschluss: `npm test`, `npm run build`, `dotnet build backend/App.Api`, `npm test --prefix worker`.

## Review Focus

1. **Cron-Läufe überlappen** (Render-Kaltstart > 60 s): Ein zweiter Lauf darf weder doppelt melden noch den Stand zurücksetzen. Erwartet: Der zweite Lauf überspringt (Lease). Test in Task 4.
2. **Stern während eines laufenden Spiels** bei 2:1: keine Mitteilungen für die schon gefallenen Tore. Test in Task 4.
3. **Abo nach iOS-Neuinstallation oder Endpunktwechsel:** Das alte Abo bekommt 410 und wird gelöscht. Beim nächsten App-Start meldet sich das Gerät neu an, und die Statuszeile zeigt „registriert“. Tests in Task 4 und Task 6.
4. **Spiel über Mitternacht** (Anstoß 21:00, Ende 23:10, oder Anstoß 00:30 in einem Wettbewerb mit Stern): Es bleibt im Zeitfenster bzw. landet im Tagesplan. Test in Task 3.
5. **Render liefert `failed` für einen Wettbewerb** oder antwortet mit 5xx: Das zählt als „keine Daten“. Der Stand bleibt erhalten, und nach 10 Minuten kommt genau eine Ausfall-Mitteilung. Test in Task 4.

---

### Task 1: Worker-Gerüst und Web-Push-Krypto

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/wrangler.jsonc`, `worker/vitest.config.ts`
- Create: `worker/src/webpush.ts`
- Test: `worker/test/webpush.test.ts`

**Interfaces:**
- Produces:
  - `interface PushSubscriptionJSON { endpoint: string; keys: { p256dh: string; auth: string } }`
  - `encryptPayload(sub: PushSubscriptionJSON, plaintext: Uint8Array, opts?: { salt?: Uint8Array; serverKeys?: CryptoKeyPair }): Promise<Uint8Array>` liefert den kompletten `aes128gcm`-Body (Header + Ciphertext, ein Record, rs=4096)
  - `vapidAuthorization(endpoint: string, vapid: { publicKey: string; privateKeyJwk: JsonWebKey; subject: string }, now: number): Promise<string>` liefert `vapid t=…, k=…` mit `exp = now/1000 + 12h`
  - `sendPush(sub, payload: object, vapid, now: number, fetchFn = fetch): Promise<{ status: number }>` schickt per POST mit den Headern `Content-Encoding: aes128gcm`, `TTL: 3600`, `Urgency: high`, `Authorization`
  - `base64url` / `fromBase64url` als Helfer

- [ ] **Step 1:** Branch `feat/push-notifications` anlegen. Gerüst erstellen:
  - `package.json` mit Skripten `test` (`vitest run`), `deploy` (`wrangler deploy`) und `vapid` (`node scripts/vapid.mjs`)
  - devDependencies `wrangler`, `vitest`, `typescript`, `@cloudflare/workers-types`
  - `wrangler.jsonc`:
    - `name: "live-scores-push"`
    - `main: "src/index.ts"`
    - `triggers.crons: ["* * * * *"]`
    - Durable Object Binding `WATCHER` → Klasse `Watcher`
    - `migrations: [{ tag: "v1", new_sqlite_classes: ["Watcher"] }]`
    - `vars: { API_BASE_URL: "https://amir-live-scores-api.onrender.com", VAPID_PUBLIC_KEY: "" }`
  - `scripts/vapid.mjs` erzeugt ein P-256-Schlüsselpaar und gibt den öffentlichen Schlüssel (base64url, raw, 65 Byte) und den privaten Schlüssel als JWK aus
- [ ] **Step 2: Failing tests schreiben**

```ts
test('encryptPayload round-trips with the receiver key (RFC 8291)', async () => {
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const sub = { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: base64url(await rawPublic(receiver)), auth: base64url(auth) } }
  const body = await encryptPayload(sub, new TextEncoder().encode('{"title":"⚽"}'))
  expect(new TextDecoder().decode(await decryptForTest(body, receiver, auth))).toBe('{"title":"⚽"}')
})
test('encryptPayload matches RFC 8291 Appendix A', async () => { /* Werte aus RFC 8291 Anhang A (salt, Schlüssel, auth) übernehmen; Ergebnis byte-gleich */ })
test('vapidAuthorization signs ES256 for the endpoint origin with 12h expiry', async () => {
  const header = await vapidAuthorization('https://web.push.apple.com/abc', vapid, 1_700_000_000_000)
  const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!
  const claims = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  expect(claims).toEqual({ aud: 'https://web.push.apple.com', exp: 1_700_000_000 + 12 * 3600, sub: 'https://amirhossin27-dev.github.io/live-scores/' })
  expect(await verifyEs256(jwt, k)).toBe(true)
})
test('sendPush posts aes128gcm with TTL and urgency and returns the status', async () => { /* fetchFn-Fake prüft Header, gibt 201 */ })
```

  `decryptForTest`, `rawPublic` und `verifyEs256` sind Test-Helfer in `test/helpers.ts`.
- [ ] **Step 3:** `cd worker && npm install && npm test` muss scheitern, weil die Funktionen noch fehlen.
- [ ] **Step 4:** `webpush.ts` mit WebCrypto implementieren: ECDH, HKDF-SHA-256 mit `"WebPush: info\0" + ua_public + as_public`, dann CEK/Nonce-Info `"Content-Encoding: aes128gcm\0"` bzw. `"Content-Encoding: nonce\0"`, AES-128-GCM, Padding-Delimiter `0x02`. Keine Abhängigkeit zur Laufzeit.
- [ ] **Step 5:** `npm test --prefix worker` → PASS
- [ ] **Step 6:** Commit `feat(worker): scaffold push worker with web push encryption`

### Task 2: Ereignis-Erkennung und Mitteilungstexte

**Files:**
- Create: `worker/src/types.ts`, `worker/src/events.ts`, `worker/src/messages.ts`
- Test: `worker/test/events.test.ts`, `worker/test/messages.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `interface ApiSide { name: string; shortName?: string | null; score?: string | null; redCards?: number | null; yellowRedCards?: number | null }`
  - `interface ApiMatch { id: string; start: string; status: 'scheduled'|'live'|'finished'|'postponed'|'canceled'; statusText: string; home?: ApiSide | null; away?: ApiSide | null }`
  - `interface MatchState { home: number; away: number; homeOff: number; awayOff: number; homeRed: number; awayRed: number }`
  - `type MatchEventKind = 'goal' | 'goal-cancelled' | 'red' | 'yellow-red'`
  - `interface MatchEvent { kind: MatchEventKind; side: 'home' | 'away'; index: number }`, wobei `index` die laufende Nummer des Tors bzw. Platzverweises dieser Seite ist (für `tag`)
- Produces (`events.ts`):
  - `stateOf(match: ApiMatch): MatchState | null` liefert `null`, wenn ein Score fehlt oder nicht numerisch ist
  - `detectEvents(prev: MatchState | undefined, next: MatchState): MatchEvent[]` liefert `[]`, wenn `prev` fehlt
- Produces (`messages.ts`):
  - `interface PushMessage { title: string; body: string; tag: string; url: string }`
  - `buildEventMessage(competition: string, match: ApiMatch, event: MatchEvent, player?: string): PushMessage` mit `url: "./"` und `tag: "{competition}|{id}|{kind}|{side}|{index}"`
  - `outageMessage(): PushMessage`, `recoveryMessage(): PushMessage`

- [ ] **Step 1: Failing tests**

```ts
const s = (home: number, away: number, homeOff = 0, awayOff = 0, homeRed = 0, awayRed = 0) => ({ home, away, homeOff, awayOff, homeRed, awayRed })
test('first sight reports nothing', () => expect(detectEvents(undefined, s(2, 1))).toEqual([]))
test('one goal per goal, even two between polls', () =>
  expect(detectEvents(s(0, 0), s(2, 0))).toEqual([{ kind: 'goal', side: 'home', index: 1 }, { kind: 'goal', side: 'home', index: 2 }]))
test('a lower score is a cancelled goal', () =>
  expect(detectEvents(s(2, 1), s(1, 1))).toEqual([{ kind: 'goal-cancelled', side: 'home', index: 2 }]))
test('a sending-off by the sum; a red re-filed as second yellow is no new event', () => {
  expect(detectEvents(s(0, 0, 0, 0, 0, 0), s(0, 0, 0, 1, 0, 1))).toEqual([{ kind: 'red', side: 'away', index: 1 }])
  expect(detectEvents(s(0, 0, 0, 1, 0, 1), s(0, 0, 0, 1, 0, 0))).toEqual([])
})
test('a second yellow is reported as yellow-red', () =>
  expect(detectEvents(s(0, 0), s(0, 0, 1, 0, 0, 0))).toEqual([{ kind: 'yellow-red', side: 'home', index: 1 }]))
test('stateOf ignores matches without numeric scores', () => expect(stateOf({ ...live, home: { name: 'A', score: null } })).toBeNull())
test('goal message', () => expect(buildEventMessage('soccer/ger.1', bayernDortmund21At67, { kind: 'goal', side: 'home', index: 2 }, 'Musiala'))
  .toEqual({ title: '⚽ Tor für Bayern', body: 'Bayern 2:1 Dortmund · 67\' · Musiala', tag: 'soccer/ger.1|123|goal|home|2', url: './' }))
test('no minute and no player leave no dangling dots', () => /* statusText '' und player undefined → 'Bayern 2:1 Dortmund' */)
```

  - `MatchState.homeOff` und `awayOff` = `redCards + yellowRedCards`; `homeRed` und `awayRed` = `redCards`.
  - Steigt die Summe `homeOff`, ist das Ereignis `red`, wenn `homeRed` gestiegen ist, sonst `yellow-red`.
  - Teamname im Text: `shortName ?? name`.
- [ ] **Step 2:** `npm test --prefix worker` → FAIL
- [ ] **Step 3:** `events.ts` und `messages.ts` implementieren
- [ ] **Step 4:** `npm test --prefix worker` → PASS
- [ ] **Step 5:** Commit `feat(worker): detect goals and sending-offs and build messages`

### Task 3: Abos, Favoriten und Zeitfenster

**Files:**
- Create: `worker/src/subscriptions.ts`, `worker/src/schedule.ts`
- Test: `worker/test/subscriptions.test.ts`, `worker/test/schedule.test.ts`

**Interfaces:**
- Produces:
  - `interface FavoriteMatch { competition: string; id: string; start: string }`
  - `interface DeviceRecord { key: string; subscription: PushSubscriptionJSON; favorites: FavoriteMatch[]; competitions: string[]; lastSeen: number }`
  - `parseRegistration(body: unknown): { subscription: PushSubscriptionJSON; favorites: FavoriteMatch[]; competitions: string[] } | { error: string }` filtert auf `soccer/`, höchstens 200 Favoriten und 40 Wettbewerbe, Endpunkt-Host aus der Erlaubtliste, `keys` base64url-dekodierbar
  - `endpointKey(endpoint: string): Promise<string>` liefert SHA-256 als hex
  - `interface ScheduledMatch { competition: string; id: string; start: string }`
  - `berlinDay(now: number, offsetDays = 0): string` liefert `YYYYMMDD` in Europe/Berlin
  - `scheduleDays(now: number): string[]` liefert `[berlinDay(now), berlinDay(now, 1)]`
  - `apiDaysFor(start: string): string[]` liefert den Berlin-Tag des Anstoßes und, falls anders, den UTC-Tag
  - `inWindow(start: string, status: ApiMatch['status'] | undefined, now: number): boolean` gemäß Global Constraints
  - `watchedMatches(devices: DeviceRecord[], schedule: ScheduledMatch[], finished: Set<string>, now: number): Map<string, { match: ScheduledMatch; devices: string[] }>`, Schlüssel `competition|id`. Vereinigt Einzel-Favoriten und Spiele aus dem Tagesplan der Favoriten-Wettbewerbe, nur im Fenster.

- [ ] **Step 1: Failing tests**, u. a.:

```ts
test('rejects endpoints outside the known push services', async () =>
  expect(parseRegistration({ subscription: { endpoint: 'https://evil.example/x', keys }, favorites: [], competitions: [] })).toEqual({ error: expect.any(String) }))
test('drops non-football favourites and competitions', () => { /* 'racing/f1' fällt raus, 'soccer/ger.1' bleibt */ })
test('window opens 3 minutes before kick-off and closes at full time or after 4 hours', () => {
  const start = '2026-11-21T14:30:00Z', t = Date.parse(start)
  expect(inWindow(start, 'scheduled', t - 4 * 60_000)).toBe(false)
  expect(inWindow(start, 'scheduled', t - 3 * 60_000)).toBe(true)
  expect(inWindow(start, 'live', t + 3.9 * 3600_000)).toBe(true)
  expect(inWindow(start, 'live', t + 4 * 3600_000 + 1)).toBe(false)
  expect(inWindow(start, 'finished', t + 100 * 60_000)).toBe(false)
})
test('a 21:00 match stays watched after midnight', () => { /* Anstoß 2026-11-21T20:00Z, now 2026-11-21T23:05Z, status live → im Fenster */ })
test('scheduleDays covers today and tomorrow in Berlin', () => expect(scheduleDays(Date.parse('2026-11-21T23:30:00Z'))).toEqual(['20261122', '20261123']))
test('watchedMatches merges single favourites and favourite competitions per device', () => { /* zwei Geräte, gleiches Spiel → devices beide */ })
```

- [ ] **Step 2:** FAIL bestätigen
- [ ] **Step 3:** Implementieren. Berlin-Tag über `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })`.
- [ ] **Step 4:** `npm test --prefix worker` → PASS
- [ ] **Step 5:** Commit `feat(worker): validate registrations and compute watch windows`

### Task 4: Watcher-Logik (Cron-Lauf)

**Files:**
- Create: `worker/src/store.ts`, `worker/src/watcher.ts`
- Test: `worker/test/watcher.test.ts`

**Interfaces:**
- Consumes: alles aus Task 1–3
- Produces:
  - `interface Store { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void>; delete(key: string): Promise<void>; list<T>(prefix: string): Promise<Map<string, T>> }`, implementiert von `MemoryStore` (für Tests) und `DurableStore(ctx.storage)`
  - Schlüssel:
    - `device:{key}` → `DeviceRecord`
    - `schedule` → `{ days: string[]; fetchedAt: number; competitions: string[]; matches: ScheduledMatch[] }`
    - `state:{competition|id}` → `MatchState & { status: string }`
    - `meta` → `{ lastTickAt: number; lastSuccessAt?: number; lastError?: string; outageSince?: number; outageNotified?: boolean; leaseUntil?: number }`
  - `interface WatcherDeps { store: Store; now: () => number; api: (path: string) => Promise<Response>; push: (sub: PushSubscriptionJSON, msg: PushMessage) => Promise<{ status: number }> }`
  - `tick(deps: WatcherDeps): Promise<void>`
  - `register(deps, body: unknown): Promise<{ ok: true; key: string } | { error: string }>` und `unregister(deps, endpoint: string): Promise<void>`
  - `status(deps, endpoint: string): Promise<{ registered: boolean; lastTickAt: number | null; scheduleReady: boolean; favoritesToday: number; lastError: string | null }>`

Ablauf von `tick`:
1. **Lease:** Ist `meta.leaseUntil > now`, abbrechen. Sonst `leaseUntil = now + 5 min` setzen und am Ende im `finally` freigeben.
2. `lastTickAt` schreiben.
3. **Tagesplan neu holen**, wenn `schedule.days` nicht `scheduleDays(now)` entspricht, die Wettbewerbs-Menge sich geändert hat (Flag `scheduleDirty`, das `register` setzt) oder der letzte Versuch fehlschlug und 15 Minuten her ist. Dabei `/api/sports/scores?competitions=…&date=…` je Tag abfragen; höchstens 40 Wettbewerbe pro Aufruf.
4. `watchedMatches` bestimmen. Ist die Menge leer: fertig, kein Aufruf an Render.
5. Je API-Tag der beobachteten Spiele **einen** `/scores`-Aufruf mit allen betroffenen Wettbewerben machen. Jedes Spiel per `stateOf`, `detectEvents` und den Status bearbeiten.
6. Bei Ereignissen: Den Spielernamen einmal pro Spiel und Lauf über `/api/sports/match` holen; das jüngste Event passender Art und Seite liefert `player`. Fehler dabei werden ignoriert. Dann **zuerst den neuen Stand speichern, danach senden** (lieber einmal zu wenig als doppelt). Gesendet wird an alle `devices` des Spiels. Bei 404/410 das Gerät löschen.
7. Ein Wettbewerb in `failed`, ein Spiel fehlt in der Antwort, HTTP ≠ 200 oder eine Exception gelten als „keine Daten“. Der Stand bleibt unverändert, `lastError` wird gesetzt.
8. **Ausfall:** Läuft mindestens ein beobachtetes Spiel schon nach Anstoß und kommen für ein solches Spiel seit `outageSince` mindestens 10 Minuten keine Daten, an alle Geräte mit beobachteten Spielen einmal `outageMessage` schicken (`outageNotified = true`). Beim ersten Erfolg danach `recoveryMessage` an dieselben Geräte schicken und die Flags zurücksetzen. Die Tore aus der Lücke meldet Schritt 5 automatisch.
9. `state:*` von Spielen löschen, die beendet sind und älter als 6 h.

- [ ] **Step 1: Failing tests** mit `MemoryStore`, fester Uhr, API-Fake und Push-Spy:
  - `no watched match → no API call`
  - `first tick on a running 2:1 stores the state and sends nothing`
  - `goal between ticks → exactly one push to each device that watches the match, with scorer from /match`
  - `scorer lookup fails → push without player`
  - `overlapping tick while lease is held does nothing`. Prüfung: Zwei `tick`s laufen parallel, die API antwortet erst nach dem zweiten Start; es gibt genau einen Push.
  - `410 from push service deletes the device`
  - `failed competition counts as no data; after 10 minutes exactly one outage push, then recovery push and the missed goal`
  - `schedule refreshes on new Berlin day and after register; scheduled competition match appears in watched set`
  - `status reports registered, lastTickAt, scheduleReady and favoritesToday`
  - `register over limit evicts the least recently seen device`
- [ ] **Step 2:** FAIL bestätigen
- [ ] **Step 3:** `store.ts` und `watcher.ts` implementieren
- [ ] **Step 4:** `npm test --prefix worker` → PASS
- [ ] **Step 5:** Commit `feat(worker): watch favourite matches and push events`

### Task 5: Worker-Einstieg (HTTP, Cron, Durable Object)

**Files:**
- Create: `worker/src/index.ts`
- Test: `worker/test/index.test.ts`

**Interfaces:**
- Consumes: `tick`, `register`, `unregister`, `status`, `sendPush`
- Produces (HTTP, JSON):
  - `PUT /subscription` mit Body `{ subscription, favorites, competitions }` → `200 { ok: true }` | `400 { error }`
  - `DELETE /subscription` mit Body `{ endpoint }` → `204`
  - `POST /subscription/status` mit Body `{ endpoint }` → Status-Objekt aus Task 4
  - `GET /health` → `{ lastTickAt, lastSuccessAt, devices: number, lastError }`
  - `OPTIONS` → CORS-Preflight. Jede andere Origin bekommt keine CORS-Header.
  - `export class Watcher extends DurableObject` mit RPC-Methoden `tick()`, `register(body)`, `unregister(endpoint)`, `status(endpoint)`, `health()`. Es gibt genau eine Instanz: `idFromName("main")`.
  - `export default { fetch, scheduled }`: `scheduled` ruft `env.WATCHER.get(id).tick()` auf
  - `push` in den Deps baut `sendPush` mit `env.VAPID_PUBLIC_KEY` und `JSON.parse(env.VAPID_PRIVATE_KEY)`

- [ ] **Step 1: Failing tests** für den Router als reine Funktion `route(request: Request, watcher: WatcherApi, allowedOrigins: string[]): Promise<Response>`:
  - CORS nur für erlaubte Origins
  - unbekannter Pfad → 404
  - Body über 32 KB → 413
  - kaputtes JSON → 400
- [ ] **Step 2:** FAIL bestätigen
- [ ] **Step 3:** Implementieren
- [ ] **Step 4:** `npm test --prefix worker` und `npx tsc --noEmit -p worker` → PASS
- [ ] **Step 5:** CI erweitern: In `.github/workflows/pages.yml` nach `npm test` die Schritte `npm ci --prefix worker` und `npm test --prefix worker` einfügen. Die README bekommt den Abschnitt „Push-Mitteilungen“ mit den Einrichtungsschritten aus der Spec.
- [ ] **Step 6:** Commit `feat(worker): http api, cron trigger and durable object`

### Task 6: App – Service Worker, Schalter, Statuszeile, Abgleich

**Files:**
- Create: `src/swPush.mjs` (exportiert `swPushSource: string`), `tests/swPush.test.mjs`
- Modify: `vite.config.ts` (hängt `swPushSource` an die erzeugte `sw.js` an)
- Modify: `src/vite-env.d.ts` (`APP_CONFIG` um `pushWorkerUrl?: string; vapidPublicKey?: string` ergänzen)
- Create: `src/features/notifications/pushClient.ts`, `src/features/notifications/usePushSync.ts`, `src/features/notifications/NotificationSettings.tsx`, `src/features/notifications/notifications.css`
- Test: `src/features/notifications/pushClient.test.ts`, `src/features/notifications/NotificationSettings.test.tsx`
- Modify: `src/features/overview/SportsWidget.tsx` (`SportsSettings` zeigt oben `<NotificationSettings>`, außer in `embed`; `usePushSync(favorites, favoriteLeagues)` im Widget)

**Interfaces:**
- Consumes: Worker-HTTP-API aus Task 5; `readSportsFavorites`, `readFavoriteCompetitions` und `readViewOptions`
- Produces:
  - `type PushAvailability = 'no-config' | 'unsupported' | 'not-installed' | 'denied' | 'ready'`
  - `pushAvailability(): PushAvailability`. `not-installed`, wenn `matchMedia('(display-mode: standalone)')` nicht greift und `navigator.standalone` nicht `true` ist.
  - `enablePush(favorites, competitions): Promise<void>` (Erlaubnis anfragen, `subscribe` mit `applicationServerKey` aus `vapidPublicKey`, `PUT`)
  - `disablePush(): Promise<void>` (`DELETE`, `unsubscribe`)
  - `syncPush(favorites, competitions): Promise<void>` (nur wenn ein Abo besteht: `PUT`)
  - `type WorkerStatus = { registered: boolean; lastTickAt: number | null; scheduleReady: boolean; favoritesToday: number; lastError: string | null }` (gleiche Form wie `status()` aus Task 4)
  - `pushStatus(): Promise<WorkerStatus | null>`
  - Merker in localStorage: `dwh.sports.push.v1` = `'on' | 'off'`

Texte:
- Schalter: `Mitteilungen bei Toren & Roten Karten`
- Hinweise:
  - not-installed: `Zum Home-Bildschirm hinzufügen und die App von dort öffnen, dann hier einschalten.`
  - unsupported: `Dieses Gerät unterstützt keine Mitteilungen (iPhone: ab iOS 16.4).`
  - denied: `Mitteilungen sind blockiert. Erlauben unter Einstellungen → Mitteilungen → Live Scores.`
- Statuszeile OK: `Wächter aktiv vor {n} Min · dieses Gerät registriert · {k} Favoritenspiele heute`
- Warnungen (Klasse `is-warning`, rot):
  - `Wächter seit {n} Min nicht gelaufen`
  - `Gerät nicht registriert – wird neu angemeldet`
  - `Spielplan für heute fehlt`
  - `Wächter nicht erreichbar`

- [ ] **Step 1: Failing tests**
  - `tests/swPush.test.mjs`: `swPushSource` mit einem Fake-`self` auswerten. Ein `push`-Event mit `{title, body, tag, url}` ruft `showNotification(title, { body, tag, icon: 'icons/icon-192.png', data: { url } })` auf. `notificationclick` fokussiert ein offenes Fenster im Scope oder ruft `openWindow(url)` auf.
  - `pushClient.test.ts`:
    - Verfügbarkeit für alle fünf Zustände
    - `syncPush` macht ohne bestehendes Abo keinen Request
    - `enablePush` schickt nur `soccer/`-Favoriten
  - `NotificationSettings.test.tsx`:
    - Hinweis und deaktivierter Schalter bei `not-installed`
    - Statuszeile OK
    - Warnung bei `lastTickAt` vor 6 Min
    - `registered: false` → `syncPush` wird aufgerufen und der Warntext erscheint
    - In `embed` wird nichts gerendert
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** Implementieren. `usePushSync` ruft `syncPush` beim Mount und bei jeder Änderung der Favoriten auf (Debounce 1 s). Fehler werden still geschluckt; die Statuszeile zeigt sie.
- [ ] **Step 4:** `npm test` und `npm run build` → PASS. Im erzeugten `dist/sw.js` müssen die `push`- und `notificationclick`-Listener stehen, die Fetch-Logik unverändert.
- [ ] **Step 5:** Im Browser (Vorschau, 393 px) die Einstellungen mit Schalter, Hinweis und Statuszeile im hellen und dunklen Design prüfen. Kein Überlauf, Kompakt-Einbettung unverändert.
- [ ] **Step 6:** Commit `feat: push notification toggle, status line and service worker handlers`

### Task 7: Einrichtung, Veröffentlichung und Test auf dem iPhone (mit Amir)

Jeder Schritt mit Außenwirkung erst nach Amirs ausdrücklicher Freigabe im Chat.

- [ ] **Step 1:** Amir legt das Cloudflare-Konto an und führt `npx wrangler login` im Ordner `worker/` aus.
- [ ] **Step 2:** VAPID-Schlüssel erzeugen. Den privaten Schlüssel per `npx wrangler secret put VAPID_PRIVATE_KEY` setzen, den öffentlichen Schlüssel in `wrangler.jsonc` unter `vars` eintragen. Der private Schlüssel landet nie im Repo oder im Chat.
- [ ] **Step 3:** `npm run deploy --prefix worker`. Die `*.workers.dev`-Adresse notieren. `GET /health` muss nach 2 Minuten `lastTickAt` zeigen.
- [ ] **Step 4:** `public/config.js` um `pushWorkerUrl` und `vapidPublicKey` ergänzen.
- [ ] **Step 5:** `npm test`, `npm run build`, `dotnet build backend/App.Api` und `npm test --prefix worker` laufen grün. Branch mit `main` zusammenführen (Konflikt in `config.js` beachten: Render-URL behalten). Dann nach Freigabe nach `main` pushen, was die Pages-Bereitstellung auslöst.
- [ ] **Step 6:** Amir auf dem iPhone:
  1. App vom Home-Bildschirm öffnen
  2. Schalter einschalten und erlauben
  3. Die Statuszeile zeigt „registriert“
  4. Ein Live-Spiel mit Stern markieren
  5. Beim nächsten Tor kommt die Mitteilung bei geschlossener App
- [ ] **Step 7:** Plan-Häkchen und Nachweise eintragen. Commit `docs: record push notification release`
