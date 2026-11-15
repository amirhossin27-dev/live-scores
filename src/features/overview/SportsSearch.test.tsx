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

it.each(['de', 'en'] as const)('returns through the visible panel exit to the filtered search (%s)', async (language) => {
  render(<SportsSearch language={language} />)
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value: 'Alex' } })
  await screen.findByRole('option', { name: /Alex Player/ })
  const filters = within(screen.getByRole('group', { name: language === 'de' ? 'Suchergebnisse filtern' : 'Filter search results' }))
  fireEvent.click(filters.getByRole('button', { name: language === 'de' ? /Vereine/ : /Clubs/ }))
  fireEvent.click(screen.getByRole('option', { name: /Alex FC/ }))
  const panel = within(await screen.findByRole('dialog', { name: 'Alex FC' }))
  const label = language === 'de' ? 'Zu den Suchergebnissen' : 'Back to search results'
  const exit = panel.getByRole('button', { name: label })
  expect(exit.textContent).toContain(label)
  fireEvent.click(exit)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect((input as HTMLInputElement).value).toBe('Alex')
  expect(screen.getAllByRole('option')).toHaveLength(1)
  expect(screen.getByRole('option', { name: /Alex FC/ })).toBeTruthy()
  expect(document.activeElement).toBe(input)
})

it('keeps the query and filters usable when no search results exist', async () => {
  api.searchSports.mockResolvedValue([])
  render(<SportsSearch language="de" />)
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value: 'Niemand' } })
  await screen.findByText('Keine Treffer. Versuche einen anderen Namen.')
  expect(screen.queryByRole('option')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Trainer/ }))
  expect((input as HTMLInputElement).value).toBe('Niemand')
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(input.getAttribute('aria-expanded')).toBe('false')
})

it('keeps a selected category visible and switchable after the visual viewport shrinks', async () => {
  const viewport = document.createElement('div')
  let viewportHeight = 800
  Object.defineProperties(viewport, { height: { get: () => viewportHeight }, offsetTop: { value: 0 } })
  vi.stubGlobal('visualViewport', viewport)
  try {
    render(<SportsSearch language="en" />)
    const input = screen.getByRole('combobox', { name: 'Search players, coaches, clubs or national teams' })
    fireEvent.change(input, { target: { value: 'Alex' } })
    await screen.findByRole('option', { name: /Alex Player/ })
    const filters = screen.getByRole('group', { name: 'Filter search results' })
    fireEvent.click(within(filters).getByRole('button', { name: /Clubs/ }))
    expect(screen.getAllByRole('option')).toHaveLength(1)
    viewportHeight = 170
    fireEvent(viewport, new Event('resize'))
    const category = screen.getByRole('combobox', { name: 'Filter search results' }) as HTMLSelectElement
    expect(category.value).toBe('club')
    fireEvent.change(input, { target: { value: 'Alex new' } })
    await waitFor(() => expect(api.searchSports).toHaveBeenCalledWith('Alex new', 'en', expect.any(AbortSignal)))
    await waitFor(() => expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1))
    fireEvent.change(category, { target: { value: 'all' } })
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(4)
    viewportHeight = 800
    fireEvent(viewport, new Event('resize'))
    expect(within(screen.getByRole('group', { name: 'Filter search results' })).getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true')
    expect((input as HTMLInputElement).value).toBe('Alex new')
  } finally { cleanup(); vi.unstubAllGlobals() }
})
