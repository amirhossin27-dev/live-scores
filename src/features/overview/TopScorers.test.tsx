import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TopScorers } from './TopScorers'
import { sortScorers } from './sportsScorers'
import type { SportsScorer, SportsScorers } from './sportsScorers'

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('../../services/platformApi', () => ({ fetchJson }))

vi.mock('./PlayerProfile', () => ({ PlayerProfile: ({ id, onBack }: { id: string; onBack: () => void }) => <div data-testid="player-profile">{id}<button onClick={onBack}>Back</button></div> }))
vi.mock('./TeamProfile', () => ({ TeamProfile: ({ team, onBack }: { team: { id: string }; onBack: () => void }) => <div data-testid="team-profile">{team.id}<button onClick={onBack}>Back</button></div> }))

const germany = { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' }

const players: SportsScorer[] = [
  { id: '1', name: 'Goal Leader', country: germany, team: 'First Club', teamId: '10', goals: 12, assists: 1, scorings: 13 },
  { id: '2', name: 'Assist Leader', team: 'Second Club', teamId: '20', goals: 3, assists: 15, scorings: 18 },
  { id: '3', name: 'Unknown Count', team: null, teamId: null, goals: null, assists: 5, scorings: null },
]
const response: SportsScorers = { competition: 'soccer/ger.1', season: '2026/2027', updatedAt: '2026-10-24T13:00:00Z', source: 'fotmob', available: true, seasons: ['2026/2027', '2025/2026'], players }
const props = { competition: 'soccer/ger.1', season: '2026-27', language: 'de' as const }
const names = () => within(screen.getByRole('table', { name: 'Top Scorers' })).getAllByRole('rowheader').map((cell) => cell.querySelector('.scorer-player-link')?.textContent)
const tick = async (milliseconds = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) }) }

beforeEach(() => {
  vi.useFakeTimers()
  fetchJson.mockReset().mockResolvedValue(response)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('top scorer table', () => {
  it('shows the 1990 archive without opening unrelated numeric player or team profiles', async () => {
    fetchJson.mockResolvedValue({ ...response, season: '1990/1991', source: 'transfermarkt', seasons: ['2026/2027', '1990/1991', '1989/1990'],
      players: [{ id: 'transfermarkt:117598', name: 'Historical Player', team: 'Real Madrid', teamId: null, teamLogo: 'https://img.a.transfermarkt.technology/wappen/small/418.png', goals: 19, assists: 6, scorings: 25, hasProfile: false }] })
    render(<TopScorers {...props} season="1990/1991" />)
    await tick()
    expect(names()).toEqual(['Historical Player'])
    expect(screen.queryByRole('button', { name: 'Historical Player' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Real Madrid' })).toBeNull()
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['2026/2027', '1990/1991'])
    expect(screen.getByTitle('Real Madrid').querySelector('img')?.getAttribute('src')).toContain('/418.png')
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toContain('25')
  })

  it('loads a selected historical season, removes old rows and keeps the season choices', async () => {
    render(<TopScorers {...props} />)
    await tick()
    expect((screen.getByRole('combobox', { name: 'Saison' }) as HTMLSelectElement).value).toBe('2026/2027')
    let resolve!: (data: SportsScorers) => void
    fetchJson.mockImplementationOnce(() => new Promise<SportsScorers>((done) => { resolve = done }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2025/2026' } })
    expect(screen.queryByText('Goal Leader')).toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(fetchJson).toHaveBeenLastCalledWith('/api/sports/scorers?competition=soccer%2Fger.1&season=2025%2F2026', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    await act(async () => { resolve({ ...response, season: '2025/2026', players: [{ ...players[0], name: 'Historical Leader' }] }) })
    expect(names()).toEqual(['Historical Leader'])
  })

  it('opens the nationality flag in the national team profile and returns to the ranking', async () => {
    render(<TopScorers {...props} />)
    await tick()
    expect(screen.queryByText(/Scorerpunkte =/)).toBeNull()
    expect(screen.queryByText(/Automatische Aktualisierung/)).toBeNull()
    fetchJson.mockResolvedValueOnce({ id: '8570', name: 'Germany' })
    fireEvent.click(screen.getByRole('button', { name: 'Nationalmannschaft von Deutschland öffnen' }))
    await tick()
    expect(fetchJson).toHaveBeenCalledWith('/api/sports/national-team?code=GER', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.getByTestId('team-profile').textContent).toContain('8570')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(names()[0]).toBe('Goal Leader')
  })

  it('offers retry on failed nationality lookup and aborts when returning', async () => {
    render(<TopScorers {...props} />)
    await tick()
    fetchJson.mockRejectedValueOnce(new Error('unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Nationalmannschaft von Deutschland öffnen' }))
    await tick()
    expect(screen.getByRole('status').textContent).toContain('nicht verfügbar')
    fetchJson.mockImplementationOnce(() => new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await tick()
    const signal = fetchJson.mock.calls.at(-1)![1].signal as AbortSignal
    fireEvent.click(screen.getByRole('button', { name: '‹ Zurück zu Top Scorers' }))
    expect(signal.aborted).toBe(true)
    expect(names()[0]).toBe('Goal Leader')
  })

  it('opens player and badge profiles and preserves sorting when returning', async () => {
    render(<TopScorers {...props} />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Assists absteigend sortieren' }))
    fireEvent.click(screen.getByRole('button', { name: 'Goal Leader' }))
    expect(screen.getByTestId('player-profile').textContent).toContain('1')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(names()[0]).toBe('Assist Leader')
    const badge = screen.getByRole('button', { name: 'First Club' })
    expect(badge.querySelector('img')?.getAttribute('src')).toContain('/10.png')
    expect(screen.queryByText('First Club')).toBeNull()
    fireEvent.click(badge)
    expect(screen.getByTestId('team-profile').textContent).toContain('10')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(names()[0]).toBe('Assist Leader')
  })

  it('loads when shown, passes the season, and sorts all three metrics in either direction', async () => {
    render(<TopScorers {...props} />)
    await tick()
    expect(fetchJson).toHaveBeenCalledWith('/api/sports/scorers?competition=soccer%2Fger.1&season=2026-27', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(names()).toEqual(['Goal Leader', 'Assist Leader', 'Unknown Count'])
    fireEvent.click(screen.getByRole('button', { name: 'Assists absteigend sortieren' }))
    expect(names()).toEqual(['Assist Leader', 'Unknown Count', 'Goal Leader'])
    fireEvent.click(screen.getByRole('button', { name: 'Assists aufsteigend sortieren' }))
    expect(names()).toEqual(['Goal Leader', 'Unknown Count', 'Assist Leader'])
    fireEvent.click(screen.getByRole('button', { name: 'Scorerpunkte absteigend sortieren' }))
    expect(names()).toEqual(['Assist Leader', 'Goal Leader', 'Unknown Count'])
    fireEvent.click(screen.getByRole('button', { name: 'Scorerpunkte aufsteigend sortieren' }))
    expect(names()).toEqual(['Goal Leader', 'Assist Leader', 'Unknown Count'])
    fireEvent.click(screen.getByRole('button', { name: 'Tore absteigend sortieren' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tore aufsteigend sortieren' }))
    expect(names()).toEqual(['Assist Leader', 'Goal Leader', 'Unknown Count'])
    expect(screen.getByRole('columnheader', { name: /Tore/ }).getAttribute('aria-sort')).toBe('ascending')
    expect(screen.getAllByTitle('Keine Angabe')).toHaveLength(2)
  })

  it('refreshes every 30 seconds, preserves the chosen sorting, and stops when left', async () => {
    const { unmount } = render(<TopScorers {...props} />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Assists absteigend sortieren' }))
    fetchJson.mockResolvedValue({ ...response, players: players.map((player) => player.id === '1' ? { ...player, assists: 20, scorings: 32 } : player) })
    await tick(30_000)
    expect(fetchJson).toHaveBeenCalledTimes(2)
    expect(names()[0]).toBe('Goal Leader')
    expect(screen.getByRole('columnheader', { name: /Assists/ }).getAttribute('aria-sort')).toBe('descending')
    unmount()
    const signal = fetchJson.mock.calls[1][1].signal as AbortSignal
    expect(signal.aborted).toBe(true)
    await tick(90_000)
    expect(fetchJson).toHaveBeenCalledTimes(2)
  })

  it('retains stale rows on refresh failure, retries automatically, and recovers', async () => {
    render(<TopScorers {...props} />)
    await tick()
    fetchJson.mockRejectedValueOnce(new Error('upstream'))
    await tick(30_000)
    expect(screen.getByRole('status').textContent).toContain('letzte erfolgreiche Abruf')
    expect(names()).toHaveLength(3)
    await tick(30_000)
    expect(screen.queryByRole('status')).toBeNull()
    expect(fetchJson).toHaveBeenCalledTimes(3)
  })

  it('pauses in hidden tabs and immediately refreshes after returning', async () => {
    render(<TopScorers {...props} />)
    await tick()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    fireEvent(document, new Event('visibilitychange'))
    await tick(90_000)
    expect(fetchJson).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    fireEvent(document, new Event('visibilitychange'))
    await tick()
    expect(fetchJson).toHaveBeenCalledTimes(2)
  })

  it('never shows rows from a different league and ignores responses after unmount', async () => {
    const { rerender, unmount } = render(<TopScorers {...props} />)
    await tick()
    let resolve!: (data: SportsScorers) => void
    fetchJson.mockImplementationOnce(() => new Promise<SportsScorers>((done) => { resolve = done }))
    rerender(<TopScorers {...props} competition="soccer/eng.1" />)
    expect(screen.queryByText('Goal Leader')).toBeNull()
    unmount()
    await act(async () => { resolve(response) })
    await tick(60_000)
    expect(fetchJson).toHaveBeenCalledTimes(2)
  })

  it('explains missing source data instead of showing an empty ranking', async () => {
    fetchJson.mockResolvedValue({ ...response, available: false, players: [] })
    render(<TopScorers {...props} />)
    await tick()
    expect(screen.getByText(/noch keine Scorer-Daten verfügbar/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('sorts numerically, keeps unknowns last and does not mutate the data', () => {
    expect(sortScorers(players, 'goals', 'descending').map((player) => player.goals)).toEqual([12, 3, null])
    expect(sortScorers(players, 'goals', 'ascending').map((player) => player.goals)).toEqual([3, 12, null])
    expect(players.map((player) => player.goals)).toEqual([12, 3, null])
  })
})
