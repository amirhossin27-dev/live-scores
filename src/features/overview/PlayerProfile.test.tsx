import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerProfile } from './PlayerProfile'
import type { SportsPlayerMatch, SportsPlayerProfile } from './sportsApi'

const api = vi.hoisted(() => ({ loadPlayerProfile: vi.fn(), loadPlayerSeason: vi.fn(), loadPlayerMatches: vi.fn() }))
vi.mock('./sportsApi', () => api)

function match(id: string, competition: string, opponent: string): SportsPlayerMatch {
  return { id, competition, opponent, date: '2026-10-01T18:00:00Z', home: true, homeScore: 2, awayScore: 0, minutes: 90, goals: 1, assists: 0, yellowCards: 0, redCards: 0, rating: 8, onBench: false }
}
const leagueMatch = match('current-1', 'Bundesliga', 'FC Augsburg')
const cupMatch = match('current-2', 'Champions League', 'Arsenal')
function profile(overrides: Partial<SportsPlayerProfile> = {}): SportsPlayerProfile {
  return {
    id: '9', name: 'Harry Kane', team: 'Bayern München', position: null, country: 'England', countryCode: 'ENG', birthDate: null, age: 33, heightCm: 188,
    foot: null, shirt: '9', marketValue: null, contractEnd: null, injury: null, seasonLeague: 'Bundesliga', season: '2026/2027',
    seasonStats: [{ key: 'goals', title: 'Goals', value: '9' }], recentMatches: [leagueMatch], career: [], transfers: [], transfersSource: 'fotmob',
    seasons: [
      { name: '2026/2027', competitions: [{ entry: '0-0', name: 'Bundesliga' }, { entry: '0-1', name: 'Champions League' }] },
      { name: '2025/2026', competitions: [{ entry: '1-0', name: 'Bundesliga' }, { entry: '1-1', name: 'DFB Pokal' }] },
      { name: '2024/2025', competitions: [{ entry: '2-0', name: 'Bundesliga' }] },
    ], seasonEntry: '0-0', ...overrides,
  }
}
function renderProfile(language: 'de' | 'en' = 'de', onOpenTeam = vi.fn()) {
  return render(<PlayerProfile id="9" name="Harry Kane" language={language} locale={language === 'de' ? 'de-DE' : 'en-GB'} onBack={() => {}} onOpenTeam={onOpenTeam} />)
}
beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  api.loadPlayerProfile.mockResolvedValue(profile())
  api.loadPlayerMatches.mockResolvedValue([leagueMatch, cupMatch])
  api.loadPlayerSeason.mockResolvedValue([{ key: 'goals', title: 'Goals', value: '36' }])
})
afterEach(cleanup)

describe('player profile seasons', () => {
  it('places the season below Recent matches and loads all season competitions with working filters', async () => {
    renderProfile()
    expect(await screen.findByText('Arsenal')).toBeTruthy()
    const recent = document.querySelector('.pp-recent-panel') as HTMLElement
    const picker = within(recent).getByRole('combobox', { name: 'Saison' })
    expect(recent.querySelector('h4')).toBeNull()
    expect((picker as HTMLSelectElement).value).toBe('2026/2027')
    expect(api.loadPlayerMatches).toHaveBeenCalledWith('9', '2026/2027', expect.any(AbortSignal))
    expect(screen.getByText('2 Spiele')).toBeTruthy()
    expect(screen.getByText('2 Wettbewerbe')).toBeTruthy()
    const filters = within(screen.getByRole('group', { name: 'Wettbewerb' }))
    fireEvent.click(filters.getByRole('button', { name: 'Champions League 1' }))
    expect(screen.queryByText('FC Augsburg')).toBeNull()
    expect(screen.getByText('Arsenal')).toBeTruthy()
    fireEvent.click(filters.getByRole('button', { name: 'Alle Wettbewerbe 2' }))
    expect(screen.getByText('FC Augsburg')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Karriere' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Letzte Spiele' }))
    expect((screen.getByRole('combobox', { name: 'Saison' }) as HTMLSelectElement).value).toBe('2026/2027')
  })

  it('clears current matches during a historical request and ignores an older response after a second season change', async () => {
    let finishOld: (value: SportsPlayerMatch[]) => void = () => {}
    let finishOldFigures: (value: { key: string; title: string; value: string }[]) => void = () => {}
    api.loadPlayerSeason.mockImplementation((_id: string, entry: string) => entry === '1-0' ? new Promise((resolve) => { finishOldFigures = resolve }) : Promise.resolve([{ key: 'goals', title: 'Goals', value: '45' }]))
    api.loadPlayerMatches.mockImplementation((_id: string, season: string) => season === '2025/2026' ? new Promise<SportsPlayerMatch[]>((resolve) => { finishOld = resolve }) : Promise.resolve(season === '2024/2025' ? [match('oldest', 'DFB Pokal', 'Mainz 05')] : [leagueMatch, cupMatch]))
    renderProfile()
    await screen.findByText('Arsenal')
    const picker = screen.getByRole('combobox', { name: 'Saison' })
    fireEvent.change(picker, { target: { value: '2025/2026' } })
    expect(screen.queryByText('FC Augsburg')).toBeNull()
    expect(screen.queryByText('Arsenal')).toBeNull()
    expect(screen.getByText('Saisonspiele werden geladen …')).toBeTruthy()
    const firstSignal = api.loadPlayerMatches.mock.calls.find((call) => call[1] === '2025/2026')?.[2] as AbortSignal
    fireEvent.change(picker, { target: { value: '2024/2025' } })
    expect(await screen.findByText('Mainz 05')).toBeTruthy()
    expect(firstSignal.aborted).toBe(true)
    await act(async () => {
      finishOld([match('stale', 'Premier League', 'Stale opponent')])
      finishOldFigures([{ key: 'goals', title: 'Goals', value: '99' }])
    })
    expect(within(screen.getByRole('region', { name: 'Statistik' })).getByText('45')).toBeTruthy()
    expect(screen.queryByText('99')).toBeNull()
    expect(screen.queryByText('Stale opponent')).toBeNull()
    expect(screen.getByText('Mainz 05')).toBeTruthy()
    const filters = within(screen.getByRole('group', { name: 'Wettbewerb' }))
    expect(filters.getByRole('button', { name: 'DFB Pokal 1' })).toBeTruthy()
    expect(filters.queryByRole('button', { name: /Champions League/ })).toBeNull()
  })

  it('shows an unavailable historical season with a retry and never falls back to current games', async () => {
    api.loadPlayerMatches.mockImplementation((_id: string, season: string) => season === '2025/2026' ? Promise.reject(new Error('offline')) : Promise.resolve([leagueMatch]))
    renderProfile()
    await screen.findByRole('combobox', { name: 'Saison' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Saison' }), { target: { value: '2025/2026' } })
    expect(await screen.findByText('Die Spiele dieser Saison sind gerade nicht erreichbar.')).toBeTruthy()
    expect(screen.queryByText('FC Augsburg')).toBeNull()
    api.loadPlayerMatches.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByText('Für diese Saison sind keine Spiele verfügbar.')).toBeTruthy()
    expect(screen.queryByText('FC Augsburg')).toBeNull()
  })

  it('keeps the current latest games available if loading the full current season fails', async () => {
    api.loadPlayerMatches.mockRejectedValue(new Error('offline'))
    renderProfile()
    expect(await screen.findByText('Die Spiele dieser Saison sind gerade nicht erreichbar.')).toBeTruthy()
    expect(screen.getByText('Zuletzt verfügbare Spiele')).toBeTruthy()
    expect(screen.getByText('FC Augsburg')).toBeTruthy()
  })

  it('groups real career totals by season and combines transfer-season teams without inventing unknown totals', async () => {
    api.loadPlayerProfile.mockResolvedValue(profile({ careerSeasons: [
      { season: '2025/2026', teams: [
        { team: 'Bayern München', teamId: '9823', logo: null, kind: 'club', appearances: 32, goals: 30, assists: 8 },
        { team: 'England', teamId: '77', logo: null, kind: 'national', appearances: 8, goals: 5, assists: 2 },
      ] },
      { season: '2024/2025', teams: [{ team: 'Bayern München', teamId: '9823', logo: null, kind: 'club', appearances: 30, goals: 26, assists: null }] },
    ] }))
    const onOpenTeam = vi.fn()
    renderProfile('de', onOpenTeam)
    await screen.findByRole('heading', { name: 'Harry Kane' })
    fireEvent.click(screen.getByRole('tab', { name: 'Karriere' }))
    const seasons = [...document.querySelectorAll('.pp-career-season')]
    expect(seasons).toHaveLength(2)
    expect(seasons[0].querySelector('summary')?.textContent).toContain('2025/2026')
    expect([...seasons[0].querySelectorAll('.pp-career-totals b')].map((item) => item.textContent)).toEqual(['40', '35', '10'])
    expect([...seasons[1].querySelectorAll('.pp-career-totals b')].map((item) => item.textContent)).toEqual(['30', '26', '–'])
    expect(screen.getByRole('table', { name: '2025/2026 · Vereine und Nationalmannschaften' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('table', { name: '2025/2026 · Vereine und Nationalmannschaften' })).getByRole('button', { name: /Bayern München/ }))
    expect(onOpenTeam).toHaveBeenCalledWith('9823')
  })

  it('localizes the new season browser and compact statistics in English', async () => {
    renderProfile('en')
    expect(await screen.findByText('Arsenal')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Season' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Statistics' })).toBeTruthy()
    expect(screen.getByText('2 matches')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All competitions 2' })).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), { target: { value: '2025/2026' } })
    await waitFor(() => expect(api.loadPlayerSeason).toHaveBeenCalledWith('9', '1-0', expect.anything()))
    expect(await screen.findByText('36')).toBeTruthy()
  })

  it('always shows goals, assists and red cards including real zeros, with at most six figures', async () => {
    api.loadPlayerProfile.mockResolvedValue(profile({ seasonStats: [
      { key: 'matches_uppercase', title: 'Matches', value: '12' },
      { key: 'started', title: 'Starts', value: '11' },
      { key: 'minutes_played', title: 'Minutes', value: '990' },
      { key: 'rating', title: 'Rating', value: '7.4' },
      { key: 'yellow_cards', title: 'Yellow cards', value: '2' },
      { key: 'goals', title: 'Goals', value: '0' },
      { key: 'assists', title: 'Assists', value: '0' },
      { key: 'red_cards', title: 'Red cards', value: '0' },
    ] }))
    renderProfile('en')
    const statistics = await screen.findByRole('region', { name: 'Statistics' })
    expect([...statistics.querySelectorAll('li')].map((item) => item.textContent)).toEqual(['12Matches', '0Goals', '0Assists', '0Red cards', '990Minutes', '7.4Rating'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), { target: { value: '2025/2026' } })
    api.loadPlayerSeason.mockResolvedValue([{ key: 'goals', title: 'Goals', value: '0' }, { key: 'assists', title: 'Assists', value: '0' }, { key: 'red_cards', title: 'Red cards', value: '0' }])
    fireEvent.change(screen.getByRole('combobox', { name: 'Competition' }), { target: { value: '1-1' } })
    await waitFor(() => expect([...statistics.querySelectorAll('li')].map((item) => item.textContent)).toEqual(['0Goals', '0Assists', '0Red cards']))
  })

  it('keeps unknown figures distinct from zero and prioritizes goalkeeper figures within six values', async () => {
    api.loadPlayerProfile.mockResolvedValue(profile({ seasonStats: [
      { key: 'goals', title: 'Goals', value: '0' },
      { key: 'matches_uppercase', title: 'Matches', value: '9' },
      { key: 'minutes_played', title: 'Minutes', value: '810' },
      { key: 'rating', title: 'Rating', value: '7.5' },
      { key: 'goals_conceded', title: 'Goals conceded', value: '6' },
      { key: 'clean_sheet_title', title: 'Clean sheets', value: '4' },
    ] }))
    renderProfile('en')
    const statistics = await screen.findByRole('region', { name: 'Statistics' })
    expect([...statistics.querySelectorAll('li')].map((item) => item.textContent)).toEqual(['9Matches', '0Goals', '–Assists', '–Red cards', '6Goals conceded', '4Clean sheets'])
    expect(within(statistics).getAllByTitle('Not available')).toHaveLength(2)
  })

  it('pages long season lists eight games at a time and resets on competition and season changes', async () => {
    const fullSeason = Array.from({ length: 20 }, (_, index) => match(`m${index}`, index < 10 ? 'Bundesliga' : 'Champions League', `Opponent ${index + 1}`))
    const historic = Array.from({ length: 12 }, (_, index) => match(`h${index}`, 'DFB Pokal', `Historic ${index + 1}`))
    api.loadPlayerMatches.mockImplementation((_id: string, season: string) => Promise.resolve(season === '2025/2026' ? historic : fullSeason))
    renderProfile('en')
    await screen.findByText('20 matches')
    expect(document.querySelectorAll('.pp-recent tbody tr')).toHaveLength(8)
    expect(screen.getByText('1–8 of 20 matches')).toBeTruthy()
    expect(screen.queryByText('Opponent 9')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next matches' }))
    expect(screen.getByText('Opponent 9')).toBeTruthy()
    expect(screen.getByText('9–16 of 20 matches')).toBeTruthy()
    const filters = within(screen.getByRole('group', { name: 'Competition' }))
    fireEvent.click(filters.getByRole('button', { name: 'Champions League 10' }))
    expect(screen.getByText('1–8 of 10 matches')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Previous matches' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next matches' }))
    expect(document.querySelectorAll('.pp-recent tbody tr')).toHaveLength(2)
    expect(screen.getByText('9–10 of 10 matches')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), { target: { value: '2025/2026' } })
    expect(await screen.findByText('Historic 1')).toBeTruthy()
    expect(screen.getByText('1–8 of 12 matches')).toBeTruthy()
    expect(screen.queryByText('Opponent 19')).toBeNull()
    expect(document.querySelectorAll('.pp-recent tbody tr')).toHaveLength(8)
  })

})
