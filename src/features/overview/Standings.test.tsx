import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SportsStandings, SportsTableRow, SportsText } from './sportsApi'
import { StandingsBody } from './Standings'
import { zoneAppearance } from './sportsZones'

const loadStandings = vi.hoisted(() => vi.fn())
vi.mock('./sportsApi', async (original) => ({ ...await original<object>(), loadStandings }))
beforeEach(() => loadStandings.mockReset())
afterEach(cleanup)

function row(rank: number, name: string, zone: string | null, highlight = false): SportsTableRow {
  return { rank, name, zone, highlight, logo: null, values: ['3', '9'] }
}

const standings: SportsStandings = {
  competition: 'soccer/ger.1', season: '2026/27', bracket: null,
  table: {
    source: 'fotmob', columns: ['gamesPlayed', 'points'],
    groups: [{ name: null, rows: [row(1, 'First Club', '#001122'), row(2, 'Second Club', '#001122', true), row(3, 'Third Club', null), row(18, 'Last Club', '#220000')] }],
    zones: [{ color: '#001122', label: { key: 'championsleague', text: 'Champions League' } }, { color: '#220000', label: { key: 'relegation', text: 'Relegation' } }],
  },
}

describe('historical standings', () => {
  it('keeps the published season list while loading, hides old rows and ignores superseded responses', async () => {
    let finishOld!: (value: SportsStandings) => void
    let finishNew!: (value: SportsStandings) => void
    loadStandings.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishNew = resolve }))
    const data = { ...standings, seasons: ['2026/2027', '2025-26', '1990/1991', '1989/1990'] }
    render(<StandingsBody standings={data} view="table" language="de" />)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['2026/2027', '2025/2026', '1990/1991'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Saison' }), { target: { value: '1990/1991' } })
    expect(screen.queryByText('First Club')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('geladen')
    const firstSignal = loadStandings.mock.calls[0][2] as AbortSignal
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2025/2026' } })
    expect(firstSignal.aborted).toBe(true)
    const historical = (name: string, season: string): SportsStandings => ({ ...data, season, table: { ...data.table!, live: false, groups: [{ name: null, rows: [row(1, name, null)] }] } })
    await act(async () => finishNew(historical('Correct historical club', '2025/2026')))
    expect(screen.getByText('Correct historical club')).toBeTruthy()
    await act(async () => finishOld(historical('Superseded club', '1990/1991')))
    expect(screen.queryByText('Superseded club')).toBeNull()
    expect(loadStandings).toHaveBeenLastCalledWith('soccer/ger.1', null, expect.any(AbortSignal), '2025/2026')
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('keeps season selection usable after a failed request and retries that season', async () => {
    loadStandings.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...standings, season: '1990/1991' })
    render(<StandingsBody standings={{ ...standings, seasons: ['2026/2027', '1990/1991'] }} view="table" language="en" />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), { target: { value: '1990/1991' } })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByText('First Club')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('First Club')).toBeTruthy()
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('1990/1991')
  })
})

describe('standings zones', () => {
  it('keeps Europa and Conference League distinct when their provider colours are identical', () => {
    const sameColor: SportsStandings = { ...standings, table: { ...standings.table!, groups: [{ name: null, rows: [
      { ...row(5, 'Europa Club', '#B2BFD0'), zoneKey: 'europa' },
      { ...row(6, 'Conference Club', '#B2BFD0'), zoneKey: 'conference' },
    ] }], zones: [
      { key: 'europa', color: '#B2BFD0', label: { key: 'europaleague', text: 'Europa League' } },
      { key: 'conference', color: '#B2BFD0', label: { key: null, text: 'Conference League' } },
    ] } }
    render(<StandingsBody standings={sameColor} view="table" language="de" />)
    const europa = screen.getByRole('img', { name: 'Platz 5: Europa League' }).closest('tr')!
    const conference = screen.getByRole('img', { name: 'Platz 6: Conference League' }).closest('tr')!
    expect(europa.style.getPropertyValue('--st-zone-light')).not.toBe(conference.style.getPropertyValue('--st-zone-light'))
    expect(conference.classList.contains('st-zone-start')).toBe(true)
    expect(screen.getByRole('list', { name: 'Tabellenbereiche' }).textContent).toBe('Europa LeagueConference League')
  })

  it('labels colored ranks and the compact legend without extra codes in the table', () => {
    render(<StandingsBody standings={standings} view="table" language="de" />)
    const rows = screen.getAllByRole('row')
    const champions = within(rows[1]).getByRole('img', { name: 'Platz 1: Champions League' })
    const relegation = within(rows[4]).getByRole('img', { name: 'Platz 18: Abstieg' })
    expect(champions.textContent).toBe('1')
    expect(relegation.textContent).toBe('18')
    expect(rows[2].classList.contains('is-highlight')).toBe(true)
    expect(rows[4].classList.contains('st-zone-start')).toBe(true)
    expect(document.querySelector('.st-zone-code')).toBeNull()
    const legend = within(screen.getByRole('list', { name: 'Tabellenbereiche' }))
    expect(legend.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Champions League', 'Abstieg'])
    // Near-black provider colours cannot make a zone disappear in dark mode.
    expect(rows[1].style.getPropertyValue('--st-zone-dark')).toBe('#7dd3fc')
    expect(rows[4].style.getPropertyValue('--st-zone-dark')).toBe('#b91c1c')
  })

  it('filters the legend with the shown groups and reveals other zones when all groups are requested', () => {
    const grouped: SportsStandings = { ...standings, table: { ...standings.table!, groups: [
      { name: 'Group A', rows: [row(1, 'Featured Club', '#001122', true)] },
      { name: 'Group B', rows: [row(18, 'Other Club', '#220000')] },
    ] } }
    render(<StandingsBody standings={grouped} view="table" language="en" focus />)
    expect(screen.getByRole('list', { name: 'Table zones' }).textContent).toBe('Champions League')
    expect(screen.queryByText('Other Club')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all groups' }))
    expect(screen.getByRole('list', { name: 'Table zones' }).textContent).toBe('Champions LeagueRelegation')
    expect(screen.getByText('Other Club')).toBeTruthy()
  })

  it('does not guess a zone meaning when the provider omits its label', () => {
    const unlabeled: SportsStandings = { ...standings, table: { ...standings.table!, groups: [{ name: null, rows: [row(5, 'Example Club', '#050505')] }], zones: [] } }
    render(<StandingsBody standings={unlabeled} view="table" language="de" />)
    expect(screen.getByRole('img', { name: 'Platz 5: Tabellenbereich ohne Bezeichnung' })).toBeTruthy()
    expect(screen.getByText('Tabellenbereich ohne Bezeichnung')).toBeTruthy()
  })

  it('keeps rank text at readable contrast in both palettes and distinguishes relegation from its playoff', () => {
    const meanings: SportsText[] = ['Champions League', 'Europa League', 'Conference League', 'Promotion', 'Relegation', 'Relegation playoff', 'Eliminated', 'Qualification next stage'].map((text) => ({ key: null, text }))
    const luminance = (hex: string) => {
      const channels = hex.match(/[a-f\d]{2}/gi)!.map((channel) => parseInt(channel, 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const contrast = (one: string, two: string) => (Math.max(luminance(one), luminance(two)) + 0.05) / (Math.min(luminance(one), luminance(two)) + 0.05)
    const palettes = meanings.map((meaning) => zoneAppearance(meaning) as Record<string, string>)
    for (const palette of palettes) {
      expect(contrast(palette['--st-zone-light'], palette['--st-zone-text-light'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette['--st-zone-dark'], palette['--st-zone-text-dark'])).toBeGreaterThanOrEqual(4.5)
    }
    expect(palettes[4]['--st-zone-dark']).not.toBe(palettes[5]['--st-zone-dark'])
  })
})
