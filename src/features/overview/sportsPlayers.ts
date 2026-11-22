import type { SportsEvent, SportsLineup, SportsPlayer } from './sportsApi'

// Names of the two sources differ in accents now and then ("Krauß"/"Krauss", "Jagiełło"/"Jagiello"); compare them plainly.
const letters: Record<string, string> = { ß: 'ss', ł: 'l', Ł: 'l', ø: 'o', Ø: 'o', đ: 'd', Đ: 'd', æ: 'ae', Æ: 'ae', œ: 'oe', ı: 'i' }

export function plain(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ßłŁøØđĐæÆœı]/g, (letter) => letters[letter]).toLowerCase().trim()
}

/** Older feeds sometimes put the coach in the player field without marking their role. */
export function isCoachDismissal(event: SportsEvent, lineups: SportsLineup[]) {
  if (event.kind !== 'red' && event.kind !== 'yellow-red') return false
  if (event.isCoach) return true
  if (!event.player) return false
  const team = lineups.find((lineup) => lineup.side === event.side)
  const name = plain(event.player)
  return !!team?.coach && plain(team.coach) === name &&
    ![...team.starters, ...team.bench].some((player) => plain(player.name) === name)
}

/**
 * The player of a line-up behind a name of the timeline (ESPN's names): the same name, else the one player of the side with the
 * same last name. `sides` in the order to look in (an own goal is written to the side that profits from it).
 */
export function findPlayer(lineups: SportsLineup[], sides: ('home' | 'away')[], name: string | null): SportsPlayer | null {
  if (!name) return null
  const wanted = plain(name)
  const last = wanted.split(/\s+/).pop() ?? wanted
  for (const which of sides) {
    const lineup = lineups.find((item) => item.side === which)
    if (!lineup) continue
    const players = [...lineup.starters, ...lineup.bench]
    const exact = players.find((player) => plain(player.name) === wanted)
    if (exact) return exact
    const byLast = players.filter((player) => (plain(player.name).split(/\s+/).pop() ?? '') === last)
    if (byLast.length === 1) return byLast[0]
  }
  return null
}
