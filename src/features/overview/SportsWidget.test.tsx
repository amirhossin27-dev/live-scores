import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SportsWidget } from './SportsWidget'
import { saveScoreSnapshot } from './sportsScoreCache'
import type { SportsMatch, SportsMatchDetails, SportsPlayer, SportsPlayerProfile, SportsScores, SportsSide, SportsStandings, SportsTeamProfile } from './sportsApi'
import { maxCompetitions, presetSelection, sportsCatalog } from './sportsCatalog'

const api = vi.hoisted(() => ({ loadSportsScores: vi.fn(), loadMatchDetails: vi.fn(), loadPlayerProfile: vi.fn(), loadStandings: vi.fn(), loadBroadcasts: vi.fn(), loadTeam: vi.fn(), loadTeamNews: vi.fn(), findMatch: vi.fn(), loadPlayerSeason: vi.fn(), loadPlayerMatches: vi.fn(), searchSports: vi.fn(), loadNationalTeam: vi.fn() }))
vi.mock('./sportsApi', () => api)
const platform = vi.hoisted(() => ({ fetchJson: vi.fn(), apiBaseUrl: 'https://api.test' }))
vi.mock('../../services/platformApi', () => platform)

const now = new Date(2026, 9, 7, 12, 0)

function side(name: string, score: string | null, winner: boolean | null = null): SportsSide {
  return { name, shortName: null, logo: null, score, winner }
}

function match(id: string, overrides: Partial<SportsMatch>): SportsMatch {
  return { id, start: new Date(2026, 9, 7, 18, 30).toISOString(), status: 'scheduled', statusText: '', title: null, home: null, away: null, detail: null, ...overrides }
}

const scores: SportsScores = {
  date: '20261007',
  failed: [],
  competitions: [
    {
      id: 'soccer/esp.1',
      name: 'LALIGA',
      matches: [match('3', { status: 'finished', statusText: 'FT', home: side('FC Sevilla', '0'), away: side('Real Betis', '2', true) })],
    },
    {
      id: 'soccer/ger.1',
      name: 'Bundesliga',
      matches: [
        match('1', { status: 'live', statusText: "67'", home: side('Bayern München', '2'), away: side('Borussia Dortmund', '1') }),
        match('2', { home: side('RB Leipzig', '0'), away: side('VfB Stuttgart', '0') }),
        match('4', { home: side('Fortuna Dusseldorf', null), away: side('FC Cologne', null) }),
      ],
    },
    {
      id: 'racing/f1',
      name: 'Formula 1',
      matches: [match('r1', { title: 'Großer Preis von Mexiko', detail: 'Qualifying', home: null, away: null })],
    },
    {
      id: 'mma/ufc',
      name: 'UFC',
      matches: [match('f1', { title: 'Lightweight', detail: 'UFC 320', status: 'live', statusText: 'R2 3:12', home: side('Fighter One', null), away: side('Fighter Two', null) })],
    },
  ],
}

function renderWidget(language: 'de' | 'en' = 'de') {
  return render(<SportsWidget language={language} now={now} />)
}

function lastIds() {
  const calls = api.loadSportsScores.mock.calls
  return calls[calls.length - 1][0] as string[]
}

beforeEach(() => {
  api.loadNationalTeam.mockReset()
  api.loadPlayerMatches.mockResolvedValue([])
  window.localStorage.clear()
  api.loadSportsScores.mockResolvedValue(scores)
  // most matches and competitions in these tests have no table
  api.loadStandings.mockResolvedValue({ competition: '', season: null, table: null, bracket: null })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe('SportsWidget', () => {
  it('asks for the preset competitions of today: the Flashscore leagues, the cups of the top four, the European and the big tournaments', async () => {
    renderWidget()
    await screen.findByText('Bayern München')

    const [ids, date] = api.loadSportsScores.mock.calls[0]
    expect(date).toBe('20261007')
    expect(ids).toEqual([...presetSelection].sort())
    for (const id of ['soccer/ger.1', 'soccer/ger.2', 'soccer/eng.1', 'soccer/fra.1', 'soccer/ita.1', 'soccer/ksa.1', 'soccer/esp.1', 'soccer/tur.1']) expect(ids).toContain(id)
    for (const id of ['soccer/ger.dfb_pokal', 'soccer/eng.fa', 'soccer/esp.copa_del_rey', 'soccer/ita.coppa_italia']) expect(ids).toContain(id)
    for (const id of ['soccer/uefa.champions', 'soccer/uefa.europa', 'soccer/uefa.europa.conf', 'soccer/fifa.world', 'soccer/uefa.euro', 'soccer/uefa.nations', 'racing/f1', 'mma/ufc']) expect(ids).toContain(id)
    expect(ids.length).toBeLessThanOrEqual(maxCompetitions)
  })

  it('groups the matches by competition in the order of the catalog and shows time, live minute, score and result', async () => {
    renderWidget()
    await screen.findByText('Bayern München')

    const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(titles).toEqual(['DeutschlandBundesliga3', 'SpanienLaLiga1', 'MotorsportFormel 11', 'KampfsportUFC1'])

    const bundesliga = within(screen.getByRole('region', { name: 'Deutschland Bundesliga' }))
    const live = bundesliga.getByText('Bayern München').closest('li') as HTMLElement
    expect(live.classList.contains('is-live')).toBe(true)
    expect(live.textContent).toContain("67'")
    expect(live.textContent).toContain('2:1')
    const scheduled = bundesliga.getByText('RB Leipzig').closest('li') as HTMLElement
    expect(scheduled.textContent).toContain('18:30')
    // the source reports 0 : 0 before the kick-off: that is not a score
    expect(scheduled.textContent).toContain('–:–')
    expect(scheduled.textContent).not.toContain('0:0')

    const liga = within(screen.getByRole('region', { name: 'Spanien LaLiga' }))
    const finished = liga.getByText('Real Betis').closest('li') as HTMLElement
    expect(finished.textContent).toContain('Ende')
    expect(finished.textContent).toContain('0:2')
    expect(finished.querySelector('.is-winner .sp-name')?.textContent).toBe('Real Betis')
  })

  it('writes well-known clubs in German on the German page and as the source writes them in English', async () => {
    renderWidget()
    expect(await screen.findByText('Fortuna Düsseldorf')).toBeTruthy()
    expect(screen.getByText('1. FC Köln')).toBeTruthy()
    expect(screen.queryByText('FC Cologne')).toBeNull()
    cleanup()

    renderWidget('en')
    expect(await screen.findByText('Fortuna Dusseldorf')).toBeTruthy()
    expect(screen.getByText('FC Cologne')).toBeTruthy()
  })

  it('shows a race weekend as one line and a fight with its weight class and event', async () => {
    renderWidget()
    await screen.findByText('Bayern München')

    const race = screen.getByText('Großer Preis von Mexiko').closest('li') as HTMLElement
    expect(race.textContent).toContain('Qualifying')
    expect(race.textContent).toContain('18:30')

    const fight = screen.getByText('Fighter One').closest('li') as HTMLElement
    expect(fight.textContent).toContain('R2 3:12')
    expect(fight.textContent).toContain('Lightweight · UFC 320')
  })

  it('counts the matches that are live and can show only those', async () => {
    renderWidget()
    await screen.findByText('Bayern München')

    const filter = within(screen.getByRole('group', { name: 'Live-Ergebnisse' }))
    expect(filter.getByRole('button', { name: /Live/ }).textContent).toContain('2')
    fireEvent.click(filter.getByRole('button', { name: /Live/ }))

    expect(screen.queryByText('RB Leipzig')).toBeNull()
    expect(screen.queryByText('Real Betis')).toBeNull()
    expect(screen.getByText('Bayern München')).toBeTruthy()
    expect(screen.getByText('Fighter One')).toBeTruthy()

    fireEvent.click(filter.getByRole('button', { name: 'Alle' }))
    expect(screen.getByText('RB Leipzig')).toBeTruthy()
  })

  it('moves to other days and back with the arrows and asks for that day', async () => {
    renderWidget()
    await screen.findByText('Bayern München')

    fireEvent.click(screen.getByRole('button', { name: 'Nächster Tag' }))
    await waitFor(() => expect(api.loadSportsScores).toHaveBeenLastCalledWith(expect.any(Array), '20261008', expect.anything()))
    expect(screen.getByText('8. Okt.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Vorheriger Tag' }))
    fireEvent.click(screen.getByRole('button', { name: 'Vorheriger Tag' }))
    await waitFor(() => expect(api.loadSportsScores).toHaveBeenLastCalledWith(expect.any(Array), '20261006', expect.anything()))
    expect(screen.getByText('6. Okt.')).toBeTruthy()

    // the day opens a small calendar with the shown day marked; any day of it can be picked
    fireEvent.click(screen.getByRole('button', { name: 'Tag im Kalender wählen' }))
    const calendar = within(screen.getByRole('dialog', { name: 'Tag im Kalender wählen' }))
    expect(calendar.getByRole('button', { name: 'Dienstag, 6. Oktober 2026' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(calendar.getByRole('button', { name: 'Mittwoch, 7. Oktober 2026' }))
    await waitFor(() => expect(api.loadSportsScores).toHaveBeenLastCalledWith(expect.any(Array), '20261007', expect.anything()))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tag im Kalender wählen' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nächster Monat' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Samstag, 21. November 2026' }))
    await waitFor(() => expect(api.loadSportsScores).toHaveBeenLastCalledWith(expect.any(Array), '20261121', expect.anything()))
    expect(screen.getByText('21. Nov.')).toBeTruthy()
  })

  it('lets the user pick the competitions, remembers the choice in this browser and can go back to the preset', async () => {
    const view = renderWidget()
    await screen.findByText('Bayern München')

    fireEvent.click(screen.getByRole('button', { name: 'Wettbewerbe auswählen' }))
    expect(screen.getByText(/Wähle die Wettbewerbe/).textContent).toContain(`${presetSelection.length} von ${maxCompetitions}`)
    expect(screen.getByText(/Boxen ist nicht dabei/)).toBeTruthy()
    const bundesliga = screen.getByRole('checkbox', { name: 'Deutschland · Bundesliga' }) as HTMLInputElement
    expect(bundesliga.checked).toBe(true)
    const eredivisie = screen.getByRole('checkbox', { name: 'Niederlande · Eredivisie' }) as HTMLInputElement
    expect(eredivisie.checked).toBe(false)

    fireEvent.click(bundesliga)
    fireEvent.click(eredivisie)
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }))
    await waitFor(() => expect(lastIds()).toContain('soccer/ned.1'))
    expect(lastIds()).not.toContain('soccer/ger.1')
    expect([...JSON.parse(window.localStorage.getItem('dwh.sports.v1') ?? '[]')].sort()).toEqual(lastIds())

    // Another visit: the choice is still there.
    view.unmount()
    renderWidget()
    await waitFor(() => expect(lastIds()).toContain('soccer/ned.1'))
    expect(lastIds()).not.toContain('soccer/ger.1')

    fireEvent.click(screen.getByRole('button', { name: 'Wettbewerbe auswählen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Standard' }))
    expect(lastIds()).toEqual([...presetSelection].sort())
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('dwh.sports.v1') ?? '[]')).toEqual(presetSelection))
  })

  it('changes the order of the competitions with the arrows or by dragging, keeps it and asks for nothing new', async () => {
    const view = renderWidget()
    await screen.findByText('Bayern München')
    const titles = () => screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(titles()).toEqual(['DeutschlandBundesliga3', 'SpanienLaLiga1', 'MotorsportFormel 11', 'KampfsportUFC1'])

    fireEvent.click(screen.getByRole('button', { name: 'Wettbewerbe auswählen' }))
    const order = within(screen.getByRole('group', { name: 'Reihenfolge' }))
    const rows = () => order.getAllByRole('listitem').map((row) => row.querySelector('.sp-order-name')?.textContent)
    expect(rows()[0]).toBe('Deutschland · Bundesliga')
    expect((order.getByRole('button', { name: 'Deutschland · Bundesliga nach oben' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(order.getByRole('button', { name: 'Deutschland · Bundesliga nach unten' }))
    expect(rows().slice(0, 2)).toEqual(['Deutschland · 2. Bundesliga', 'Deutschland · Bundesliga'])
    expect(screen.getByText('Deutschland · Bundesliga steht jetzt an Stelle 2 von 20.')).toBeTruthy()

    // dragging LaLiga onto the upper half of the first line puts it first
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() }
    const rowOf = (name: string) => order.getAllByRole('listitem').find((row) => row.querySelector('.sp-order-name')?.textContent === name) as HTMLElement
    const target = rowOf('Deutschland · 2. Bundesliga')
    target.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40, left: 0, right: 300, width: 300, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.dragStart(rowOf('Spanien · LaLiga'), { dataTransfer })
    const over = createEvent.dragOver(target, { dataTransfer })
    Object.defineProperty(over, 'clientY', { value: 5 })
    fireEvent(target, over)
    fireEvent.drop(target, { dataTransfer })
    expect(rows().slice(0, 3)).toEqual(['Spanien · LaLiga', 'Deutschland · 2. Bundesliga', 'Deutschland · Bundesliga'])

    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }))
    expect(titles()).toEqual(['SpanienLaLiga1', 'DeutschlandBundesliga3', 'MotorsportFormel 11', 'KampfsportUFC1'])
    // the scores do not depend on the order: no new request
    expect(api.loadSportsScores).toHaveBeenCalledTimes(1)

    // the next visit keeps the order
    view.unmount()
    renderWidget()
    await screen.findByText('Bayern München')
    expect(titles()).toEqual(['SpanienLaLiga1', 'DeutschlandBundesliga3', 'MotorsportFormel 11', 'KampfsportUFC1'])
  })

  it('opens the match on its timeline when a team name in the scores is clicked', async () => {
    api.loadMatchDetails.mockResolvedValue({ ...matchWithTeams })
    renderWidget()
    const name = await screen.findByText('Bayern München')
    expect(screen.queryByRole('button', { name: 'Verein: Bayern München' })).toBeNull()
    // the name lies on the line, whose button opens the match
    expect(name.closest('li')?.querySelector('.sp-open')).toBeTruthy()
    fireEvent.click(name.closest('li')!.querySelector('.sp-open')!)
    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    expect(panel.getByRole('tab', { name: 'Spielverlauf' }).getAttribute('aria-selected')).toBe('true')
    expect(api.loadTeam).not.toHaveBeenCalled()
  })

  it('does not ask again and again: one request per choice, and none for an empty choice', async () => {
    renderWidget()
    await screen.findByText('Bayern München')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(api.loadSportsScores).toHaveBeenCalledTimes(1)

    cleanup()
    window.localStorage.setItem('dwh.sports.v1', '[]')
    api.loadSportsScores.mockClear()
    renderWidget()
    expect(screen.getByText('Keine Wettbewerbe ausgewählt.')).toBeTruthy()
    expect(api.loadSportsScores).not.toHaveBeenCalled()
  })

  it('does not take more competitions than the API accepts and ignores unknown stored ones', async () => {
    window.localStorage.setItem('dwh.sports.v1', JSON.stringify(['soccer/unknown.1', 'soccer/ger.1', 'soccer/ger.1']))
    renderWidget()
    await waitFor(() => expect(api.loadSportsScores).toHaveBeenCalled())
    expect(lastIds()).toEqual(['soccer/ger.1'])
    cleanup()

    window.localStorage.setItem('dwh.sports.v1', JSON.stringify(sportsCatalog.map((competition) => competition.id)))
    api.loadSportsScores.mockClear()
    renderWidget()
    await waitFor(() => expect(api.loadSportsScores).toHaveBeenCalled())
    expect(lastIds()).toHaveLength(maxCompetitions)

    fireEvent.click(screen.getByRole('button', { name: 'Wettbewerbe auswählen' }))
    const unchecked = screen.getAllByRole('checkbox').filter((box) => !(box as HTMLInputElement).checked)
    expect(unchecked.length).toBeGreaterThan(0)
    expect(unchecked.every((box) => (box as HTMLInputElement).disabled)).toBe(true)
  })

  it('skips a day without matches and shows the next day that has some, until the user picks a day', async () => {
    api.loadSportsScores.mockImplementation(async (_ids: string[], date: string) => (date === '20261009' ? scores : { date, competitions: [], failed: [] }))
    renderWidget()

    expect(await screen.findByText('Bayern München')).toBeTruthy()
    const dates = api.loadSportsScores.mock.calls.map((call) => call[1])
    expect(dates.slice(0, 3)).toEqual(['20261007', '20261008', '20261009'])
    expect(screen.getByText('Heute keine Spiele – der nächste Tag mit Spielen wird gezeigt.')).toBeTruthy()

    // going back by hand stays on the empty day instead of jumping forward again
    fireEvent.click(screen.getByRole('button', { name: 'Vorheriger Tag' }))
    expect(await screen.findByText('An diesem Tag keine Spiele in deinen Wettbewerben.')).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(api.loadSportsScores.mock.calls[api.loadSportsScores.mock.calls.length - 1][1]).toBe('20261008')
  })

  it('stops skipping after a week without matches and says so; an unreachable source is reported and retried on request', async () => {
    api.loadSportsScores.mockResolvedValue({ date: '20261007', competitions: [], failed: [] })
    renderWidget()
    await waitFor(() => expect(api.loadSportsScores.mock.calls.map((call) => call[1])).toContain('20261014'))
    expect(await screen.findByText('An diesem Tag keine Spiele in deinen Wettbewerben.')).toBeTruthy()
    expect(api.loadSportsScores).toHaveBeenCalledTimes(8)
    cleanup()

    api.loadSportsScores.mockReset()
    api.loadSportsScores.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(scores)
    renderWidget()
    expect(await screen.findByText('Die Ergebnisse sind gerade nicht erreichbar.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByText('Bayern München')).toBeTruthy()
  })

  it('mentions competitions without data and keeps the old results when a refresh fails', async () => {
    api.loadSportsScores.mockResolvedValue({ ...scores, failed: ['soccer/ita.1', 'soccer/fra.1'] })
    renderWidget('en')
    expect(await screen.findByText('Bayern München')).toBeTruthy()
    expect(screen.getByText('Could not refresh 2 competitions.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Live Scores' })).toBeTruthy()
    expect(screen.queryByText('Source: ESPN', { exact: false })).toBeNull()
  })

  const details: SportsMatchDetails = {
    id: '1',
    competition: 'German Bundesliga',
    start: new Date(2026, 9, 7, 18, 30).toISOString(),
    status: 'live',
    statusText: "67'",
    home: side('Bayern Munich', '2'),
    away: side('Borussia Dortmund', '1'),
    homePeriods: ['1', '1'],
    awayPeriods: ['0', '1'],
    venue: 'Allianz Arena',
    city: 'München',
    attendance: 75000,
    referee: { name: 'Felix Zwayer', country: { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' } },
    venueCountry: { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' },
    homeTeamId: '9823',
    awayTeamId: '9789',
    stats: [
      { key: 'shotPct', label: 'On Target %', home: '0.4', away: '0.3' },
      { key: 'totalShots', label: 'SHOTS', home: '14', away: '6' },
      { key: 'possessionPct', label: 'Possession', home: '61.5', away: '38.5' },
    ],
    events: [
      { kind: 'goal', minute: "12'", side: 'home', player: 'Harry Kane', other: 'Michael Olise' },
      { kind: 'yellow', minute: "30'", side: 'away', player: 'Emre Can', other: null },
      { kind: 'own-goal', minute: "45'+2'", side: 'away', player: 'Nico Schlotterbeck', other: null },
      { kind: 'substitution', minute: "45'", side: 'home', player: 'Leon Goretzka', other: 'Joshua Kimmich' },
      { kind: 'substitution', minute: "60'", side: 'away', player: 'Karim Adeyemi', other: 'Serhou Guirassy' },
      { kind: 'yellow-red', minute: "64'", side: 'away', player: 'Waldemar Anton', other: null },
    ],
    lineups: [
      {
        side: 'home',
        formation: '4-2-3-1',
        source: 'fotmob',
        coach: 'Vincent Kompany',
        starters: [player('Manuel Neuer', '1', { x: 0.5, y: 0.1, rating: 7.4, profileId: '9001', captain: true }), player('Harry Kane', '9', { x: 0.5, y: 0.9, rating: 8.6, profileId: '9002' })],
        bench: [player('Sven Ulreich', '26', { rating: null, profileId: '9003' })],
      },
      {
        side: 'away',
        formation: '4-3-3',
        source: 'fotmob',
        coach: null,
        starters: [player('Gregor Kobel', '1', { x: 0.5, y: 0.1, rating: 5.9, profileId: '9101' }), player('Emre Can', '23', { x: 0.5, y: 0.5, rating: 6.4, profileId: '9102', subOut: 70 })],
        bench: [player('Karim Adeyemi', '27', { rating: 6.8, profileId: '9103', subIn: 60 })],
      },
    ],
  }

  function player(name: string, jersey: string, rest: Partial<SportsPlayer>): SportsPlayer {
    return { name, jersey, position: null, x: null, y: null, rating: null, profileId: null, subIn: null, subOut: null, captain: false, ...rest }
  }

  const profile: SportsPlayerProfile = {
    id: '9002',
    name: 'Harry Kane',
    team: 'FC Bayern München',
    position: { key: 'striker_long', text: 'Striker' },
    country: 'England',
    countryCode: 'ENG',
    birthDate: '1993-07-28T00:00:00Z',
    age: 33,
    heightCm: 188,
    foot: { key: 'right', text: 'Right' },
    shirt: '9',
    marketValue: 65000000,
    contractEnd: '2027-06-30T00:00:00Z',
    injury: null,
    seasonLeague: 'Bundesliga',
    season: '2026/2027',
    seasonStats: [{ key: 'goals', title: 'Goals', value: '9' }, { key: 'rating', title: 'Rating', value: '8.1' }],
    recentMatches: [
      { id: 'm1', date: '2026-10-04T13:30:00Z', competition: 'Bundesliga', opponent: 'VfB Stuttgart', home: true, homeScore: 3, awayScore: 1, minutes: 90, goals: 2, assists: 0, yellowCards: 0, redCards: 0, rating: 9.1, onBench: false, opponentId: '10269', opponentLogo: 'https://images.fotmob.com/image_resources/logo/teamlogo/10269.png' },
      { id: 'm2', date: '2026-09-27T13:30:00Z', competition: 'Bundesliga', opponent: 'Hamburger SV', home: false, homeScore: 2, awayScore: 1, minutes: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: null, onBench: true },
    ],
    career: [
      { team: 'FC Bayern München', kind: 'club', start: '2023-08-12T00:00:00Z', end: null, active: true, appearances: 140, goals: 130, assists: 30, transfer: { key: 'transfer', text: 'Transfer' } },
      { team: 'Tottenham Hotspur', kind: 'club', start: '2011-07-01T00:00:00Z', end: '2023-08-11T00:00:00Z', active: false, appearances: 435, goals: 280, assists: 64, transfer: null },
    ],
    transfers: [
      { date: '2023-08-12T00:00:00Z', from: 'Tottenham', to: 'Bayern München', type: null, fee: 95000000, feeKind: 'fee', marketValue: 90000000, fromLogo: 'https://img.a.transfermarkt.technology/wappen/smallquad/148.png', toLogo: 'https://img.a.transfermarkt.technology/wappen/smallquad/27.png' },
      { date: '2013-05-31T00:00:00Z', from: 'Leicester', to: 'Tottenham', type: null, fee: null, feeKind: 'loan-end', marketValue: null },
    ],
    transfersSource: 'transfermarkt',
    injuryHistory: [
      { season: '25/26', injury: 'Muskelfaserriss', from: '2025-11-02T00:00:00Z', until: null, days: 12, gamesMissed: 2 },
      { season: '25/26', injury: 'Fieber', from: '2025-09-01T00:00:00Z', until: '2025-09-05T00:00:00Z', days: 5, gamesMissed: 1 },
      { season: '23/24', injury: 'Knöchelverletzung', from: '2024-03-01T00:00:00Z', until: '2024-03-20T00:00:00Z', days: 20, gamesMissed: 4 },
    ],
    trophies: [
      { role: 'player', team: 'Bayern München', teamId: '9823', logo: null, competition: 'Bundesliga', seasonsWon: ['2025/2026', '2024/2025'], seasonsRunnerUp: [] },
    ],
  }

  it('opens the statistics, timeline and line-ups of a match when its line is tapped', async () => {
    api.loadMatchDetails.mockResolvedValue(details)
    api.loadPlayerMatches.mockResolvedValue(profile.recentMatches)
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Statistik Bayern München gegen Borussia Dortmund' }))

    const panel = await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' })
    expect(api.loadMatchDetails).toHaveBeenCalledWith('soccer/ger.1', '1', expect.anything())
    const stats = within(panel)

    // the timeline is the first tab and opens first; a goal shows the black and white ball
    expect(stats.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Spielverlauf', 'Statistik', 'Aufstellung', 'Stream'])
    expect(await stats.findByText('Harry Kane')).toBeTruthy()
    expect(stats.getByRole('tab', { name: 'Spielverlauf' }).getAttribute('aria-selected')).toBe('true')
    expect(stats.getByRole('img', { name: 'Tor' }).querySelector('svg.football-icon')).toBeTruthy()
    expect(stats.getByText('(Michael Olise)')).toBeTruthy()
    expect(stats.getByRole('img', { name: 'Gelbe Karte' })).toBeTruthy()
    // a substitution in one line: the player coming on, then the one going off
    const change = panel.querySelectorAll('.md-moment')[4]
    expect(change.querySelector('.md-who.is-sub')?.textContent).toBe('Karim AdeyemiSerhou Guirassy')
    expect(within(change as HTMLElement).getByTitle('Eingewechselt').closest('.md-sub-on')?.textContent).toBe('Karim Adeyemi')
    expect(within(change as HTMLElement).getByTitle('Ausgewechselt').closest('.md-sub-off')?.textContent).toBe('Serhou Guirassy')
    // an own goal is the red ball, a second yellow its own card
    expect(stats.getByRole('img', { name: 'Eigentor' }).querySelector('svg.football-icon.is-own-goal')).toBeTruthy()
    expect(stats.getByRole('img', { name: 'Gelb-Rote Karte' })).toBeTruthy()
    // a line "Halbzeit" with the score at the break parts the halves (added time still belongs to the first half, changes at the break after it)
    const timeline = [...panel.querySelectorAll('.md-moments > li')].map((item) => item.classList.contains('md-break') ? item.textContent : item.querySelector('.md-minute')?.textContent)
    expect(timeline).toEqual(["12'", "30'", "45'+2'", 'Halbzeit1:0', "45'", "60'", "64'"])
    // referee and stadium at the top of the timeline, each with the flag of the country
    const facts = within(panel.querySelector('.md-facts') as HTMLElement)
    expect(facts.getByText('Schiedsrichter').nextElementSibling?.textContent).toBe('Felix Zwayer')
    expect(facts.getByText('Stadion').nextElementSibling?.textContent).toBe('Allianz Arena, München')
    expect(facts.getAllByRole('img', { name: 'Deutschland' })).toHaveLength(2)
    // names the line-ups know open the player profile, the others stay text
    expect(stats.getByRole('button', { name: 'Karim Adeyemi' }).getAttribute('title')).toBe('Profil von Karim Adeyemi')
    expect(stats.getByRole('button', { name: 'Emre Can' })).toBeTruthy()
    expect(stats.queryByRole('button', { name: 'Michael Olise' })).toBeNull()
    expect(stats.queryByRole('button', { name: 'Serhou Guirassy' })).toBeNull()
    api.loadPlayerProfile.mockResolvedValue(profile)
    fireEvent.click(stats.getByRole('button', { name: 'Harry Kane' }))
    expect(await stats.findByRole('heading', { name: 'Harry Kane' })).toBeTruthy()
    expect(api.loadPlayerProfile).toHaveBeenLastCalledWith('9002', 'de', expect.anything())
    fireEvent.click(stats.getByRole('button', { name: '‹ Zurück zum Spiel' }))
    expect(stats.getByRole('tab', { name: 'Spielverlauf' }).getAttribute('aria-selected')).toBe('true')

    // the football figures in a fixed order with German labels; ESPN's rounded percentages are left out
    fireEvent.click(stats.getByRole('tab', { name: 'Statistik' }))
    expect(stats.getByText('61,5 %')).toBeTruthy()
    expect(stats.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['61,5 %Ballbesitz38,5 %', '14Torschüsse6'])
    expect(stats.queryByText('On Target %')).toBeNull()
    expect(stats.queryByText('Stadion: Allianz Arena, München', { exact: false })).toBeNull()
    expect(stats.getByText('75.000 Zuschauer', { exact: false })).toBeTruthy()

    // the line-ups as a pitch: number, short name and the rating of every player, goals and cards from the timeline
    fireEvent.click(stats.getByRole('tab', { name: 'Aufstellung' }))
    const kane = stats.getByRole('button', { name: /^Harry Kane \(9\), Note 8.6, Tor – Profil von Harry Kane$/ })
    expect(kane.querySelector('.lp-name')?.textContent).toBe('Kane')
    expect(within(kane).queryByTitle('Nationalität nicht verfügbar')).toBeNull()
    expect(stats.getByRole('button', { name: /^Manuel Neuer \(1\), Kapitän, Note 7.4/ })).toBeTruthy()
    expect(stats.getByRole('button', { name: /^Emre Can \(23\), Note 6.4, Gelbe Karte, ausgewechselt 70\./ })).toBeTruthy()
    expect(stats.getByText('4-2-3-1')).toBeTruthy()
    expect(stats.getByText('Trainer: Vincent Kompany')).toBeTruthy()
    expect(stats.getByText('Karim Adeyemi').closest('.lp-bench-row')?.textContent).toBe('27Karim Adeyemi↑60′6,8')

    // a tap on a player opens his profile in the panel; "back" returns to the match
    api.loadPlayerProfile.mockResolvedValue(profile)
    fireEvent.click(kane)
    expect(await stats.findByRole('heading', { name: 'Harry Kane' })).toBeTruthy()
    expect(api.loadPlayerProfile).toHaveBeenCalledWith('9002', 'de', expect.anything())
    expect(stats.getByRole('img', { name: 'Harry Kane' }).getAttribute('src')).toContain('/playerimages/9002.png')
    fireEvent.error(stats.getByRole('img', { name: 'Harry Kane' }))
    expect(panel.querySelector('.pp-portrait svg')).toBeTruthy()
    expect(stats.getByText('FC Bayern München · Stürmer')).toBeTruthy()
    expect(stats.getByText('Keine aktuelle Verletzung bekannt.')).toBeTruthy()
    // the recent matches as a table: opponent with crest (opens the team), the result seen from the player's team, minutes, rating
    const recent = stats.getAllByRole('row')
    expect(recent[0].textContent).toBe('DatumGegnerTore, Vorlagen, KartenErgebnisMin.Note')
    // the whole row opens the match: the opponent is no team link here
    expect(within(recent[1]).queryByRole('button', { name: /^VfB Stuttgart/ })).toBeNull()
    expect(within(recent[1]).getByText('VfB Stuttgart')).toBeTruthy()
    expect(recent[1].querySelector('img.pp-crest')?.getAttribute('src')).toContain('10269')
    expect(recent[1].querySelector('.pp-result')?.className).toBe('pp-result is-win')
    expect(recent[1].querySelector('.pp-result')?.textContent).toBe('3:1')
    expect(within(recent[1]).getAllByRole('img', { name: 'Tor' })).toHaveLength(2)
    // away and lost 2:1: the player's team scored 1
    expect(recent[2].querySelector('.pp-result')?.textContent).toBe('1:2')
    expect(recent[2].querySelector('.pp-result')?.className).toBe('pp-result is-loss')
    expect(recent[2].textContent).toContain('Bank')
    // the transfers with the crests of both clubs and the fees from Transfermarkt
    fireEvent.click(stats.getByRole('tab', { name: 'Transfers' }))
    const move = stats.getByLabelText('Von: Tottenham').closest('li') as HTMLElement
    expect(within(move).getByLabelText('Zu: Bayern München')).toBeTruthy()
    expect([...move.querySelectorAll('img.pp-crest')].map((image) => image.getAttribute('src'))).toEqual([
      'https://img.a.transfermarkt.technology/wappen/smallquad/148.png',
      'https://img.a.transfermarkt.technology/wappen/smallquad/27.png',
    ])
    expect(within(move).getByText('95 Mio. €')).toBeTruthy()
    expect(within(move).getByText('Marktwert 90 Mio. €')).toBeTruthy()
    expect(stats.getByText('Leihende')).toBeTruthy()
    expect(stats.getByText('Summe der Ablösen: 95 Mio. €')).toBeTruthy()
    expect(stats.queryByText('Ablösesummen: Transfermarkt')).toBeNull()
    // the injuries from Transfermarkt by season, a running one in red without an end
    fireEvent.click(stats.getByRole('tab', { name: 'Verletzungen' }))
    expect(stats.queryByText('Verletzungshistorie: Transfermarkt')).toBeNull()
    const figures = [...document.querySelectorAll('.pp-injuries li')].map((item) => item.textContent)
    expect(figures).toEqual(['3Verletzungen', '37Tage', '7Verpasste Spiele'])
    const lines = stats.getAllByRole('row').map((row) => row.textContent?.replace(/\s/g, ' '))
    expect(lines).toEqual([
      'VerletzungTageSpiele',
      '25/262 Verletzungen · 17 Tage',
      'Muskelfaserriss02.11.25 – offen122',
      'Fieber01.09.25 – 05.09.2551',
      '23/241 Verletzung · 20 Tage',
      'Knöchelverletzung01.03.24 – 20.03.24204',
    ])
    expect(stats.getByText('Muskelfaserriss').closest('tr')?.className).toBe('is-open')
    // the titles with the team
    fireEvent.click(stats.getByRole('tab', { name: 'Titel' }))
    expect(within(panel.querySelector('.pp-titles') as HTMLElement).getByText('Bundesliga').closest('li')?.textContent).toBe('BundesligaBayern München2×2025/20262024/2025')
    fireEvent.click(stats.getByRole('button', { name: '‹ Zurück zum Spiel' }))
    expect(stats.getByRole('tab', { name: 'Aufstellung' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(['starter', 'bench'] as const)('opens the national team from a %s flag and returns to the selected line-up', async (position) => {
    const country = { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' }
    api.loadMatchDetails.mockResolvedValue({
      ...details,
      lineups: details.lineups.map((lineup) => ({
        ...lineup,
        starters: lineup.starters.map((person, index) => ({ ...person, country: position === 'starter' && lineup.side === 'home' && index === 0 ? country : null })),
        bench: lineup.bench.map((person, index) => ({ ...person, country: position === 'bench' && lineup.side === 'home' && index === 0 ? country : null })),
      })),
    })
    let resolveNationalTeam: (team: { id: string; name: string }) => void = () => {}
    api.loadNationalTeam.mockReturnValue(new Promise<{ id: string; name: string }>((resolve) => { resolveNationalTeam = resolve }))
    const nationalTeam: SportsTeamProfile = {
      id: '8570', name: 'Deutschland', logo: null, country, league: null, season: null, venue: null, city: null, capacity: null, coach: null,
      fixtures: [], trophies: [], transfers: [], squad: [],
    }
    api.loadTeam.mockResolvedValue(nationalTeam)
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Statistik Bayern München gegen Borussia Dortmund' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    fireEvent.click(await panel.findByRole('tab', { name: 'Aufstellung' }))
    fireEvent.click(panel.getByRole('button', { name: 'Nationalmannschaft von Deutschland öffnen' }))
    expect(api.loadNationalTeam).toHaveBeenCalledWith(country, expect.any(AbortSignal))
    expect(panel.getByRole('status').textContent).toBe('Nationalmannschaft wird geladen …')
    expect(api.loadPlayerProfile).not.toHaveBeenCalled()
    expect(api.loadTeam).not.toHaveBeenCalled()
    await act(async () => resolveNationalTeam({ id: '8570', name: 'Deutschland' }))
    expect(await panel.findByRole('heading', { level: 3, name: 'Deutschland' })).toBeTruthy()
    expect(api.loadTeam).toHaveBeenCalledWith({ id: '8570' }, expect.any(AbortSignal))
    expect(api.loadPlayerProfile).not.toHaveBeenCalled()
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zum Spiel' }))
    expect(panel.getByRole('tab', { name: 'Aufstellung' }).getAttribute('aria-selected')).toBe('true')
    expect(panel.getByRole('button', { name: 'Nationalmannschaft von Deutschland öffnen' })).toBeTruthy()
    expect(panel.queryByRole('heading', { level: 3, name: 'Deutschland' })).toBeNull()
  })

  it('returns to the preserved line-up when national-team resolution fails', async () => {
    const country = { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' }
    api.loadMatchDetails.mockResolvedValue({
      ...details,
      lineups: details.lineups.map((lineup) => ({ ...lineup, starters: lineup.starters.map((person, index) => ({ ...person, country: lineup.side === 'home' && index === 0 ? country : null })) })),
    })
    api.loadNationalTeam.mockRejectedValue(new Error('national team unavailable'))
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Statistik Bayern München gegen Borussia Dortmund' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    fireEvent.click(await panel.findByRole('tab', { name: 'Aufstellung' }))
    fireEvent.click(panel.getByRole('button', { name: 'Nationalmannschaft von Deutschland öffnen' }))
    expect(await panel.findByText('Die Nationalmannschaft ist gerade nicht verfügbar.')).toBeTruthy()
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zum Spiel' }))
    expect(panel.getByRole('tab', { name: 'Aufstellung' }).getAttribute('aria-selected')).toBe('true')
    expect(api.loadNationalTeam).toHaveBeenCalledWith(country, expect.any(AbortSignal))
    expect(api.loadTeam).not.toHaveBeenCalled()
    expect(api.loadPlayerProfile).not.toHaveBeenCalled()
    expect(panel.getByRole('button', { name: 'Nationalmannschaft von Deutschland öffnen' })).toBeTruthy()
  })

  it('aborts national-team navigation on back and ignores a late resolver response', async () => {
    const country = { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' }
    api.loadMatchDetails.mockResolvedValue({
      ...details,
      lineups: details.lineups.map((lineup) => ({ ...lineup, starters: lineup.starters.map((person, index) => ({ ...person, country: lineup.side === 'home' && index === 0 ? country : null })) })),
    })
    let resolveNationalTeam: (team: { id: string; name: string }) => void = () => {}
    api.loadNationalTeam.mockReturnValue(new Promise<{ id: string; name: string }>((resolve) => { resolveNationalTeam = resolve }))
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Statistik Bayern München gegen Borussia Dortmund' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    fireEvent.click(await panel.findByRole('tab', { name: 'Aufstellung' }))
    fireEvent.click(panel.getByRole('button', { name: 'Nationalmannschaft von Deutschland öffnen' }))
    expect(panel.getByRole('status').textContent).toBe('Nationalmannschaft wird geladen …')
    const signal = api.loadNationalTeam.mock.calls[0][1] as AbortSignal
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zum Spiel' }))
    fireEvent.click(panel.getByRole('tab', { name: 'Statistik' }))
    expect(signal.aborted).toBe(true)
    await act(async () => resolveNationalTeam({ id: '8570', name: 'Deutschland' }))
    expect(panel.getByRole('tab', { name: 'Statistik' }).getAttribute('aria-selected')).toBe('true')
    expect(panel.queryByText('Nationalmannschaft wird geladen …')).toBeNull()
    expect(api.loadTeam).not.toHaveBeenCalled()
    expect(api.loadPlayerProfile).not.toHaveBeenCalled()
  })

  it('offers statistics only for team sports and says so when the details are not reachable', async () => {
    api.loadMatchDetails.mockRejectedValue(new Error('502'))
    renderWidget('en')
    await screen.findByText('Bayern München')
    // a race weekend and a fight have no statistics at the source
    expect(screen.queryByRole('button', { name: /^Statistics .*Fighter One/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Statistics / })).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: 'Statistics FC Sevilla vs Real Betis' }))
    expect(await screen.findByText('The match data is not reachable right now.')).toBeTruthy()
  })
})

describe('SportsWidget favourites', () => {
  it('marks a match with the star, shows it only behind the star filter and remembers it in this browser', async () => {
    renderWidget()
    await screen.findByText('Bayern München')
    expect(screen.queryByRole('region', { name: 'Favoriten' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'RB Leipzig – VfB Stuttgart als Favorit merken' }))

    // "Alle" lists the match once, in its competition: the favourites are not repeated on top
    expect(screen.queryByRole('region', { name: 'Favoriten' })).toBeNull()
    expect(screen.getAllByText('RB Leipzig')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Favoriten' }).textContent).toBe('Favoriten 1')
    expect(JSON.parse(window.localStorage.getItem('dwh.sports.favorites.v1') ?? '[]')).toEqual([{ competition: 'soccer/ger.1', id: '2', start: scores.competitions[1].matches[1].start }])

    fireEvent.click(screen.getByRole('button', { name: 'Favoriten' }))
    const favorites = within(screen.getByRole('region', { name: 'Favoriten' }))
    expect(favorites.getByText('RB Leipzig')).toBeTruthy()
    // the line in the favourites names its competition
    expect(favorites.getByText('Deutschland · Bundesliga', { exact: false })).toBeTruthy()
    expect(screen.getAllByText('RB Leipzig')).toHaveLength(1)
    expect(screen.queryByText('Bayern München')).toBeNull()

    // live shows no favourites group either
    fireEvent.click(screen.getByRole('button', { name: /^Live/ }))
    expect(screen.queryByRole('region', { name: 'Favoriten' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Favoriten' }))

    // the star in the favourites group takes it out again
    fireEvent.click(screen.getByRole('button', { name: 'RB Leipzig – VfB Stuttgart aus den Favoriten nehmen' }))
    expect(screen.getByText('An diesem Tag spielt keiner deiner Favoriten.')).toBeTruthy()
    expect(window.localStorage.getItem('dwh.sports.favorites.v1')).toBe('[]')
  })

  it('marks a whole competition with the star of its title: all its matches are behind the star filter', async () => {
    renderWidget()
    await screen.findByText('Bayern München')
    fireEvent.click(screen.getByRole('button', { name: 'Deutschland · Bundesliga als Favorit merken (alle Spiele)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Spanien · LaLiga als Favorit merken (alle Spiele)' }))
    expect(JSON.parse(window.localStorage.getItem('dwh.sports.favoriteCompetitions.v1') ?? '[]')).toEqual(['soccer/ger.1', 'soccer/esp.1'])
    // a single match of another competition joins them
    fireEvent.click(screen.getByRole('button', { name: 'Fighter One – Fighter Two als Favorit merken' }))
    expect(screen.getByRole('button', { name: 'Favoriten' }).textContent).toBe('Favoriten 5')

    fireEvent.click(screen.getByRole('button', { name: 'Favoriten' }))
    expect(screen.getByRole('region', { name: 'Deutschland Bundesliga' })).toBeTruthy()
    expect(screen.getByText('RB Leipzig')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Favoriten' })).getByText('Fighter One')).toBeTruthy()
    expect(screen.queryByText('Großer Preis von Mexiko')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Deutschland · Bundesliga aus den Favoriten nehmen' }))
    expect(screen.queryByText('RB Leipzig')).toBeNull()
    expect(screen.getByRole('button', { name: 'Favoriten' }).textContent).toBe('Favoriten 2')
  })

  it('shows red cards and second yellows next to the team', async () => {
    const carded = structuredClone(scores)
    carded.competitions[1].matches[0].home = { ...side('Bayern München', '2'), redCards: 1, yellowRedCards: 0 }
    carded.competitions[1].matches[0].away = { ...side('Borussia Dortmund', '1'), redCards: 1, yellowRedCards: 1 }
    api.loadSportsScores.mockResolvedValue(carded)
    renderWidget()
    const home = await screen.findByRole('img', { name: 'Rote Karte' })
    const away = screen.getByRole('img', { name: 'Gelb-Rote Karte, Rote Karte' })
    // The cards follow the club name on both sides, never stand in front of it.
    expect(home.previousElementSibling?.textContent).toBe('Bayern München')
    expect(away.previousElementSibling?.textContent).toBe('Borussia Dortmund')
    expect([...away.querySelectorAll('.sp-card')].map((card) => card.className)).toEqual(['sp-card is-yellow-red', 'sp-card is-red'])
  })

  it('reads the stars back and forgets those two weeks after the kick-off', async () => {
    window.localStorage.setItem('dwh.sports.favorites.v1', JSON.stringify([
      { competition: 'soccer/ger.1', id: '1', start: scores.competitions[1].matches[0].start },
      { competition: 'soccer/ger.1', id: 'old', start: '2026-09-01T18:30:00Z' },
      { nonsense: true },
    ]))
    renderWidget('en')
    // the star is on in the competition
    expect(await screen.findByRole('button', { name: 'Remove Bayern München – Borussia Dortmund from the favourites' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Favourites' }))
    const favorites = within(screen.getByRole('region', { name: 'Favourites' }))
    expect(favorites.getByText('Bayern München')).toBeTruthy()
    expect(favorites.getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('SportsWidget tables and knock-out trees', () => {
  function row(rank: number, name: string, values: string[], zone: string | null, highlight = false) {
    return { rank, name, logo: null, values, zone, highlight }
  }

  const league: SportsStandings = {
    competition: 'soccer/ger.1',
    season: '2026-27',
    table: {
      columns: ['gamesPlayed', 'wins', 'ties', 'losses', 'goals', 'goalDifference', 'points'],
      groups: [{
        name: null,
        rows: [
          row(1, 'SC Freiburg', ['5', '4', '1', '0', '14:4', '+10', '13'], '#81D6AC'),
          row(2, 'Bayern Munich', ['5', '3', '2', '0', '16:4', '+12', '11'], '#81D6AC', true),
          row(18, 'Borussia Dortmund', ['5', '0', '1', '4', '3:12', '-9', '1'], '#FF7F84', true),
        ],
      }],
      zones: [{ color: '#81D6AC', label: { key: null, text: 'Champions League' } }, { color: '#FF7F84', label: { key: null, text: 'Relegation' } }],
      source: 'espn',
    },
    bracket: null,
  }

  function team(name: string, winner = false) {
    return { name, logo: null, winner }
  }

  const cup: SportsStandings = {
    competition: 'soccer/ger.dfb_pokal',
    season: '2025/2026',
    table: null,
    bracket: {
      rounds: [
        { stage: '2', feedsNext: false, matchups: [{ home: team('St. Pauli'), away: team('Hamburger SV', true), homeScore: 0, awayScore: 1, games: [{ start: '2025-10-28T19:45:00Z', status: 'finished', homeScore: 0, awayScore: 1, note: null }], highlight: false }] },
        {
          stage: '1/2',
          feedsNext: true,
          matchups: [
            { home: team('Bayern München', true), away: team('Hamburger SV'), homeScore: 3, awayScore: 1, games: [{ start: '2026-04-22T18:45:00Z', status: 'finished', homeScore: 3, awayScore: 1, note: null }], highlight: false },
            { home: team('VfB Stuttgart', true), away: team('Freiburg'), homeScore: 1, awayScore: 1, games: [{ start: '2026-04-23T18:45:00Z', status: 'finished', homeScore: 1, awayScore: 1, note: 'pen' }], highlight: false },
          ],
        },
        { stage: 'final', feedsNext: false, matchups: [{ home: team('Bayern München'), away: null, homeScore: null, awayScore: null, games: [{ start: '2026-05-23T18:00:00Z', status: 'scheduled', homeScore: null, awayScore: null, note: null }], highlight: false }] },
      ],
    },
  }

  it('opens the table of a league from its title, with zones and season, without source attribution, and its top scorers as a tab; fight cards have no table', async () => {
    const plain = league.table!.groups[0].rows.map((item) => ({ ...item, highlight: false }))
    api.loadStandings.mockResolvedValue({ ...league, table: { ...league.table!, groups: [{ name: null, rows: plain }] } })
    renderWidget()
    await screen.findByText('Bayern München')
    expect(screen.queryByRole('button', { name: /^Tabelle: .*UFC/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Tabelle: Motorsport · Formel 1' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tabelle: Deutschland · Bundesliga' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bundesliga' }))
    expect(api.loadStandings).toHaveBeenCalledWith('soccer/ger.1', null, expect.anything(), null)
    expect(await panel.findByText('Bayern München')).toBeTruthy()

    const rows = panel.getAllByRole('row')
    expect(rows[0].textContent).toBe('#TeamSpSUNToreDiffPkt')
    // without FotMob's id a team stays text
    expect(panel.queryByRole('button', { name: 'Verein: SC Freiburg' })).toBeNull()
    expect(rows[1].textContent).toBe('1SC Freiburg541014:4+1013')
    expect(panel.getByTitle('Punkte').textContent).toBe('Pkt')
    expect(rows.filter((item) => item.className.includes('is-highlight'))).toHaveLength(0)
    // the colours of the zones explained in German
    expect(panel.getByText('Champions League')).toBeTruthy()
    expect(panel.getByText('Abstieg')).toBeTruthy()
    expect(panel.getByText('Saison 2026-27')).toBeTruthy()
    expect(panel.queryByText(/Quelle:/)).toBeNull()
    // a league has no tree: the table and its top scorers are the tabs
    const tabs = panel.getAllByRole('tab')
    expect(tabs.map((item) => item.textContent)).toEqual(['Tabelle', 'Top Scorers'])
    expect(tabs.map((item) => item.tabIndex)).toEqual([0, -1])
    expect(panel.getByRole('tabpanel', { name: 'Tabelle' })).toBeTruthy()
    expect(platform.fetchJson).not.toHaveBeenCalled()

    // the arrow keys move the focus and show the tab; the scorers are loaded only then
    platform.fetchJson.mockResolvedValue({ competition: 'soccer/ger.1', season: '2026-27', updatedAt: '2026-10-07T12:00:00Z', source: 'fotmob', available: true, players: [{ id: '9', name: 'Harry Kane', team: 'Bayern München', teamId: '1', goals: 9, assists: 2, scorings: 11 }] })
    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(tabs.map((item) => item.tabIndex)).toEqual([-1, 0])
    expect(document.activeElement).toBe(tabs[1])
    const scorers = within(panel.getByRole('tabpanel', { name: 'Top Scorers' }))
    expect(await scorers.findByText('Harry Kane')).toBeTruthy()
    expect(platform.fetchJson).toHaveBeenCalledWith('/api/sports/scorers?competition=soccer%2Fger.1&season=2026-27', expect.anything())
    expect(panel.queryByText('Saison 2026-27')).toBeNull()
    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tabs[0])
    fireEvent.keyDown(tabs[0], { key: 'End' })
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tabs[1], { key: 'Home' })
    expect(await panel.findByText('Saison 2026-27')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows a live table with the running results and the places won or lost', async () => {
    const rows = league.table!.groups[0].rows
    api.loadStandings.mockResolvedValue({
      ...league,
      table: {
        ...league.table!,
        live: true,
        groups: [{
          name: null,
          rows: [
            { ...rows[1], rank: 1, highlight: false, live: { score: '2:1', outcome: 'win', minute: "67'" }, rankChange: 1 },
            { ...rows[0], rank: 2, highlight: false, rankChange: -1 },
            { ...rows[2], highlight: false, live: { score: '1:2', outcome: 'loss', minute: "67'" }, rankChange: 0 },
          ],
        }],
      },
    })
    renderWidget()
    await screen.findByText('Bayern München')
    fireEvent.click(screen.getByRole('button', { name: 'Tabelle: Deutschland · Bundesliga' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bundesliga' }))
    expect(await panel.findByText('Live-Tabelle')).toBeTruthy()
    expect(panel.getByLabelText('Läuft: 2:1 (67\')').className).toBe('st-result is-win')
    const up = panel.getByRole('img', { name: '1 Platz hoch' })
    const down = panel.getByRole('img', { name: '1 Platz runter' })
    expect(up.closest('td')?.className).toBe('st-name')
    expect(down.closest('td')?.className).toBe('st-name')
    expect(up.previousElementSibling?.textContent).toContain('Bayern München')
    expect(panel.getAllByRole('row')[1].querySelector('.st-rank')?.textContent).toBe('1')
    expect(panel.getAllByRole('row')[1].classList.contains('is-live')).toBe(true)
  })

  it('opens the tree of a cup on the round that is not over yet and draws the rounds it feeds as a tree', async () => {
    const pokal = { id: 'soccer/ger.dfb_pokal', name: 'DFB Pokal', matches: [match('p1', { home: side('Bayern München', null), away: side('VfB Stuttgart', null) })] }
    api.loadSportsScores.mockResolvedValue({ ...scores, competitions: [...scores.competitions, pokal] })
    api.loadStandings.mockResolvedValue(cup)
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Turnierbaum: Deutschland · DFB-Pokal' }))

    const panel = within(await screen.findByRole('dialog', { name: 'DFB-Pokal' }))
    const rounds = within(await panel.findByRole('group', { name: 'Runden' }))
    expect(rounds.getAllByRole('button').map((item) => item.textContent)).toEqual(['2. Runde', 'Halbfinale', 'Finale'])
    expect(rounds.getByRole('button', { name: 'Finale' }).getAttribute('aria-pressed')).toBe('true')
    // the final: the second finalist is not known yet
    expect(panel.getByText('Noch offen')).toBeTruthy()
    expect(panel.queryByRole('region', { name: 'Halbfinale' })).toBeNull()

    // from the semi-finals on, the rounds stand side by side as a tree; a tie on penalties says so
    fireEvent.click(rounds.getByRole('button', { name: 'Halbfinale' }))
    expect(panel.getByRole('region', { name: 'Halbfinale' })).toBeTruthy()
    expect(panel.getByRole('region', { name: 'Finale' })).toBeTruthy()
    expect(panel.getByText('n. E.')).toBeTruthy()
    expect(panel.getByText('Saison 2025/2026')).toBeTruthy()
    expect(panel.queryByText(/Quelle:/)).toBeNull()

    // an early round of the cup stands alone: it was drawn afresh
    fireEvent.click(rounds.getByRole('button', { name: '2. Runde' }))
    expect(panel.getByRole('region', { name: '2. Runde' })).toBeTruthy()
    expect(panel.queryByRole('region', { name: 'Halbfinale' })).toBeNull()
  })

  it('shows the table and the tree after the line-ups of a match, with its teams and its tie marked', async () => {
    api.loadMatchDetails.mockReturnValue(new Promise(() => {}))
    const tie = { home: team('Bayern München'), away: team('Borussia Dortmund'), homeScore: 2, awayScore: 1, games: [{ start: '2026-10-07T16:30:00Z', status: 'live' as const, homeScore: 2, awayScore: 1, note: null }], highlight: true }
    api.loadStandings.mockResolvedValue({ ...league, bracket: { rounds: [{ stage: '1/8', feedsNext: false, matchups: [tie] }] } })
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Statistik Bayern München gegen Borussia Dortmund' }))

    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    expect(api.loadStandings).toHaveBeenCalledWith('soccer/ger.1', '1', expect.anything(), null)
    await panel.findByRole('tab', { name: 'Tabelle' })
    expect(panel.getAllByRole('tab').map((item) => item.textContent)).toEqual(['Spielverlauf', 'Statistik', 'Aufstellung', 'Tabelle', 'Top Scorers', 'Turnierbaum', 'Stream'])

    fireEvent.click(panel.getByRole('tab', { name: 'Tabelle' }))
    const marked = panel.getAllByRole('row').filter((item) => item.className.includes('is-highlight'))
    expect(marked.map((item) => item.querySelector('.st-team-name')?.textContent)).toEqual(['Bayern München', 'Borussia Dortmund'])

    fireEvent.click(panel.getByRole('tab', { name: 'Turnierbaum' }))
    const shown = panel.getAllByText('Borussia Dortmund').map((item) => item.closest('.br-tie')).find(Boolean)
    expect(shown?.getAttribute('aria-current')).toBe('true')
    expect(shown?.textContent).toContain('Live')
  })

  it('says so when a competition has neither table nor tree, or when they are not reachable', async () => {
    api.loadStandings.mockRejectedValueOnce(new Error('502'))
    renderWidget('en')
    fireEvent.click(await screen.findByRole('button', { name: 'Table: Spain · LaLiga' }))
    const panel = within(await screen.findByRole('dialog', { name: 'LaLiga' }))
    expect(await panel.findByText('The table is not reachable right now.')).toBeTruthy()
    fireEvent.click(panel.getByRole('button', { name: 'Try again' }))
    expect(await panel.findByText('This competition has no table and no bracket (yet).')).toBeTruthy()
  })
})

describe('SportsWidget broadcasts', () => {
  it('lists where a match is shown, Germany first, and only asks when the tab is opened', async () => {
    api.loadMatchDetails.mockReturnValue(new Promise(() => {}))
    api.loadBroadcasts.mockResolvedValue({
      countries: [
        { country: 'DE', channels: ['WOW', 'Sky Bundesliga 2'] },
        { country: 'AT', channels: [] },
        { country: 'GB', channels: ['TNT Sports 4'] },
        { country: 'US', channels: ['Paramount+', 'ESPN+'] },
      ],
      sources: ['FotMob', 'ESPN'],
    })
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Statistik Bayern München gegen Borussia Dortmund' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    expect(api.loadBroadcasts).not.toHaveBeenCalled()

    fireEvent.click(panel.getByRole('tab', { name: 'Stream' }))
    expect(await panel.findByText('Sky Bundesliga 2')).toBeTruthy()
    expect(api.loadBroadcasts).toHaveBeenCalledWith('soccer/ger.1', '1', expect.anything())
    const countries = panel.getAllByRole('listitem').map((item) => item.textContent)
    expect(countries).toEqual(['DeutschlandWOWSky Bundesliga 2', 'ÖsterreichKeine Übertragung bekannt', 'Vereinigtes KönigreichTNT Sports 4', 'USAParamount+ESPN+'])
    expect(panel.queryByText(/Quelle: FotMob, ESPN/)).toBeNull()
    expect(panel.getByText('Übertragungen können sich kurzfristig ändern.')).toBeTruthy()
  })

  it('says so when nothing is known or the broadcasts are not reachable', async () => {
    api.loadMatchDetails.mockReturnValue(new Promise(() => {}))
    api.loadBroadcasts.mockRejectedValueOnce(new Error('502')).mockResolvedValue({ countries: [{ country: 'DE', channels: [] }], sources: [] })
    renderWidget('en')
    fireEvent.click(await screen.findByRole('button', { name: 'Statistics Bayern München vs Borussia Dortmund' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    fireEvent.click(panel.getByRole('tab', { name: 'Stream' }))
    expect(await panel.findByText('The broadcasts are not reachable right now.')).toBeTruthy()
    fireEvent.click(panel.getByRole('button', { name: 'Try again' }))
    expect(await panel.findByText('No broadcasts are known for this match (yet).')).toBeTruthy()
  })
})

describe('SportsWidget team pages', () => {
  function fixture(id: string, start: string, home: [string, string, number | null], away: [string, string, number | null], rest: Partial<SportsTeamProfile['fixtures'][number]> = {}) {
    return {
      id,
      start,
      competition: 'Bundesliga',
      home: { id: home[0], name: home[1], logo: null, score: home[2] },
      away: { id: away[0], name: away[1], logo: null, score: away[2] },
      status: 'scheduled' as const,
      statusText: null,
      result: null,
      ...rest,
    }
  }

  const finished = Array.from({ length: 7 }, (_, index) => fixture(`p${index}`, `2026-0${index + 2}-10T13:30:00Z`, ['9823', 'Bayern München', 2], [`o${index}`, `Gegner ${index}`, index === 6 ? 3 : 1], { status: 'finished', result: index === 6 ? 'loss' : 'win' }))
  const upcoming = Array.from({ length: 6 }, (_, index) => fixture(`n${index}`, `2026-1${index % 3}-2${index}T13:30:00Z`, [`u${index}`, `Kommend ${index}`, null], ['9823', 'Bayern München', null]))

  const bayern: SportsTeamProfile = {
    id: '9823',
    name: 'Bayern München',
    logo: 'https://images.fotmob.com/image_resources/logo/teamlogo/9823.png',
    country: { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' },
    league: 'Bundesliga',
    season: '2026/2027',
    venue: 'Allianz Arena',
    city: 'München',
    capacity: 75024,
    coach: 'Vincent Kompany',
    fixtures: [...finished, ...upcoming].sort((left, right) => left.start.localeCompare(right.start)),
    trophies: [
      { competition: 'Bundesliga', won: 35, runnerUp: 10, seasonsWon: ['2025/2026', '2024/2025'], seasonsRunnerUp: ['2011/2012'] },
      { competition: 'Champions League', won: 6, runnerUp: 5, seasonsWon: ['2019/2020'], seasonsRunnerUp: [] },
    ],
    transfers: [
      { date: '2026-09-01T00:00:00Z', player: 'Arijon Ibrahimović', playerId: '1327150', position: { key: null, text: 'AM' }, direction: 'out', from: 'Bayern München', to: 'Augsburg', fee: 500000, feeKind: 'loan', until: '2027-06-30T00:00:00Z', marketValue: null },
      { date: '2026-07-03T00:00:00Z', player: 'Nathaniel Brown', playerId: '1', position: null, direction: 'in', from: 'Frankfurt', to: 'Bayern München', fee: 50000000, feeKind: 'fee', until: null, marketValue: null },
      { date: '2026-07-01T00:00:00Z', player: 'Ismael Saibari', playerId: '2', position: null, direction: 'in', from: 'PSV Eindhoven', to: 'Bayern München', fee: 50000000, feeKind: 'fee', until: null, marketValue: null },
      { date: '2026-05-15T00:00:00Z', player: 'Manuel Neuer', playerId: '3', position: null, direction: 'extension', from: null, to: null, fee: null, feeKind: 'extension', until: '2027-06-30T00:00:00Z', marketValue: null },
    ],
    squad: [
      { key: 'coach', members: [{ id: '39027', name: 'Vincent Kompany', shirt: null, country: { name: 'Belgium', code: 'BEL', iso: 'be', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/bel.png' }, age: 40, role: null, injured: false, rating: null, goals: null, assists: null, marketValue: null }] },
      { key: 'keepers', members: [{ id: '27299', name: 'Manuel Neuer', shirt: '1', country: { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' }, age: 40, role: null, injured: true, rating: 6.99, goals: 0, assists: 0, marketValue: 2219328 }] },
    ],
  }

  const dortmund: SportsTeamProfile = { ...bayern, id: '9789', name: 'Borussia Dortmund', coach: null, venue: null, fixtures: [], trophies: [], transfers: [], squad: [] }

  /** The team page of Bayern, opened from the head of the panel of its match (the scores open the match). */
  async function openBayern() {
    api.loadMatchDetails.mockResolvedValue({ ...matchWithTeams })
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Statistik Bayern München gegen Borussia Dortmund' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    fireEvent.click(await panel.findByRole('button', { name: 'Bayern München' }))
    return panel
  }

  it('walks the real player → team visit path using the persistent header and restores the squad', async () => {
    api.loadTeam.mockImplementation(({ id }: { id: string }) => Promise.resolve(id === '9823' ? bayern : dortmund))
    api.loadPlayerProfile.mockResolvedValue({ ...profileOf('27299', 'Manuel Neuer'), teamId: '9789', career: [{ teamId: '9789', team: 'Borussia Dortmund', logo: null, kind: 'club', start: null, end: null, active: false, appearances: 5, goals: 0, assists: 0 }] })
    const panel = await openBayern()
    await panel.findByRole('heading', { level: 3, name: 'Bayern München' })
    fireEvent.click(panel.getByRole('tab', { name: 'Kader' }))
    fireEvent.click(panel.getByRole('button', { name: 'Manuel Neuer' }))
    await panel.findByRole('heading', { name: 'Manuel Neuer' })
    fireEvent.click(panel.getByRole('tab', { name: 'Karriere' }))
    fireEvent.click(panel.getByRole('button', { name: /Borussia Dortmund/ }))
    await panel.findByRole('heading', { name: 'Borussia Dortmund' })
    const header = () => within(document.querySelector('.side-drawer-header') as HTMLElement)
    fireEvent.click(header().getByRole('button', { name: /Zurück/ }))
    expect(panel.getByRole('heading', { name: 'Manuel Neuer' })).toBeTruthy()
    expect(panel.getByRole('tab', { name: 'Karriere' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(header().getByRole('button', { name: /Zurück/ }))
    expect(panel.getByRole('tab', { name: 'Kader' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(header().getByRole('button', { name: /Zurück/ }))
    expect(panel.getByRole('tab', { name: 'Spielverlauf' })).toBeTruthy()
    fireEvent.click(header().getByRole('button', { name: 'Zur Übersicht' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('restores team pagination and scroll after leaving a still-loading match, ignoring its late result', async () => {
    api.loadTeam.mockResolvedValue(bayern)
    let finish!: (value: unknown) => void
    api.findMatch.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const panel = await openBayern()
    await panel.findByRole('heading', { level: 3, name: 'Bayern München' })
    fireEvent.click(panel.getByRole('button', { name: 'Frühere Spiele anzeigen' }))
    const scroller = document.querySelector('.side-drawer-body') as HTMLElement
    scroller.scrollTop = 420
    fireEvent.click(panel.getByText('Gegner 6'))
    expect(scroller.scrollTop).toBe(0)
    expect(panel.getByText('Spiel wird gesucht …')).toBeTruthy()
    const signal = api.findMatch.mock.calls.at(-1)![1] as AbortSignal
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zum Verein' }))
    expect(signal.aborted).toBe(true)
    expect(scroller.scrollTop).toBe(420)
    expect(panel.queryByRole('button', { name: 'Frühere Spiele anzeigen' })).toBeNull()
    await act(async () => finish({ competition: 'soccer/ger.1', match: scores.competitions[1].matches[0] }))
    expect(panel.getByRole('tab', { name: 'Spiele' })).toBeTruthy()
    expect(panel.queryByRole('tab', { name: 'Spielverlauf' })).toBeNull()
  })

  it('preserves competition season through team → match and exposes back during missing match data', async () => {
    const table = { columns: ['gamesPlayed', 'points'], groups: [{ name: null, rows: [{ rank: 1, name: 'Bayern München', logo: null, values: ['5', '13'], zone: null, highlight: false, teamId: '9823' }] }], zones: [], source: 'espn' }
    api.loadStandings.mockImplementation((_competition: string, _match: string | null, _signal: AbortSignal, season?: string) => Promise.resolve({ competition: 'soccer/ger.1', season: season ?? '2026/2027', seasons: ['2026/2027', '2025/2026'], table, bracket: null }))
    api.loadTeam.mockResolvedValue(bayern)
    api.findMatch.mockRejectedValue({ status: 404 })
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Tabelle: Deutschland · Bundesliga' }))
    const panel = within(await screen.findByRole('dialog'))
    fireEvent.change(await panel.findByRole('combobox', { name: 'Saison' }), { target: { value: '2025/2026' } })
    fireEvent.click(await panel.findByRole('button', { name: 'Verein: Bayern München' }))
    await panel.findByRole('heading', { name: 'Bayern München' })
    fireEvent.click(panel.getByText('Gegner 6'))
    await panel.findByText('Für dieses Spiel gibt es keine Spielinfo: der Wettbewerb ist nicht in den Live-Scores.')
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zum Verein' }))
    expect(panel.getByRole('tab', { name: 'Spiele' })).toBeTruthy()
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zur Tabelle' }))
    expect((panel.getByRole('combobox', { name: 'Saison' }) as HTMLSelectElement).value).toBe('2025/2026')
  })

  it.each(['Escape', 'Schließen', 'Spiel'] as const)('keeps a table form portal operable and %s restores trigger focus without reopening', async (dismiss) => {
    const form = [finished[0]]
    const table = { columns: ['gamesPlayed', 'points'], groups: [{ name: null, rows: [{ rank: 1, name: 'Bayern München', logo: null, values: ['5', '13'], zone: null, highlight: false, teamId: '9823', form }] }], zones: [], source: 'espn' }
    api.loadStandings.mockResolvedValue({ competition: 'soccer/ger.1', season: '2026/2027', table, bracket: null })
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Tabelle: Deutschland · Bundesliga' }))
    const drawer = await screen.findByRole('dialog', { name: 'Bundesliga' })
    const trigger = await within(drawer).findByRole('button', { name: '5 · Form von Bayern München' })
    const nativeFocus = trigger.focus.bind(trigger)
    vi.spyOn(trigger, 'focus').mockImplementation((options) => {
      // Native browsers refuse focus while a containing drawer is inert; jsdom does not.
      if ((trigger.closest('.side-drawer-backdrop') as HTMLElement).inert) return
      nativeFocus(options)
    })
    trigger.focus()
    const popup = await screen.findByRole('dialog', { name: 'Form von Bayern München' })
    const close = within(popup).getByRole('button', { name: 'Schließen' })
    close.focus()
    expect(document.activeElement).toBe(close)
    if (dismiss === 'Spiel') {
      api.findMatch.mockReturnValue(new Promise(() => {}))
      const fixture = within(popup).getByRole('button', { name: /Sieg:/ })
      fixture.focus()
      fireEvent.click(fixture)
      expect(screen.queryByRole('dialog', { name: 'Form von Bayern München' })).toBeNull()
      fireEvent.click(within(drawer).getByRole('button', { name: '‹ Zurück zur Tabelle' }))
      expect(screen.queryByRole('dialog', { name: 'Form von Bayern München' })).toBeNull()
      expect(drawer.contains(document.activeElement)).toBe(true)
      return
    }
    if (dismiss === 'Escape') fireEvent.keyDown(close, { key: 'Escape' })
    else fireEvent.click(close)
    expect(screen.queryByRole('dialog', { name: 'Form von Bayern München' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(screen.getByRole('dialog', { name: 'Bundesliga' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('returns from search → coach → team through the selected profile and original filtered search', async () => {
    api.searchSports.mockResolvedValue([{ id: 'coach-1', name: 'Alex Coach', kind: 'coach', description: null, logo: null, country: null }, { id: 'other', name: 'Alex Club', kind: 'club', description: null, logo: null, country: null }])
    api.loadPlayerProfile.mockResolvedValue({ ...profileOf('coach-1', 'Alex Coach'), isCoach: true, coachCareer: [{ team: 'Bayern München', teamId: '9823', logo: null, start: null, end: null, active: false, matches: 10, wins: 6, draws: 2, losses: 2, pointsPerGame: 2 }] })
    api.loadTeam.mockResolvedValue(bayern)
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /^(Suche öffnen|Open search)$/ }))
  const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Alex' } })
    await screen.findByRole('option', { name: /Alex Coach/ })
    fireEvent.click(screen.getByRole('button', { name: /Trainer1/ }))
    fireEvent.click(screen.getByRole('option', { name: /Alex Coach/ }))
    const panel = within(await screen.findByRole('dialog', { name: 'Alex Coach' }))
    fireEvent.click(await panel.findByRole('button', { name: /Bayern München/ }))
    await panel.findByRole('heading', { name: 'Bayern München' })
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zu Alex Coach' }))
    expect(panel.getByRole('heading', { level: 3, name: 'Alex Coach' })).toBeTruthy()
    fireEvent.click(panel.getByRole('button', { name: 'Zu den Suchergebnissen' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((input as HTMLInputElement).value).toBe('Alex')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option').textContent).toContain('Alex Coach')
    expect(document.activeElement).toBe(input)
  })

  it('preserves the selected bracket round through a team visit', async () => {
    const tie = { home: { name: 'Bayern München', logo: null, winner: false, teamId: '9823' }, away: null, homeScore: null, awayScore: null, games: [], highlight: false }
    api.loadStandings.mockResolvedValue({ competition: 'soccer/ger.1', season: '2026/2027', table: { columns: ['points'], groups: [{ name: null, rows: [] }], zones: [], source: 'espn' }, bracket: { rounds: [{ stage: '1/2', feedsNext: false, matchups: [tie] }, { stage: 'final', feedsNext: false, matchups: [tie] }] } })
    api.loadTeam.mockResolvedValue(bayern)
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Tabelle: Deutschland · Bundesliga' }))
    const panel = within(await screen.findByRole('dialog'))
    fireEvent.click(await panel.findByRole('tab', { name: 'Turnierbaum' }))
    fireEvent.click(panel.getByRole('button', { name: 'Finale' }))
    fireEvent.click(panel.getByRole('button', { name: 'Verein: Bayern München' }))
    await panel.findByRole('heading', { name: 'Bayern München' })
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zur Tabelle' }))
    expect(panel.getByRole('button', { name: 'Finale' }).getAttribute('aria-pressed')).toBe('true')
    expect(panel.getByRole('tab', { name: 'Turnierbaum' }).getAttribute('aria-selected')).toBe('true')
  })

  it('opens the page of a football team from the match: next and last five matches, more on request', async () => {
    api.loadTeam.mockResolvedValue(bayern)
    const panel = await openBayern()
    expect(api.loadTeam).toHaveBeenCalledWith({ id: '9823' }, expect.anything())
    expect(await panel.findByRole('heading', { level: 3, name: 'Bayern München' })).toBeTruthy()
    expect(panel.getByText('Allianz Arena, München · 75.024 Plätze')).toBeTruthy()
    expect(panel.getByText('Vincent Kompany')).toBeTruthy()
    expect(panel.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Spiele', 'Titel', 'News', 'Transfers', 'Kader'])

    // five next ones (soonest first) and five last ones (newest first); a loss in red, more on request
    const [next, last] = panel.getAllByRole('list').map((list) => within(list).getAllByRole('listitem'))
    expect(next).toHaveLength(5)
    expect(last).toHaveLength(5)
    expect(last[0].textContent).toContain('Gegner 6')
    expect(last[0].querySelector('.pp-result')?.className).toContain('is-loss')
    expect(next[0].textContent).toContain('Kommend 0')
    fireEvent.click(panel.getByRole('button', { name: 'Frühere Spiele anzeigen' }))
    expect(within(panel.getAllByRole('list')[1]).getAllByRole('listitem')).toHaveLength(7)
    expect(panel.queryByRole('button', { name: 'Frühere Spiele anzeigen' })).toBeNull()
    fireEvent.click(panel.getByRole('button', { name: 'Weitere Spiele anzeigen' }))
    expect(within(panel.getAllByRole('list')[0]).getAllByRole('listitem')).toHaveLength(6)

    // a match opens its match info, also from the opponent's name (no team link there); "back" returns to the team
    expect(panel.queryByRole('button', { name: 'Gegner 6' })).toBeNull()
    api.findMatch.mockResolvedValue({ competition: 'soccer/ger.1', match: { id: '1', start: matchWithTeams.start, status: 'finished', statusText: 'FT', title: null, home: matchWithTeams.home, away: matchWithTeams.away, detail: null } })
    fireEvent.click(panel.getByText('Gegner 6'))
    expect(api.findMatch).toHaveBeenCalledWith('p6', expect.anything())
    expect(await panel.findByRole('tab', { name: 'Spielverlauf' })).toBeTruthy()
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zum Verein' }))
    expect(await panel.findByRole('heading', { level: 3, name: 'Bayern München' })).toBeTruthy()
  })

  it('lists titles with their seasons, news, transfers and the squad; players open their profile', async () => {
    api.loadTeam.mockResolvedValue(bayern)
    api.loadTeamNews.mockResolvedValue([{ id: 'a', title: 'FC Bayern in Stavanger', url: 'https://miasanrot.de/a/', image: null, source: 'Miasanrot', published: '2026-10-07T10:30:00Z' }])
    const panel = await openBayern()
    await panel.findByRole('heading', { level: 3, name: 'Bayern München' })

    fireEvent.click(panel.getByRole('tab', { name: 'Titel' }))
    const titles = panel.getAllByRole('listitem')
    expect(titles[0].textContent).toBe('Bundesliga35×2025/20262024/202510× Zweiter: 2011/2012')
    expect(titles[1].textContent).toBe('Champions League6×2019/2020')

    // news only when the tab is opened, in the UI language; they open at the publisher
    expect(api.loadTeamNews).not.toHaveBeenCalled()
    fireEvent.click(panel.getByRole('tab', { name: 'News' }))
    const article = await panel.findByRole('link', { name: 'FC Bayern in Stavanger' })
    expect(api.loadTeamNews).toHaveBeenCalledWith('9823', 'de', expect.anything())
    expect(article.getAttribute('href')).toBe('https://miasanrot.de/a/')
    expect(article.getAttribute('target')).toBe('_blank')
    expect(article.getAttribute('rel')).toBe('noopener noreferrer')

    fireEvent.click(panel.getByRole('tab', { name: 'Transfers' }))
    expect(panel.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Zugänge 2', 'Abgänge 1', 'Vertragsverlängerungen 1'])
    expect(panel.getByText('Summe der Ablösen: 100 Mio. €')).toBeTruthy()
    expect(panel.getByText('Leihe · 500.000 €')).toBeTruthy()
    // position, the other club (with its crest; a button to its page when FotMob knows it) and the end of the loan
    expect(panel.getByText('Arijon Ibrahimović').closest('li')?.textContent?.replace(/\s/g, ' ')).toBe('01.09.2026Arijon IbrahimovićAMzuAugsburgbis 06/2027Leihe · 500.000 €')
    expect(panel.getByText('Verlängert')).toBeTruthy()

    fireEvent.click(panel.getByRole('tab', { name: 'Kader' }))
    // one table: the groups are its sections, so the columns stay in line
    expect(panel.getAllByRole('table')).toHaveLength(1)
    expect([...document.querySelectorAll('.tp-group')].map((row) => row.textContent)).toEqual(['Trainer', 'Torhüter1'])
    expect(panel.getAllByRole('row').map((row) => row.querySelectorAll('th, td').length)).toEqual([5, 1, 5, 1, 5])
    expect(panel.getByRole('img', { name: 'Belgien' })).toBeTruthy()
    expect(panel.getByRole('img', { name: 'Verletzt' })).toBeTruthy()
    const neuer = panel.getByRole('button', { name: 'Manuel Neuer' })
    expect(neuer.closest('tr')?.textContent?.replace(/\s/g, ' ')).toBe('1Manuel Neuer+407,02,2 Mio. €')

    api.loadPlayerProfile.mockResolvedValue({ ...profileOf('27299', 'Manuel Neuer') })
    fireEvent.click(neuer)
    expect(await panel.findByRole('heading', { name: 'Manuel Neuer' })).toBeTruthy()
    expect(api.loadPlayerProfile).toHaveBeenCalledWith('27299', 'de', expect.anything())
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zum Verein' }))
    expect(panel.getByRole('tab', { name: 'Spiele' })).toBeTruthy()
  })

  it('opens a team from its line in a table and from its side in a knock-out tree', async () => {
    api.loadTeam.mockResolvedValue(bayern)
    const rows = [
      { rank: 1, name: 'Bayern Munich', logo: null, values: ['5', '4', '1', '0', '16:4', '+12', '13'], zone: null, highlight: false, teamId: '9823' },
      { rank: 2, name: 'SC Freiburg', logo: null, values: ['5', '4', '0', '1', '14:4', '+10', '12'], zone: null, highlight: false, teamId: null },
    ]
    api.loadStandings.mockResolvedValue({
      competition: 'soccer/ger.1',
      season: '2026-27',
      table: { columns: ['gamesPlayed', 'wins', 'ties', 'losses', 'goals', 'goalDifference', 'points'], groups: [{ name: null, rows }], zones: [], source: 'espn' },
      bracket: null,
    })
    renderWidget()
    fireEvent.click(await screen.findByRole('button', { name: 'Tabelle: Deutschland · Bundesliga' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bundesliga' }))
    fireEvent.click(await panel.findByRole('button', { name: 'Verein: Bayern München' }))
    expect(await panel.findByRole('heading', { level: 3, name: 'Bayern München' })).toBeTruthy()
    expect(api.loadTeam).toHaveBeenCalledWith({ id: '9823' }, expect.anything())
    fireEvent.click(panel.getByRole('button', { name: '‹ Zurück zur Tabelle' }))
    expect(await panel.findByRole('button', { name: 'Verein: Bayern München' })).toBeTruthy()
    expect(panel.queryByRole('button', { name: 'Verein: SC Freiburg' })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })

    // the tree in the match panel: a side opens the team, "back" returns to the match
    api.loadMatchDetails.mockReturnValue(new Promise(() => {}))
    const tie = { home: { name: 'Bayern München', logo: null, winner: false, teamId: '9823' }, away: { name: 'Borussia Dortmund', logo: null, winner: false, teamId: '9789' }, homeScore: 2, awayScore: 1, games: [{ start: '2026-10-07T16:30:00Z', status: 'live' as const, homeScore: 2, awayScore: 1, note: null }], highlight: true }
    api.loadStandings.mockResolvedValue({ competition: 'soccer/ger.1', season: '2026-27', table: null, bracket: { rounds: [{ stage: '1/8', feedsNext: false, matchups: [tie] }] } })
    api.loadTeam.mockResolvedValue(dortmund)
    fireEvent.click(screen.getByRole('button', { name: 'Statistik Bayern München gegen Borussia Dortmund' }))
    const match = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    fireEvent.click(await match.findByRole('tab', { name: 'Turnierbaum' }))
    fireEvent.click(match.getByRole('button', { name: 'Verein: Borussia Dortmund' }))
    expect(await match.findByRole('heading', { level: 3, name: 'Borussia Dortmund' })).toBeTruthy()
    expect(api.loadTeam).toHaveBeenLastCalledWith({ id: '9789' }, expect.anything())
    fireEvent.click(match.getByRole('button', { name: '‹ Zurück zum Spiel' }))
    expect(await match.findByRole('tab', { name: 'Turnierbaum' })).toBeTruthy()
  })

  it('opens a team from the head of the match panel and says so when the source does not know the team', async () => {
    api.loadMatchDetails.mockResolvedValue({ ...matchWithTeams })
    api.loadTeam.mockResolvedValue(dortmund)
    renderWidget('en')
    fireEvent.click(await screen.findByRole('button', { name: 'Statistics Bayern München vs Borussia Dortmund' }))
    const panel = within(await screen.findByRole('dialog', { name: 'Bayern München – Borussia Dortmund' }))
    fireEvent.click(await panel.findByRole('button', { name: /Borussia Dortmund/ }))
    expect(await panel.findByRole('heading', { level: 3, name: 'Borussia Dortmund' })).toBeTruthy()
    expect(api.loadTeam).toHaveBeenCalledWith({ id: '9789' }, expect.anything())
    fireEvent.click(panel.getByRole('button', { name: '‹ Back to the match' }))
    expect(await panel.findByRole('tab', { name: 'Line-Up' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })

    api.loadMatchDetails.mockResolvedValue({ ...matchWithTeams, id: '3', home: { ...matchWithTeams.home, name: 'Sevilla FC' }, away: { ...matchWithTeams.away, name: 'Real Betis' }, homeTeamId: '8302', awayTeamId: '8603' })
    api.loadTeam.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    fireEvent.click(screen.getByRole('button', { name: 'Statistics FC Sevilla vs Real Betis' }))
    const betis = within(await screen.findByRole('dialog', { name: /Real Betis/ }))
    fireEvent.click(await betis.findByRole('button', { name: 'Real Betis' }))
    expect(await screen.findByText('This team was not found at the data source.')).toBeTruthy()
  })

  it('opens the profile of the coach from the squad: coaching career with the record, playing career and titles', async () => {
    api.loadTeam.mockResolvedValue(bayern)
    api.loadPlayerProfile.mockResolvedValue({
      ...profileOf('39027', 'Vincent Kompany'),
      position: { key: 'coach', text: 'Coach' },
      age: 40,
      country: 'Belgium',
      isCoach: true,
      coachCareer: [
        { team: 'FC Bayern München', teamId: '9823', logo: null, start: '2024-07-01T00:00:00Z', end: null, active: true, matches: 120, wins: 90, draws: 15, losses: 15, pointsPerGame: 2.38 },
        { team: 'Burnley', teamId: '8191', logo: null, start: '2022-07-01T00:00:00Z', end: '2024-05-29T00:00:00Z', active: false, matches: 84, wins: 34, draws: 16, losses: 34, pointsPerGame: 1.4 },
      ],
      career: [
        { team: 'Manchester City', kind: 'club', start: '2008-08-22T00:00:00Z', end: '2019-06-30T00:00:00Z', active: false, appearances: 360, goals: 20, assists: 10, transfer: null, teamId: '8456', logo: null },
      ],
      trophies: [
        { role: 'coach', team: 'Bayern München', teamId: '9823', logo: null, competition: 'Bundesliga', seasonsWon: ['2025/2026', '2024/2025'], seasonsRunnerUp: [] },
        { role: 'player', team: 'Manchester City', teamId: '8456', logo: null, competition: 'Premier League', seasonsWon: ['2018/2019', '2017/2018'], seasonsRunnerUp: ['2012/2013'] },
      ],
    })
    const panel = await openBayern()
    await panel.findByRole('heading', { level: 3, name: 'Bayern München' })
    fireEvent.click(panel.getByRole('tab', { name: 'Kader' }))
    fireEvent.click(panel.getByRole('button', { name: 'Vincent Kompany' }))

    expect(await panel.findByRole('heading', { level: 3, name: 'Vincent Kompany' })).toBeTruthy()
    expect(api.loadPlayerProfile).toHaveBeenCalledWith('39027', 'de', expect.anything())
    expect(panel.getByText('FC Bayern München · Trainer')).toBeTruthy()
    expect(panel.getByText('Trainer seit').nextElementSibling?.textContent).toBe('1. Juli 2024')
    expect(panel.getByText('Bilanz bei FC Bayern München')).toBeTruthy()
    // no matches, transfers or injuries for a coach
    expect(panel.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Trainerkarriere', 'Spielerkarriere', 'Titel'])
    expect(panel.queryByText('Keine aktuelle Verletzung bekannt.')).toBeNull()

    const rows = panel.getAllByRole('row').map((row) => row.textContent)
    expect(rows).toEqual(['VereinSpSUNØ Pkt', 'FC Bayern München07/2024 – heute1209015152,38', 'Burnley07/2022 – 05/2024843416341,40'])

    fireEvent.click(panel.getByRole('tab', { name: 'Spielerkarriere' }))
    expect(panel.getByText('Manchester City').closest('tr')?.textContent).toBe('Manchester City08/2008 – 06/20193602010')

    fireEvent.click(panel.getByRole('tab', { name: 'Titel' }))
    expect(panel.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Als Trainer', 'Als Spieler'])
    expect(panel.getByText('Zweiter: 2012/2013')).toBeTruthy()

    // a club of the profile opens its team page
    api.loadTeam.mockResolvedValueOnce({ ...bayern, id: '8456', name: 'Manchester City' })
    fireEvent.click(panel.getByRole('button', { name: /Manchester City/ }))
    expect(await panel.findByRole('heading', { level: 3, name: 'Manchester City' })).toBeTruthy()
    expect(api.loadTeam).toHaveBeenLastCalledWith({ id: '8456' }, expect.anything())
  })
})

const matchWithTeams: SportsMatchDetails = {
  id: '1',
  competition: 'German Bundesliga',
  start: new Date(2026, 9, 7, 18, 30).toISOString(),
  status: 'finished',
  statusText: 'FT',
  home: { name: 'Bayern Munich', shortName: null, logo: null, score: '2', winner: true },
  away: { name: 'Borussia Dortmund', shortName: null, logo: null, score: '1', winner: false },
  homePeriods: [],
  awayPeriods: [],
  venue: null,
  city: null,
  attendance: null,
  stats: [],
  events: [],
  lineups: [],
  homeTeamId: '9823',
  awayTeamId: '9789',
}

function profileOf(id: string, name: string): SportsPlayerProfile {
  return {
    id, name, team: 'FC Bayern München', position: null, country: null, countryCode: null, birthDate: null, age: null, heightCm: null, foot: null, shirt: null,
    marketValue: null, contractEnd: null, injury: null, seasonLeague: null, season: null, seasonStats: [], recentMatches: [], career: [], transfers: [], transfersSource: 'fotmob',
  }
}

describe.each(['de', 'en'] as const)('visible panel exits (%s)', (language) => {
  it.each(['loading', 'failed'] as const)('returns from a %s match to the selected live filter', async (state) => {
    api.loadMatchDetails.mockImplementation(() => state === 'loading'
      ? new Promise(() => {})
      : Promise.reject(new Error('offline')))
    renderWidget(language)
    fireEvent.click(await screen.findByRole('button', { name: /^Live/ }))
    fireEvent.click(screen.getByRole('button', { name: language === 'de'
      ? 'Statistik Bayern München gegen Borussia Dortmund'
      : 'Statistics Bayern München vs Borussia Dortmund' }))
    const panel = within(await screen.findByRole('dialog'))
    if (state === 'failed') await panel.findByText(language === 'de'
      ? 'Die Spieldaten sind gerade nicht erreichbar.'
      : 'The match data is not reachable right now.')
    const label = language === 'de' ? 'Zur Übersicht' : 'Back to overview'
    const exit = panel.getByRole('button', { name: label })
    expect(exit.textContent).toContain(label)
    fireEvent.click(exit)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /^Live/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Bayern München')).toBeTruthy()
    expect(screen.queryByText('FC Sevilla')).toBeNull()
  })

  it.each(['loading', 'failed'] as const)('can leave a %s competition without waiting for data', async (state) => {
    api.loadStandings.mockImplementation(() => state === 'loading'
      ? new Promise(() => {})
      : Promise.reject(new Error('offline')))
    renderWidget(language)
    fireEvent.click(await screen.findByRole('button', { name: language === 'de'
      ? 'Tabelle: Spanien · LaLiga'
      : 'Table: Spain · LaLiga' }))
    const panel = within(await screen.findByRole('dialog', { name: 'LaLiga' }))
    if (state === 'failed') await panel.findByText(language === 'de'
      ? 'Die Tabelle ist gerade nicht erreichbar.'
      : 'The table is not reachable right now.')
    const label = language === 'de' ? 'Zur Übersicht' : 'Back to overview'
    const exit = panel.getByRole('button', { name: label })
    expect(exit.textContent).toContain(label)
    fireEvent.click(exit)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('FC Sevilla')).toBeTruthy()
  })
})

it('offers an explicit settings exit before the competition choices and preserves the chosen live filter', async () => {
  renderWidget()
  fireEvent.click(await screen.findByRole('button', { name: /^Live/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Wettbewerbe auswählen' }))
  const exit = screen.getByRole('button', { name: 'Fertig' })
  const firstChoice = screen.getAllByRole('checkbox')[0]
  expect(exit.compareDocumentPosition(firstChoice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(exit)
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.getByRole('button', { name: /^Live/ }).getAttribute('aria-pressed')).toBe('true')
})

it.each(['club', 'player'] as const)('can repeatedly leave an unknown %s search result without losing the query', async (kind) => {
  api.searchSports.mockResolvedValue([{ id: 'unknown', name: 'Unbekannt', kind, description: null, logo: null, country: null }])
  api.loadTeam.mockRejectedValue(Object.assign(new Error('missing team'), { status: 404 }))
  api.loadPlayerProfile.mockRejectedValue(Object.assign(new Error('missing person'), { status: 404 }))
  renderWidget()
  fireEvent.click(screen.getByRole('button', { name: /^(Suche öffnen|Open search)$/ }))
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value: 'Unbekannt' } })
  await screen.findByRole('option', { name: /Unbekannt/ })
  for (let visit = 0; visit < 2; visit += 1) {
    fireEvent.click(screen.getByRole('option', { name: /Unbekannt/ }))
    const panel = within(await screen.findByRole('dialog', { name: 'Unbekannt' }))
    await panel.findByRole('button', { name: 'Erneut versuchen' })
    fireEvent.click(panel.getByRole('button', { name: 'Zu den Suchergebnissen' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((input as HTMLInputElement).value).toBe('Unbekannt')
    expect(document.activeElement).toBe(input)
  }
})

describe('mobile date return', () => {
  it.each([
    ['de', 'Nächster Tag', 'Zurück zu heute', 'Favoriten'],
    ['en', 'Next day', 'Back to today', 'Favourites'],
  ] as const)('returns explicitly to today while retaining the selected filter (%s)', async (language, nextDay, backToday, favoritesLabel) => {
    renderWidget(language)
    await screen.findByRole('button', { name: language === 'de' ? 'Statistik Bayern München gegen Borussia Dortmund' : 'Statistics Bayern München vs Borussia Dortmund' })
    fireEvent.click(screen.getByRole('button', { name: favoritesLabel }))
    fireEvent.click(screen.getByRole('button', { name: nextDay }))
    await waitFor(() => expect(api.loadSportsScores.mock.calls.at(-1)?.[1]).toBe('20261008'))
    fireEvent.click(screen.getByRole('button', { name: backToday }))
    await waitFor(() => expect(api.loadSportsScores.mock.calls.at(-1)?.[1]).toBe('20261007'))
    expect(screen.getByRole('button', { name: favoritesLabel }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('button', { name: backToday })).toBeNull()
  })
})


describe('saved results while refreshing', () => {
  it.each(['de', 'en'] as const)('shows a saved overview immediately with its age and no fresh live pulse (%s)', language => {
    saveScoreSnapshot('https://api.test', scores, Date.now() - 300_000)
    api.loadSportsScores.mockReturnValue(new Promise(() => {}))
    renderWidget(language)
    expect(screen.getByText('Bayern München')).toBeTruthy()
    expect(screen.getByText(language === 'de' ? /Gespeichert ·/ : /Saved ·/)).toBeTruthy()
    expect(document.querySelector('.sp-dot')?.classList.contains('is-live')).toBe(false)
    expect(screen.queryByRole('button', { name: language === 'de' ? 'Aktualisieren' : 'Refresh' })).toBeNull()
  })
  it('waits for a fresh answer before automatically skipping a saved empty day', async () => {
    saveScoreSnapshot('https://api.test', { date: '20261007', failed: [], competitions: presetSelection.map(id => ({ id, name: id, matches: [] })) })
    api.loadSportsScores.mockReturnValue(new Promise(() => {}))
    renderWidget()
    expect(screen.getByText(/Gespeichert ·/)).toBeTruthy()
    await waitFor(() => expect(api.loadSportsScores).toHaveBeenCalledTimes(1))
    expect(api.loadSportsScores.mock.calls[0][1]).toBe('20261007')
  })
  it('does not turn source failure into an empty-day jump', async () => {
    api.loadSportsScores.mockResolvedValue({ date: '20261007', competitions: [], failed: [...presetSelection] })
    renderWidget()
    expect(await screen.findByText('Die Ergebnisse sind gerade nicht erreichbar.')).toBeTruthy()
    expect(api.loadSportsScores).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy()
  })
})

describe('compact search controls', () => {
  it.each([
    ['de', 'Suche öffnen', 'Suche schließen', 'Nächster Tag'],
    ['en', 'Open search', 'Close search', 'Next day'],
  ] as const)('expands, focuses and clears search while retaining date and live filter (%s)', async (language, openLabel, closeLabel, nextDay) => {
    renderWidget(language)
    await screen.findByText('Bayern München')
    expect(screen.queryByRole('combobox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Live/ }))
    fireEvent.click(screen.getByRole('button', { name: nextDay }))
    fireEvent.click(screen.getByRole('button', { name: openLabel }))
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: closeLabel }))
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: openLabel }))
    fireEvent.click(screen.getByRole('button', { name: openLabel }))
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: /^Live/ }).getAttribute('aria-pressed')).toBe('true')
    expect(api.loadSportsScores.mock.calls.at(-1)?.[1]).toBe('20261008')
  })
})

it('uses the chosen compact design date label', async () => {
  const result = render(<SportsWidget language="de" now={new Date(2026, 10, 20, 12)} />)
  await screen.findByText('Bayern München')
  const date = screen.getByRole('button', { name: 'Tag im Kalender wählen' })
  expect(date.textContent?.trim()).toBe('Heute')
  fireEvent.click(screen.getByRole('button', { name: 'Nächster Tag' }))
  await waitFor(() => expect(date.textContent?.trim()).toBe('Sa., 21. Nov.'))
  result.unmount()
})


it('shows two neutral placeholders instead of a vs label or source zeros before kickoff', async () => {
  renderWidget()
  await screen.findByText('RB Leipzig')
  const row = screen.getByText('RB Leipzig').closest('li')!
  expect(Array.from(row.querySelectorAll('.sp-score b')).map(el => el.textContent)).toEqual(['–', '–'])
  expect(row.textContent).not.toContain('vs')
  expect(row.textContent).not.toContain('0:0')
})
