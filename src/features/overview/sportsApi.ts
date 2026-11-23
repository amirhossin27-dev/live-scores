import { fetchJson, scoresApiBaseUrl } from '../../services/platformApi'

export type { SportsStatus, SportsSide, SportsMatch, SportsCompetitionScores, SportsScores } from '../../../shared/scoreboard'
import type { SportsStatus, SportsSide, SportsMatch, SportsScores } from '../../../shared/scoreboard'

export function loadSportsScores(competitions: string[], date: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ competitions: competitions.join(','), date })
  return fetchJson<SportsScores>(`/api/sports/scores?${query.toString()}`, { signal }, scoresApiBaseUrl)
}

/** One figure of a match for both sides, as text ("69.6", "19/34", "30:40"); `label` is the English label of the source. */
export interface SportsStat {
  key: string
  label: string
  home: string
  away: string
}

export type SportsEventKind = 'goal' | 'penalty' | 'own-goal' | 'yellow' | 'yellow-red' | 'red' | 'substitution'

/** A moment of a football match: `player` scores, is booked or comes on; `other` is the assist or the player going off. */
export interface SportsEvent {
  kind: SportsEventKind
  isCoach?: boolean
  minute: string
  side: 'home' | 'away'
  player: string | null
  other: string | null
}

/**
 * `x`/`y` place a starter on his half of the pitch (0..1, seen from his own goal: y 0.1 is the keeper, 0.9 the strikers; x 0 is
 * the team's right flank). `rating` is the match rating (0-10), `profileId` opens the player profile.
 */
export interface SportsPlayer {
  name: string
  jersey: string | null
  position: string | null
  x: number | null
  y: number | null
  rating: number | null
  profileId: string | null
  subIn: number | null
  subOut: number | null
  captain: boolean
  /** Nationality supplied by the line-up source. */
  country?: SportsCountry | null
}

export interface SportsLineup {
  side: 'home' | 'away'
  formation: string | null
  starters: SportsPlayer[]
  bench: SportsPlayer[]
  /** `fotmob`: places and ratings from FotMob; `espn`: places worked out from the formation, no ratings. */
  source: 'fotmob' | 'espn'
  coach: string | null
  coachId?: string | null
}

export interface SportsMatchDetails {
  id: string
  competition: string
  start: string
  status: SportsStatus
  statusText: string
  home: SportsSide
  away: SportsSide
  /** Scores per half, quarter, period or inning (empty when the source has none). */
  homePeriods: string[]
  awayPeriods: string[]
  venue: string | null
  city: string | null
  attendance: number | null
  stats: SportsStat[]
  events: SportsEvent[]
  lineups: SportsLineup[]
  /** The channels ESPN names (mostly US). */
  broadcasts?: string[] | null
  /** Football from FotMob: the referee with his nationality (ESPN's without), the stadium's country, the team ids for the team pages. */
  referee?: SportsOfficial | null
  venueCountry?: SportsCountry | null
  homeTeamId?: string | null
  awayTeamId?: string | null
}

/** A country: the English name of the source, the FIFA code, the ISO code ("de", "gb-eng") for the name in the UI, a flag picture. */
export interface SportsCountry {
  name: string
  code: string | null
  iso: string | null
  flag: string | null
}

export interface SportsOfficial {
  name: string
  country: SportsCountry | null
}

/** A key of the source (for the translation) and its English text as fallback. */
export interface SportsText {
  key: string | null
  text: string
}

export interface SportsPlayerMatch {
  id: string
  date: string
  competition: string
  opponent: string
  home: boolean
  homeScore: number | null
  awayScore: number | null
  minutes: number | null
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  rating: number | null
  onBench: boolean
  /** FotMob's id and crest of the opponent. */
  opponentId?: string | null
  opponentLogo?: string | null
}

export interface SportsCareerEntry {
  team: string
  kind: 'club' | 'national'
  start: string | null
  end: string | null
  active: boolean
  appearances: number | null
  goals: number | null
  assists: number | null
  transfer: SportsText | null
  teamId?: string | null
  logo?: string | null
}

/** Recorded season totals; a transfer season can contain more than one team. */
export interface SportsCareerSeason {
  season: string
  teams: {
    team: string
    teamId: string | null
    logo: string | null
    kind: 'club' | 'national'
    appearances: number | null
    goals: number | null
    assists: number | null
  }[]
}

/** A club a coach managed, with the record when the source has it. */
export interface SportsCoachStint {
  team: string
  teamId: string | null
  logo: string | null
  start: string | null
  end: string | null
  active: boolean
  matches: number | null
  wins: number | null
  draws: number | null
  losses: number | null
  pointsPerGame: number | null
}

/** A title of a person as coach or as player, with the team it was won with. */
export interface SportsPersonTrophy {
  role: 'coach' | 'player'
  team: string
  teamId: string | null
  logo: string | null
  competition: string
  seasonsWon: string[]
  seasonsRunnerUp: string[]
}

/** A past (or the running) injury from Transfermarkt; `until` is null while the player is still out. */
export interface SportsInjuryRecord {
  season: string | null
  injury: string
  from: string | null
  until: string | null
  days: number | null
  gamesMissed: number | null
}

/** A move between clubs; `feeKind` and `fee` come from Transfermarkt (null for moves derived from FotMob's career). */
export interface SportsTransfer {
  season?: string | null
  fromFlag?: string | null
  toFlag?: string | null
  detailUrl?: string | null
  date: string
  from: string | null
  to: string
  type: SportsText | null
  fee: number | null
  feeKind: 'fee' | 'free' | 'loan' | 'loan-end' | 'unknown' | null
  /** The player's market value at the time of the move. */
  marketValue: number | null
  fromLogo?: string | null
  toLogo?: string | null
}

export interface SportsPlayerProfile {
  id: string
  name: string
  team: string | null
  position: SportsText | null
  country: string | null
  countryCode: string | null
  birthDate: string | null
  age: number | null
  heightCm: number | null
  foot: SportsText | null
  shirt: string | null
  marketValue: number | null
  contractEnd: string | null
  /** The current injury (FotMob). */
  injury: { status: SportsText; expectedReturn: string | null; updated: string | null } | null
  seasonLeague: string | null
  season: string | null
  seasonStats: { key: string; title: string; value: string }[]
  recentMatches: SportsPlayerMatch[]
  career: SportsCareerEntry[]
  transfers: SportsTransfer[]
  /** `transfermarkt`: with fees; `fotmob`: the moves between the clubs of the career, without fees. */
  transfersSource: 'transfermarkt' | 'fotmob'
  /** A coach: his clubs as coach and his titles come with the profile, there are no matches, transfers or injuries. */
  isCoach?: boolean
  coachCareer?: SportsCoachStint[] | null
  trophies?: SportsPersonTrophy[] | null
  /** Transfermarkt's injury history, newest first; null when the player was not found there. */
  injuryHistory?: SportsInjuryRecord[] | null
  /** The seasons of FotMob's statistics, newest first, and the entry of the season `seasonStats` belong to. */
  seasons?: SportsPlayerSeason[] | null
  seasonEntry?: string | null
  careerSeasons?: SportsCareerSeason[] | null
}

/** A season of a player's statistics with its competitions; `entry` loads the figures of one of them. */
export interface SportsPlayerSeason {
  name: string
  competitions: { entry: string; name: string }[]
}

export interface SportsSeasonStat {
  key: string
  title: string
  value: string
}

export function loadPlayerSeason(id: string, entry: string, signal?: AbortSignal) {
  return fetchJson<SportsSeasonStat[]>(`/api/sports/player/season?${new URLSearchParams({ id, entry }).toString()}`, { signal })
}

export function loadPlayerProfile(id: string, language: 'de' | 'en', signal?: AbortSignal) {
  return fetchJson<SportsPlayerProfile>(`/api/sports/player?${new URLSearchParams({ id, language }).toString()}`, { signal })
}

export function loadPlayerMatches(id: string, season: string, signal?: AbortSignal) {
  return fetchJson<SportsPlayerMatch[]>(`/api/sports/player/matches?${new URLSearchParams({ id, season }).toString()}`, { signal })
}

export interface SportsSearchResult {
  id: string
  name: string
  kind: 'player' | 'coach' | 'club' | 'national'
  description: string | null
  logo: string | null
  country: SportsCountry | null
}

export function searchSports(q: string, language: 'de' | 'en', signal?: AbortSignal) {
  return fetchJson<SportsSearchResult[]>(`/api/sports/search?${new URLSearchParams({ q, language }).toString()}`, { signal })
}

/** A line of a table; `values` follow the `columns` of the table, `zone` is the colour of the zone the place is in. */
export interface SportsTableRow {
  rank: number
  name: string
  logo: string | null
  values: string[]
  zone: string | null
  /** Semantic zone identity; provider colours can be shared by different qualifications. */
  zoneKey?: string | null
  /** One of the two teams of the match the table was asked for. */
  highlight: boolean
  /** Live table: the running match of the team (score seen from the team) and the places won (+) or lost (–) by it. */
  live?: { score: string; outcome: 'win' | 'draw' | 'loss'; minute: string } | null
  rankChange?: number
  /** FotMob's id for the team page (football; null when the source names could not be matched). */
  teamId?: string | null
  /** The last finished matches of the competition (newest first) and the next one, from FotMob (football). */
  form?: SportsTeamFixture[] | null
  next?: SportsTeamFixture | null
}

/** A league, a conference or a group; `name` is null when the competition has only one table. */
export interface SportsTableGroup {
  name: string | null
  rows: SportsTableRow[]
}

export type SportsTableColumn = 'gamesPlayed' | 'wins' | 'ties' | 'losses' | 'goals' | 'goalDifference' | 'points' | 'winPercent' | 'gamesBehind' | 'otLosses'

export interface SportsTable {
  columns: SportsTableColumn[]
  groups: SportsTableGroup[]
  /** What the colours mean: FotMob sends a key, ESPN only the English text. */
  zones: { color: string; label: SportsText; key?: string | null }[]
  source: 'espn' | 'fotmob' | 'transfermarkt'
  /** The running matches are counted in (football). */
  live?: boolean
}

export interface SportsBracketTeam {
  name: string
  logo: string | null
  winner: boolean
  /** FotMob's id for the team page. */
  teamId?: string | null
}

/** One game of a tie, its score seen from the tie's first team; `note` is `aet` (after extra time) or `pen` (after penalties). */
export interface SportsBracketGame {
  start: string
  status: 'scheduled' | 'live' | 'finished' | 'canceled'
  homeScore: number | null
  awayScore: number | null
  note: 'aet' | 'pen' | null
}

/** A tie: one game or two legs, the scores are the totals; a side is null until it is decided. */
export interface SportsMatchup {
  home: SportsBracketTeam | null
  away: SportsBracketTeam | null
  homeScore: number | null
  awayScore: number | null
  games: SportsBracketGame[]
  /** The tie of the match the tree was asked for. */
  highlight: boolean
}

/**
 * A knock-out round; `stage` is `playoff`, `1/16`, `1/8`, `1/4`, `1/2`, `final`, `bronze` or the number of an early cup round.
 * `feedsNext`: ties 1 and 2 give tie 1 of the next round, and so on, so the rounds can be drawn as a tree.
 */
export interface SportsRound {
  stage: string
  matchups: SportsMatchup[]
  feedsNext: boolean
}

export interface SportsStandings {
  competition: string
  season: string | null
  table: SportsTable | null
  bracket: { rounds: SportsRound[] } | null
  seasons?: string[]
}

/** The table (ESPN) and the knock-out tree (FotMob) of a competition; with a match, its teams and its tie are marked. */
export function loadStandings(competition: string, match: string | null, signal?: AbortSignal, season: string | null = null) {
  const query = new URLSearchParams({ competition })
  if (match) query.set('match', match)
  if (season) query.set('season', season)
  return fetchJson<SportsStandings>(`/api/sports/standings?${query.toString()}`, { signal })
}

/** The channels and streaming services of one country (DE, AT, CH, GB, US). */
export interface SportsBroadcast {
  country: string
  channels: string[]
}

export interface SportsBroadcasts {
  countries: SportsBroadcast[]
  /** FotMob (per country, football) and/or ESPN (US). */
  sources: string[]
}

export function loadBroadcasts(competition: string, id: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ competition, id })
  return fetchJson<SportsBroadcasts>(`/api/sports/broadcasts?${query.toString()}`, { signal })
}

export interface SportsTeamSide {
  id: string | null
  name: string
  logo: string | null
  score: number | null
}

/** A match of the team's season; `result` is seen from the team (finished matches only). */
export interface SportsTeamFixture {
  id: string
  start: string
  competition: string
  home: SportsTeamSide
  away: SportsTeamSide
  status: SportsStatus
  statusText: string | null
  result: 'win' | 'draw' | 'loss' | null
}

export interface SportsTrophy {
  competition: string
  won: number
  runnerUp: number
  /** Newest first. */
  seasonsWon: string[]
  seasonsRunnerUp: string[]
}

export interface SportsTeamTransfer {
  date: string
  player: string
  playerId: string | null
  position: SportsText | null
  direction: 'in' | 'out' | 'extension'
  from: string | null
  to: string | null
  /** Euros; with `loan` a loan fee. */
  fee: number | null
  feeKind: 'fee' | 'loan' | 'free' | 'undisclosed' | 'extension' | 'unknown'
  /** End of the loan or of the new contract. */
  until: string | null
  marketValue: number | null
  /** FotMob's ids and crests of the two clubs. */
  fromId?: string | null
  toId?: string | null
  fromLogo?: string | null
  toLogo?: string | null
}

export interface SportsSquadMember {
  id: string
  name: string
  shirt: string | null
  country: SportsCountry | null
  age: number | null
  role: SportsText | null
  injured: boolean
  rating: number | null
  goals: number | null
  assists: number | null
  marketValue: number | null
}

export interface SportsSquadGroup {
  key: 'coach' | 'keepers' | 'defenders' | 'midfielders' | 'attackers'
  members: SportsSquadMember[]
}

/** A football team page from FotMob: the matches of the season, titles, transfers and squad. */
export interface SportsTeamProfile {
  id: string
  name: string
  logo: string | null
  country: SportsCountry | null
  league: string | null
  season: string | null
  venue: string | null
  city: string | null
  capacity: number | null
  coach: string | null
  fixtures: SportsTeamFixture[]
  trophies: SportsTrophy[]
  transfers: SportsTeamTransfer[]
  squad: SportsSquadGroup[]
}

/** A team by FotMob's id, or by a football match of the scores and its side. */
export type SportsTeamRef = { id: string } | { competition: string; match: string; side: 'home' | 'away' }

/** Resolve a nationality to its verified senior national team, rather than guessing a team id. */
export function loadNationalTeam(country: SportsCountry, signal?: AbortSignal) {
  return fetchJson<{ id: string; name: string }>(`/api/sports/national-team?${new URLSearchParams({ code: country.code ?? '' }).toString()}`, { signal })
}

export function loadTeam(ref: SportsTeamRef, signal?: AbortSignal) {
  const query = new URLSearchParams('id' in ref ? { id: ref.id } : { competition: ref.competition, match: ref.match, side: ref.side })
  return fetchJson<SportsTeamProfile>(`/api/sports/team?${query.toString()}`, { signal })
}

export interface SportsNewsItem {
  id: string
  title: string
  url: string
  image: string | null
  source: string | null
  published: string | null
}

export function loadTeamNews(id: string, language: 'de' | 'en', signal?: AbortSignal) {
  return fetchJson<SportsNewsItem[]>(`/api/sports/team/news?${new URLSearchParams({ id, language }).toString()}`, { signal })
}

/** A FotMob match (team page, profile, form) found in ESPN's scores: it opens the match panel. */
export interface SportsMatchLink {
  competition: string
  match: SportsMatch
}

/** 404 when the competition is not in the live scores or ESPN does not have the match. */
export function findMatch(fotmob: string, signal?: AbortSignal) {
  return fetchJson<SportsMatchLink>(`/api/sports/match/find?${new URLSearchParams({ fotmob }).toString()}`, { signal })
}

export function loadMatchDetails(competition: string, id: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ competition, id })
  return fetchJson<SportsMatchDetails>(`/api/sports/match?${query.toString()}`, { signal })
}
