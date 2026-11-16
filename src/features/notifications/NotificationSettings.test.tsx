import { afterEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationSettings } from './NotificationSettings'
import { installPushEnv, resetPushEnv } from './pushTestEnv'

const favorites = [{ competition: 'soccer/ger.1', id: '7', start: '2026-11-21T14:30:00Z' }]

afterEach(() => { resetPushEnv(); window.history.replaceState(null, '', '/') })

const toggle = () => screen.getByRole('switch', { name: 'Mitteilungen bei Toren & Roten Karten' })

test('hint and disabled switch before the app is on the home screen', () => {
  installPushEnv({ standalone: false, pushManager: false })
  render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  expect((toggle() as HTMLInputElement).disabled).toBe(true)
  expect(screen.getByText('Zum Home-Bildschirm hinzufügen und die App von dort öffnen, dann hier einschalten.')).toBeTruthy()
})

test('hint when notifications are blocked', () => {
  installPushEnv({ permission: 'denied' })
  render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  expect(screen.getByText('Mitteilungen sind blockiert. Erlauben unter Einstellungen → Mitteilungen → Live Scores.')).toBeTruthy()
})

test('switching on registers the device and shows the status line', async () => {
  const env = installPushEnv({ permission: 'default' })
  env.requestPermission.mockResolvedValue('granted')
  render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  await userEvent.click(toggle())
  expect(await screen.findByText('Wächter aktiv vor 1 Min · dieses Gerät registriert · 2 Favoritenspiele heute')).toBeTruthy()
  expect((toggle() as HTMLInputElement).checked).toBe(true)
  expect(env.requests[0].method).toBe('PUT')
})

test('warns in red when the watcher has not run for over 5 minutes', async () => {
  const env = installPushEnv({ subscribed: true })
  window.localStorage.setItem('dwh.sports.push.v1', 'on')
  env.status = { registered: true, lastTickAt: Date.now() - 6 * 60_000, scheduleReady: true, favoritesToday: 1, lastError: null }
  render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  const line = await screen.findByText('Wächter seit 6 Min nicht gelaufen')
  expect((line).classList.contains('is-warning')).toBe(true)
})

test('an unknown device is registered again and the warning shows', async () => {
  const env = installPushEnv({ subscribed: true })
  window.localStorage.setItem('dwh.sports.push.v1', 'on')
  env.status = { registered: false, lastTickAt: Date.now() - 60_000, scheduleReady: true, favoritesToday: 0, lastError: null }
  render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  expect((await screen.findByText('Gerät nicht registriert – wird neu angemeldet')).classList.contains('is-warning')).toBe(true)
  await waitFor(() => expect(env.requests.some((r) => r.method === 'PUT')).toBe(true))
})

test('missing plan and unreachable watcher are warnings', async () => {
  const env = installPushEnv({ subscribed: true })
  window.localStorage.setItem('dwh.sports.push.v1', 'on')
  env.status = { registered: true, lastTickAt: Date.now() - 60_000, scheduleReady: false, favoritesToday: 0, lastError: null }
  const { unmount } = render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  expect((await screen.findByText('Spielplan für heute fehlt')).classList.contains('is-warning')).toBe(true)
  unmount()
  env.status = 'down'
  render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  expect((await screen.findByText('Wächter nicht erreichbar')).classList.contains('is-warning')).toBe(true)
})

test('switching off unsubscribes', async () => {
  const env = installPushEnv({ subscribed: true })
  window.localStorage.setItem('dwh.sports.push.v1', 'on')
  render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  await userEvent.click(toggle())
  await waitFor(() => expect(env.requests.some((r) => r.method === 'DELETE')).toBe(true))
  expect((toggle() as HTMLInputElement).checked).toBe(false)
})

test('renders nothing in the embedded view', () => {
  installPushEnv()
  window.history.replaceState(null, '', '/?embed=1&view=compact')
  const { container } = render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  expect(container.innerHTML).toBe('')
})

test('renders nothing without push configuration', () => {
  installPushEnv({ config: false })
  const { container } = render(<NotificationSettings language="de" favorites={favorites} competitions={[]} />)
  expect(container.innerHTML).toBe('')
  vi.restoreAllMocks()
})
