/** Web Push of the app: subscription, registration of the football favourites at the push worker, status. */

export interface PushFavorite { competition: string; id: string; start: string }
export interface WorkerStatus { registered: boolean; lastTickAt: number | null; scheduleReady: boolean; favoritesToday: number; lastError: string | null; lastPushFailed?: boolean }
export type PushAvailability = 'no-config' | 'unsupported' | 'not-installed' | 'denied' | 'ready'

const settingKey = 'dwh.sports.push.v1'
const isFootball = (id: string) => id.startsWith('soccer/')

function config(): { workerUrl: string; vapidPublicKey: string } | null {
  const { pushWorkerUrl, vapidPublicKey } = window.APP_CONFIG ?? {}
  if (!pushWorkerUrl || !vapidPublicKey) return null
  try {
    const url = new URL(pushWorkerUrl)
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search) return null
    return { workerUrl: url.href.replace(/\/$/, ''), vapidPublicKey }
  } catch {
    return null
  }
}

function installed(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** On the iPhone the Push API only exists in the app opened from the home screen (iOS 16.4 and later). */
export function pushAvailability(): PushAvailability {
  if (!config()) return 'no-config'
  const supported = 'serviceWorker' in navigator && typeof window.PushManager === 'function' && typeof window.Notification === 'function'
  if (!supported) return installed() ? 'unsupported' : 'not-installed'
  if (Notification.permission === 'denied') return 'denied'
  return 'ready'
}

export function pushEnabled(): boolean {
  try { return window.localStorage.getItem(settingKey) === 'on' } catch { return false }
}
function remember(on: boolean) {
  try { window.localStorage.setItem(settingKey, on ? 'on' : 'off') } catch { /* The choice lasts for this visit. */ }
}

function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

async function subscribe(vapidPublicKey: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready
  return (await registration.pushManager.getSubscription())
    ?? registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(vapidPublicKey) })
}

async function call(method: string, path: string, body: unknown): Promise<Response> {
  const settings = config()
  if (!settings) throw new Error('Mitteilungen sind nicht eingerichtet.')
  return fetch(settings.workerUrl + path, { method, credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) })
}

async function send(subscription: PushSubscription, favorites: PushFavorite[], competitions: string[]) {
  const response = await call('PUT', '/subscription', {
    subscription: subscription.toJSON(),
    favorites: favorites.filter((item) => isFootball(item.competition)).map(({ competition, id, start }) => ({ competition, id, start })),
    competitions: competitions.filter(isFootball),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || `Mitteilungen: HTTP ${response.status}`)
  }
}

/** Asks for permission (needs a tap), subscribes and registers the favourites. */
export async function enablePush(favorites: PushFavorite[], competitions: string[]): Promise<void> {
  const settings = config()
  if (!settings) throw new Error('Mitteilungen sind nicht eingerichtet.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')
  await send(await subscribe(settings.vapidPublicKey), favorites, competitions)
  remember(true)
}

export async function disablePush(): Promise<void> {
  remember(false)
  const subscription = await currentSubscription()
  if (!subscription) return
  await call('DELETE', '/subscription', { endpoint: subscription.endpoint }).catch(() => undefined)
  await subscription.unsubscribe()
}

/** Keeps the worker up to date while notifications are on; subscribes again if the subscription was lost. */
export async function syncPush(favorites: PushFavorite[], competitions: string[]): Promise<void> {
  const settings = config()
  if (!settings || !pushEnabled() || pushAvailability() !== 'ready') return
  let subscription = await currentSubscription()
  if (!subscription && Notification.permission === 'granted') subscription = await subscribe(settings.vapidPublicKey)
  if (subscription) await send(subscription, favorites, competitions)
}

/** What the worker knows of this device; null when it cannot be asked. */
export async function pushStatus(): Promise<WorkerStatus | null> {
  try {
    const subscription = await currentSubscription()
    if (!subscription) return { registered: false, lastTickAt: null, scheduleReady: false, favoritesToday: 0, lastError: null }
    const response = await call('POST', '/subscription/status', { endpoint: subscription.endpoint })
    return response.ok ? await response.json() as WorkerStatus : null
  } catch {
    return null
  }
}
