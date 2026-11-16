/** One team of a line of `/api/sports/scores` (the fields the watcher needs). */
export interface ApiSide { name: string; shortName?: string | null; score?: string | null; redCards?: number | null; yellowRedCards?: number | null }

/** One match of `/api/sports/scores`. */
export interface ApiMatch {
  id: string
  start: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'canceled'
  statusText: string
  home?: ApiSide | null
  away?: ApiSide | null
}

export interface ApiScores { date: string; competitions: { id: string; name: string; matches: ApiMatch[] }[]; failed: string[] }

/** What the watcher remembers of a match: goals and sending-offs per side (`Off` = red + second yellow, `Red` = red only). */
export interface MatchState { home: number; away: number; homeOff: number; awayOff: number; homeRed: number; awayRed: number }

export type MatchEventKind = 'goal' | 'goal-cancelled' | 'red' | 'yellow-red'

/** `index` is the running number of the goal or sending-off of that side (for the notification tag). */
export interface MatchEvent { kind: MatchEventKind; side: 'home' | 'away'; index: number }
