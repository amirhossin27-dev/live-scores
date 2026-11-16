import type { ApiMatch, ApiSide, MatchEvent } from './types'

/** What the service worker of the app shows. `tag` keeps a push that arrives twice from showing twice. */
export interface PushMessage { title: string; body: string; tag: string; url: string }

const teamName = (side: ApiSide | null | undefined) => side?.shortName || side?.name || ''

export function buildEventMessage(competition: string, match: ApiMatch, event: MatchEvent, player?: string): PushMessage {
  const team = teamName(event.side === 'home' ? match.home : match.away)
  const title = {
    goal: `⚽ Tor für ${team}`,
    'goal-cancelled': 'Tor aberkannt',
    red: `🟥 Rot für ${team}`,
    'yellow-red': `🟨🟥 Gelb-Rot für ${team}`,
  }[event.kind]
  const parts = [`${teamName(match.home)} ${match.home?.score ?? ''}:${match.away?.score ?? ''} ${teamName(match.away)}`]
  if (match.statusText.trim()) parts.push(match.statusText.trim())
  if (player?.trim()) parts.push(player.trim())
  return { title, body: parts.join(' · '), tag: `${competition}|${match.id}|${event.kind}|${event.side}|${event.index}`, url: './' }
}

export const outageMessage = (): PushMessage => ({ title: '⚠️ Live-Daten gerade nicht erreichbar', body: 'Mitteilungen können fehlen.', tag: 'outage', url: './' })
export const recoveryMessage = (): PushMessage => ({ title: '✅ Live-Daten wieder da', body: 'Mitteilungen laufen wieder.', tag: 'outage', url: './' })
