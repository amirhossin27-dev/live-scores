import type { DeviceRecord } from './subscriptions'
import type { ApiMatch } from './types'

export interface ScheduledMatch { competition: string; id: string; start: string }
export type MatchStatus = ApiMatch['status']

const minute = 60_000
export const leadTime = 3 * minute
export const maxDuration = 4 * 60 * minute
const over: MatchStatus[] = ['finished', 'postponed', 'canceled']

const dayFormat = (timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
const berlin = dayFormat('Europe/Berlin')
const utc = dayFormat('UTC')
// ESPN files a match under its US day: a night kick-off in Berlin (01:30) belongs to the previous day there.
const us = dayFormat('America/New_York')
const compact = (formatted: string) => formatted.replace(/-/g, '')

/** `YYYYMMDD` of the calendar day in Berlin, optionally some days later. */
export function berlinDay(now: number, offsetDays = 0): string {
  return compact(berlin.format(new Date(now + offsetDays * 24 * 60 * minute)))
}

/** The days the plan of the favourite competitions covers: today and tomorrow in Berlin. */
export function scheduleDays(now: number): string[] {
  return [berlinDay(now), berlinDay(now, 1)]
}

/** The days to ask the API for a match: the Berlin day of the kick-off and, where they differ, the UTC and the US day. */
export function apiDaysFor(start: string): string[] {
  const time = Date.parse(start)
  const days = [berlinDay(time), compact(utc.format(new Date(time))), compact(us.format(new Date(time)))]
  return [...new Set(days)]
}

/** Watched from 3 minutes before kick-off until full time (or postponement), at most 4 hours after kick-off. */
export function inWindow(start: string, status: MatchStatus | undefined, now: number): boolean {
  if (status && over.includes(status)) return false
  const kickOff = Date.parse(start)
  return now >= kickOff - leadTime && now <= kickOff + maxDuration
}

/**
 * The matches to poll now, keyed `competition|id`, with the devices that want them: single favourites and the
 * matches of favourite competitions from the plan. `statuses` holds the last known status of each match.
 */
export function watchedMatches(devices: DeviceRecord[], schedule: ScheduledMatch[], statuses: Map<string, MatchStatus>, now: number): Map<string, { match: ScheduledMatch; devices: string[] }> {
  const watched = new Map<string, { match: ScheduledMatch; devices: string[] }>()
  const add = (match: ScheduledMatch, device: string) => {
    const key = `${match.competition}|${match.id}`
    if (!inWindow(match.start, statuses.get(key), now)) return
    const entry = watched.get(key) ?? { match, devices: [] }
    if (!entry.devices.includes(device)) entry.devices.push(device)
    watched.set(key, entry)
  }
  for (const device of devices) {
    for (const favorite of device.favorites) add(favorite, device.key)
    for (const match of schedule) if (device.competitions.includes(match.competition)) add(match, device.key)
  }
  return watched
}
