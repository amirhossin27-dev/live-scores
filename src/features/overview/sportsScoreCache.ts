import type { SportsCompetitionScores, SportsMatch, SportsScores, SportsSide } from './sportsApi'

const storageKey = 'live-scores.results.v1'
const maxAgeMs = 48 * 60 * 60 * 1000
const maxEntries = 160
const maxCharacters = 1_500_000
interface Entry { source: string; date: string; at: number; competition: SportsCompetitionScores }
export interface ScoreSnapshot { scores: SportsScores; at: number; complete: boolean }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const nullableText = (value: unknown) => value === null || typeof value === 'string'
function validSide(value: unknown): value is SportsSide | null {
  return value === null || record(value) && typeof value.name === 'string' && nullableText(value.shortName)
    && nullableText(value.logo) && nullableText(value.score) && (value.winner === null || typeof value.winner === 'boolean')
    && [value.redCards, value.yellowRedCards].every(n => n == null || typeof n === 'number' && Number.isFinite(n) && n >= 0)
}
function validMatch(value: unknown): value is SportsMatch {
  return record(value) && typeof value.id === 'string' && typeof value.start === 'string' && Number.isFinite(Date.parse(value.start))
    && typeof value.status === 'string' && ['scheduled', 'live', 'finished', 'postponed', 'canceled'].includes(value.status)
    && typeof value.statusText === 'string' && nullableText(value.title) && nullableText(value.detail)
    && validSide(value.home) && validSide(value.away)
}
function validCompetition(value: unknown): value is SportsCompetitionScores {
  return record(value) && typeof value.id === 'string' && /^[a-z]+\/[a-z0-9._-]+$/.test(value.id)
    && typeof value.name === 'string' && Array.isArray(value.matches) && value.matches.length <= 500 && value.matches.every(validMatch)
}
function entries(now: number): Entry[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw || raw.length > maxCharacters) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is Entry => record(value) && typeof value.source === 'string'
      && typeof value.date === 'string' && /^\d{8}$/.test(value.date)
      && typeof value.at === 'number' && Number.isFinite(value.at) && value.at <= now + 60_000 && now - value.at <= maxAgeMs
      && validCompetition(value.competition)).sort((a, b) => b.at - a.at).slice(0, maxEntries)
  } catch { return [] }
}

/** Public score snapshots only. Original fetch times survive reads; errors never touch preferences. */
export function readScoreSnapshot(source: string, ids: string[], date: string, now = Date.now()): ScoreSnapshot | null {
  const saved = entries(now).filter(entry => entry.source === source && entry.date === date)
  const chosen = [...new Set(ids)].flatMap(id => saved.find(entry => entry.competition.id === id) ?? [])
  if (!chosen.length) return null
  return { scores: { date, competitions: chosen.map(entry => entry.competition), failed: [] }, at: Math.min(...chosen.map(entry => entry.at)), complete: chosen.length === new Set(ids).size }
}

export function saveScoreSnapshot(source: string, scores: SportsScores, now = Date.now()) {
  try {
    if (!/^\d{8}$/.test(scores.date)) return
    let saved = entries(now)
    for (const competition of scores.competitions) {
      if (scores.failed.includes(competition.id) || !validCompetition(competition)) continue
      const entry = { source, date: scores.date, at: now, competition }
      if (JSON.stringify(entry).length > maxCharacters) continue
      saved = saved.filter(old => !(old.source === source && old.date === scores.date && old.competition.id === competition.id))
      saved.unshift(entry)
    }
    saved = saved.sort((a, b) => b.at - a.at).slice(0, maxEntries)
    let serialized = JSON.stringify(saved)
    while (serialized.length > maxCharacters && saved.length) { saved.pop(); serialized = JSON.stringify(saved) }
    localStorage.setItem(storageKey, serialized)
  } catch { /* Blocked/full storage only disables persistence for this visit. */ }
}
