import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { SportsSearch } from './SportsSearch'
import type { SportsSearchResult } from './sportsApi'

const api = vi.hoisted(() => ({ searchSports: vi.fn() }))
vi.mock('./sportsApi', () => api)
vi.mock('./MatchDetails', () => ({ MatchLayers: ({ children, frame }: { children: ReactNode; frame: (content: ReactNode) => ReactNode }) => frame(children) }))
vi.mock('./PlayerProfile', () => ({ PlayerProfile: ({ id, onBack }: { id: string; onBack: () => void }) => <div>Person {id}<button onClick={onBack}>Back</button></div> }))
vi.mock('./TeamProfile', () => ({ TeamProfile: ({ team, onBack }: { team: { id: string }; onBack: () => void }) => <div>Team {team.id}<button onClick={onBack}>Back</button></div> }))

const results: SportsSearchResult[] = [
  { id: '1', name: 'Alex Player', kind: 'player', description: 'Munich', logo: null, country: null },
  { id: '2', name: 'Alex Coach', kind: 'coach', description: null, logo: null, country: null },
  { id: '3', name: 'Alex FC', kind: 'club', description: 'Germany', logo: null, country: null },
  { id: '4', name: 'Germany', kind: 'national', description: null, logo: null, country: null },
]

beforeEach(() => { api.searchSports.mockReset(); api.searchSports.mockResolvedValue(results) })
afterEach(cleanup)

describe('Live Scores search', () => {
  it('waits for at least two characters and debounces fast input', async () => {
    render(<SportsSearch language="de" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'A' } })
    expect(api.searchSports).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'Ale' } })
    fireEvent.change(input, { target: { value: 'Alex' } })
    await screen.findByRole('option', { name: /Alex Player/ })
    expect(api.searchSports).toHaveBeenCalledTimes(1)
    expect(api.searchSports).toHaveBeenCalledWith('Alex', 'de', expect.any(AbortSignal))
  })

  it('filters all four entity kinds and opens a national team directly', async () => {
    render(<SportsSearch language="en" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Alex' } })
    await screen.findByRole('option', { name: /Alex Player/ })
    expect(screen.getAllByRole('option')).toHaveLength(4)
    const filters = within(screen.getByRole('group', { name: 'Filter search results' }))
    for (const [label, name] of [['Players', 'Alex Player'], ['Coaches', 'Alex Coach'], ['Clubs', 'Alex FC'], ['National teams', 'Germany']]) {
      fireEvent.click(filters.getByRole('button', { name: new RegExp(label) }))
      expect(screen.getAllByRole('option')).toHaveLength(1)
      expect(screen.getByRole('option').textContent).toContain(name)
    }
    fireEvent.click(screen.getByRole('option'))
    expect(await screen.findByRole('dialog', { name: 'Germany' })).toBeTruthy()
    expect(screen.getByText('Team 4')).toBeTruthy()
  })

  it('supports keyboard navigation into a coach profile and restores search on return', async () => {
    render(<SportsSearch language="en" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Alex' } })
    await screen.findByRole('option', { name: /Alex Coach/ })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toContain('result-1')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Person 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(input)
    expect(screen.getAllByRole('option')).toHaveLength(4)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  it('aborts superseded searches and ignores their late responses', async () => {
    let resolveOld: (items: SportsSearchResult[]) => void = () => undefined
    api.searchSports.mockImplementationOnce(() => new Promise<SportsSearchResult[]>((resolve) => { resolveOld = resolve }))
    render(<SportsSearch language="en" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'old' } })
    await waitFor(() => expect(api.searchSports).toHaveBeenCalledTimes(1))
    const signal = api.searchSports.mock.calls[0][2] as AbortSignal
    fireEvent.change(input, { target: { value: 'Alex' } })
    expect(signal.aborted).toBe(true)
    await screen.findByRole('option', { name: /Alex Player/ })
    resolveOld([{ ...results[0], name: 'Stale result' }])
    await waitFor(() => expect(screen.queryByText('Stale result')).toBeNull())
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('shows an error with retry, and clear resets the results', async () => {
    api.searchSports.mockRejectedValueOnce(new Error('offline'))
    render(<SportsSearch language="de" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Alex' } })
    await screen.findByText('Die Suche ist gerade nicht erreichbar.')
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await screen.findByRole('option', { name: /Alex Player/ })
    fireEvent.click(screen.getByRole('button', { name: 'Suche leeren' }))
    expect((input as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
