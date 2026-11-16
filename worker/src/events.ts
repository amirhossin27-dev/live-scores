import type { ApiMatch, MatchEvent, MatchState } from './types'

function goals(score: string | null | undefined): number | null {
  if (score === null || score === undefined || !/^\d+$/.test(score.trim())) return null
  return Number(score)
}

/** The state of a match, or null while a score is missing (no comparison possible). */
export function stateOf(match: ApiMatch): MatchState | null {
  if (!match.home || !match.away) return null
  const home = goals(match.home.score)
  const away = goals(match.away.score)
  if (home === null || away === null) return null
  const red = (value: number | null | undefined) => value ?? 0
  return {
    home, away,
    homeOff: red(match.home.redCards) + red(match.home.yellowRedCards),
    awayOff: red(match.away.redCards) + red(match.away.yellowRedCards),
    homeRed: red(match.home.redCards),
    awayRed: red(match.away.redCards),
  }
}

/**
 * The events between two states. Without a previous state nothing is reported (first sight of a running match).
 * Sending-offs count by their sum, so that a red card re-filed as a second yellow is no new event.
 */
export function detectEvents(prev: MatchState | undefined, next: MatchState): MatchEvent[] {
  if (!prev) return []
  const events: MatchEvent[] = []
  for (const side of ['home', 'away'] as const) {
    for (let index = prev[side] + 1; index <= next[side]; index++) events.push({ kind: 'goal', side, index })
    for (let index = prev[side]; index > next[side]; index--) events.push({ kind: 'goal-cancelled', side, index })
    const off = side === 'home' ? 'homeOff' : 'awayOff'
    const red = side === 'home' ? 'homeRed' : 'awayRed'
    const kind = next[red] > prev[red] ? 'red' : 'yellow-red'
    for (let index = prev[off] + 1; index <= next[off]; index++) events.push({ kind, side, index })
  }
  return events
}
