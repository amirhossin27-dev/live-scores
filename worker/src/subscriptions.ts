import { fromBase64url, type PushSubscriptionJSON } from './webpush'

export interface FavoriteMatch { competition: string; id: string; start: string }

/** One device with notifications on: its push subscription and its football favourites. */
export interface DeviceRecord {
  key: string; subscription: PushSubscriptionJSON; favorites: FavoriteMatch[]; competitions: string[]; lastSeen: number
  /** HTTP status of the last push to this device (0: not reachable), and when. */
  lastPushStatus?: number; lastPushAt?: number
}

export interface Registration { subscription: PushSubscriptionJSON; favorites: FavoriteMatch[]; competitions: string[] }

export const maxFavorites = 200
export const maxCompetitions = 40

const exactHosts = ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com']
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isFootball = (value: unknown): value is string => typeof value === 'string' && /^soccer\/[a-z0-9._-]{1,40}$/i.test(value)

function knownPushService(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
    return exactHosts.includes(url.hostname) || url.hostname.endsWith('.notify.windows.com')
  } catch {
    return false
  }
}

function decodedLength(value: unknown): number {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return -1
  try { return fromBase64url(value.replace(/=+$/, '')).length } catch { return -1 }
}

/** Checks what the app sends: only known push services, valid keys, football favourites within the limits. */
export function parseRegistration(body: unknown): Registration | { error: string } {
  if (!isObject(body) || !isObject(body.subscription)) return { error: 'Push-Abo fehlt.' }
  const { endpoint, keys } = body.subscription
  if (typeof endpoint !== 'string' || endpoint.length > 1024 || !knownPushService(endpoint)) return { error: 'Unbekannter Push-Dienst.' }
  if (!isObject(keys) || decodedLength(keys.p256dh) !== 65 || decodedLength(keys.auth) !== 16) return { error: 'Ungültige Schlüssel im Push-Abo.' }

  const favorites: FavoriteMatch[] = []
  for (const item of Array.isArray(body.favorites) ? body.favorites : []) {
    if (!isObject(item) || !isFootball(item.competition) || typeof item.id !== 'string' || !/^[\w-]{1,40}$/.test(item.id)) continue
    if (typeof item.start !== 'string' || Number.isNaN(Date.parse(item.start))) continue
    favorites.push({ competition: item.competition, id: item.id, start: item.start })
    if (favorites.length === maxFavorites) break
  }
  const competitions = [...new Set((Array.isArray(body.competitions) ? body.competitions : []).filter(isFootball))].slice(0, maxCompetitions)
  return { subscription: { endpoint, keys: { p256dh: keys.p256dh as string, auth: keys.auth as string } }, favorites, competitions }
}

/** The storage key of a device: the hex SHA-256 of its push endpoint. */
export async function endpointKey(endpoint: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
