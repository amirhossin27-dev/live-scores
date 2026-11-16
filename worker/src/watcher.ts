import { detectEvents, stateOf } from './events'
import { buildEventMessage, outageMessage, recoveryMessage, type PushMessage } from './messages'
import { apiDaysFor, berlinDay, inWindow, scheduleDays, watchedMatches, type MatchStatus, type ScheduledMatch } from './schedule'
import type { Store } from './store'
import { endpointKey, parseRegistration, type DeviceRecord } from './subscriptions'
import type { ApiMatch, ApiScores, MatchEvent, MatchState } from './types'
import type { PushSubscriptionJSON } from './webpush'

export interface WatcherDeps {
  store: Store
  now: () => number
  /** GET on the Render API, `path` starts with `/api/`. */
  api: (path: string) => Promise<Response>
  push: (sub: PushSubscriptionJSON, msg: PushMessage) => Promise<{ status: number }>
}

export interface WorkerStatus { registered: boolean; lastTickAt: number | null; scheduleReady: boolean; favoritesToday: number; lastError: string | null }

interface Meta { lastTickAt?: number; lastSuccessAt?: number; lastError?: string; outageSince?: number; outageNotified?: boolean; leaseUntil?: number }
interface Schedule { days: string[]; competitions: string[]; matches: ScheduledMatch[]; ok: boolean; attemptAt: number }
interface StoredState { state: MatchState | null; status: MatchStatus; start: string; seenAt: number }

const minute = 60_000
const leaseTime = 5 * minute
const scheduleRetry = 15 * minute
const outageAfter = 10 * minute
const keepState = 6 * 60 * minute
export const maxDevices = 10

const deviceKey = (key: string) => `device:${key}`
const stateKey = (match: string) => `state:${match}`
const matchKey = (m: { competition: string; id: string }) => `${m.competition}|${m.id}`

function meta(store: Store): Meta { return store.get<Meta>('meta') ?? {} }
function patchMeta(store: Store, patch: Partial<Meta>) {
  const next = { ...meta(store), ...patch }
  for (const key of Object.keys(next) as (keyof Meta)[]) if (next[key] === undefined) delete next[key]
  store.put('meta', next)
}
const devicesOf = (store: Store) => [...store.list<DeviceRecord>('device:').values()]

async function readScores(deps: WatcherDeps, competitions: string[], day: string): Promise<{ matches: Map<string, ApiMatch>; failed: boolean }> {
  const matches = new Map<string, ApiMatch>()
  try {
    const response = await deps.api(`/api/sports/scores?competitions=${competitions.map(encodeURIComponent).join(',')}&date=${day}`)
    if (!response.ok) throw new Error(`Render antwortet mit HTTP ${response.status}`)
    const scores = await response.json() as ApiScores
    for (const competition of scores.competitions ?? []) {
      if (scores.failed?.includes(competition.id)) continue
      for (const m of competition.matches ?? []) matches.set(matchKey({ competition: competition.id, id: m.id }), m)
    }
    const failed = (scores.failed ?? []).filter((id) => competitions.includes(id))
    if (failed.length) patchMeta(deps.store, { lastError: `Keine Daten für ${failed.join(', ')}` })
    return { matches, failed: failed.length > 0 }
  } catch (error) {
    patchMeta(deps.store, { lastError: error instanceof Error ? error.message : String(error) })
    return { matches, failed: true }
  }
}

/** The matches of the favourite competitions for today and tomorrow (Berlin); running matches of the old plan stay. */
async function refreshSchedule(deps: WatcherDeps, devices: DeviceRecord[], now: number): Promise<Schedule> {
  const days = scheduleDays(now)
  const competitions = [...new Set(devices.flatMap((device) => device.competitions))].sort()
  const old = deps.store.get<Schedule>('schedule')
  const current = old && old.days.join() === days.join() && old.competitions.join() === competitions.join()
  if (old && current && (old.ok || now - old.attemptAt < scheduleRetry)) return old

  const found = new Map<string, ScheduledMatch>()
  // Keep what is still running (a match across midnight) or what a failed request would otherwise lose.
  for (const m of old?.matches ?? []) if (competitions.includes(m.competition) && (inWindow(m.start, undefined, now) || Date.parse(m.start) > now)) found.set(matchKey(m), m)
  let ok = true
  if (competitions.length) {
    for (const day of days) {
      const result = await readScores(deps, competitions, day)
      ok &&= !result.failed
      for (const [key, m] of result.matches) found.set(key, { competition: key.slice(0, key.lastIndexOf('|')), id: m.id, start: m.start })
    }
  }
  const schedule: Schedule = { days, competitions, matches: [...found.values()], ok, attemptAt: now }
  deps.store.put('schedule', schedule)
  return schedule
}

/** The player of the index-th goal or sending-off of a side, from the match details; undefined when unknown. */
async function playerOf(deps: WatcherDeps, competition: string, id: string, events: MatchEvent[]): Promise<Map<MatchEvent, string>> {
  const players = new Map<MatchEvent, string>()
  try {
    const response = await deps.api(`/api/sports/match?competition=${encodeURIComponent(competition)}&id=${encodeURIComponent(id)}`)
    if (!response.ok) return players
    const details = await response.json() as { events?: { kind: string; side: string; player?: string | null }[] }
    for (const event of events) {
      const kinds = event.kind === 'goal' ? ['goal', 'penalty', 'own-goal'] : event.kind === 'goal-cancelled' ? [] : ['red', 'yellow-red']
      const ofSide = (details.events ?? []).filter((moment) => moment.side === event.side && kinds.includes(moment.kind))
      const player = ofSide[event.index - 1]?.player
      if (player) players.set(event, player)
    }
  } catch {
    // Without the name the notification still goes out.
  }
  return players
}

async function send(deps: WatcherDeps, deviceKeys: Iterable<string>, msg: PushMessage) {
  for (const key of deviceKeys) {
    const device = deps.store.get<DeviceRecord>(deviceKey(key))
    if (!device) continue
    try {
      const { status } = await deps.push(device.subscription, msg)
      if (status === 404 || status === 410) deps.store.delete(deviceKey(key))
      else if (status >= 400) patchMeta(deps.store, { lastError: `Push-Dienst antwortet mit HTTP ${status}` })
    } catch (error) {
      patchMeta(deps.store, { lastError: error instanceof Error ? error.message : String(error) })
    }
  }
}

async function run(deps: WatcherDeps, now: number) {
  const { store } = deps
  const devices = devicesOf(store)
  const schedule = await refreshSchedule(deps, devices, now)
  const stored = store.list<StoredState>('state:')
  const statuses = new Map<string, MatchStatus>([...stored].map(([key, value]) => [key.slice('state:'.length), value.status]))
  const watched = watchedMatches(devices, schedule.matches, statuses, now)

  if (watched.size === 0) {
    patchMeta(store, { outageSince: undefined, outageNotified: undefined })
  } else {
    // One request per API day with all competitions that need it.
    const byDay = new Map<string, Set<string>>()
    for (const { match } of watched.values()) for (const day of apiDaysFor(match.start)) {
      const set = byDay.get(day) ?? new Set<string>()
      set.add(match.competition)
      byDay.set(day, set)
    }
    const received = new Map<string, ApiMatch>()
    let allOk = true
    for (const [day, competitions] of byDay) {
      const result = await readScores(deps, [...competitions].sort(), day)
      for (const [key, m] of result.matches) if (watched.has(key) && !received.has(key)) received.set(key, m)
      if (result.failed) allOk = false
    }

    const missing = [...watched.keys()].filter((key) => !received.has(key) && Date.parse(watched.get(key)!.match.start) <= now)
    const affected = new Set([...watched.values()].flatMap((entry) => entry.devices))
    const current = meta(store)
    if (missing.length) {
      const since = current.outageSince ?? now
      patchMeta(store, { outageSince: since })
      if (!current.outageNotified && now - since >= outageAfter) {
        patchMeta(store, { outageNotified: true })
        await send(deps, affected, outageMessage())
      }
    } else {
      if (current.outageNotified) await send(deps, affected, recoveryMessage())
      patchMeta(store, { outageSince: undefined, outageNotified: undefined })
    }
    if (allOk && received.size) patchMeta(store, { lastSuccessAt: now, lastError: undefined })

    for (const [key, m] of received) {
      const entry = watched.get(key)!
      const competition = entry.match.competition
      const previous = stored.get(stateKey(key))
      const next = stateOf(m)
      // Save first, then send: a crash afterwards means one notification too few, never one twice.
      store.put(stateKey(key), { state: next ?? previous?.state ?? null, status: m.status, start: m.start, seenAt: now } satisfies StoredState)
      if (!next || !previous?.state) continue
      const events = detectEvents(previous.state, next)
      if (!events.length) continue
      const players = await playerOf(deps, competition, m.id, events)
      for (const event of events) await send(deps, entry.devices, buildEventMessage(competition, m, event, players.get(event)))
    }
  }

  for (const [key, value] of stored) {
    const finished = value.status === 'finished' || value.status === 'postponed' || value.status === 'canceled'
    if ((finished && now - value.seenAt > keepState) || now - Date.parse(value.start) > 2 * keepState) store.delete(key)
  }
}

/** One cron run. A run that is still busy (slow cold start of Render) holds a lease; a second one does nothing. */
export async function tick(deps: WatcherDeps): Promise<void> {
  const now = deps.now()
  const current = meta(deps.store)
  if (current.leaseUntil && current.leaseUntil > now) return
  patchMeta(deps.store, { leaseUntil: now + leaseTime, lastTickAt: now })
  try {
    await run(deps, now)
  } finally {
    patchMeta(deps.store, { leaseUntil: undefined })
  }
}

export async function register(deps: WatcherDeps, body: unknown): Promise<{ ok: true; key: string } | { error: string }> {
  const parsed = parseRegistration(body)
  if ('error' in parsed) return parsed
  const key = await endpointKey(parsed.subscription.endpoint)
  const now = deps.now()
  deps.store.put(deviceKey(key), { key, ...parsed, lastSeen: now } satisfies DeviceRecord)
  const devices = devicesOf(deps.store)
  if (devices.length > maxDevices) {
    const oldest = devices.filter((device) => device.key !== key).sort((a, b) => a.lastSeen - b.lastSeen)
    for (const device of oldest.slice(0, devices.length - maxDevices)) deps.store.delete(deviceKey(device.key))
  }
  return { ok: true, key }
}

export async function unregister(deps: WatcherDeps, endpoint: string): Promise<void> {
  deps.store.delete(deviceKey(await endpointKey(endpoint)))
}

export async function status(deps: WatcherDeps, endpoint: string): Promise<WorkerStatus> {
  const now = deps.now()
  const device = deps.store.get<DeviceRecord>(deviceKey(await endpointKey(endpoint)))
  const m = meta(deps.store)
  const schedule = deps.store.get<Schedule>('schedule')
  const today = berlinDay(now)
  let favoritesToday = 0
  if (device) {
    const matches = new Map<string, ScheduledMatch>()
    for (const f of device.favorites) matches.set(matchKey(f), f)
    for (const s of schedule?.matches ?? []) if (device.competitions.includes(s.competition)) matches.set(matchKey(s), s)
    favoritesToday = [...matches.values()].filter((match) => berlinDay(Date.parse(match.start)) === today).length
  }
  return {
    registered: device !== undefined,
    lastTickAt: m.lastTickAt ?? null,
    scheduleReady: schedule !== undefined && schedule.ok && schedule.days[0] === today,
    favoritesToday,
    lastError: m.lastError ?? null,
  }
}

export async function health(deps: WatcherDeps) {
  const m = meta(deps.store)
  return { lastTickAt: m.lastTickAt ?? null, lastSuccessAt: m.lastSuccessAt ?? null, devices: devicesOf(deps.store).length, lastError: m.lastError ?? null }
}
