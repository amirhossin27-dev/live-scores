import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SideDrawer } from '../../components/SideDrawer'
import './sportsDetailPanel.css'
import type { Language } from '../../types/platform'
import { localeFor } from './overviewCopy'
import { FootballIcon } from './FootballIcon'
import { LineupPitch } from './LineupPitch'
import './matchStatistics.css'
import { PlayerProfile } from './PlayerProfile'
import { Broadcasts } from './Broadcasts'
import { CountryFlag } from './CountryFlag'
import { TeamProfile } from './TeamProfile'
import { StandingsBody } from './Standings'
import { SportsTabs } from './SportsTabs'
import { findMatch, loadNationalTeam } from './sportsApi'
import type { SportsCountry, SportsEvent, SportsLineup, SportsMatch, SportsMatchDetails, SportsMatchLink, SportsPlayer, SportsSide, SportsStat, SportsTeamRef } from './sportsApi'
import { competitionLabelOf, hasStandings } from './sportsCatalog'
import { OpenMatchContext } from './sportsMatchNav'
import type { MatchTarget } from './sportsMatchNav'
import { findPlayer } from './sportsPlayers'
import { useMatchDetails, useStandings } from './sportsHooks'
import { teamName } from './sportsNames'
import { standingsViews } from './sportsStandings'

const copy = {
  de: {
    close: 'Schließen',
    loading: 'Spieldaten werden geladen …',
    down: 'Die Spieldaten sind gerade nicht erreichbar.',
    retry: 'Erneut versuchen',
    stats: 'Statistik',
    moments: 'Spielverlauf',
    lineups: 'Aufstellung',
    noStats: 'Für dieses Spiel gibt es (noch) keine Statistik.',
    noMoments: 'Noch keine Tore, Karten oder Wechsel.',
    noLineups: 'Die Aufstellungen sind noch nicht bekannt.',
    bench: 'Ersatzbank',
    venue: 'Stadion',
    attendance: (count: string) => `${count} Zuschauer`,
    live: 'Live',
    ended: 'Ende',
    halftime: 'Halbzeit',
    scheduled: 'Anstoß',
    postponed: 'Verschoben',
    canceled: 'Abgesagt',
    assist: 'Vorlage',
    on: 'Eingewechselt',
    off: 'Ausgewechselt',
    profile: (name: string) => `Profil von ${name}`,
    goal: 'Tor',
    penalty: 'Elfmeter',
    ownGoal: 'Eigentor',
    yellow: 'Gelbe Karte',
    yellowRed: 'Gelb-Rote Karte',
    red: 'Rote Karte',
    substitution: 'Wechsel',
    halftimeBreak: 'Halbzeit',
    extraTimeBreak: 'Verlängerung',
    everyThirty: 'live alle 30 s',
    table: 'Tabelle',
    scorers: 'Top Scorers',
    bracket: 'Turnierbaum',
    stream: 'Stream',
    referee: 'Schiedsrichter',
    openTeam: (name: string) => `Verein: ${name}`,
    backToMatch: 'Zurück zum Spiel',
    back: 'Zurück',
    searching: 'Spiel wird gesucht …',
    notListed: 'Für dieses Spiel gibt es keine Spielinfo: der Wettbewerb ist nicht in den Live-Scores.',
    nationalLoading: 'Nationalmannschaft wird geladen …',
    nationalFailed: 'Die Nationalmannschaft konnte nicht geladen werden.',
  },
  en: {
    close: 'Close',
    loading: 'Loading match data …',
    down: 'The match data is not reachable right now.',
    retry: 'Try again',
    stats: 'Statistics',
    moments: 'Timeline',
    lineups: 'Line-Up',
    noStats: 'There are no statistics for this match (yet).',
    noMoments: 'No goals, cards or substitutions yet.',
    noLineups: 'The line-ups are not known yet.',
    bench: 'Bench',
    venue: 'Venue',
    attendance: (count: string) => `Attendance ${count}`,
    live: 'Live',
    ended: 'FT',
    halftime: 'HT',
    scheduled: 'Kick-off',
    postponed: 'Postponed',
    canceled: 'Canceled',
    assist: 'Assist',
    on: 'Subbed on',
    off: 'Subbed off',
    profile: (name: string) => `Profile of ${name}`,
    goal: 'Goal',
    penalty: 'Penalty',
    ownGoal: 'Own goal',
    yellow: 'Yellow card',
    yellowRed: 'Second yellow card',
    red: 'Red card',
    substitution: 'Substitution',
    halftimeBreak: 'Half-time',
    extraTimeBreak: 'Extra time',
    everyThirty: 'live every 30 s',
    table: 'Table',
    scorers: 'Top Scorers',
    bracket: 'Bracket',
    stream: 'Stream',
    referee: 'Referee',
    openTeam: (name: string) => `Team: ${name}`,
    backToMatch: 'Back to the match',
    back: 'Back',
    searching: 'Looking for the match …',
    notListed: 'There is no match info for this match: the competition is not in the live scores.',
    nationalLoading: 'Loading national team …',
    nationalFailed: 'The national team could not be loaded.',
  },
}

type Copy = (typeof copy)['de']

/** The football figures worth showing, in this order; ESPN's percentages of shots, passes and so on are rounded to one digit and left out. */
const footballStats: Record<string, { de: string; en: string; percent?: boolean }> = {
  possessionPct: { de: 'Ballbesitz', en: 'Possession', percent: true },
  totalShots: { de: 'Torschüsse', en: 'Shots' },
  shotsOnTarget: { de: 'Schüsse aufs Tor', en: 'Shots on target' },
  blockedShots: { de: 'Geblockte Schüsse', en: 'Blocked shots' },
  wonCorners: { de: 'Ecken', en: 'Corners' },
  saves: { de: 'Paraden', en: 'Saves' },
  offsides: { de: 'Abseits', en: 'Offsides' },
  foulsCommitted: { de: 'Fouls', en: 'Fouls' },
  yellowCards: { de: 'Gelbe Karten', en: 'Yellow cards' },
  redCards: { de: 'Rote Karten', en: 'Red cards' },
  totalPasses: { de: 'Pässe', en: 'Passes' },
  accuratePasses: { de: 'Angekommene Pässe', en: 'Accurate passes' },
  totalCrosses: { de: 'Flanken', en: 'Crosses' },
  totalLongBalls: { de: 'Lange Bälle', en: 'Long balls' },
  totalTackles: { de: 'Tacklings', en: 'Tackles' },
  interceptions: { de: 'Abgefangene Bälle', en: 'Interceptions' },
  totalClearance: { de: 'Klärungen', en: 'Clearances' },
}

const numberPattern = /^-?\d+(\.\d+)?$/

interface StatLine {
  key: string
  label: string
  home: string
  away: string
  /** Share of the home side for the bar, or null when the values are no plain numbers ("19/34", "30:40"). */
  share: number | null
}

function statLines(details: SportsMatchDetails, football: boolean, language: Language, locale: string): StatLine[] {
  const lang = language === 'de' ? 'de' : 'en'
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const byKey = new Map(details.stats.map((stat) => [stat.key, stat]))
  const chosen: { stat: SportsStat; label: string; percent: boolean }[] = football
    ? Object.entries(footballStats).flatMap(([key, meta]) => {
      const stat = byKey.get(key)
      return stat ? [{ stat, label: meta[lang], percent: meta.percent ?? false }] : []
    })
    : details.stats.map((stat) => ({ stat, label: stat.label, percent: false }))

  return chosen.map(({ stat, label, percent }) => {
    const numeric = numberPattern.test(stat.home) && numberPattern.test(stat.away)
    const home = Number(stat.home)
    const away = Number(stat.away)
    const show = (value: string, number: number) => (numeric ? `${format.format(number)}${percent ? ' %' : ''}` : value)
    return {
      key: stat.key,
      label,
      home: show(stat.home, home),
      away: show(stat.away, away),
      share: numeric && home >= 0 && away >= 0 ? (home + away === 0 ? 0.5 : home / (home + away)) : null,
    }
  })
}

function statusLabel(details: SportsMatchDetails, t: Copy, time: Intl.DateTimeFormat) {
  switch (details.status) {
    case 'live':
      return details.statusText === 'HT' ? t.halftime : details.statusText || t.live
    case 'finished':
      return details.statusText && details.statusText !== 'FT' ? details.statusText : t.ended
    case 'postponed':
      return t.postponed
    case 'canceled':
      return t.canceled
    default:
      return `${t.scheduled} ${time.format(new Date(details.start))}`
  }
}

function Crest({ side }: { side: SportsSide }) {
  return side.logo ? <img className="md-crest" src={side.logo} alt="" referrerPolicy="no-referrer" /> : <span className="md-crest is-empty" aria-hidden="true" />
}

function EventIcon({ event, t }: { event: SportsEvent; t: Copy }) {
  const label = { goal: t.goal, penalty: t.penalty, 'own-goal': t.ownGoal, yellow: t.yellow, 'yellow-red': t.yellowRed, red: t.red, substitution: t.substitution }[event.kind]
  if (event.kind === 'goal' || event.kind === 'penalty' || event.kind === 'own-goal') {
    return <span className={`md-icon is-${event.kind}`} role="img" aria-label={label} title={label}><FootballIcon size={18} variant={event.kind === 'own-goal' ? 'own-goal' : 'goal'} /></span>
  }
  if (event.kind === 'substitution') return <span className="md-icon is-substitution" role="img" aria-label={label} title={label}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 10a7 7 0 0 1 12-4l2 2m0-5v5h-5" stroke="var(--success)" /><path d="M19 14a7 7 0 0 1-12 4l-2-2m0 5v-5h5" stroke="#ef4444" /></svg></span>
  return <span className={`md-icon is-${event.kind}`} role="img" aria-label={label} title={label} />
}

/** "45'+2'" is 45, "67'" is 67: the minute without the added time. */
function minuteOf(minute: string) {
  const value = Number.parseInt(minute, 10)
  return Number.isNaN(value) ? null : value
}

/** 1 = first half (up to 45 + added time), 2 = second half (up to 90 + added time), 3 = extra time. */
function phaseOf(minute: string) {
  const value = minuteOf(minute)
  if (value === null) return null
  return value <= 45 ? 1 : value <= 90 ? 2 : 3
}

/** A name of the timeline: a button to the player profile when the line-ups (FotMob) know the player. */
function Person({ name, sides, lineups, t, onOpen }: { name: string | null; sides: ('home' | 'away')[]; lineups: SportsLineup[]; t: Copy; onOpen: (player: SportsPlayer) => void }) {
  if (!name) return <>–</>
  const player = findPlayer(lineups, sides, name)
  return player?.profileId
    ? <button type="button" className="md-person" title={t.profile(name)} onClick={() => onOpen(player)}>{name}</button>
    : <>{name}</>
}

interface MomentsProps {
  events: SportsEvent[]
  t: Copy
  details: SportsMatchDetails
  onOpenPlayer: (player: SportsPlayer) => void
}

/** Goals, cards and substitutions; a line "Half-time" (with the score at the break) parts the two halves, "Extra time" the extra time. */
function Moments({ events, t, details, onOpenPlayer }: MomentsProps) {
  if (events.length === 0) return <p className="md-empty">{t.noMoments}</p>
  const halftimeScore = details.homePeriods.length > 0 && details.awayPeriods.length > 0 ? `${details.homePeriods[0]}:${details.awayPeriods[0]}` : null
  // the break is there once the match has reached it: a moment after it, the half-time itself, the second half or the end
  const running = details.status === 'live' ? (details.statusText === 'HT' ? 2 : phaseOf(details.statusText) ?? 1) : details.status === 'finished' ? 2 : 1
  const items: ReactNode[] = []
  let phase = 1
  const breakLine = (next: number) => (
    <li key={`break-${next}`} className="md-break" aria-label={next === 2 ? t.halftimeBreak : t.extraTimeBreak}>
      <span>{next === 2 ? t.halftimeBreak : t.extraTimeBreak}{next === 2 && halftimeScore ? <b>{halftimeScore}</b> : null}</span>
    </li>
  )
  events.forEach((event, index) => {
    // the source writes changes at the break as 45': they belong after the half-time line
    const eventPhase = event.kind === 'substitution' && /^45'?$/.test(event.minute.trim()) ? 2 : phaseOf(event.minute) ?? phase
    while (phase < eventPhase) {
      phase += 1
      items.push(breakLine(phase))
    }
    // an own goal is written to the side that profits from it: the scorer is in the other line-up
    const sides: ('home' | 'away')[] = event.kind === 'own-goal' ? [event.side === 'home' ? 'away' : 'home', event.side] : [event.side]
    const person = (name: string | null) => <Person name={name} sides={sides} lineups={details.lineups} t={t} onOpen={onOpenPlayer} />
    // a substitution in one line: the player coming on, then the one going off
    const who = event.kind === 'substitution' ? (
      <span className="md-who is-sub">
        <strong className="md-sub-on" title={t.on}>{person(event.player)}</strong>
        {event.other && <span className="md-sub-off" title={t.off}>{person(event.other)}</span>}
      </span>
    ) : (
      <span className="md-who">
        <strong>{person(event.player)}</strong>
        {(event.kind === 'goal' || event.kind === 'penalty') && event.other && <small className="md-assist" title={t.assist}>({person(event.other)})</small>}
      </span>
    )
    items.push(
      <li key={`${event.minute}-${event.kind}-${index}`} className={`md-moment is-${event.side}`}>
        <span className="md-minute">{event.minute}</span>
        <EventIcon event={event} t={t} />
        {who}
      </li>,
    )
  })
  if (phase === 1 && running >= 2) items.push(breakLine(2))
  return <ol className="md-moments">{items}</ol>
}

/** Referee (with his nationality) and stadium (with the flag of its country) at the top of the timeline. */
function MatchFacts({ details, t, language }: { details: SportsMatchDetails; t: Copy; language: Language }) {
  const place = [details.venue, details.city].filter(Boolean).join(', ')
  if (!details.referee && !place) return null
  return (
    <dl className="md-facts">
      {details.referee && (
        <div>
          <dt>{t.referee}</dt>
          <dd>{details.referee.name}<CountryFlag country={details.referee.country ?? null} language={language} /></dd>
        </div>
      )}
      {place && (
        <div>
          <dt>{t.venue}</dt>
          <dd>{place}<CountryFlag country={details.venueCountry ?? null} language={language} /></dd>
        </div>
      )}
    </dl>
  )
}

type Tab = 'stats' | 'moments' | 'lineups' | 'table' | 'scorers' | 'bracket' | 'stream'

interface MatchViewProps {
  competition: string
  competitionLabel: string
  match: SportsMatch
  language: Language
  /** Shown as "back" when the match was opened from a table, a team page or a profile. */
  onBack?: () => void
  backLabel?: string
}

/** Statistics, timeline, line-ups, table and streams of one match: the content of the match panel, also as a layer of another panel. */
export function MatchView({ competition, competitionLabel, match, language, onBack, backLabel }: MatchViewProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const locale = localeFor(language)
  const { details, failed, loading, retry } = useMatchDetails(competition, match.id)
  // The table and the tree of the competition, with the two teams and the tie of this match marked.
  const { standings } = useStandings(hasStandings(competition) ? competition : null, match.id)
  const football = competition.startsWith('soccer/')
  const [chosenTab, setChosenTab] = useState<Tab | null>(null)
  const [player, setPlayer] = useState<SportsPlayer | null>(null)
  const [team, setTeam] = useState<SportsTeamRef | null>(null)
  const nationalRequest = useRef<AbortController | null>(null)
  const [nationalStatus, setNationalStatus] = useState<{ country: SportsCountry; failed: boolean } | null>(null)
  useEffect(() => () => nationalRequest.current?.abort(), [])
  const cancelNationalRequest = () => {
    nationalRequest.current?.abort()
    nationalRequest.current = null
    setNationalStatus(null)
  }
  const openPlayer = (next: SportsPlayer) => {
    cancelNationalRequest()
    setPlayer(next)
  }
  const openTeam = (id: string) => {
    cancelNationalRequest()
    setPlayer(null)
    setTeam({ id })
  }
  const openCountry = async (country: SportsCountry) => {
    nationalRequest.current?.abort()
    const controller = new AbortController()
    nationalRequest.current = controller
    setNationalStatus({ country, failed: false })
    try {
      const national = await loadNationalTeam(country, controller.signal)
      if (!controller.signal.aborted) openTeam(national.id)
    } catch {
      if (!controller.signal.aborted) setNationalStatus({ country, failed: true })
    }
  }
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [locale])

  // Until the details are there, the line of the scoreboard fills the head of the panel.
  const home = details?.home ?? match.home
  const away = details?.away ?? match.away
  const homeName = home ? teamName(home.name, language) : ''
  const awayName = away ? teamName(away.name, language) : ''
  const lines = details ? statLines(details, football, language, locale) : []
  // Football opens on the timeline; the other sports only have statistics. After them the table (football: and the top scorers) and the tree, once loaded.
  const standingsTabs = standingsViews(standings).map((view) => ({ id: view as Tab, label: t[view] }))
  const tabs: { id: Tab; label: string }[] = [
    ...(football
      ? [{ id: 'moments' as const, label: t.moments }, { id: 'stats' as const, label: t.stats }, { id: 'lineups' as const, label: t.lineups }]
      : [{ id: 'stats' as const, label: t.stats }]),
    ...standingsTabs,
    // where the match is shown on TV or as a stream
    { id: 'stream' as const, label: t.stream },
  ]
  const tab = tabs.find((item) => item.id === chosenTab)?.id ?? tabs[0].id

  let body: ReactNode
  if (tab === 'stream') {
    body = <Broadcasts competition={competition} matchId={match.id} language={language} />
  } else if ((tab === 'table' || tab === 'scorers' || tab === 'bracket') && standings) {
    body = <StandingsBody standings={standings} view={tab} language={language} focus onOpenTeam={football ? openTeam : undefined} />
  } else if (!details) {
    body = loading
      ? <p className="md-empty" aria-live="polite">{t.loading}</p>
      : <div className="md-empty" aria-live="polite"><span>{t.down}</span> <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></div>
  } else if (tab === 'stats') {
    body = lines.length === 0 ? <p className="md-empty">{t.noStats}</p> : (
      <ul className="md-stats md-stats-compact" aria-label={t.stats}>
        {lines.map((line) => (
          <li key={line.key} className={`md-stat${line.key === 'possessionPct' || line.key === 'totalShots' || line.key === 'shotsOnTarget' ? ' is-key-stat' : ''}`}>
            <b className={line.share !== null && line.share > 0.5 ? 'is-leading' : undefined}>{line.home}</b>
            <span>{line.label}</span>
            <b className={line.share !== null && line.share < 0.5 ? 'is-leading' : undefined}>{line.away}</b>
            {line.share !== null && (
              <span className="md-bar" aria-hidden="true">
                <i className={line.share >= 0.5 ? 'is-ahead' : ''} style={{ width: `${line.share * 100}%` }} />
                <i className={line.share <= 0.5 ? 'is-ahead' : ''} style={{ width: `${(1 - line.share) * 100}%` }} />
              </span>
            )}
          </li>
        ))}
      </ul>
    )
  } else if (tab === 'moments') {
    body = <><MatchFacts details={details} t={t} language={language} /><Moments events={details.events} t={t} details={details} onOpenPlayer={openPlayer} /></>
  } else {
    body = <>
      {nationalStatus && <p className="sp-notice" role="status">{nationalStatus.failed ? t.nationalFailed : t.nationalLoading}{nationalStatus.failed && <> <button type="button" className="sp-text-button" onClick={() => void openCountry(nationalStatus.country)}>{t.retry}</button></>}</p>}
      <LineupPitch lineups={details.lineups} events={details.events} homeName={homeName} awayName={awayName} language={language} locale={locale} onOpenPlayer={openPlayer} onOpenCountry={openCountry} />
    </>
  }

  const scored = (details?.status ?? match.status) === 'live' || (details?.status ?? match.status) === 'finished'
  // Football names the stadium at the top of the timeline (with the referee); the other sports at the bottom.
  const place = details && !football ? [details.venue, details.city].filter(Boolean).join(', ') : ''
  // The crests and names open the team page (football, when FotMob has the match).
  const teamButton = (side: 'home' | 'away', content: ReactNode, name: string) => {
    const id = side === 'home' ? details?.homeTeamId : details?.awayTeamId
    return football && id
      ? <button type="button" className="md-side md-team-link" title={t.openTeam(name)} onClick={() => openTeam(id)}>{content}</button>
      : <span className="md-side">{content}</span>
  }

  if (team) return <TeamProfile team={team} language={language} locale={locale} backLabel={t.backToMatch} onBack={() => setTeam(null)} />
  if (player?.profileId) {
    return (
      <PlayerProfile
        id={player.profileId}
        name={player.name}
        language={language}
        locale={locale}
        backLabel={t.backToMatch}
        onBack={() => setPlayer(null)}
        onOpenTeam={openTeam}
      />
    )
  }

  return (
    <>
      {onBack && <button type="button" className="sp-text-button pp-back" onClick={onBack}>‹ {backLabel ?? t.back}</button>}
      <div className={`md-head is-${details?.status ?? match.status}`}>
        {teamButton('home', <>{home && <Crest side={home} />}<strong>{homeName}</strong></>, homeName)}
        <span className="md-result">
          <b>{scored ? `${home?.score ?? '–'} : ${away?.score ?? '–'}` : '– : –'}</b>
          <small>{details ? statusLabel(details, t, time) : ''}</small>
        </span>
        {teamButton('away', <>{away && <Crest side={away} />}<strong>{awayName}</strong></>, awayName)}
      </div>

      <SportsTabs tabs={tabs} active={tab} label={competitionLabel} onSelect={(id) => { cancelNationalRequest(); setChosenTab(id) }}>
        {body}
      </SportsTabs>

      {failed && details && <p className="sp-notice">{t.down}</p>}
      {(place || !!details?.attendance || details?.status === 'live') && <p className="sp-foot md-foot">
        {[place ? `${t.venue}: ${place}` : null, details?.attendance ? t.attendance(new Intl.NumberFormat(locale).format(details.attendance)) : null, details?.status === 'live' ? t.everyThirty : null].filter(Boolean).join(' · ')}
      </p>}
    </>
  )
}

interface MatchLayersProps {
  language: Language
  children: ReactNode
  /** Puts the layers into the panel; `top` is the match on top (null while it is searched), `depth` the number of layers. */
  frame: (content: ReactNode, top: { link: SportsMatchLink | null; depth: number }) => ReactNode
}

interface MatchLayer {
  key: number
  target: MatchTarget
  link: SportsMatchLink | null
  state: 'loading' | 'ready' | 'missing' | 'down'
  /** Where the panel was scrolled to below this layer, for the way back. */
  scroll: number
}

/**
 * The matches opened inside a side panel, as layers over its content: each one is found in ESPN's scores and shown as a match
 * view with "back". The layers below stay mounted (only hidden), so the table, the team page or the profile come back as they
 * were, scrolled to where they were. `frame` puts the content and the layers into the panel; it gets the match on top.
 */
export function MatchLayers({ language, children, frame }: MatchLayersProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const [layers, setLayers] = useState<MatchLayer[]>([])
  const hostRef = useRef<HTMLDivElement>(null)
  const nextKey = useRef(0)
  const controllers = useRef<AbortController[]>([])

  useEffect(() => {
    const running = controllers.current
    return () => running.forEach((controller) => controller.abort())
  }, [])

  const scroller = () => hostRef.current?.closest<HTMLElement>('.side-drawer-body') ?? null
  const scrollTo = (top: number) => window.requestAnimationFrame(() => {
    const element = scroller()
    if (element) element.scrollTop = top
  })

  function resolve(key: number, target: MatchTarget) {
    const controller = new AbortController()
    controllers.current.push(controller)
    const update = (patch: Partial<MatchLayer>) => setLayers((items) => items.map((layer) => (layer.key === key ? { ...layer, ...patch } : layer)))
    findMatch(target.fotmob, controller.signal)
      .then((link) => update({ link, state: 'ready' }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) update({ state: (error as { status?: number }).status === 404 ? 'missing' : 'down' })
      })
  }

  function open(target: MatchTarget) {
    const key = nextKey.current
    nextKey.current += 1
    setLayers((items) => [...items, { key, target, link: null, state: 'loading', scroll: scroller()?.scrollTop ?? 0 }])
    resolve(key, target)
    scrollTo(0)
  }

  function close(index: number) {
    const scroll = layers[index]?.scroll ?? 0
    setLayers((items) => items.slice(0, index))
    scrollTo(scroll)
  }

  function retry(layer: MatchLayer) {
    setLayers((items) => items.map((item) => (item.key === layer.key ? { ...item, state: 'loading' } : item)))
    resolve(layer.key, layer.target)
  }

  function layerBody(layer: MatchLayer, index: number) {
    if (layer.link) {
      return <MatchView competition={layer.link.competition} competitionLabel={competitionLabelOf(layer.link.competition, language)} match={layer.link.match} language={language} onBack={() => close(index)} backLabel={layer.target.back} />
    }
    return (
      <>
        <button type="button" className="sp-text-button pp-back" onClick={() => close(index)}>‹ {layer.target.back}</button>
        {layer.state === 'loading' && <p className="md-empty" aria-live="polite">{t.searching}</p>}
        {layer.state === 'missing' && <p className="md-empty" aria-live="polite">{t.notListed}</p>}
        {layer.state === 'down' && <div className="md-empty" aria-live="polite"><span>{t.down}</span> <button type="button" className="sp-text-button" onClick={() => retry(layer)}>{t.retry}</button></div>}
      </>
    )
  }

  const content = (
    <OpenMatchContext.Provider value={open}>
      <div ref={hostRef} className="md-layers">
        <div hidden={layers.length > 0}>{children}</div>
        {layers.map((layer, index) => (
          <div key={layer.key} hidden={index < layers.length - 1}>{layerBody(layer, index)}</div>
        ))}
      </div>
    </OpenMatchContext.Provider>
  )

  return frame(content, { link: layers.length > 0 ? layers[layers.length - 1].link : null, depth: layers.length })
}

interface MatchDetailsProps {
  competition: string
  competitionLabel: string
  match: SportsMatch
  language: Language
  onClose: () => void
}

/** The match panel, opened from a line of the live scores; matches opened inside it (form, team page, profile) lie over it. */
export function MatchDetails({ competition, competitionLabel, match, language, onClose }: MatchDetailsProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  return (
    <MatchLayers
      language={language}
      frame={(content, top) => {
        // the title follows the match on top
        const shown = top.depth > 0 ? top.link?.match ?? null : match
        const title = shown?.home && shown.away ? `${teamName(shown.home.name, language)} – ${teamName(shown.away.name, language)}` : competitionLabel
        const subtitle = top.depth > 0 ? (top.link ? competitionLabelOf(top.link.competition, language) : undefined) : competitionLabel
        return <SideDrawer className="sports-detail-drawer" title={title} subtitle={subtitle} closeLabel={t.close} onClose={onClose}>{content}</SideDrawer>
      }}
    >
      <MatchView competition={competition} competitionLabel={competitionLabel} match={match} language={language} />
    </MatchLayers>
  )
}
