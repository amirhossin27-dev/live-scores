import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSportsScores } from './sportsHooks'
import { readScoreSnapshot, saveScoreSnapshot } from './sportsScoreCache'
import type { SportsScores } from './sportsApi'
const api = vi.hoisted(() => ({ loadSportsScores: vi.fn() }))
vi.mock('./sportsApi', () => api)
vi.mock('../../services/platformApi', () => ({ apiBaseUrl: 'https://api.test' }))
const ids = ['soccer/ger.1']
const date = '20261115'
const source = 'https://api.test'
const time = 1_800_000_000_000
function scores(score = '2', selected = ids): SportsScores {
  return { date, failed: [], competitions: selected.map(id => ({ id, name: id, matches: [{ id: 'm', start: '2026-11-15T18:00:00Z', status: 'live', statusText: '67', title: null, detail: null, home: { name: 'Bayern', shortName: null, logo: null, score, winner: null }, away: { name: 'Dortmund', shortName: null, logo: null, score: '1', winner: null } }] })) }
}
const homeScore = (data: SportsScores | null) => data?.competitions[0].matches[0]?.home?.score
beforeEach(() => { localStorage.clear(); api.loadSportsScores.mockReset(); vi.spyOn(Date, 'now').mockReturnValue(time) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear() })
it('hydrates immediately after remount, refreshes behind visible data, and replaces it on success', async () => {
  api.loadSportsScores.mockResolvedValue(scores())
  const first = renderHook(() => useSportsScores(ids, date))
  await waitFor(() => expect(homeScore(first.result.current.scores)).toBe('2'))
  first.unmount()
  let finish!: (s: SportsScores) => void
  api.loadSportsScores.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const second = renderHook(() => useSportsScores(ids, date))
  expect(homeScore(second.result.current.scores)).toBe('2')
  expect(second.result.current.cached).toBe(true)
  expect(second.result.current.refreshing).toBe(true)
  expect(second.result.current.updatedAt).toBe(time)
  await act(async () => { finish(scores('3')) })
  expect(homeScore(second.result.current.scores)).toBe('3')
  expect(second.result.current.cached).toBe(false)
  expect(second.result.current.refreshing).toBe(false)
})
it('keeps good results after a failed refresh and retries without blanking the screen', async () => {
  saveScoreSnapshot(source, scores(), time - 60_000)
  api.loadSportsScores.mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() => useSportsScores(ids, date))
  await waitFor(() => expect(result.current.failed).toBe(true))
  expect(homeScore(result.current.scores)).toBe('2')
  expect(result.current.updatedAt).toBe(time - 60_000)
  api.loadSportsScores.mockResolvedValue(scores('4'))
  act(() => result.current.retry())
  expect(homeScore(result.current.scores)).toBe('2')
  await waitFor(() => expect(homeScore(result.current.scores)).toBe('4'))
  expect(result.current.failed).toBe(false)
})
it('retains only the matching failed competitions in a partial answer with their original age', async () => {
  const two = [ids[0], 'soccer/eng.1']
  saveScoreSnapshot(source, scores('2', two), time - 60_000)
  api.loadSportsScores.mockResolvedValue({ ...scores('3'), failed: ['soccer/eng.1'] })
  const { result } = renderHook(() => useSportsScores(two, date))
  await waitFor(() => expect(result.current.refreshing).toBe(false))
  expect(result.current.scores?.competitions.map(c => c.matches[0].home?.score)).toEqual(['3', '2'])
  expect(result.current.cached).toBe(true)
  expect(result.current.updatedAt).toBe(time - 60_000)
})
it('does not show another date or save a late aborted response', async () => {
  let late!: (s: SportsScores) => void
  api.loadSportsScores.mockReturnValueOnce(new Promise(resolve => { late = resolve })).mockReturnValue(new Promise(() => {}))
  const { result, rerender } = renderHook(({ day }) => useSportsScores(ids, day), { initialProps: { day: date } })
  rerender({ day: '20261116' })
  await act(async () => { late(scores()) })
  expect(result.current.scores).toBeNull()
  expect(readScoreSnapshot(source, ids, date, time)).toBeNull()
})
it('uses saved results offline and refreshes immediately on reconnection', async () => {
  saveScoreSnapshot(source, scores(), time)
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  api.loadSportsScores.mockResolvedValue(scores('5'))
  const { result } = renderHook(() => useSportsScores(ids, date))
  expect(result.current.offline).toBe(true)
  expect(homeScore(result.current.scores)).toBe('2')
  expect(api.loadSportsScores).not.toHaveBeenCalled()
  online.mockReturnValue(true)
  act(() => window.dispatchEvent(new Event('online')))
  await waitFor(() => expect(homeScore(result.current.scores)).toBe('5'))
})
it('shows a slow state after eight seconds without stored data and clears it after success', async () => {
  vi.useFakeTimers()
  let finish!: (s: SportsScores) => void
  api.loadSportsScores.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { result } = renderHook(() => useSportsScores(ids, date))
  await act(async () => { await vi.advanceTimersByTimeAsync(8_000) })
  expect(result.current.slow).toBe(true)
  await act(async () => { finish(scores()) })
  expect(result.current.slow).toBe(false)
})
it('refreshes on becoming visible without duplicating a request already running', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  api.loadSportsScores.mockReturnValue(new Promise(() => {}))
  renderHook(() => useSportsScores(ids, date))
  expect(api.loadSportsScores).not.toHaveBeenCalled()
  visibility.mockReturnValue('visible')
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(api.loadSportsScores).toHaveBeenCalledTimes(1)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(api.loadSportsScores).toHaveBeenCalledTimes(1)
})
it('still displays network results when persistent storage is blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  api.loadSportsScores.mockResolvedValue(scores())
  const { result } = renderHook(() => useSportsScores(ids, date))
  await waitFor(() => expect(homeScore(result.current.scores)).toBe('2'))
})
