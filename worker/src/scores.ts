import { parseBoard } from './scoreboard'
import type { SportsCompetitionScores, SportsScores } from '../../shared/scoreboard'

const competitionId = /^(soccer|basketball|football|hockey|baseball|racing|mma)\/[a-z0-9][a-z0-9._-]{0,39}$/
function validDate(day: string) {
  if (!/^\d{8}$/.test(day)) return false
  const iso = day.slice(0, 4) + '-' + day.slice(4, 6) + '-' + day.slice(6)
  const value = new Date(iso)
  return Number.isFinite(value.getTime()) && value.toISOString().startsWith(iso)
}

async function loadLeague(id: string, date: string, signal: AbortSignal) {
  const source = 'https://site.api.espn.com/apis/site/v2/sports/' + id + '/scoreboard?dates=' + date
  const response = await fetch(source, { headers: { Accept: 'application/json' }, signal, redirect: 'manual' })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('Upstream HTTP ' + response.status)
  }
  return parseBoard(id, await response.json<Parameters<typeof parseBoard>[1]>())
}

export async function serveScores(url: URL, cors: Record<string, string>): Promise<Response> {
  const date = url.searchParams.get('date') ?? ''
  const ids = [...new Set((url.searchParams.get('competitions') ?? '').split(','))].sort()
  const headers = { ...cors, 'Cache-Control': 'no-store' }
  if (!validDate(date) || ids.length > 40 || !ids.every(id => competitionId.test(id))) {
    return Response.json({ error: 'Ungültiger Spieltag oder Wettbewerb.' }, { status: 400, headers })
  }

  // One cache lookup per selection keeps even 40 leagues within the subrequest budget.
  const key = new URL('/api/sports/scores', url.origin)
  key.searchParams.set('date', date)
  key.searchParams.set('competitions', ids.join(','))
  const cache = typeof caches === 'undefined' ? undefined : caches.default
  const hit = await cache?.match(key.href).catch(() => undefined)
  if (hit) return new Response(hit.body, { headers: { ...headers, 'Content-Type': 'application/json' } })

  const fetchedAt = Date.now()
  const deadline = AbortSignal.timeout(12_000)
  const results = new Map<string, SportsCompetitionScores>()
  const remaining = ids.values()
  async function consume() {
    for (const id of remaining) {
      if (deadline.aborted) return
      try { results.set(id, await loadLeague(id, date, deadline)) }
      catch (error) {
        console.warn('Scoreboard lookup failed', id, error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ids.length, 6) }, consume))
  if (!results.size) return Response.json({ error: 'Keine aktuellen Ergebnisse von der Datenquelle.' }, { status: 502, headers })
  const scores: SportsScores = { date, fetchedAt, competitions: ids.flatMap(id => results.get(id) ?? []), failed: ids.filter(id => !results.has(id)) }
  const json = JSON.stringify(scores)
  if (!scores.failed.length && cache) {
    await cache.put(key.href, new Response(json, { headers: { 'Cache-Control': 'public, max-age=30', 'Content-Type': 'application/json' } })).catch(() => {})
  }
  return new Response(json, { headers: { ...headers, 'Content-Type': 'application/json' } })
}
