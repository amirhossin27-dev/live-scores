import { useEffect, useMemo, useRef, useState } from 'react'
import { loadBroadcasts, loadMatchDetails, loadPlayerMatches, loadPlayerProfile, loadPlayerSeason, loadSportsScores, loadStandings, loadTeam, loadTeamNews } from './sportsApi'
import type { SportsBroadcasts, SportsMatchDetails, SportsNewsItem, SportsPlayerMatch, SportsPlayerProfile, SportsScores, SportsSeasonStat, SportsStandings, SportsTeamProfile, SportsTeamRef } from './sportsApi'
import { apiBaseUrl } from '../../services/platformApi'
import { readScoreSnapshot, saveScoreSnapshot } from './sportsScoreCache'
import type { ScoreSnapshot } from './sportsScoreCache'

const liveRefreshMs = 30_000
const idleRefreshMs = 2 * 60_000
interface Loaded extends ScoreSnapshot { key: string; cached: boolean }

/** Restore the last matching scores immediately, then revalidate through the normal API. */
export function useSportsScores(ids: string[], date: string) {
  const key = `${date}|${ids.join(',')}`
  const saved = useMemo(() => ids.length ? readScoreSnapshot(apiBaseUrl, ids, date) : null, [key])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const latest = useRef(loaded)
  latest.current = loaded
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const online = () => { setOffline(false); setAttempt(value => value + 1) }
    const disconnected = () => setOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', disconnected)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', disconnected) }
  }, [])

  useEffect(() => {
    setSlow(false)
    setRefreshingKey(null)
    if (!ids.length || offline) return
    const controller = new AbortController()
    const requestKey = key
    let timer = 0
    let slowTimer = 0
    let inFlight = false
    function schedule(scores: SportsScores | null) {
      const live = scores?.competitions.some(c => c.matches.some(match => match.status === 'live'))
      timer = window.setTimeout(run, live ? liveRefreshMs : idleRefreshMs)
    }
    function run() {
      if (controller.signal.aborted || inFlight) return
      window.clearTimeout(timer)
      if (document.visibilityState === 'hidden') { schedule(null); return }
      inFlight = true
      setRefreshingKey(requestKey)
      slowTimer = window.setTimeout(() => setSlow(true), 8_000)
      loadSportsScores(ids, date, controller.signal).then(scores => {
        if (controller.signal.aborted) return
        const previous = latest.current?.key === requestKey ? latest.current : saved
        const failed = new Set(scores.failed)
        const retained = previous?.scores.competitions.filter(c => failed.has(c.id) && !scores.competitions.some(fresh => fresh.id === c.id)) ?? []
        const merged = { ...scores, competitions: [...scores.competitions, ...retained] }
        const at = retained.length && previous ? Math.min(previous.at, Date.now()) : Date.now()
        const next = { key: requestKey, scores: merged, at, cached: retained.length > 0, complete: !scores.failed.length }
        latest.current = next
        setLoaded(next)
        if (scores.date === date) saveScoreSnapshot(apiBaseUrl, scores)
        setFailedKey(null)
        schedule(merged)
      }).catch(() => {
        if (controller.signal.aborted) return
        setFailedKey(requestKey)
        schedule(null)
      }).finally(() => {
        if (controller.signal.aborted) return
        inFlight = false
        window.clearTimeout(slowTimer)
        setSlow(false)
        setRefreshingKey(null)
      })
    }
    const visible = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', visible)
    run()
    return () => { controller.abort(); window.clearTimeout(timer); window.clearTimeout(slowTimer); document.removeEventListener('visibilitychange', visible) }
  }, [ids, date, attempt, offline])

  const current = loaded?.key === key ? loaded : null
  const snapshot = current ?? saved
  const scores = snapshot?.scores ?? null
  const cached = current ? current.cached : saved !== null
  const refreshing = refreshingKey === key && !offline
  const failed = failedKey === key
  const hasMatches = scores?.competitions.some(c => c.matches.length > 0)
  return {
    scores, updatedAt: snapshot?.at ?? null, cached, refreshing, offline, failed,
    slow: slow && refreshing && !scores,
    loading: ids.length > 0 && !offline && !failed && (!scores || refreshing && cached && !snapshot?.complete && !hasMatches),
    retry: () => setAttempt(value => value + 1),
  }
}

interface LoadedMatch {
  key: string
  details: SportsMatchDetails
}

/** The details of one match; refreshed every 30 seconds while it is running (not while the tab is hidden). */
export function useMatchDetails(competition: string, id: string) {
  const [loaded, setLoaded] = useState<LoadedMatch | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${competition}|${id}`

  useEffect(() => {
    const controller = new AbortController()
    const requestKey = `${competition}|${id}`
    let timer = 0

    function run() {
      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(run, liveRefreshMs)
        return
      }
      loadMatchDetails(competition, id, controller.signal)
        .then((details) => {
          setLoaded({ key: requestKey, details })
          setFailedKey(null)
          if (details.status === 'live') timer = window.setTimeout(run, liveRefreshMs)
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailedKey(requestKey)
        })
    }

    run()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [competition, id, attempt])

  const details = loaded?.key === key ? loaded.details : null
  return {
    details,
    failed: failedKey === key,
    loading: details === null && failedKey !== key,
    retry: () => setAttempt((value) => value + 1),
  }
}

interface LoadedStandings {
  key: string
  standings: SportsStandings
}

/**
 * The table and the knock-out tree of a competition (with a match: its teams and its tie marked); loaded once while the panel
 * is open, a live table every 30 seconds. `competition` null loads nothing (a competition without table and tree).
 */
export function useStandings(competition: string | null, match: string | null, season: string | null = null) {
  const [loaded, setLoaded] = useState<LoadedStandings | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${competition}|${match ?? ''}|${season ?? ''}`

  useEffect(() => {
    if (competition === null) return undefined
    const id = competition
    const controller = new AbortController()
    const requestKey = `${competition}|${match ?? ''}|${season ?? ''}`
    let timer = 0

    // a live table (running matches counted in) is asked again every 30 seconds, not while the tab is hidden
    function run() {
      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(run, liveRefreshMs)
        return
      }
      loadStandings(id, match, controller.signal, season)
        .then((standings) => {
          if (controller.signal.aborted) return
          setLoaded({ key: requestKey, standings })
          setFailedKey(null)
          if (standings.table?.live) timer = window.setTimeout(run, liveRefreshMs)
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailedKey(requestKey)
        })
    }

    run()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [competition, match, season, attempt])

  const standings = competition !== null && loaded?.key === key ? loaded.standings : null
  return {
    standings,
    failed: failedKey === key,
    loading: competition !== null && standings === null && failedKey !== key,
    retry: () => setAttempt((value) => value + 1),
  }
}

/** The profile of one player (recent matches, career, transfers, current injury); loaded once per player. */
export function usePlayerProfile(id: string, language: 'de' | 'en') {
  const [loaded, setLoaded] = useState<{ language: string; profile: SportsPlayerProfile } | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    loadPlayerProfile(id, language, controller.signal)
      .then((profile) => {
        if (controller.signal.aborted) return
        setLoaded({ language, profile })
        setFailedId(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedId(id)
      })
    return () => controller.abort()
  }, [id, language, attempt])

  // the names of the injuries come in the language of the page: a profile of the other language waits for the new one
  const profile = loaded?.profile.id === id && loaded.language === language ? loaded.profile : null
  return {
    profile,
    failed: failedId === id,
    loading: profile === null && failedId !== id,
    retry: () => setAttempt((value) => value + 1),
  }
}

interface LoadedSeason {
  key: string
  stats: SportsSeasonStat[]
}

/** The figures of one season and competition of a player; nothing is loaded while `entry` is null (the profile's own season). */
export function usePlayerSeason(id: string, entry: string | null) {
  const [loaded, setLoaded] = useState<LoadedSeason | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${id}|${entry}`

  useEffect(() => {
    if (entry === null) return undefined
    const controller = new AbortController()
    const requestKey = `${id}|${entry}`
    loadPlayerSeason(id, entry, controller.signal)
      .then((stats) => {
        if (controller.signal.aborted) return
        setLoaded({ key: requestKey, stats })
        setFailedKey(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(requestKey)
      })
    return () => controller.abort()
  }, [id, entry, attempt])

  const stats = entry !== null && loaded?.key === key ? loaded.stats : null
  return {
    stats,
    failed: failedKey === key,
    loading: entry !== null && stats === null && failedKey !== key,
    retry: () => setAttempt((value) => value + 1),
  }
}

/** A season's appearances; changing the season immediately hides the previous season's games. */
export function usePlayerMatches(id: string, season: string | null) {
  const [loaded, setLoaded] = useState<{ key: string; matches: SportsPlayerMatch[] } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${id}|${season}`

  useEffect(() => {
    if (season === null) return undefined
    const controller = new AbortController()
    const requestKey = `${id}|${season}`
    loadPlayerMatches(id, season, controller.signal)
      .then((matches) => {
        if (controller.signal.aborted) return
        setLoaded({ key: requestKey, matches })
        setFailedKey(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(requestKey)
      })
    return () => controller.abort()
  }, [id, season, attempt])

  const matches = season !== null && loaded?.key === key ? loaded.matches : null
  return {
    matches,
    failed: failedKey === key,
    loading: season !== null && matches === null && failedKey !== key,
    retry: () => { setFailedKey(null); setAttempt((value) => value + 1) },
  }
}

interface LoadedBroadcasts {
  key: string
  broadcasts: SportsBroadcasts
}

/** Where a match is shown on TV or as a stream; loaded once while the tab is open. */
export function useBroadcasts(competition: string, id: string) {
  const [loaded, setLoaded] = useState<LoadedBroadcasts | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${competition}|${id}`

  useEffect(() => {
    const controller = new AbortController()
    const requestKey = `${competition}|${id}`
    loadBroadcasts(competition, id, controller.signal)
      .then((broadcasts) => {
        setLoaded({ key: requestKey, broadcasts })
        setFailedKey(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(requestKey)
      })
    return () => controller.abort()
  }, [competition, id, attempt])

  const broadcasts = loaded?.key === key ? loaded.broadcasts : null
  return {
    broadcasts,
    failed: failedKey === key,
    loading: broadcasts === null && failedKey !== key,
    retry: () => setAttempt((value) => value + 1),
  }
}

function teamRefKey(ref: SportsTeamRef) {
  return 'id' in ref ? ref.id : `${ref.competition}|${ref.match}|${ref.side}`
}

interface LoadedTeam {
  key: string
  team: SportsTeamProfile
}

/** A team page (football); loaded once per team. `ref` must keep its identity between renders (state, not a new object). */
export function useTeam(ref: SportsTeamRef) {
  const [loaded, setLoaded] = useState<LoadedTeam | null>(null)
  const [failed, setFailed] = useState<{ key: string; missing: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = teamRefKey(ref)

  useEffect(() => {
    const controller = new AbortController()
    const requestKey = teamRefKey(ref)
    loadTeam(ref, controller.signal)
      .then((team) => {
        setLoaded({ key: requestKey, team })
        setFailed(null)
      })
      .catch((error: unknown) => {
        // 404: the source does not know the team (FotMob has not got the match)
        if (!controller.signal.aborted) setFailed({ key: requestKey, missing: (error as { status?: number }).status === 404 })
      })
    return () => controller.abort()
  }, [ref, attempt])

  const team = loaded?.key === key ? loaded.team : null
  return {
    team,
    failed: failed?.key === key,
    missing: failed?.key === key && failed.missing,
    loading: team === null && failed?.key !== key,
    retry: () => setAttempt((value) => value + 1),
  }
}

interface LoadedNews {
  key: string
  news: SportsNewsItem[]
}

/** The newest articles about a team in the UI language; loaded once while the tab is open. */
export function useTeamNews(id: string, language: 'de' | 'en') {
  const [loaded, setLoaded] = useState<LoadedNews | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${id}|${language}`

  useEffect(() => {
    const controller = new AbortController()
    const requestKey = `${id}|${language}`
    loadTeamNews(id, language, controller.signal)
      .then((news) => {
        setLoaded({ key: requestKey, news })
        setFailedKey(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(requestKey)
      })
    return () => controller.abort()
  }, [id, language, attempt])

  const news = loaded?.key === key ? loaded.news : null
  return {
    news,
    failed: failedKey === key,
    loading: news === null && failedKey !== key,
    retry: () => setAttempt((value) => value + 1),
  }
}
