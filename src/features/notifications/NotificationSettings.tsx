import { useEffect, useState } from 'react'
import type { Language } from '../../types/platform'
import { readViewOptions } from '../../runtime.mjs'
import { disablePush, enablePush, pushAvailability, pushEnabled, pushStatus, syncPush, type PushFavorite, type WorkerStatus } from './pushClient'
import './notifications.css'

const staleAfter = 5 * 60_000

const copy = {
  de: {
    legend: 'Mitteilungen',
    toggle: 'Mitteilungen bei Toren & Roten Karten',
    notInstalled: 'Zum Home-Bildschirm hinzufügen und die App von dort öffnen, dann hier einschalten.',
    unsupported: 'Dieses Gerät unterstützt keine Mitteilungen (iPhone: ab iOS 16.4).',
    denied: 'Mitteilungen sind blockiert. Erlauben unter Einstellungen → Mitteilungen → Live Scores.',
    checking: 'Wächter wird geprüft …',
    ok: (minutes: number, today: number) => `Wächter aktiv vor ${minutes} Min · dieses Gerät registriert · ${today} ${today === 1 ? 'Favoritenspiel' : 'Favoritenspiele'} heute`,
    stale: (minutes: number | null) => minutes === null ? 'Wächter noch nicht gelaufen' : `Wächter seit ${minutes} Min nicht gelaufen`,
    unregistered: 'Gerät nicht registriert – wird neu angemeldet',
    noPlan: 'Spielplan für heute fehlt',
    pushRefused: 'Letzte Mitteilung wurde vom Push-Dienst abgelehnt',
    unreachable: 'Wächter nicht erreichbar',
    failed: (message: string) => `Einschalten fehlgeschlagen: ${message}`,
  },
  en: {
    legend: 'Notifications',
    toggle: 'Notifications for goals & red cards',
    notInstalled: 'Add to the home screen and open the app from there, then switch on here.',
    unsupported: 'This device does not support notifications (iPhone: iOS 16.4 or later).',
    denied: 'Notifications are blocked. Allow them in Settings → Notifications → Live Scores.',
    checking: 'Checking the watcher …',
    ok: (minutes: number, today: number) => `Watcher active ${minutes} min ago · this device registered · ${today} favourite ${today === 1 ? 'match' : 'matches'} today`,
    stale: (minutes: number | null) => minutes === null ? 'Watcher has not run yet' : `Watcher has not run for ${minutes} min`,
    unregistered: 'Device not registered – registering again',
    noPlan: 'Today’s fixtures are missing',
    pushRefused: 'The push service refused the last notification',
    unreachable: 'Watcher not reachable',
    failed: (message: string) => `Could not switch on: ${message}`,
  },
}

type Copy = (typeof copy)['de']

/** The status line under the switch: green when the whole chain works, red with the reason otherwise. */
export function statusLine(status: WorkerStatus | null, now: number, t: Copy): { text: string; warning: boolean } {
  if (!status) return { text: t.unreachable, warning: true }
  if (!status.registered) return { text: t.unregistered, warning: true }
  const age = status.lastTickAt === null ? null : now - status.lastTickAt
  if (age === null || age > staleAfter) return { text: t.stale(age === null ? null : Math.floor(age / 60_000)), warning: true }
  if (!status.scheduleReady) return { text: t.noPlan, warning: true }
  if (status.lastPushFailed) return { text: t.pushRefused, warning: true }
  return { text: t.ok(Math.max(1, Math.round(age / 60_000)), status.favoritesToday), warning: false }
}

interface Props { language: Language; favorites: PushFavorite[]; competitions: string[] }

export function NotificationSettings({ language, favorites, competitions }: Props) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const [embedded] = useState(() => readViewOptions(window.location.href).embedded)
  const [availability, setAvailability] = useState(pushAvailability)
  const [on, setOn] = useState(() => pushEnabled() && availability === 'ready')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<WorkerStatus | null | undefined>(undefined)

  useEffect(() => {
    if (!on) { setStatus(undefined); return }
    let alive = true
    void pushStatus().then((next) => {
      if (!alive) return
      setStatus(next)
      // The worker lost this device (expired subscription, eviction): register again right away.
      if (next && !next.registered) void syncPush(favorites, competitions).catch(() => undefined)
    })
    return () => { alive = false }
    // Asked once per opening of the settings and after switching on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on])

  if (embedded || availability === 'no-config') return null

  async function change(next: boolean) {
    setBusy(true)
    setError(null)
    try {
      if (next) await enablePush(favorites, competitions)
      else await disablePush()
      setOn(next)
    } catch (failure) {
      setAvailability(pushAvailability())
      const message = failure instanceof Error ? failure.message : String(failure)
      if (message !== 'denied') setError(t.failed(message))
      setOn(false)
    } finally {
      setBusy(false)
    }
  }

  const hint = availability === 'not-installed' ? t.notInstalled : availability === 'unsupported' ? t.unsupported : availability === 'denied' ? t.denied : null
  const line = status === undefined ? { text: t.checking, warning: false } : statusLine(status, Date.now(), t)
  return (
    <fieldset className="sp-group sp-push">
      <legend>{t.legend}</legend>
      <label className={`sp-option sp-push-toggle${on ? ' is-on' : ''}`}>
        <input type="checkbox" role="switch" checked={on} disabled={busy || availability !== 'ready'} onChange={(event) => void change(event.target.checked)} />
        <span>{t.toggle}</span>
      </label>
      {hint && <p className="sp-hint">{hint}</p>}
      {on && <p className={`sp-push-status${line.warning ? ' is-warning' : ''}`} role="status">{line.text}</p>}
      {error && <p className="sp-push-status is-warning" role="alert">{error}</p>}
    </fieldset>
  )
}
