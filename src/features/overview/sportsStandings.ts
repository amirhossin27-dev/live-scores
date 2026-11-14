import type { SportsStandings } from './sportsApi'

export type StandingsView = 'table' | 'scorers' | 'bracket'

/** What there is to show of a competition: the table (in football with the top scorers next to it), the knock-out tree, or both. */
export function standingsViews(standings: SportsStandings | null): StandingsView[] {
  if (!standings) return []
  const views: StandingsView[] = []
  if (standings.table && standings.table.groups.length > 0) {
    views.push('table')
    if (standings.competition.startsWith('soccer/')) views.push('scorers')
  }
  if (standings.bracket && standings.bracket.rounds.length > 0) views.push('bracket')
  return views
}
