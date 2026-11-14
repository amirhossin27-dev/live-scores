import { useEffect, useState } from 'react'
import type { SportsCountry } from './sportsApi'
import { fetchJson } from '../../services/platformApi'

export interface SportsScorer {
  id: string
  name: string
  team: string | null
  teamId: string | null
  country?: SportsCountry | null
  goals: number | null
  assists: number | null
  scorings: number | null
  teamLogo?: string | null
  hasProfile?: boolean
}

export interface SportsScorers {
  competition: string
  season: string | null
  updatedAt: string
  source: 'fotmob' | 'transfermarkt'
  available: boolean
  seasons?: string[]
  players: SportsScorer[]
}

export type ScorerMetric = 'goals' | 'assists' | 'scorings'
export type ScorerDirection = 'ascending' | 'descending'

export function loadScorers(competition: string, season: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ competition })
  if (season) query.set('season', season)
  return fetchJson<SportsScorers>(`/api/sports/scorers?${query.toString()}`, { signal })
}

/** Missing values always follow known counts, including when sorting in ascending order. */
export function sortScorers(players: SportsScorer[], metric: ScorerMetric, direction: ScorerDirection) {
  return [...players].sort((left, right) => {
    const a = left[metric]
    const b = right[metric]
    if (a === null && b !== null) return 1
    if (b === null && a !== null) return -1
    if (a !== null && b !== null && a !== b) return direction === 'descending' ? b - a : a - b
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  })
}

/** Poll only while the scorer table is mounted and visible; retain the last successful response on failures. */
export function useScorers(competition: string, season: string | null) {
  const [loaded, setLoaded] = useState<{ key: string; data: SportsScorers } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${competition}|${season ?? ''}`

  useEffect(() => {
    const controller = new AbortController()
    const requestKey = `${competition}|${season ?? ''}`
    let timer = 0
    let pending = false

    async function run() {
      window.clearTimeout(timer)
      if (controller.signal.aborted || pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const data = await loadScorers(competition, season, controller.signal)
        if (controller.signal.aborted) return
        setLoaded({ key: requestKey, data })
        setFailedKey(null)
      } catch {
        if (!controller.signal.aborted) setFailedKey(requestKey)
      } finally {
        pending = false
        if (!controller.signal.aborted) timer = window.setTimeout(run, 30_000)
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') window.clearTimeout(timer)
      else void run()
    }

    void run()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [competition, season, attempt])

  const data = loaded?.key === key ? loaded.data : null
  return {
    data,
    failed: failedKey === key,
    loading: !data && failedKey !== key,
    retry: () => { setFailedKey(null); setAttempt((value) => value + 1) },
  }
}
