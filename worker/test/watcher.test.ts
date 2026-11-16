import { beforeEach, describe, expect, test } from 'vitest'
import { MemoryStore } from '../src/store'
import { health, register, status, tick, unregister, type WatcherDeps } from '../src/watcher'
import type { PushMessage } from '../src/messages'
import type { ApiMatch } from '../src/types'
import type { PushSubscriptionJSON } from '../src/webpush'

const keys = { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' }
const sub = (name: string): PushSubscriptionJSON => ({ endpoint: `https://web.push.apple.com/${name}`, keys })
const kickOff = Date.parse('2026-11-21T14:30:00Z')
const minute = 60_000
const fav = { competition: 'soccer/ger.1', id: '7', start: '2026-11-21T14:30:00Z' }

function match(home: string | null, away: string | null, extra: Partial<ApiMatch> = {}): ApiMatch {
  return { id: '7', start: fav.start, status: 'live', statusText: "12'", home: { name: 'Bayern', score: home }, away: { name: 'Dortmund', score: away }, ...extra }
}

interface Harness { deps: WatcherDeps; sent: { endpoint: string; msg: PushMessage }[]; calls: string[]; setNow(t: number): void; setMatch(m: ApiMatch | 'error' | 'failed'): void; events: { kind: string; side: string; player: string }[]; pushStatus: number; detailsFail: boolean }

function harness(): Harness {
  let now = kickOff + 10 * minute
  let current: ApiMatch | 'error' | 'failed' = match('0', '0')
  const h: Harness = {
    sent: [], calls: [], events: [], pushStatus: 201, detailsFail: false,
    setNow: (t) => { now = t },
    setMatch: (m) => { current = m },
    deps: undefined as unknown as WatcherDeps,
  }
  h.deps = {
    store: new MemoryStore(),
    now: () => now,
    api: async (path) => {
      h.calls.push(path)
      if (path.startsWith('/api/sports/match?')) {
        if (h.detailsFail) return new Response('{}', { status: 502 })
        return Response.json({ events: h.events })
      }
      if (current === 'error') return new Response('{"error":"down"}', { status: 502 })
      const competitions = new URL(path, 'https://x').searchParams.get('competitions')!.split(',')
      if (current === 'failed') return Response.json({ date: '20261121', competitions: [], failed: competitions })
      return Response.json({ date: '20261121', competitions: competitions.map((id) => ({ id, name: id, matches: id === 'soccer/ger.1' ? [current] : [] })), failed: [] })
    },
    push: async (subscription, msg) => { h.sent.push({ endpoint: subscription.endpoint, msg }); return { status: h.pushStatus } },
  }
  return h
}

async function registerFav(h: Harness, name = 'a', favorites = [fav], competitions: string[] = []) {
  const result = await register(h.deps, { subscription: sub(name), favorites, competitions })
  expect(result).toMatchObject({ ok: true })
}

describe('tick', () => {
  let h: Harness
  beforeEach(() => { h = harness() })

  test('no watched match → no API call', async () => {
    await registerFav(h, 'a', [{ ...fav, start: '2026-11-21T19:30:00Z' }])
    await tick(h.deps)
    expect(h.calls).toEqual([])
  })

  test('first tick on a running 2:1 stores the state and sends nothing', async () => {
    await registerFav(h)
    h.setMatch(match('2', '1'))
    await tick(h.deps)
    expect(h.sent).toEqual([])
    h.setNow(kickOff + 11 * minute)
    await tick(h.deps)
    expect(h.sent).toEqual([])
  })

  test('goal between ticks → exactly one push to each device that watches the match, with scorer from /match', async () => {
    await registerFav(h, 'a')
    await registerFav(h, 'b')
    await registerFav(h, 'c', [])
    await tick(h.deps)
    h.events = [{ kind: 'goal', side: 'home', player: 'Musiala' }]
    h.setMatch(match('1', '0', { statusText: "23'" }))
    h.setNow(kickOff + 11 * minute)
    await tick(h.deps)
    expect(h.sent.map((s) => s.endpoint).sort()).toEqual([sub('a').endpoint, sub('b').endpoint])
    expect(h.sent[0].msg).toEqual({ title: '⚽ Tor für Bayern', body: "Bayern 1:0 Dortmund · 23' · Musiala", tag: 'soccer/ger.1|7|goal|home|1', url: './' })
    h.setNow(kickOff + 12 * minute)
    await tick(h.deps)
    expect(h.sent).toHaveLength(2)
  })

  test('scorer lookup fails → push without player', async () => {
    await registerFav(h)
    await tick(h.deps)
    h.detailsFail = true
    h.setMatch(match('0', '1', { statusText: '' }))
    h.setNow(kickOff + 11 * minute)
    await tick(h.deps)
    expect(h.sent.map((s) => s.msg.body)).toEqual(['Bayern 0:1 Dortmund'])
  })

  test('red card push names the player', async () => {
    await registerFav(h)
    await tick(h.deps)
    h.events = [{ kind: 'red', side: 'away', player: 'Can' }]
    h.setMatch(match('0', '0', { away: { name: 'Dortmund', score: '0', redCards: 1 } }))
    h.setNow(kickOff + 11 * minute)
    await tick(h.deps)
    expect(h.sent.map((s) => [s.msg.title, s.msg.body])).toEqual([['🟥 Rot für Dortmund', "Bayern 0:0 Dortmund · 12' · Can"]])
  })

  test('overlapping tick while lease is held does nothing', async () => {
    await registerFav(h)
    await tick(h.deps)
    h.setMatch(match('1', '0'))
    h.setNow(kickOff + 11 * minute)
    const slowApi = h.deps.api
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    h.deps.api = async (path) => { await gate; return slowApi(path) }
    const first = tick(h.deps)
    const second = tick(h.deps)
    release()
    await Promise.all([first, second])
    expect(h.sent).toHaveLength(1)
  })

  test('410 from push service deletes the device', async () => {
    await registerFav(h)
    await tick(h.deps)
    h.pushStatus = 410
    h.setMatch(match('1', '0'))
    h.setNow(kickOff + 11 * minute)
    await tick(h.deps)
    expect((await status(h.deps, sub('a').endpoint)).registered).toBe(false)
  })

  test('failed competition counts as no data; after 10 minutes exactly one outage push, then recovery push and the missed goal', async () => {
    await registerFav(h)
    await tick(h.deps)
    h.setMatch('failed')
    for (let m = 11; m <= 25; m++) { h.setNow(kickOff + m * minute); await tick(h.deps) }
    expect(h.sent.map((s) => s.msg.title)).toEqual(['⚠️ Live-Daten gerade nicht erreichbar'])
    h.setMatch('error')
    h.setNow(kickOff + 26 * minute); await tick(h.deps)
    expect(h.sent).toHaveLength(1)
    h.setMatch(match('1', '0'))
    h.setNow(kickOff + 27 * minute); await tick(h.deps)
    expect(h.sent.map((s) => s.msg.title)).toEqual(['⚠️ Live-Daten gerade nicht erreichbar', '✅ Live-Daten wieder da', '⚽ Tor für Bayern'])
  })

  test('a short gap under 10 minutes sends no outage push', async () => {
    await registerFav(h)
    await tick(h.deps)
    h.setMatch('error')
    for (let m = 11; m <= 19; m++) { h.setNow(kickOff + m * minute); await tick(h.deps) }
    h.setMatch(match('0', '0'))
    h.setNow(kickOff + 20 * minute); await tick(h.deps)
    expect(h.sent).toEqual([])
  })

  test('schedule refreshes on new Berlin day and after register; scheduled competition match appears in watched set', async () => {
    h.setNow(kickOff - 6 * 60 * minute)
    await registerFav(h, 'a', [], ['soccer/ger.1'])
    h.setMatch(match(null, null, { status: 'scheduled', statusText: '' }))
    await tick(h.deps)
    expect(h.calls.filter((c) => c.includes('date=20261121') || c.includes('date=20261122'))).toHaveLength(2)
    h.calls.length = 0
    h.setNow(kickOff - 5 * 60 * minute); await tick(h.deps)
    expect(h.calls).toEqual([])
    await registerFav(h, 'a', [], ['soccer/ger.1', 'soccer/eng.1'])
    await tick(h.deps)
    expect(h.calls).toHaveLength(2)
    h.calls.length = 0
    h.setMatch(match('0', '0'))
    h.setNow(kickOff + minute); await tick(h.deps)
    h.setMatch(match('1', '0'))
    h.setNow(kickOff + 2 * minute); await tick(h.deps)
    expect(h.sent.map((s) => s.msg.title)).toEqual(['⚽ Tor für Bayern'])
  })

  test('a match of a favourite competition running past midnight stays watched after the plan of the new day', async () => {
    const late = { ...fav, start: '2026-11-21T22:30:00Z' }
    h.setNow(Date.parse('2026-11-21T22:00:00Z'))
    await registerFav(h, 'a', [], ['soccer/ger.1'])
    h.setMatch(match('0', '0', { start: late.start, status: 'scheduled' }))
    await tick(h.deps)
    h.setMatch(match('0', '0', { start: late.start }))
    h.setNow(Date.parse('2026-11-21T22:40:00Z')); await tick(h.deps)
    h.setMatch('failed')
    h.setNow(Date.parse('2026-11-21T23:10:00Z')); await tick(h.deps)
    h.setMatch(match('1', '0', { start: late.start }))
    h.setNow(Date.parse('2026-11-21T23:11:00Z')); await tick(h.deps)
    expect(h.sent.map((s) => s.msg.title)).toEqual(['⚽ Tor für Bayern'])
  })
})

describe('register, status and health', () => {
  test('status reports registered, lastTickAt, scheduleReady and favoritesToday', async () => {
    const h = harness()
    expect(await status(h.deps, sub('a').endpoint)).toEqual({ registered: false, lastTickAt: null, scheduleReady: false, favoritesToday: 0, lastError: null })
    await registerFav(h, 'a', [fav, { ...fav, id: '8', start: '2026-11-25T14:30:00Z' }])
    await tick(h.deps)
    expect(await status(h.deps, sub('a').endpoint)).toEqual({ registered: true, lastTickAt: kickOff + 10 * minute, scheduleReady: true, favoritesToday: 1, lastError: null })
  })

  test('register over limit evicts the least recently seen device', async () => {
    const h = harness()
    for (let i = 0; i < 10; i++) { h.setNow(kickOff + i * minute); await registerFav(h, `d${i}`) }
    h.setNow(kickOff + 20 * minute)
    await registerFav(h, 'd0')
    await registerFav(h, 'new')
    expect((await status(h.deps, sub('d0').endpoint)).registered).toBe(true)
    expect((await status(h.deps, sub('d1').endpoint)).registered).toBe(false)
    expect((await status(h.deps, sub('new').endpoint)).registered).toBe(true)
    expect((await health(h.deps)).devices).toBe(10)
  })

  test('register rejects bad bodies and unregister removes the device', async () => {
    const h = harness()
    expect(await register(h.deps, { subscription: { endpoint: 'https://evil.example/x', keys } })).toEqual({ error: expect.any(String) })
    await registerFav(h)
    await unregister(h.deps, sub('a').endpoint)
    expect((await status(h.deps, sub('a').endpoint)).registered).toBe(false)
  })
})
