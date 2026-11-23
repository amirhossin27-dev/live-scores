import type { SportsCompetitionScores, SportsMatch, SportsSide } from '../../shared/scoreboard'

interface Status { type?: { name?: string; state?: string; shortDetail?: string; detail?: string }; displayClock?: string }
interface Competitor {
  team?: { id?: string; displayName?: string; name?: string; shortDisplayName?: string; abbreviation?: string; logo?: string; logos?: { href?: string }[] }
  athlete?: { displayName?: string; fullName?: string; shortName?: string; flag?: { href?: string } }
  score?: string | number
  homeAway?: string
  winner?: boolean
}
interface Card { team?: { id?: string }; athletesInvolved?: { id?: string; displayName?: string }[]; redCard?: boolean; yellowCard?: boolean }
interface Contest {
  id?: string; date?: string; startDate?: string; status?: Status
  competitors?: Competitor[]; details?: Card[]; notes?: { headline?: string }[]
  type?: { abbreviation?: string; text?: string }
}
interface ScoreEvent { id?: string; date?: string; name?: string; shortName?: string; status?: Status; competitions?: Contest[] }
interface Board { leagues?: { name?: string }[]; events?: ScoreEvent[] }

function statusOf(status?: Status): Pick<SportsMatch, 'status' | 'statusText'> {
  const type = status?.type
  const name = type?.name ?? ''
  const detail = type?.shortDetail ?? type?.detail ?? ''
  if (/POSTPONED|SUSPENDED|ABANDONED/.test(name)) return { status: 'postponed', statusText: detail }
  if (name.includes('CANCEL')) return { status: 'canceled', statusText: detail }
  if (type?.state === 'post') return { status: 'finished', statusText: detail }
  if (type?.state === 'in') return { status: 'live', statusText: !detail || ['Live', 'In Progress'].includes(detail) ? status?.displayClock ?? '' : detail }
  return { status: 'scheduled', statusText: '' }
}

function sideOf(entry?: Competitor, cards?: Card[]): SportsSide | null {
  if (!entry) return null
  const team = entry.team
  const athlete = entry.athlete
  const name = team?.displayName ?? team?.name ?? athlete?.displayName ?? athlete?.fullName
  if (!name?.trim()) return null
  const image = team?.logo ?? team?.logos?.[0]?.href ?? athlete?.flag?.href
  const side: SportsSide = { name: name.trim(), shortName: team?.shortDisplayName ?? team?.abbreviation ?? athlete?.shortName ?? null,
    logo: image && /^https:\/\/[\w.-]+\.espncdn\.com\//i.test(image) ? image : null,
    score: entry.score == null ? null : String(entry.score), winner: entry.winner ?? null }
  if (team?.id && cards) {
    const booked = new Set<string>()
    side.redCards = 0
    side.yellowRedCards = 0
    for (const card of cards) {
      if (card.team?.id !== team.id) continue
      const actor = card.athletesInvolved?.[0]
      const player = actor?.id ?? actor?.displayName
      if (card.redCard) {
        if (player && booked.has(player)) side.yellowRedCards++
        else side.redCards++
      } else if (card.yellowCard && player) booked.add(player)
    }
  }
  return side
}

function match(event: ScoreEvent, contest: Contest, id: string | undefined, title: string | null, home: SportsSide | null, away: SportsSide | null, detail: string | null): SportsMatch[] {
  const start = contest.date ?? contest.startDate ?? event.date
  if (!id || !start || !Number.isFinite(Date.parse(start))) return []
  return [{ id, start, ...statusOf(contest.status ?? event.status), title, home, away, detail }]
}

function matchesOf(sport: string, event: ScoreEvent): SportsMatch[] {
  const contests = event.competitions
  if (!contests?.length) return []
  const name = event.name ?? event.shortName ?? null
  if (sport === 'mma') {
    return contests.slice(-6).reverse().flatMap(fight => {
      const fighters = (fight.competitors ?? []).map(entry => sideOf(entry)).filter(side => side !== null)
      return fighters.length === 2 ? match(event, fight, fight.id, fight.type?.text ?? fight.type?.abbreviation ?? null, fighters[0], fighters[1], name) : []
    })
  }
  if (sport === 'racing') {
    const last = contests[contests.length - 1]
    const finished = last.status?.type?.state === 'post'
    const session = finished ? last : contests.find(c => c.status?.type?.state === 'in') ?? contests.find(c => c.status?.type?.state === 'pre') ?? last
    const winner = finished ? sideOf(session.competitors?.find(c => c.winner)) : null
    return match(event, session, event.id, name, winner, null, session.type?.abbreviation ?? session.type?.text ?? null)
  }
  const contest = contests[0]
  const home = sideOf(contest.competitors?.find(c => c.homeAway !== 'away'), contest.details)
  const away = sideOf(contest.competitors?.find(c => c.homeAway === 'away'), contest.details)
  return home && away ? match(event, contest, event.id, null, home, away, contest.notes?.[0]?.headline ?? null) : []
}

export function parseBoard(id: string, board: Board): SportsCompetitionScores {
  if (!Array.isArray(board?.events)) throw new Error('Missing scoreboard events')
  const sport = id.split('/')[0]
  const matches = board.events.flatMap(event => matchesOf(sport, event))
  matches.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  return { id, name: board.leagues?.[0]?.name ?? id, matches }
}
