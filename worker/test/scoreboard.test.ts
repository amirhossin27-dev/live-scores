import { parseBoard } from '../src/scoreboard'
import { afterEach, expect, test, vi } from 'vitest'
import { route, type WatcherApi } from '../src/router'

const request = (ids: string, date = '20261123') => new Request('https://scores.example/api/sports/scores?date=' + date + '&competitions=' + ids, { headers: { Origin: 'https://amirhossin27-dev.github.io' } })
const watcher = {} as WatcherApi
afterEach(() => vi.unstubAllGlobals())
test('reads public ESPN results and distinguishes an upstream failure from an empty league', async () => {
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    if (options.redirect !== 'manual') throw new Error('Unsupported redirect mode in Workers')
    return url.includes('ger.1')
    ? Response.json({ leagues: [{ name: 'Bundesliga' }], events: [] })
    : Response.json({ error: 'unavailable' }, { status: 503 })
  })
  vi.stubGlobal('fetch', fetcher)
  const response = await route(request('soccer/ger.1,soccer/eng.1'), watcher)
  expect(response.status).toBe(200)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://amirhossin27-dev.github.io')
  expect(await response.json()).toMatchObject({ date: '20261123', fetchedAt: expect.any(Number),
    competitions: [{ id: 'soccer/ger.1', name: 'Bundesliga', matches: [] }], failed: ['soccer/eng.1'] })
  expect(fetcher.mock.calls.map(([url]) => new URL(url).hostname)).toEqual(['site.api.espn.com', 'site.api.espn.com'])
})
test('rejects invalid dates and invalid leagues before fetching', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  for (const req of [request('soccer/ger.1','20260230'), request('soccer/..')])
    expect((await route(req, watcher)).status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})
test('reuses a complete response for 30 seconds with its original timestamp and fresh CORS headers', async () => {
  const entries = new Map<string, Response>()
  const cache = { match: async (key: string) => entries.get(key)?.clone(), put: async (key: string, value: Response) => { entries.set(key, value) } }
  vi.stubGlobal('caches', { default: cache })
  const source = vi.fn(async () => Response.json({ events: [] }))
  vi.stubGlobal('fetch', source)
  const first = await route(request('soccer/ger.1,soccer/eng.1'), watcher)
  const reordered = request('soccer/eng.1,soccer/ger.1')
  reordered.headers.set('Origin','http://localhost:5180')
  const second = await route(reordered, watcher)
  expect(await second.json()).toEqual(await first.json())
  expect(source).toHaveBeenCalledTimes(2)
  expect([...entries.values()][0].headers.get('Cache-Control')).toContain('max-age=30')
  expect(second.headers.get('Cache-Control')).toBe('no-store')
  expect(second.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5180')
})
test('preserves home/away, live clock, notes and second yellow cards for match details', () => {
  const match = parseBoard('soccer/ger.1', { events: [{ id: '17', date: '2026-11-23T14:00Z', competitions: [{
    competitors: [{ homeAway: 'away', team: { id: '2', displayName: 'Away' }, score: '0' }, { homeAway: 'home', team: { id: '1', displayName: 'Home' }, score: '1' }],
    status: { type: { state: 'in', shortDetail: 'Live' }, displayClock: '62' }, notes: [{ headline: 'Round 1' }],
    details: [{ yellowCard: true, team: { id: '1' }, athletesInvolved: [{ id: '19' }] }, { redCard: true, team: { id: '1' }, athletesInvolved: [{ id: '19' }] }]
  }] }] }).matches[0]
  expect(match).toMatchObject({ id: '17', status: 'live', statusText: '62', detail: 'Round 1', home: { name: 'Home', score: '1', yellowRedCards: 1, redCards: 0 }, away: { name: 'Away', score: '0' } })
})
test('keeps race sessions and individual fight IDs navigable', () => {
  const fighters = [{ athlete: { fullName: 'A' }, winner: true }, { athlete: { fullName: 'B' } }]
  const event = { id: '7', name: 'Final', date: '2026-11-23T14:00Z', competitions: [
    { id: '8', status: { type: { state: 'post' } }, competitors: fighters }, { id: '9', type: { text: 'Race' }, status: { type: { state: 'post' } }, competitors: fighters }] }
  expect(parseBoard('mma/ufc', { events: [event] }).matches.map(m => m.id)).toEqual(['9', '8'])
  expect(parseBoard('racing/f1', { events: [event] }).matches).toMatchObject([{ id: '7', status: 'finished', home: { name: 'A' }, away: null, detail: 'Race' }])
})
test('a total source outage returns an error', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ message: 'unknown response' }))
  expect((await route(request('soccer/ger.1'), watcher)).status).toBe(502)
})
