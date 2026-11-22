import type { CSSProperties } from 'react'
import type { Language } from '../../types/platform'
import { FootballIcon } from './FootballIcon'
import { CountryFlag } from './CountryFlag'
import { countryName, rectangularFlagUrl } from './sportsCountries'
import './sportsLineup.css'
import type { SportsCountry, SportsEvent, SportsLineup, SportsPlayer } from './sportsApi'
import { Rating } from './sportsRating'
import { isCoachDismissal, plain } from './sportsPlayers'

const copy = {
  de: {
    bench: 'Ersatzbank',
    benches: 'Ersatzbänke im Vergleich',
    pitch: 'Spielfeld',
    nationality: 'Nationalität',
    coach: 'Trainer',
    captain: 'Kapitän',
    subOut: (minute: number) => `ausgewechselt ${minute}.`,
    subIn: (minute: number) => `eingewechselt ${minute}.`,
    profile: (name: string) => `Profil von ${name}`,
    noLineups: 'Die Aufstellungen sind noch nicht bekannt.',
    noRatings: 'Für dieses Spiel sind keine Noten oder Spielerprofile verfügbar. Die Positionen stammen aus der Formation.',
    rating: 'Note',
    goals: (count: number) => (count === 1 ? 'Tor' : `${count} Tore`),
    yellow: 'Gelbe Karte',
    yellowRed: 'Gelb-Rote Karte',
    red: 'Rote Karte',
    nationalTeam: (name: string) => `Nationalmannschaft von ${name} öffnen`,
  },
  en: {
    bench: 'Bench',
    benches: 'Benches compared',
    pitch: 'Pitch',
    nationality: 'Nationality',
    coach: 'Coach',
    captain: 'Captain',
    subOut: (minute: number) => `subbed off ${minute}'`,
    subIn: (minute: number) => `subbed on ${minute}'`,
    profile: (name: string) => `Profile of ${name}`,
    noLineups: 'The line-ups are not known yet.',
    noRatings: 'Ratings and player profiles are not available for this match. Positions are based on the formation.',
    rating: 'Rating',
    goals: (count: number) => (count === 1 ? 'Goal' : `${count} goals`),
    yellow: 'Yellow card',
    yellowRed: 'Second yellow card',
    red: 'Red card',
    nationalTeam: (name: string) => `Open ${name} national team`,
  },
}

type Copy = (typeof copy)['de']

interface Marks {
  goals: number
  yellow: boolean
  yellowRed: boolean
  red: boolean
}

function marksFor(events: SportsEvent[]) {
  const marks = new Map<string, Marks>()
  for (const event of events) {
    if (!event.player || event.kind === 'substitution' || event.kind === 'own-goal') continue
    const key = `${event.side}|${plain(event.player)}`
    const mark = marks.get(key) ?? { goals: 0, yellow: false, yellowRed: false, red: false }
    if (event.kind === 'goal' || event.kind === 'penalty') mark.goals += 1
    if (event.kind === 'yellow') mark.yellow = true
    if (event.kind === 'yellow-red') mark.yellowRed = true
    if (event.kind === 'red') mark.red = true
    marks.set(key, mark)
  }
  return marks
}

/** "Marvin Schwäbe" -> "Schwäbe", "Said El Mala" -> "El Mala": the name a shirt would carry. */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  const particles = new Set(['de', 'da', 'van', 'von', 'der', 'den', 'di', 'del', 'el', 'al', 'le', 'la', 'dos', 'du', 'ter'])
  let first = parts.length - 1
  while (first > 1 && particles.has(parts[first - 1].toLowerCase())) first -= 1
  return parts.slice(first).join(' ')
}

interface PlayerProps {
  player: SportsPlayer
  side: 'home' | 'away'
  marks: Marks | undefined
  t: Copy
  locale: string
  language: Language
  onOpen: (player: SportsPlayer) => void
  onOpenCountry?: (country: SportsCountry) => void
}

function LineupFlag({ country, language, t, className, onOpen }: { country: SportsCountry | null; language: Language; t: Copy; className: string; onOpen?: (country: SportsCountry) => void }) {
  const label = country ? t.nationalTeam(countryName(country, language)) : ''
  return <span className={className}>{rectangularFlagUrl(country) && country?.code && onOpen
    ? <button type="button" className="lp-country-link" aria-label={label} title={label} onClick={() => onOpen(country)}><CountryFlag country={country} language={language} rectangular /></button>
    : <CountryFlag country={country} language={language} rectangular />}</span>
}

// A source may repeat a dismissal as both red and yellow-red. Keep its explicit second-yellow meaning.
function cardFor(marks: Marks | undefined) {
  return marks?.yellowRed ? 'yellow-red' : marks?.red ? 'red' : marks?.yellow ? 'yellow' : null
}

function cardLabel(card: ReturnType<typeof cardFor>, t: Copy) {
  return card === 'yellow-red' ? t.yellowRed : card === 'red' ? t.red : card === 'yellow' ? t.yellow : null
}

function PlayerMarks({ marks, t }: { marks: Marks | undefined; t: Copy }) {
  const card = cardFor(marks)
  return (
    <span className="lp-events">
      {card && <span className={`lp-card${card === 'red' ? ' is-red' : card === 'yellow-red' ? ' is-yellow-red' : ''}`} role="img" aria-label={cardLabel(card, t)!} title={cardLabel(card, t)!} />}
      {marks && marks.goals > 0 && (
        <span className="lp-goals" role="img" aria-label={t.goals(marks.goals)} title={t.goals(marks.goals)}>
          <FootballIcon size={9} />
          {marks.goals > 1 && <small aria-hidden="true">{marks.goals}</small>}
        </span>
      )}
    </span>
  )
}

function PitchPlayer({ player, side, marks, t, locale, language, onOpen, onOpenCountry }: PlayerProps) {
  // Home always attacks down from the upper half; rotate the away side around the centre of the pitch.
  const x = player.x ?? 0.5
  const y = player.y ?? 0.5
  const top = side === 'home' ? y * 50 : 100 - y * 50
  const style = {
    left: `clamp(var(--lp-player-edge, 38px), ${(side === 'home' ? x : 1 - x) * 100}%, calc(100% - var(--lp-player-edge, 38px)))`,
    // Every player has the same fixed info row, including empty flag, event and rating slots.
    top: `clamp(38px, ${top}%, calc(100% - 24px))`,
  } as CSSProperties
  const details = [
    player.captain ? t.captain : null,
    player.rating !== null ? `${t.rating} ${player.rating}` : null,
    marks?.goals ? t.goals(marks.goals) : null,
    cardLabel(cardFor(marks), t),
    player.subOut !== null ? t.subOut(player.subOut) : null,
    player.country ? `${t.nationality}: ${countryName(player.country, language)}` : null,
  ].filter(Boolean).join(', ')
  const name = shortName(player.name)
  // Long names (with the substitution minute) get a smaller size so they stay on one line next to their neighbours.
  const long = name.length + (player.subOut !== null ? 4 : 0) >= 11
  const content = (
    <>
      <span className="lp-shirt">
        {player.jersey ?? ''}
        {player.captain && <span className="lp-captain" aria-hidden="true">C</span>}
      </span>
      <span className={`lp-name${long ? ' is-long' : ''}`}>
        <span className="lp-name-text">{name}</span>
        {player.subOut !== null && <i className="lp-off" aria-hidden="true">↓{player.subOut}′</i>}
      </span>
    </>
  )
  const label = details ? `${player.name} (${player.jersey ?? '–'}), ${details}` : `${player.name} (${player.jersey ?? '–'})`
  return (
    <span className={`lp-player is-${side}`} style={style}>
      {player.profileId
        ? <button type="button" className="lp-player-open" aria-label={`${label} – ${t.profile(player.name)}`} title={t.profile(player.name)} onClick={() => onOpen(player)}>{content}</button>
        : <span className="lp-player-open" role="img" aria-label={label}>{content}</span>}
      <span className="lp-status">
        <LineupFlag className="lp-country-slot" country={player.country ?? null} language={language} t={t} onOpen={onOpenCountry} />
        <span className="lp-rating-slot"><Rating value={player.rating} locale={locale} className="lp-rating" /></span>
        <PlayerMarks marks={marks} t={t} />
      </span>
    </span>
  )
}

function CoachRow({ name, profileId, card, t, onOpen }: {
  name: string | null; profileId?: string | null; card?: SportsEvent; t: Copy; onOpen: PlayerProps['onOpen']
}) {
  const kind = card?.kind === 'yellow-red' ? 'yellow-red' : 'red'
  const label = cardLabel(kind, t)!
  return <p className="lp-coach">
    {t.coach}{name && ': '}{name && profileId
      ? <button type="button" className="lp-coach-link" title={t.profile(name)} onClick={() => onOpen({ name, profileId, jersey: null, position: null, x: null, y: null, rating: null, subIn: null, subOut: null, captain: false })}>{name}</button>
      : name}
    {card && <span className="lp-events"><span className={`lp-card is-${kind}`} role="img" aria-label={label} title={`${label} ${card.minute}`.trim()} /></span>}
  </p>
}

function BenchList({ lineup, team, coachCards, marks, t, locale, language, onOpen, onOpenCountry }: { lineup: SportsLineup | undefined; team: string; coachCards: SportsEvent[]; marks: Map<string, Marks>; t: Copy; locale: string; language: Language; onOpen: (player: SportsPlayer) => void; onOpenCountry?: (country: SportsCountry) => void }) {
  const coach = lineup?.coach
  const listedCoach = (card: SportsEvent) => !!coach && (!card.player || plain(card.player) === plain(coach))
  return (
    <section className="lp-bench">
      <h4>{team}</h4>
      {coach && <CoachRow name={coach} profileId={lineup?.coachId} card={coachCards.find(listedCoach)} t={t} onOpen={onOpen} />}
      {coachCards.filter((card) => !listedCoach(card)).map((card) =>
        <CoachRow key={`${card.minute}-${card.player}`} name={card.player} card={card} t={t} onOpen={onOpen} />)}
      {lineup && lineup.bench.length > 0 && (
        <>
          <h5>{t.bench}</h5>
          <ul>
            {lineup.bench.map((player) => {
              const identity = <><span className="lp-bench-name">{player.name}</span><PlayerMarks marks={marks.get(`${lineup.side}|${plain(player.name)}`)} t={t} /></>
              const row = (
                <>
                  <span className="md-jersey">{player.jersey ?? ''}</span>
                  <LineupFlag className="lp-bench-flag" country={player.country ?? null} language={language} t={t} onOpen={onOpenCountry} />
                  {player.profileId
                    ? <button type="button" className="lp-bench-identity" title={t.profile(player.name)} onClick={() => onOpen(player)}>{identity}</button>
                    : <span className="lp-bench-identity">{identity}</span>}
                  <span className="lp-bench-sub">{player.subIn !== null && <small className="lp-on" title={t.subIn(player.subIn)}>↑{player.subIn}′</small>}</span>
                  <span className="lp-bench-rating"><Rating value={player.rating} locale={locale} /></span>
                </>
              )
              return (
                <li key={`${player.jersey}-${player.name}`}>
                  <span className="lp-bench-row">{row}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

interface LineupPitchProps {
  lineups: SportsLineup[]
  events: SportsEvent[]
  homeName: string
  awayName: string
  language: Language
  locale: string
  onOpenPlayer: (player: SportsPlayer) => void
  onOpenCountry?: (country: SportsCountry) => void
}

/** Both line-ups on one pitch (home above, away below), followed by the opposing benches. */
export function LineupPitch({ lineups, events, homeName, awayName, language, locale, onOpenPlayer, onOpenCountry }: LineupPitchProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const home = lineups.find((lineup) => lineup.side === 'home')
  const away = lineups.find((lineup) => lineup.side === 'away')
  const coachCards = events.filter((event) => isCoachDismissal(event, lineups))
  if (!home && !away && coachCards.length === 0) return <p className="md-empty">{t.noLineups}</p>
  const marks = marksFor(events.filter((event) => !event.isCoach && !coachCards.includes(event)))
  const markOf = (side: 'home' | 'away', player: SportsPlayer) => marks.get(`${side}|${plain(player.name)}`)

  return (
    <div className="lp">
      {home || away ? <>
      <div className="lp-teams"><span className="lp-team is-home" title={homeName}><span>{homeName}</span>{home?.formation && <b>{home.formation}</b>}</span><span className="lp-team is-away" title={awayName}><span>{awayName}</span>{away?.formation && <b>{away.formation}</b>}</span></div>
      <div className="lp-pitch-viewport" role="region" aria-label={t.pitch} tabIndex={0}>
       <div className="lp-pitch">
        <svg className="lp-lines" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1" y="1" width="66" height="103" />
          <line x1="1" y1="52.5" x2="67" y2="52.5" />
          <circle cx="34" cy="52.5" r="9.15" />
          <rect x="13.85" y="1" width="40.3" height="16.5" />
          <rect x="24.85" y="1" width="18.3" height="5.5" />
          <rect x="13.85" y="87.5" width="40.3" height="16.5" />
          <rect x="24.85" y="98.5" width="18.3" height="5.5" />
        </svg>
        {home?.starters.map((player) => <PitchPlayer key={`h-${player.jersey}-${player.name}`} player={player} side="home" marks={markOf('home', player)} t={t} locale={locale} language={language} onOpen={onOpenPlayer} onOpenCountry={onOpenCountry} />)}
        {away?.starters.map((player) => <PitchPlayer key={`a-${player.jersey}-${player.name}`} player={player} side="away" marks={markOf('away', player)} t={t} locale={locale} language={language} onOpen={onOpenPlayer} onOpenCountry={onOpenCountry} />)}
       </div>
      </div>
      </> : <p className="md-empty">{t.noLineups}</p>}
      {(home?.source === 'espn' || away?.source === 'espn') && <p className="lp-hint">{t.noRatings}</p>}
      <div className="lp-bench-compare" role="region" aria-label={t.benches} tabIndex={0}>
        <div className="lp-benches">
          <BenchList lineup={home} team={homeName} coachCards={coachCards.filter((card) => card.side === 'home')} marks={marks} t={t} locale={locale} language={language} onOpen={onOpenPlayer} onOpenCountry={onOpenCountry} />
          <BenchList lineup={away} team={awayName} coachCards={coachCards.filter((card) => card.side === 'away')} marks={marks} t={t} locale={locale} language={language} onOpen={onOpenPlayer} onOpenCountry={onOpenCountry} />
        </div>
      </div>
    </div>
  )
}
