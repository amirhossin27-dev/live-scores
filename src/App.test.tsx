import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./features/overview/sportsApi', async importOriginal => {
  const actual = await importOriginal<typeof import('./features/overview/sportsApi')>()
  return {
    ...actual,
    loadSportsScores: vi.fn(async (ids: string[], date: string) => ({ date, failed: [], competitions: ids.map(id => ({ id, name: id, matches: id === 'soccer/ger.1' ? [{ id: 'sample', start: new Date().toISOString(), status: 'live', statusText: '67', title: null, detail: null, home: { name: 'Bayern Munich', shortName: null, logo: null, score: '2', winner: null }, away: { name: 'Borussia Dortmund', shortName: null, logo: null, score: '1', winner: null } }] : [] })) })),
    searchSports: vi.fn(async () => []),
  }
})
beforeEach(() => { localStorage.clear(); history.replaceState({}, '', '/') })
afterEach(() => { cleanup(); localStorage.clear(); history.replaceState({}, '', '/'); delete document.documentElement.dataset.theme })

it('places appearance and settings in lower tools without a visible title block or normal refresh action', async () => {
  const { container } = render(<App />)
  await screen.findByText('Bayern München')
  const tools = screen.getByRole('navigation', { name: 'App-Werkzeuge' })
  expect(within(tools).getByRole('button', { name: 'Sprache wechseln' })).toBeTruthy()
  expect(within(tools).getByRole('combobox', { name: 'Darstellung' })).toBeTruthy()
  expect(within(tools).getByRole('button', { name: 'Wettbewerbe auswählen' })).toBeTruthy()
  expect(container.querySelector('.app-header')).toBeNull()
  expect(container.querySelector('.panel-header')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Aktualisieren' })).toBeNull()
})

it('persists the moved language/theme controls and returns from settings to the lower trigger', async () => {
  render(<App />)
  await screen.findByText('Bayern München')
  const tools = screen.getByRole('navigation', { name: 'App-Werkzeuge' })
  fireEvent.click(within(tools).getByRole('button', { name: 'Sprache wechseln' }))
  expect(localStorage.getItem('live-scores.language')).toBe('en')
  fireEvent.change(within(tools).getByRole('combobox', { name: 'Appearance' }), { target: { value: 'dark' } })
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem('live-scores.theme')).toBe('dark')
  fireEvent.click(screen.getByRole('button', { name: /^Live/ }))
  const trigger = within(tools).getByRole('button', { name: 'Choose competitions' })
  fireEvent.click(trigger)
  const done = screen.getByRole('button', { name: 'Done' })
  expect(document.activeElement).toBe(done)
  fireEvent.click(done)
  expect(document.activeElement).toBe(trigger)
  expect(screen.getByRole('button', { name: /^Live/ }).getAttribute('aria-pressed')).toBe('true')
})

it.each(['full', 'compact'])('keeps embedded %s settings accessible without global appearance tools', async view => {
  history.replaceState({}, '', '/?embed=1&view=' + view + '&lang=en&theme=light')
  render(<App />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Choose competitions' })).toBeTruthy())
  expect(screen.queryByRole('navigation', { name: 'App tools' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Change language' })).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'Appearance' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Choose competitions' }))
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.getByRole('button', { name: 'Choose competitions' })).toBeTruthy()
})
