import { describe, expect, test } from 'vitest'
import { apiDaysFor, berlinDay, inWindow, scheduleDays, watchedMatches } from '../src/schedule'
import type { DeviceRecord } from '../src/subscriptions'

describe('inWindow', () => {
  const start = '2026-11-21T14:30:00Z'
  const t = Date.parse(start)
  test('opens 3 minutes before kick-off', () => {
    expect(inWindow(start, 'scheduled', t - 4 * 60_000)).toBe(false)
    expect(inWindow(start, 'scheduled', t - 3 * 60_000)).toBe(true)
    expect(inWindow(start, undefined, t - 60_000)).toBe(true)
  })
  test('closes at full time, postponement or after 4 hours', () => {
    expect(inWindow(start, 'live', t + 3.9 * 3600_000)).toBe(true)
    expect(inWindow(start, 'live', t + 4 * 3600_000 + 1)).toBe(false)
    expect(inWindow(start, 'finished', t + 100 * 60_000)).toBe(false)
    expect(inWindow(start, 'postponed', t)).toBe(false)
    expect(inWindow(start, 'canceled', t)).toBe(false)
  })
  test('a 21:00 match stays watched after midnight', () =>
    expect(inWindow('2026-11-21T20:00:00Z', 'live', Date.parse('2026-11-21T23:05:00Z'))).toBe(true))
})

describe('days', () => {
  test('berlinDay uses the calendar of Berlin', () => {
    expect(berlinDay(Date.parse('2026-11-21T23:30:00Z'))).toBe('20261122')
    expect(berlinDay(Date.parse('2026-11-21T22:30:00Z'))).toBe('20261121')
    expect(berlinDay(Date.parse('2026-07-01T22:30:00Z'))).toBe('20260702')
  })
  test('scheduleDays covers today and tomorrow in Berlin', () =>
    expect(scheduleDays(Date.parse('2026-11-21T23:30:00Z'))).toEqual(['20261122', '20261123']))
  test('apiDaysFor adds the UTC day when it differs', () => {
    expect(apiDaysFor('2026-11-21T14:30:00Z')).toEqual(['20261121'])
    expect(apiDaysFor('2026-11-21T23:30:00Z')).toEqual(['20261122', '20261121'])
  })
  test('apiDaysFor adds the US day, under which ESPN files night matches (01:30 Berlin = previous US day)', () => {
    expect(apiDaysFor('2026-11-22T01:30:00Z')).toContain('20261121')
    expect(apiDaysFor('2026-11-22T01:30:00Z')).toContain('20261122')
  })
})

describe('watchedMatches', () => {
  const now = Date.parse('2026-11-21T14:35:00Z')
  const device = (key: string, favorites: DeviceRecord['favorites'], competitions: string[] = []): DeviceRecord =>
    ({ key, subscription: { endpoint: `https://web.push.apple.com/${key}`, keys: { p256dh: 'x', auth: 'y' } }, favorites, competitions, lastSeen: now })
  const fav = { competition: 'soccer/ger.1', id: '7', start: '2026-11-21T14:30:00Z' }

  test('merges single favourites and favourite competitions per device', () => {
    const schedule = [{ competition: 'soccer/ger.1', id: '7', start: fav.start }, { competition: 'soccer/ger.1', id: '8', start: '2026-11-21T14:30:00Z' }, { competition: 'soccer/eng.1', id: '9', start: '2026-11-21T14:30:00Z' }]
    const watched = watchedMatches([device('a', [fav]), device('b', [], ['soccer/ger.1'])], schedule, new Map(), now)
    expect([...watched.keys()].sort()).toEqual(['soccer/ger.1|7', 'soccer/ger.1|8'])
    expect(watched.get('soccer/ger.1|7')!.devices.sort()).toEqual(['a', 'b'])
    expect(watched.get('soccer/ger.1|8')!.devices).toEqual(['b'])
  })

  test('leaves out matches outside the window and finished ones', () => {
    const later = { competition: 'soccer/ger.1', id: '10', start: '2026-11-21T17:30:00Z' }
    const watched = watchedMatches([device('a', [fav, later])], [], new Map([['soccer/ger.1|7', 'finished']]), now)
    expect(watched.size).toBe(0)
  })
})
