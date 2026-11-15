import { useMemo, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import './sports.css'
import { DatePicker } from '../../components/DatePicker'
import type { Language } from '../../types/platform'
import { Flag } from './Flag'
import { MatchDetails } from './MatchDetails'
import { localeFor } from './overviewCopy'
import { CompetitionPanel } from './CompetitionPanel'
import { SportsSearch } from './SportsSearch'
import type { SportsMatch, SportsSide } from './sportsApi'
import { competitionById, competitionCountry, competitionName, groupLabels, hasStandings, maxCompetitions, presetSelection, sportsCatalog, sportsGroups } from './sportsCatalog'
import type { SportsCompetition } from './sportsCatalog'
import { useSportsScores } from './sportsHooks'
import { teamName } from './sportsNames'
import { favoriteKey, readFavoriteCompetitions, readSportsFavorites, saveFavoriteCompetitions, saveSportsFavorites, readSportsSelection, saveSportsSelection } from './sportsPrefs'
import type { SportsFavorite } from './sportsPrefs'

const copy = {
  de: {
    eyebrow: 'Sport',
    title: 'Live-Ergebnisse',
    live: 'Live',
    all: 'Alle',
    settings: 'Wettbewerbe auswählen',
    previous: 'Vorheriger Tag',
    next: 'Nächster Tag',
    today: 'Heute',
    backToday: 'Zurück zu heute',
    yesterday: 'Gestern',
    tomorrow: 'Morgen',
    loading: 'Ergebnisse werden geladen …',
    retry: 'Erneut versuchen',
    refresh: 'Aktualisieren',
    refreshing: 'Wird aktualisiert …',
    saved: (stamp: string) => `Gespeicherte Ergebnisse vom ${stamp}.`,
    offlineSaved: (stamp: string) => `Offline · gespeicherte Ergebnisse vom ${stamp}.`,
    offlineEmpty: 'Du bist offline. Für diesen Spieltag sind keine Ergebnisse gespeichert.',
    slow: 'Der Abruf dauert länger. Bereits gespeicherte Ergebnisse erscheinen beim nächsten Öffnen sofort.',
    down: 'Die Ergebnisse sind gerade nicht erreichbar.',
    stale: 'Aktualisierung fehlgeschlagen – zuletzt geladene Ergebnisse.',
    partial: (count: number) => `${count} ${count === 1 ? 'Wettbewerb konnte' : 'Wettbewerbe konnten'} nicht aktualisiert werden.`,
    noSelection: 'Keine Wettbewerbe ausgewählt.',
    noMatches: 'An diesem Tag keine Spiele in deinen Wettbewerben.',
    skipped: 'Heute keine Spiele – der nächste Tag mit Spielen wird gezeigt.',
    noLive: 'Gerade läuft nichts live.',
    pick: 'Wettbewerbe auswählen',
    updated: (time: string) => `Stand ${time}`,
    everyThirty: 'live alle 30 s',
    winner: 'Sieg',
    postponed: 'Verschoben',
    canceled: 'Abgesagt',
    halftime: 'Pause',
    ended: 'Ende',
    extraTime: 'n. V.',
    penalties: 'n. E.',
    settingsIntro: (count: number) => `Wähle die Wettbewerbe, deren Ergebnisse du sehen willst (${count} von ${maxCompetitions}). Die Auswahl gilt nur für diesen Browser.`,
    boxing: 'Boxen ist nicht dabei: Dafür gibt es keine frei verfügbare Datenquelle.',
    reset: 'Standard',
    done: 'Fertig',
    order: 'Reihenfolge',
    orderHint: 'Ziehe die Wettbewerbe an die gewünschte Stelle oder nutze die Pfeile. Die Reihenfolge bleibt in diesem Browser gespeichert.',
    moveUp: (name: string) => `${name} nach oben`,
    moveDown: (name: string) => `${name} nach unten`,
    moved: (name: string, place: number, count: number) => `${name} steht jetzt an Stelle ${place} von ${count}.`,
    choose: 'Wettbewerbe',
    group: 'Spielplan',
    details: (home: string, away: string) => `Statistik ${home} gegen ${away}`,
    favorites: 'Favoriten',
    addFavorite: (name: string) => `${name} als Favorit merken`,
    removeFavorite: (name: string) => `${name} aus den Favoriten nehmen`,
    noFavorites: 'An diesem Tag spielt keiner deiner Favoriten.',
    addFavoriteLeague: (name: string) => `${name} als Favorit merken (alle Spiele)`,
    removeFavoriteLeague: (name: string) => `${name} aus den Favoriten nehmen`,
    red: (count: number) => (count === 1 ? 'Rote Karte' : `${count} Rote Karten`),
    yellowRed: (count: number) => (count === 1 ? 'Gelb-Rote Karte' : `${count} Gelb-Rote Karten`),
    openTable: (name: string) => `Tabelle: ${name}`,
    openBracket: (name: string) => `Turnierbaum: ${name}`,
    openTeam: (name: string) => `Verein: ${name}`,
    pickDay: 'Tag im Kalender wählen',
    close: 'Schließen',
  },
  en: {
    eyebrow: 'Sport',
    title: 'Live Scores',
    live: 'Live',
    all: 'All',
    settings: 'Choose competitions',
    previous: 'Previous day',
    next: 'Next day',
    today: 'Today',
    backToday: 'Back to today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    loading: 'Loading scores …',
    retry: 'Try again',
    refresh: 'Refresh',
    refreshing: 'Updating …',
    saved: (stamp: string) => `Saved results from ${stamp}.`,
    offlineSaved: (stamp: string) => `Offline · saved results from ${stamp}.`,
    offlineEmpty: 'You are offline. No results are saved for this matchday.',
    slow: 'This request is taking longer. Saved results will appear immediately on your next visit.',
    down: 'The scores are not reachable right now.',
    stale: 'Refresh failed – showing the scores loaded last.',
    partial: (count: number) => `Could not refresh ${count} ${count === 1 ? 'competition' : 'competitions'}.`,
    noSelection: 'No competitions selected.',
    noMatches: 'No matches on this day in your competitions.',
    skipped: 'No matches today – showing the next day with matches.',
    noLive: 'Nothing is live right now.',
    pick: 'Choose competitions',
    updated: (time: string) => `Updated ${time}`,
    everyThirty: 'live every 30 s',
    winner: 'Winner',
    postponed: 'Postponed',
    canceled: 'Canceled',
    halftime: 'HT',
    ended: 'FT',
    extraTime: 'AET',
    penalties: 'Pens',
    settingsIntro: (count: number) => `Choose the competitions whose scores you want to see (${count} of ${maxCompetitions}). The choice only applies to this browser.`,
    boxing: 'Boxing is not included: there is no freely available data source for it.',
    reset: 'Default',
    done: 'Done',
    order: 'Order',
    orderHint: 'Drag the competitions to the place you want or use the arrows. The order is kept in this browser.',
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    moved: (name: string, place: number, count: number) => `${name} is now at place ${place} of ${count}.`,
    choose: 'Competitions',
    group: 'Schedule',
    details: (home: string, away: string) => `Statistics ${home} vs ${away}`,
    favorites: 'Favourites',
    addFavorite: (name: string) => `Add ${name} to the favourites`,
    removeFavorite: (name: string) => `Remove ${name} from the favourites`,
    noFavorites: 'None of your favourites plays on this day.',
    addFavoriteLeague: (name: string) => `Add ${name} to the favourites (all matches)`,
    removeFavoriteLeague: (name: string) => `Remove ${name} from the favourites`,
    red: (count: number) => (count === 1 ? 'Red card' : `${count} red cards`),
    yellowRed: (count: number) => (count === 1 ? 'Second yellow card' : `${count} second yellow cards`),
    openTable: (name: string) => `Table: ${name}`,
    openBracket: (name: string) => `Bracket: ${name}`,
    openTeam: (name: string) => `Team: ${name}`,
    pickDay: 'Pick a day in the calendar',
    close: 'Close',
  },
}

type Copy = (typeof copy)['de']

// The arrows and the calendar reach a year back and ahead; a day without matches is skipped up to a week ahead.
const maxOffset = 365
const autoSkipDays = 7

const teamSports = ['soccer', 'basketball', 'football', 'hockey', 'baseball']

function isTeamSport(competition: string) {
  return teamSports.includes(competition.split('/')[0])
}

function isoDay(day: Date) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

/** Whole days from `from` to the calendar day `iso` (YYYY-MM-DD), by the local calendar (summer time does not shift it). */
function daysUntil(from: Date, iso: string) {
  const [year, month, date] = iso.split('-').map(Number)
  return Math.round((Date.UTC(year, month - 1, date) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000)
}

function dayCode(day: Date) {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}${month}${date}`
}

function whenLabel(match: SportsMatch, time: Intl.DateTimeFormat, t: Copy) {
  switch (match.status) {
    case 'live':
      return match.statusText === 'HT' ? t.halftime : match.statusText || t.live
    case 'finished':
      return match.statusText === 'AET' ? t.extraTime : match.statusText === 'FT-Pens' ? t.penalties : match.statusText && match.statusText !== 'FT' ? match.statusText : t.ended
    case 'postponed':
      return t.postponed
    case 'canceled':
      return t.canceled
    default:
      return time.format(new Date(match.start))
  }
}

function Logo({ side }: { side: SportsSide }) {
  return side.logo ? <img className="sp-logo" src={side.logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="sp-logo is-empty" aria-hidden="true" />
}

function Star({ on, name, t, onToggle, league = false }: { on: boolean; name: string; t: Copy; onToggle: () => void; league?: boolean }) {
  const label = league ? (on ? t.removeFavoriteLeague(name) : t.addFavoriteLeague(name)) : on ? t.removeFavorite(name) : t.addFavorite(name)
  return (
    <button type="button" className={`sp-star${on ? ' is-on' : ''}`} aria-pressed={on} aria-label={label} title={label} onClick={onToggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1 6L12 17l-5.35 2.85 1-6L3.3 9.6l6-.9z" /></svg>
    </button>
  )
}

/** Sending-offs of a football team next to its name: a red card, or a yellow and red one for a second yellow. */
function SendOffs({ side, t }: { side: SportsSide; t: Copy }) {
  const red = side.redCards ?? 0
  const yellowRed = side.yellowRedCards ?? 0
  if (red + yellowRed === 0) return null
  const label = [yellowRed > 0 ? t.yellowRed(yellowRed) : null, red > 0 ? t.red(red) : null].filter(Boolean).join(', ')
  const cards = [...Array.from({ length: Math.min(yellowRed, 3) }, () => 'is-yellow-red'), ...Array.from({ length: Math.min(red, 3) }, () => 'is-red')]
  return (
    <span className="sp-cards" role="img" aria-label={label} title={label}>
      {cards.map((kind, index) => <i key={index} className={`sp-card ${kind}`} />)}
    </span>
  )
}

interface MatchRowProps {
  match: SportsMatch
  time: Intl.DateTimeFormat
  t: Copy
  language: Language
  favorite: boolean
  onToggleFavorite: () => void
  /** Opens the match (football on its timeline); the whole line is the button, team names included. */
  onOpen?: () => void
  /** In the favourites group: the competition, shown under the line. */
  context?: string
}

function MatchRow({ match, time, t, language, favorite, onToggleFavorite, onOpen, context }: MatchRowProps) {
  const when = whenLabel(match, time, t)
  const status = `sp-match is-${match.status}${favorite ? ' is-favorite' : ''}`

  // A race weekend has no second side: the Grand Prix, the session that is running, and the winner once it is over.
  if (!match.away) {
    const sub = [context, match.detail, match.home ? `${t.winner}: ${teamName(match.home.name, language)}` : null].filter(Boolean).join(' · ')
    const name = match.title ?? match.home?.name ?? ''
    return (
      <li className={`${status} is-single`}>
        <span className="sp-when">{when}</span>
        <span className="sp-single">
          <strong>{name}</strong>
          {sub && <small>{sub}</small>}
        </span>
        <Star on={favorite} name={name} t={t} onToggle={onToggleFavorite} />
      </li>
    )
  }

  const { home } = match
  const away = match.away
  if (!home) return null
  const note = [context, match.title, match.detail].filter(Boolean).join(' · ')
  // The source sends 0 : 0 for a match that has not started: only running and finished matches show a score.
  const scored = (match.status === 'live' || match.status === 'finished') && (home.score !== null || away.score !== null)
  return (
    <li className={`${status}${onOpen ? ' is-clickable' : ''}`}>
      {onOpen && <button type="button" className="sp-open" aria-label={t.details(teamName(home.name, language), teamName(away.name, language))} onClick={onOpen} />}
      <span className="sp-when">{when}</span>
      <span className={`sp-team is-home${home.winner ? ' is-winner' : ''}`}>
        <SendOffs side={home} t={t} />
        <span className="sp-name">{teamName(home.name, language)}</span>
        <Logo side={home} />
      </span>
      <span className="sp-score">
        {scored ? <><b>{home.score ?? '–'}</b><i>:</i><b>{away.score ?? '–'}</b></> : <span className="sp-versus">vs</span>}
      </span>
      <span className={`sp-team is-away${away.winner ? ' is-winner' : ''}`}>
        <Logo side={away} />
        <span className="sp-name">{teamName(away.name, language)}</span>
        <SendOffs side={away} t={t} />
      </span>
      <Star on={favorite} name={`${teamName(home.name, language)} – ${teamName(away.name, language)}`} t={t} onToggle={onToggleFavorite} />
      {note && <small className="sp-note">{note}</small>}
    </li>
  )
}

interface OrderProps {
  language: Language
  selection: string[]
  t: Copy
  onMove: (id: string, to: number) => void
}

/** The chosen competitions in the order of the live scores: drag a line to its place, or move it with the arrows. */
function CompetitionOrder({ language, selection, t, onMove }: OrderProps) {
  const [drag, setDrag] = useState<{ id: string; overId: string | null; after: boolean } | null>(null)
  const [note, setNote] = useState('')
  const chosen = selection.map((id) => competitionById(id)).filter((item): item is SportsCompetition => item !== undefined)
  if (chosen.length < 2) return null
  const label = (competition: SportsCompetition) => `${competitionCountry(competition, language)} · ${competitionName(competition, language)}`

  function move(competition: SportsCompetition, to: number) {
    onMove(competition.id, to)
    setNote(t.moved(label(competition), Math.max(0, Math.min(chosen.length - 1, to)) + 1, chosen.length))
  }

  function dragOver(event: DragEvent<HTMLLIElement>, id: string) {
    if (!drag || drag.id === id) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const after = event.clientY > rect.top + rect.height / 2
    if (drag.overId !== id || drag.after !== after) setDrag({ ...drag, overId: id, after })
  }

  function drop() {
    if (drag?.overId && drag.overId !== drag.id) {
      const from = selection.indexOf(drag.id)
      const over = selection.indexOf(drag.overId)
      const competition = competitionById(drag.id)
      if (from >= 0 && over >= 0 && competition) {
        const insertAt = over + (drag.after ? 1 : 0)
        move(competition, insertAt > from ? insertAt - 1 : insertAt)
      }
    }
    setDrag(null)
  }

  return (
    <fieldset className="sp-group sp-order-group">
      <legend>{t.order}</legend>
      <p className="sp-hint">{t.orderHint}</p>
      <ol className="sp-order" onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrag((current) => (current ? { ...current, overId: null } : current))
      }}>
        {chosen.map((competition, index) => {
          const dropClass = drag?.overId === competition.id ? (drag.after ? ' drop-after' : ' drop-before') : ''
          return (
            <li
              key={competition.id}
              className={`sp-order-row${drag?.id === competition.id ? ' is-dragging' : ''}${dropClass}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                // Firefox only starts a drag when some data is set.
                event.dataTransfer.setData('text/plain', competition.id)
                setDrag({ id: competition.id, overId: null, after: false })
              }}
              onDragOver={(event) => dragOver(event, competition.id)}
              onDrop={(event) => {
                event.preventDefault()
                drop()
              }}
              onDragEnd={() => setDrag(null)}
            >
              <span className="sp-grip" aria-hidden="true">⋮⋮</span>
              <span className="sp-order-place">{index + 1}</span>
              <Flag code={competition.flag} />
              <span className="sp-order-name" title={label(competition)}>{label(competition)}</span>
              <button type="button" className="sp-order-move" disabled={index === 0} aria-label={t.moveUp(label(competition))} title={t.moveUp(label(competition))} onClick={() => move(competition, index - 1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
              </button>
              <button type="button" className="sp-order-move" disabled={index === chosen.length - 1} aria-label={t.moveDown(label(competition))} title={t.moveDown(label(competition))} onClick={() => move(competition, index + 1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="sp-sr" aria-live="polite">{note}</p>
    </fieldset>
  )
}

interface SettingsProps {
  language: Language
  selection: string[]
  t: Copy
  onToggle: (id: string) => void
  onMove: (id: string, to: number) => void
  onReset: () => void
  onClose: () => void
}

function SportsSettings({ language, selection, t, onToggle, onMove, onReset, onClose }: SettingsProps) {
  const lang = language === 'de' ? 'de' : 'en'
  return (
    <div className="sp-settings">
      <div className="sp-settings-exit"><button type="button" className="sp-text-button is-primary" onClick={onClose}>{t.done}</button></div>
      <p className="sp-intro">{t.settingsIntro(selection.length)}</p>
      <CompetitionOrder language={language} selection={selection} t={t} onMove={onMove} />
      {sportsGroups.map((group) => (
        <fieldset key={group} className="sp-group">
          <legend>{groupLabels[group][lang]}</legend>
          <div className="sp-options">
            {sportsCatalog.filter((competition) => competition.group === group).map((competition) => {
              const checked = selection.includes(competition.id)
              const label = `${competitionCountry(competition, language)} · ${competitionName(competition, language)}`
              return (
                <label key={competition.id} className={`sp-option${checked ? ' is-on' : ''}`} title={label}>
                  <input type="checkbox" checked={checked} disabled={!checked && selection.length >= maxCompetitions} onChange={() => onToggle(competition.id)} />
                  <Flag code={competition.flag} />
                  <span>{label}</span>
                </label>
              )
            })}
          </div>
          {group === 'fighting' && <p className="sp-hint">{t.boxing}</p>}
        </fieldset>
      ))}
      <div className="sp-settings-foot">
        <button type="button" className="sp-text-button" onClick={onReset}>{t.reset}</button>
      </div>
    </div>
  )
}

/** Live scores of the competitions the user picked (preset: the Flashscore leagues, cups, European and national tournaments, Formula 1, UFC). */
export function SportsWidget({ language, now }: { language: Language; now: Date }) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const locale = localeFor(language)
  const [selection, setSelection] = useState(readSportsSelection)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'live' | 'favorites'>('all')
  const [favorites, setFavorites] = useState<SportsFavorite[]>(() => readSportsFavorites(now.getTime()))
  const [favoriteLeagues, setFavoriteLeagues] = useState<string[]>(readFavoriteCompetitions)
  const [offset, setOffset] = useState(0)
  // Until the user picks a day, a day without matches is skipped: the next day with matches is shown.
  const [auto, setAuto] = useState(true)
  const [opened, setOpened] = useState<{ competition: string; label: string; match: SportsMatch } | null>(null)
  const [standingsOf, setStandingsOf] = useState<SportsCompetition | null>(null)

  const day = useMemo(() => {
    const result = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return { code: dayCode(result), date: result }
  }, [now, offset])
  // The scores do not depend on the order of the competitions: moving one must not start a new request.
  const requestedKey = [...selection].sort().join('|')
  const requested = useMemo(() => (requestedKey ? requestedKey.split('|') : []), [requestedKey])
  const { scores, updatedAt, failed, loading, retry, cached, refreshing, offline, slow } = useSportsScores(requested, day.code)

  const time = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale])
  const dayFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }), [locale])
  const savedTime = useMemo(() => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), [locale])
  const dayName = offset === 0 ? t.today : offset === -1 ? t.yesterday : offset === 1 ? t.tomorrow : null

  const sections = useMemo(() => {
    const received = new Map((scores?.competitions ?? []).map((competition) => [competition.id, competition]))
    // in the order the user set (a new choice comes last)
    return selection
      .map((id) => competitionById(id))
      .filter((competition): competition is SportsCompetition => competition !== undefined)
      .map((competition) => ({ competition, matches: received.get(competition.id)?.matches ?? [] }))
      .filter((section) => section.matches.length > 0)
  }, [scores, selection])
  if (auto && scores && !cached && !refreshing && !offline && !failed && scores.failed.length === 0 && sections.length === 0 && offset < autoSkipDays) setOffset(offset + 1)
  const liveCount = sections.reduce((sum, section) => sum + section.matches.filter((match) => match.status === 'live').length, 0)
  const favoriteKeys = useMemo(() => new Set(favorites.map((item) => favoriteKey(item.competition, item.id))), [favorites])
  const isFavorite = (competitionId: string, match: SportsMatch) => favoriteKeys.has(favoriteKey(competitionId, match.id))
  // Behind the star: the favourite competitions with all their matches, and the single favourite matches of the other
  // competitions as one group, in the order of the kick-off.
  const leagueSections = sections.filter((section) => favoriteLeagues.includes(section.competition.id))
  const favoriteMatches = sections
    .filter((section) => !favoriteLeagues.includes(section.competition.id))
    .flatMap(({ competition, matches }) => matches.filter((match) => isFavorite(competition.id, match)).map((match) => ({ competition, match })))
    .sort((left, right) => left.match.start.localeCompare(right.match.start))
  const favoriteCount = favoriteMatches.length + leagueSections.reduce((sum, section) => sum + section.matches.length, 0)
  const shown = filter === 'live'
    ? sections.map((section) => ({ ...section, matches: section.matches.filter((match) => match.status === 'live') })).filter((section) => section.matches.length > 0)
    : filter === 'favorites' ? leagueSections : sections

  function toggleFavorite(competitionId: string, match: SportsMatch) {
    const key = favoriteKey(competitionId, match.id)
    const next = favoriteKeys.has(key)
      ? favorites.filter((item) => favoriteKey(item.competition, item.id) !== key)
      : [...favorites, { competition: competitionId, id: match.id, start: match.start }]
    setFavorites(next)
    saveSportsFavorites(next)
  }

  function toggleFavoriteLeague(id: string) {
    const next = favoriteLeagues.includes(id) ? favoriteLeagues.filter((item) => item !== id) : [...favoriteLeagues, id]
    setFavoriteLeagues(next)
    saveFavoriteCompetitions(next)
  }

  const label = (competition: (typeof sections)[number]['competition']) => `${competitionCountry(competition, language)} · ${competitionName(competition, language)}`
  function row(competition: (typeof sections)[number]['competition'], match: SportsMatch, inFavorites: boolean) {
    return (
      <MatchRow
        key={`${inFavorites ? 'fav' : competition.id}-${match.id}`}
        match={match}
        time={time}
        t={t}
        language={language}
        favorite={isFavorite(competition.id, match)}
        onToggleFavorite={() => toggleFavorite(competition.id, match)}
        context={inFavorites ? label(competition) : undefined}
        // Team sports have statistics; a race weekend or a fight card has none at the source.
        onOpen={match.away && isTeamSport(competition.id) ? () => setOpened({ competition: competition.id, label: label(competition), match }) : undefined}
      />
    )
  }

  function change(next: string[]) {
    setSelection(next)
    saveSportsSelection(next)
  }

  function toggle(id: string) {
    change(selection.includes(id) ? selection.filter((item) => item !== id) : [...selection, id])
  }

  function move(id: string, to: number) {
    const from = selection.indexOf(id)
    const target = Math.max(0, Math.min(selection.length - 1, to))
    if (from < 0 || from === target) return
    const next = selection.filter((item) => item !== id)
    next.splice(target, 0, id)
    change(next)
  }

  let body: ReactNode
  if (selection.length === 0) {
    body = <div className="sp-state"><span>{t.noSelection}</span><button type="button" className="sp-text-button" onClick={() => setSettingsOpen(true)}>{t.pick}</button></div>
  } else if (loading) {
    body = <div className="sp-state" aria-live="polite"><span>{t.loading}</span>{slow && <small className="sp-slow">{t.slow}</small>}</div>
  } else if (offline && !scores) {
    body = <div className="sp-state" aria-live="polite"><span>{t.offlineEmpty}</span></div>
  } else if (!scores || sections.length === 0 && scores.failed.length > 0) {
    body = <div className="sp-state" aria-live="polite"><span>{t.down}</span><button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></div>
  } else if (filter === 'favorites' && favoriteCount === 0) {
    body = <div className="sp-state" aria-live="polite"><span>{t.noFavorites}</span></div>
  } else if (filter !== 'favorites' && shown.length === 0) {
    body = <div className="sp-state" aria-live="polite"><span>{filter === 'live' ? t.noLive : t.noMatches}</span></div>
  } else {
    body = (
      <div className="sp-list">
        {filter === 'favorites' && favoriteMatches.length > 0 && (
          <section className="sp-comp is-favorites" aria-label={t.favorites}>
            <h3 className="sp-comp-title">
              <span className="sp-star is-on is-title" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1 6L12 17l-5.35 2.85 1-6L3.3 9.6l6-.9z" /></svg></span>
              <b>{t.favorites}</b>
              <span className="sp-count">{favoriteMatches.length}</span>
            </h3>
            <ul className="sp-matches">
              {favoriteMatches.map(({ competition, match }) => row(competition, match, true))}
            </ul>
          </section>
        )}
        {shown.map(({ competition, matches }) => {
          const title = (
            <>
              <Flag code={competition.flag} />
              <span className="sp-comp-country">{competitionCountry(competition, language)}</span>
              <b>{competitionName(competition, language)}</b>
              <span className="sp-count">{matches.length}</span>
            </>
          )
          // A click on the competition opens its table (a cup: its tree); fight cards and friendlies have neither.
          const open = (competition.group === 'cups' ? t.openBracket : t.openTable)(label(competition))
          // the star of the title marks the whole competition
          const leagueStar = <Star league on={favoriteLeagues.includes(competition.id)} name={label(competition)} t={t} onToggle={() => toggleFavoriteLeague(competition.id)} />
          return (
            <section key={competition.id} className="sp-comp" aria-label={`${competitionCountry(competition, language)} ${competitionName(competition, language)}`}>
              {hasStandings(competition.id) ? (
                <h3 className="sp-comp-title is-button">
                  <button type="button" className="sp-comp-open" aria-label={open} title={open} onClick={() => setStandingsOf(competition)}>
                    {title}
                    <svg className="sp-comp-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                  {leagueStar}
                </h3>
              ) : (
                <h3 className="sp-comp-title">{title}{leagueStar}</h3>
              )}
              <ul className="sp-matches">
                {matches.map((match) => row(competition, match, false))}
              </ul>
            </section>
          )
        })}
      </div>
    )
  }

  return (
    <article className={`panel start-sports${cached || offline ? ' is-snapshot' : ''}`} aria-label={`${t.eyebrow} · ${t.title}`}>
      <div className="panel-header">
        <div>
          <p className="eyebrow sp-eyebrow">
            <span className={`sp-dot${liveCount > 0 && !cached && !offline && !failed ? ' is-live' : ''}`} aria-hidden="true" />{t.eyebrow}
          </p>
          <h2>{t.title}</h2>
        </div>
        <div className="sp-panel-actions">
        <button type="button" className="sp-icon-button" aria-label={t.refresh} title={refreshing ? t.refreshing : t.refresh} disabled={refreshing || offline || selection.length === 0} onClick={retry}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></svg>
        </button>
        <button type="button" className={`sp-icon-button${settingsOpen ? ' active' : ''}`} aria-expanded={settingsOpen} title={t.settings} aria-label={t.settings} onClick={() => setSettingsOpen((open) => !open)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
        </button>
        </div>
      </div>

      {settingsOpen ? (
        <SportsSettings language={language} selection={selection} t={t} onToggle={toggle} onMove={move} onReset={() => change(presetSelection)} onClose={() => setSettingsOpen(false)} />
      ) : (
        <>
          <div className="sp-toolbar">
            <div className="sp-days" role="group" aria-label={t.group}>
              <button type="button" className="sp-step" disabled={offset <= -maxOffset} aria-label={t.previous} onClick={() => { setAuto(false); setOffset((value) => value - 1) }}>‹</button>
              <DatePicker
                className="sp-day"
                label={t.pickDay}
                language={language}
                value={isoDay(day.date)}
                min={isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - maxOffset))}
                max={isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + maxOffset))}
                showIcon={false}
                onChange={(iso) => {
                  if (!iso) return
                  setAuto(false)
                  setOffset(Math.max(-maxOffset, Math.min(maxOffset, daysUntil(now, iso))))
                }}
              >
                {dayName && <strong>{dayName}</strong>}
                <small>{dayFormat.format(day.date)}</small>
              </DatePicker>
              <button type="button" className="sp-step" disabled={offset >= maxOffset} aria-label={t.next} onClick={() => { setAuto(false); setOffset((value) => value + 1) }}>›</button>
            </div>
            {offset !== 0 && <button type="button" className="sp-today" aria-label={t.backToday} onClick={() => { setAuto(false); setOffset(0) }}>{t.today}</button>}
            <SportsSearch language={language} />
            <div className="sp-filter" role="group" aria-label={t.title}>
              <button type="button" className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t.all}</button>
              <button type="button" className={filter === 'live' ? 'active is-live' : ''} aria-pressed={filter === 'live'} onClick={() => setFilter('live')}>{t.live} <b>{liveCount}</b></button>
              <button type="button" className={filter === 'favorites' ? 'active is-favorites' : ''} aria-pressed={filter === 'favorites'} aria-label={t.favorites} title={t.favorites} onClick={() => setFilter('favorites')}><span aria-hidden="true">★</span> {t.favorites} <b>{favoriteCount}</b></button>
            </div>
          </div>
          {auto && offset > 0 && shown.length > 0 && <p className="sp-notice is-info" aria-live="polite">{t.skipped}</p>}
          {scores && updatedAt !== null && (cached || offline) && <p className="sp-notice is-info" aria-live="polite">{offline ? t.offlineSaved(savedTime.format(new Date(updatedAt))) : t.saved(savedTime.format(new Date(updatedAt)))}{refreshing && !offline && <> {t.refreshing}</>}</p>}
          {scores && !cached && !offline && <p className="sp-refresh-status" role="status">{refreshing ? t.refreshing : '\u00a0'}</p>}
          {failed && scores && <p className="sp-notice" aria-live="polite">{t.stale} <button type="button" className="sp-text-button" disabled={refreshing || offline} onClick={retry}>{t.retry}</button></p>}
          {scores && scores.failed.length > 0 && <p className="sp-notice">{t.partial(scores.failed.length)}</p>}
          {body}
          {(updatedAt !== null || liveCount > 0) && <p className="sp-foot">
            {[updatedAt !== null ? t.updated(time.format(new Date(updatedAt))) : null, liveCount > 0 && !cached && !offline && !failed ? t.everyThirty : null].filter(Boolean).join(' · ')}
          </p>}
        </>
      )}
      {opened && <MatchDetails competition={opened.competition} competitionLabel={opened.label} match={opened.match} language={language} onClose={() => setOpened(null)} />}
      {standingsOf && <CompetitionPanel competition={standingsOf} language={language} onClose={() => setStandingsOf(null)} />}
    </article>
  )
}
