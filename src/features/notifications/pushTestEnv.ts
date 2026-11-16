import { vi } from 'vitest'

/** A fake browser with service worker, Push API and the push worker behind `fetch`, for the notification tests. */
export function installPushEnv(options: { standalone?: boolean; pushManager?: boolean; permission?: NotificationPermission; subscribed?: boolean; config?: boolean } = {}) {
  const { standalone = true, pushManager = true, permission = 'granted', subscribed = false, config = true } = options
  const requests: { method: string; url: string; body: unknown }[] = []
  let subscription: { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> } | null = null
  const makeSubscription = () => ({
    endpoint: 'https://web.push.apple.com/device1',
    toJSON: () => ({ endpoint: 'https://web.push.apple.com/device1', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: async () => { subscription = null; return true },
  })
  if (subscribed) subscription = makeSubscription()
  const env = {
    requests,
    status: { registered: true, lastTickAt: Date.now() - 60_000, scheduleReady: true, favoritesToday: 2, lastError: null } as Record<string, unknown> | 'down',
    subscribe: vi.fn(async () => { subscription = makeSubscription(); return subscription }),
    requestPermission: vi.fn(async () => permission),
    get subscription() { return subscription },
  }
  window.APP_CONFIG = config ? { apiBaseUrl: 'https://api.example', pushWorkerUrl: 'https://push.example', vapidPublicKey: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4' } : { apiBaseUrl: 'https://api.example' }
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: standalone && query.includes('standalone'), addEventListener() {}, removeEventListener() {} }))
  vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission, requestPermission: env.requestPermission }))
  if (pushManager) vi.stubGlobal('PushManager', function PushManager() {})
  else vi.stubGlobal('PushManager', undefined)
  const registration = { pushManager: { getSubscription: async () => subscription, subscribe: env.subscribe } }
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration) } })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method: init.method ?? 'GET', url, body })
    if (url.endsWith('/subscription/status')) return env.status === 'down' ? Promise.reject(new TypeError('offline')) : Response.json(env.status)
    if (init.method === 'DELETE') return new Response(null, { status: 204 })
    return Response.json({ ok: true })
  }))
  return env
}

export function resetPushEnv() {
  vi.unstubAllGlobals()
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
  delete window.APP_CONFIG
  window.localStorage.clear()
}
