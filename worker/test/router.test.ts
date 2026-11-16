import { describe, expect, test } from 'vitest'
import { allowedOrigins, route, type WatcherApi } from '../src/router'

function fakeWatcher() {
  const calls: [string, unknown][] = []
  const api: WatcherApi = {
    register: async (body) => { calls.push(['register', body]); return { ok: true, key: 'k' } },
    unregister: async (endpoint) => { calls.push(['unregister', endpoint]) },
    status: async (endpoint) => { calls.push(['status', endpoint]); return { registered: true, lastTickAt: 1, scheduleReady: true, favoritesToday: 2, lastError: null, lastPushFailed: false } },
    health: async () => ({ lastTickAt: 1, lastSuccessAt: 1, devices: 1, lastError: null }),
  }
  return { api, calls }
}

const app = 'https://amirhossin27-dev.github.io'
const req = (method: string, path: string, body?: unknown, origin = app) =>
  new Request(`https://push.example${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })

describe('route', () => {
  test('allowed origins are the app and local development', () =>
    expect(allowedOrigins).toEqual(['https://amirhossin27-dev.github.io', 'http://localhost:5180', 'http://127.0.0.1:5180']))

  test('CORS only for allowed origins', async () => {
    const { api } = fakeWatcher()
    const ok = await route(req('OPTIONS', '/subscription'), api)
    expect(ok.status).toBe(204)
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(app)
    expect(ok.headers.get('Access-Control-Allow-Methods')).toContain('PUT')
    const other = await route(req('OPTIONS', '/subscription', undefined, 'https://evil.example'), api)
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  test('PUT /subscription registers', async () => {
    const { api, calls } = fakeWatcher()
    const response = await route(req('PUT', '/subscription', { subscription: {} }), api)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(calls).toEqual([['register', { subscription: {} }]])
  })

  test('PUT /subscription with an invalid registration is 400', async () => {
    const { api } = fakeWatcher()
    api.register = async () => ({ error: 'Unbekannter Push-Dienst.' })
    const response = await route(req('PUT', '/subscription', {}), api)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unbekannter Push-Dienst.' })
  })

  test('DELETE /subscription and POST /subscription/status take the endpoint', async () => {
    const { api, calls } = fakeWatcher()
    expect((await route(req('DELETE', '/subscription', { endpoint: 'e' }), api)).status).toBe(204)
    const status = await route(req('POST', '/subscription/status', { endpoint: 'e' }), api)
    expect(await status.json()).toMatchObject({ registered: true, favoritesToday: 2 })
    expect(calls).toEqual([['unregister', 'e'], ['status', 'e']])
    expect((await route(req('POST', '/subscription/status', { endpoint: 5 }), api)).status).toBe(400)
  })

  test('GET /health', async () => {
    const { api } = fakeWatcher()
    expect(await (await route(req('GET', '/health'), api)).json()).toEqual({ lastTickAt: 1, lastSuccessAt: 1, devices: 1, lastError: null })
  })

  test('unknown path is 404, broken JSON 400, a body over 32 KB 413', async () => {
    const { api } = fakeWatcher()
    expect((await route(req('GET', '/nope'), api)).status).toBe(404)
    expect((await route(req('PUT', '/subscription', '{broken'), api)).status).toBe(400)
    expect((await route(req('PUT', '/subscription', 'x'.repeat(33 * 1024)), api)).status).toBe(413)
  })
})
