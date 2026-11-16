import { describe, expect, test } from 'vitest'
import { detectEvents, stateOf } from '../src/events'
import type { ApiMatch } from '../src/types'

const s = (home: number, away: number, homeOff = 0, awayOff = 0, homeRed = 0, awayRed = 0) => ({ home, away, homeOff, awayOff, homeRed, awayRed })

describe('detectEvents', () => {
  test('first sight reports nothing', () => expect(detectEvents(undefined, s(2, 1))).toEqual([]))

  test('one goal per goal, even two between polls', () =>
    expect(detectEvents(s(0, 0), s(2, 0))).toEqual([{ kind: 'goal', side: 'home', index: 1 }, { kind: 'goal', side: 'home', index: 2 }]))

  test('goals of both sides', () =>
    expect(detectEvents(s(1, 0), s(1, 1))).toEqual([{ kind: 'goal', side: 'away', index: 1 }]))

  test('a lower score is a cancelled goal', () =>
    expect(detectEvents(s(2, 1), s(1, 1))).toEqual([{ kind: 'goal-cancelled', side: 'home', index: 2 }]))

  test('a sending-off by the sum; a red re-filed as second yellow is no new event', () => {
    expect(detectEvents(s(0, 0, 0, 0, 0, 0), s(0, 0, 0, 1, 0, 1))).toEqual([{ kind: 'red', side: 'away', index: 1 }])
    expect(detectEvents(s(0, 0, 0, 1, 0, 1), s(0, 0, 0, 1, 0, 0))).toEqual([])
  })

  test('a second yellow is reported as yellow-red', () =>
    expect(detectEvents(s(0, 0), s(0, 0, 1, 0, 0, 0))).toEqual([{ kind: 'yellow-red', side: 'home', index: 1 }]))

  test('nothing changed, nothing reported', () => expect(detectEvents(s(1, 1, 1, 0, 1, 0), s(1, 1, 1, 0, 1, 0))).toEqual([]))
})

const live: ApiMatch = { id: '1', start: '2026-11-21T14:30:00Z', status: 'live', statusText: "67'", home: { name: 'A', score: '2', redCards: 1, yellowRedCards: 1 }, away: { name: 'B', score: '0' } }

describe('stateOf', () => {
  test('reads scores and sending-offs', () => expect(stateOf(live)).toEqual({ home: 2, away: 0, homeOff: 2, awayOff: 0, homeRed: 1, awayRed: 0 }))
  test('ignores matches without numeric scores', () => {
    expect(stateOf({ ...live, home: { name: 'A', score: null } })).toBeNull()
    expect(stateOf({ ...live, away: { name: 'B', score: '' } })).toBeNull()
    expect(stateOf({ ...live, away: null })).toBeNull()
  })
})
