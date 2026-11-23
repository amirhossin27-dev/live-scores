/** Live results as the platform API reads them from ESPN's public scoreboards. */
export type SportsStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'canceled'

export interface SportsSide {
  name: string
  shortName: string | null
  logo: string | null
  /** Text, because some sports have no number. */
  score: string | null
  winner: boolean | null
  /** Football in the scores: sending-offs of the team (straight red / second yellow). */
  redCards?: number | null
  yellowRedCards?: number | null
}

export interface SportsMatch {
  id: string
  start: string
  status: SportsStatus
  /** What the source shows next to the score: "67'", "HT", "FT". */
  statusText: string
  /** A race weekend: the Grand Prix; a fight: the weight class. */
  title: string | null
  /** For a race the winner, once it is over. */
  home: SportsSide | null
  away: SportsSide | null
  detail: string | null
}

export interface SportsCompetitionScores {
  id: string
  name: string
  matches: SportsMatch[]
}

export interface SportsScores {
  fetchedAt?: number
  date: string
  competitions: SportsCompetitionScores[]
  /** Competitions the source did not answer for. */
  failed: string[]
}
