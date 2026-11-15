import { afterEach, expect, it, vi } from 'vitest'
import { readScoreSnapshot, saveScoreSnapshot } from './sportsScoreCache'
import type { SportsScores } from './sportsApi'

const source = 'https://api.example'
const now = 1_800_000_000_000
const date = '20261115'
const league = 'soccer/ger.1'
const other = 'soccer/eng.1'
function scores(ids = [league]): SportsScores {
  return { date, failed: [], competitions: ids.map(id => ({ id, name: id, matches: [{ id: 'match1', start: '2026-11-15T18:00:00Z', status: 'live', statusText: '67', title: null, detail: null, home: { name: 'Bayern', shortName: null, logo: null, score: '2', winner: null }, away: { name: 'Dortmund', shortName: null, logo: null, score: '1', winner: null } }] })) }
}
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })
it('keeps original timestamps and isolates source, date and requested competitions', () => {
  saveScoreSnapshot(source, scores([league, other]), now)
  const subset = readScoreSnapshot(source, [other], date, now + 30_000)!
  expect(subset.scores.competitions.map(c => c.id)).toEqual([other])
  expect(subset.at).toBe(now)
  expect(subset.complete).toBe(true)
  expect(readScoreSnapshot(source, [league, 'soccer/fra.1'], date, now)?.complete).toBe(false)
  expect(readScoreSnapshot(source + '/new', [league], date, now)).toBeNull()
  expect(readScoreSnapshot(source, [league], '20261116', now)).toBeNull()
  expect(readScoreSnapshot(source, ['soccer/fra.1'], date, now)).toBeNull()
})
it('expires snapshots after 48 hours and ignores future timestamps', () => {
  saveScoreSnapshot(source, scores(), now)
  expect(readScoreSnapshot(source, [league], date, now + 48 * 3_600_000 + 1)).toBeNull()
  expect(readScoreSnapshot(source, [league], date, now - 120_000)).toBeNull()
})
it('preserves a failed competition, uses the oldest timestamp, and accepts successful empty data', () => {
  saveScoreSnapshot(source, scores([league, other]), now)
  saveScoreSnapshot(source, { date, failed: [other], competitions: [{ id: league, name: 'Bundesliga', matches: [] }] }, now + 60_000)
  const mixed = readScoreSnapshot(source, [league, other], date, now + 60_000)!
  expect(mixed.scores.competitions.find(c => c.id === league)?.matches).toEqual([])
  expect(mixed.scores.competitions.find(c => c.id === other)?.matches).toHaveLength(1)
  expect(mixed.at).toBe(now)
})
it('bounds storage without deleting unrelated preferences', () => {
  localStorage.setItem('live-scores.theme', 'dark')
  saveScoreSnapshot(source, scores(Array.from({ length: 180 }, (_, i) => `soccer/league${i}`)), now)
  const raw = localStorage.getItem('live-scores.results.v1')!
  expect(raw.length).toBeLessThanOrEqual(1_500_000)
  expect(JSON.parse(raw).length).toBeLessThanOrEqual(160)
  expect(localStorage.getItem('live-scores.theme')).toBe('dark')
})
it('ignores malformed storage and continues if access or quota is blocked', () => {
  localStorage.setItem('live-scores.results.v1', '{bad')
  expect(readScoreSnapshot(source, [league], date, now)).toBeNull()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(() => saveScoreSnapshot(source, scores(), now)).not.toThrow()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(readScoreSnapshot(source, [league], date, now)).toBeNull()
})
it('rejects malformed saved match data rather than crashing a later render', () => {
  saveScoreSnapshot(source, scores(), now)
  const entries = JSON.parse(localStorage.getItem('live-scores.results.v1')!)
  entries[0].competition.matches[0].home = { unexpected: true }
  localStorage.setItem('live-scores.results.v1', JSON.stringify(entries))
  expect(readScoreSnapshot(source, [league], date, now)).toBeNull()
})
