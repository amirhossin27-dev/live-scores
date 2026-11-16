import { afterEach, describe, expect, test } from 'vitest'
import { disablePush, enablePush, pushAvailability, pushEnabled, pushStatus, syncPush } from './pushClient'
import { installPushEnv, resetPushEnv } from './pushTestEnv'

const favorites = [{ competition: 'soccer/ger.1', id: '7', start: '2026-11-21T14:30:00Z' }, { competition: 'racing/f1', id: '9', start: '2026-11-21T14:30:00Z' }]
const competitions = ['soccer/eng.1', 'mma/ufc']

afterEach(resetPushEnv)

describe('pushAvailability', () => {
  test('no-config without worker address or key', () => { installPushEnv({ config: false }); expect(pushAvailability()).toBe('no-config') })
  test('not-installed in Safari before adding to the home screen', () => { installPushEnv({ standalone: false, pushManager: false }); expect(pushAvailability()).toBe('not-installed') })
  test('unsupported in an installed app without Push API (iOS before 16.4)', () => { installPushEnv({ pushManager: false }); expect(pushAvailability()).toBe('unsupported') })
  test('denied when notifications are blocked', () => { installPushEnv({ permission: 'denied' }); expect(pushAvailability()).toBe('denied') })
  test('ready in the installed app', () => { installPushEnv(); expect(pushAvailability()).toBe('ready') })
})

describe('enable, sync, disable', () => {
  test('enablePush subscribes and sends only football favourites', async () => {
    const env = installPushEnv({ permission: 'default' })
    env.requestPermission.mockResolvedValue('granted')
    await enablePush(favorites, competitions)
    expect(env.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(env.requests).toEqual([{ method: 'PUT', url: 'https://push.example/subscription', body: {
      subscription: { endpoint: 'https://web.push.apple.com/device1', keys: { p256dh: 'p', auth: 'a' } },
      favorites: [favorites[0]], competitions: ['soccer/eng.1'] } }])
    expect(pushEnabled()).toBe(true)
  })

  test('enablePush fails when permission is refused', async () => {
    const env = installPushEnv({ permission: 'default' })
    env.requestPermission.mockResolvedValue('denied')
    await expect(enablePush(favorites, competitions)).rejects.toThrow()
    expect(env.requests).toEqual([])
    expect(pushEnabled()).toBe(false)
  })

  test('syncPush makes no request while notifications are off', async () => {
    const env = installPushEnv({ subscribed: true })
    await syncPush(favorites, competitions)
    expect(env.requests).toEqual([])
  })

  test('syncPush sends the favourites when on, and subscribes again after the subscription was lost', async () => {
    const env = installPushEnv({ subscribed: false })
    window.localStorage.setItem('dwh.sports.push.v1', 'on')
    await syncPush(favorites, competitions)
    expect(env.subscribe).toHaveBeenCalled()
    expect(env.requests.map((r) => r.method + ' ' + r.url)).toEqual(['PUT https://push.example/subscription'])
  })

  test('disablePush unsubscribes and tells the worker', async () => {
    const env = installPushEnv({ subscribed: true })
    window.localStorage.setItem('dwh.sports.push.v1', 'on')
    await disablePush()
    expect(env.requests).toEqual([{ method: 'DELETE', url: 'https://push.example/subscription', body: { endpoint: 'https://web.push.apple.com/device1' } }])
    expect(env.subscription).toBeNull()
    expect(pushEnabled()).toBe(false)
  })

  test('pushStatus asks the worker for this device, null when unreachable', async () => {
    const env = installPushEnv({ subscribed: true })
    expect(await pushStatus()).toMatchObject({ registered: true, favoritesToday: 2 })
    expect(env.requests[0]).toEqual({ method: 'POST', url: 'https://push.example/subscription/status', body: { endpoint: 'https://web.push.apple.com/device1' } })
    env.status = 'down'
    expect(await pushStatus()).toBeNull()
  })
})
