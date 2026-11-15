import { DetailBack, DetailBoundary, useDetailNavigation } from '../../components/DetailNavigation'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import './sportsTeam.css'
import type { Language } from '../../types/platform'
import { CountryFlag } from './CountryFlag'
import { PlayerProfile } from './PlayerProfile'
import type { SportsSquadGroup, SportsTeamFixture, SportsTeamProfile, SportsTeamRef, SportsTeamSide, SportsTeamTransfer } from './sportsApi'
import { useTeam, useTeamNews } from './sportsHooks'
import { useOpenMatch } from './sportsMatchNav'
import { Rating } from './sportsRating'
import { teamName } from './sportsNames'

const copy = {
  de: {
    back: 'Zurück',
    backToTeam: 'Zurück zum Verein',
    profile: (name: string) => `Profil von ${name}`,
    fromWord: 'von',
    toWord: 'zu',
    loading: 'Vereinsdaten werden geladen …',
    down: 'Die Vereinsdaten sind gerade nicht erreichbar.',
    notFound: 'Dieser Verein wurde bei der Datenquelle nicht gefunden.',
    retry: 'Erneut versuchen',
    matches: 'Spiele',
    titles: 'Titel',
    news: 'News',
    transfers: 'Transfers',
    squad: 'Kader',
    last: 'Letzte Spiele',
    next: 'Nächste Spiele',
    moreLast: 'Frühere Spiele anzeigen',
    moreNext: 'Weitere Spiele anzeigen',
    noLast: 'In dieser Saison noch kein Spiel.',
    noNext: 'Keine weiteren Spiele angesetzt.',
    home: 'H',
    away: 'A',
    homeLong: 'Heimspiel',
    awayLong: 'Auswärtsspiel',
    live: 'Live',
    postponed: 'Verschoben',
    canceled: 'Abgesagt',
    win: 'Sieg',
    draw: 'Unentschieden',
    loss: 'Niederlage',
    openTeam: (name: string) => `Verein: ${name}`,
    openMatch: (teams: string) => `Spielinfo: ${teams}`,
    noTitles: 'Keine Titel bekannt.',
    times: (count: number) => `${count}×`,
    runnerUp: (count: number, seasons: string) => `${count}× Zweiter: ${seasons}`,
    noNews: 'Gerade keine Nachrichten zu diesem Verein.',
    newsLoading: 'Nachrichten werden geladen …',
    newsDown: 'Die Nachrichten sind gerade nicht erreichbar.',
    arrivals: 'Zugänge',
    departures: 'Abgänge',
    extensions: 'Vertragsverlängerungen',
    noTransfers: 'Keine Transfers bekannt.',
    from: (club: string) => `von ${club}`,
    to: (club: string) => `zu ${club}`,
    until: (date: string) => `bis ${date}`,
    free: 'ablösefrei',
    loan: 'Leihe',
    loanFee: (fee: string) => `Leihe · ${fee}`,
    undisclosed: 'Ablöse unbekannt',
    extension: 'Verlängert',
    unknown: '–',
    sum: (sum: string) => `Summe der Ablösen: ${sum}`,
    groups: { coach: 'Trainer', keepers: 'Torhüter', defenders: 'Abwehr', midfielders: 'Mittelfeld', attackers: 'Angriff' },
    number: 'Nr.',
    player: 'Spieler',
    age: 'Alter',
    rating: 'Note',
    value: 'Marktwert',
    injured: 'Verletzt',
    noSquad: 'Kein Kader bekannt.',
    stadium: 'Stadion',
    coach: 'Trainer',
    seats: (count: string) => `${count} Plätze`,
    season: (season: string) => `Saison ${season}`,
  },
  en: {
    back: 'Back',
    backToTeam: 'Back to the team',
    profile: (name: string) => `Profile of ${name}`,
    fromWord: 'from',
    toWord: 'to',
    loading: 'Loading team data …',
    down: 'The team data is not reachable right now.',
    notFound: 'This team was not found at the data source.',
    retry: 'Try again',
    matches: 'Matches',
    titles: 'Titles',
    news: 'News',
    transfers: 'Transfers',
    squad: 'Squad',
    last: 'Last matches',
    next: 'Next matches',
    moreLast: 'Show earlier matches',
    moreNext: 'Show more matches',
    noLast: 'No match this season yet.',
    noNext: 'No further matches scheduled.',
    home: 'H',
    away: 'A',
    homeLong: 'Home match',
    awayLong: 'Away match',
    live: 'Live',
    postponed: 'Postponed',
    canceled: 'Canceled',
    win: 'Win',
    draw: 'Draw',
    loss: 'Loss',
    openTeam: (name: string) => `Team: ${name}`,
    openMatch: (teams: string) => `Match info: ${teams}`,
    noTitles: 'No titles known.',
    times: (count: number) => `${count}×`,
    runnerUp: (count: number, seasons: string) => `${count}× runner-up: ${seasons}`,
    noNews: 'No news about this team right now.',
    newsLoading: 'Loading news …',
    newsDown: 'The news are not reachable right now.',
    arrivals: 'Arrivals',
    departures: 'Departures',
    extensions: 'Contract extensions',
    noTransfers: 'No transfers known.',
    from: (club: string) => `from ${club}`,
    to: (club: string) => `to ${club}`,
    until: (date: string) => `until ${date}`,
    free: 'free transfer',
    loan: 'Loan',
    loanFee: (fee: string) => `Loan · ${fee}`,
    undisclosed: 'Fee undisclosed',
    extension: 'Extended',
    unknown: '–',
    sum: (sum: string) => `Total fees: ${sum}`,
    groups: { coach: 'Coach', keepers: 'Keepers', defenders: 'Defenders', midfielders: 'Midfielders', attackers: 'Attackers' },
    number: 'No.',
    player: 'Player',
    age: 'Age',
    rating: 'Rating',
    value: 'Market value',
    injured: 'Injured',
    noSquad: 'No squad known.',
    stadium: 'Stadium',
    coach: 'Coach',
    seats: (count: string) => `${count} seats`,
    season: (season: string) => `Season ${season}`,
  },
}

type Copy = (typeof copy)['de']
type Tab = 'matches' | 'titles' | 'news' | 'transfers' | 'squad'

const pageSize = 5

function Crest({ side }: { side: { logo: string | null } }) {
  return side.logo ? <img className="tp-crest" src={side.logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="tp-crest is-empty" aria-hidden="true" />
}

interface FixtureRowProps {
  fixture: SportsTeamFixture
  teamId: string
  t: Copy
  language: Language
  date: Intl.DateTimeFormat
  weekday: Intl.DateTimeFormat
  time: Intl.DateTimeFormat
  onOpenTeam: (id: string) => void
  /** A click anywhere on the row opens the match info; the opponent is then plain text (its page opens from the match). */
  onOpenMatch?: () => void
}

function FixtureRow({ fixture, teamId, t, language, date, weekday, time, onOpenTeam, onOpenMatch }: FixtureRowProps) {
  const home = fixture.home.id === teamId
  const opponent: SportsTeamSide = home ? fixture.away : fixture.home
  const name = teamName(opponent.name, language)
  // FotMob's team page is not live: a running match shows "Live" without its (old) score and minute.
  const played = fixture.status === 'finished'
  const result = fixture.result ? { win: t.win, draw: t.draw, loss: t.loss }[fixture.result] : undefined
  const state = fixture.status === 'live' ? t.live : fixture.status === 'postponed' ? t.postponed : fixture.status === 'canceled' ? t.canceled : null
  const outcome = played ? (
    <span className={`pp-result tp-score${fixture.result ? ` is-${fixture.result}` : ''}`} title={result}>
      {fixture.home.score ?? '–'}:{fixture.away.score ?? '–'}
    </span>
  ) : state ? (
    <span className={`tp-state is-${fixture.status}`}>{state}</span>
  ) : (
    <span className="tp-vs">–:–</span>
  )
  const teams = `${teamName(fixture.home.name, language)} – ${teamName(fixture.away.name, language)}`
  return (
    <li className={`tp-fixture is-${fixture.status}${onOpenMatch ? ' is-link' : ''}`} onClick={onOpenMatch}>
      <span className="tp-date">
        {date.format(new Date(fixture.start))}
        <small>{[weekday.format(new Date(fixture.start)), fixture.status === 'scheduled' ? time.format(new Date(fixture.start)) : null].filter(Boolean).join(' · ')}</small>
      </span>
      <span className="tp-opponent">
        <abbr title={home ? t.homeLong : t.awayLong}>{home ? t.home : t.away}</abbr>
        {opponent.id && !onOpenMatch ? (
          <button type="button" className="tp-team-link" title={t.openTeam(name)} onClick={() => onOpenTeam(opponent.id!)}>
            <Crest side={opponent} />
            <strong>{name}</strong>
          </button>
        ) : (
          <span className="tp-team-link"><Crest side={opponent} /><strong>{name}</strong></span>
        )}
        <small>{fixture.competition}</small>
      </span>
      {onOpenMatch ? <button type="button" className="tp-match-link" aria-label={t.openMatch(teams)} title={t.openMatch(teams)}>{outcome}</button> : outcome}
    </li>
  )
}

function Matches({ team, t, language, locale, onOpenTeam }: { team: SportsTeamProfile; t: Copy; language: Language; locale: string; onOpenTeam: (id: string) => void }) {
  const [lastCount, setLastCount] = useState(pageSize)
  const [nextCount, setNextCount] = useState(pageSize)
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: '2-digit' }), [locale])
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short' }), [locale])
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale])
  const openMatch = useOpenMatch()
  // Over: finished, and called-off matches before the last finished one; the running match leads the next ones.
  const [last, next] = useMemo(() => {
    const lastPlayed = team.fixtures.filter((fixture) => fixture.status === 'finished').reduce((latest, fixture) => Math.max(latest, Date.parse(fixture.start)), 0)
    const over = (fixture: SportsTeamFixture) => fixture.status === 'finished' || (fixture.status !== 'live' && fixture.status !== 'scheduled' && Date.parse(fixture.start) < lastPlayed)
    return [team.fixtures.filter(over).reverse(), team.fixtures.filter((fixture) => !over(fixture))]
  }, [team.fixtures])
  const row = (fixture: SportsTeamFixture) => (
    <FixtureRow
      key={fixture.id}
      fixture={fixture}
      teamId={team.id}
      t={t}
      language={language}
      date={date}
      weekday={weekday}
      time={time}
      onOpenTeam={onOpenTeam}
      onOpenMatch={openMatch && fixture.status !== 'canceled' ? () => openMatch({ fotmob: fixture.id, back: t.backToTeam }) : undefined}
    />
  )

  return (
    <>
      <section className="tp-section">
        <h4>{t.next}</h4>
        {next.length === 0 ? <p className="md-empty">{t.noNext}</p> : <ul className="tp-fixtures">{next.slice(0, nextCount).map(row)}</ul>}
        {next.length > nextCount && <button type="button" className="sp-text-button tp-more" onClick={() => setNextCount((count) => count + pageSize)}>{t.moreNext}</button>}
      </section>
      <section className="tp-section">
        <h4>{t.last}</h4>
        {last.length === 0 ? <p className="md-empty">{t.noLast}</p> : <ul className="tp-fixtures">{last.slice(0, lastCount).map(row)}</ul>}
        {last.length > lastCount && <button type="button" className="sp-text-button tp-more" onClick={() => setLastCount((count) => count + pageSize)}>{t.moreLast}</button>}
      </section>
    </>
  )
}

function Titles({ team, t }: { team: SportsTeamProfile; t: Copy }) {
  const won = team.trophies.filter((trophy) => trophy.seasonsWon.length > 0)
  if (won.length === 0) return <p className="md-empty">{t.noTitles}</p>
  return (
    <ul className="tp-titles">
      {won.map((trophy) => (
        <li key={trophy.competition}>
          <div className="tp-title-head">
            <strong>{trophy.competition}</strong>
            <span className="tp-count">{t.times(trophy.won)}</span>
          </div>
          <div className="tp-seasons">
            {trophy.seasonsWon.map((season) => <span key={season} className="tp-season">{season}</span>)}
          </div>
          {trophy.seasonsRunnerUp.length > 0 && <small className="tp-runner-up">{t.runnerUp(trophy.runnerUp || trophy.seasonsRunnerUp.length, trophy.seasonsRunnerUp.join(', '))}</small>}
        </li>
      ))}
    </ul>
  )
}

function News({ teamId, t, language, locale }: { teamId: string; t: Copy; language: Language; locale: string }) {
  const lang = language === 'de' ? 'de' : 'en'
  const { news, loading, retry } = useTeamNews(teamId, lang)
  const when = useMemo(() => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), [locale])
  if (!news) {
    return loading
      ? <p className="md-empty" aria-live="polite">{t.newsLoading}</p>
      : <div className="md-empty" aria-live="polite"><span>{t.newsDown}</span> <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></div>
  }
  if (news.length === 0) return <p className="md-empty">{t.noNews}</p>
  return (
    <>
      <ul className="tp-news">
        {news.map((item) => (
          <li key={item.id}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={item.title}>
              {item.image ? <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="tp-news-image is-empty" aria-hidden="true" />}
              <span className="tp-news-text">
                <strong>{item.title}</strong>
                {item.published && <small>{when.format(new Date(item.published))}</small>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

function feeText(move: SportsTeamTransfer, t: Copy, money: Intl.NumberFormat) {
  switch (move.feeKind) {
    case 'fee': return move.fee !== null ? money.format(move.fee) : t.undisclosed
    case 'loan': return move.fee !== null ? t.loanFee(money.format(move.fee)) : t.loan
    case 'free': return t.free
    case 'undisclosed': return t.undisclosed
    case 'extension': return t.extension
    default: return t.unknown
  }
}

interface TransfersProps {
  team: SportsTeamProfile
  t: Copy
  language: Language
  locale: string
  onOpenPlayer: (id: string, name: string) => void
  onOpenTeam: (id: string) => void
}

function Transfers({ team, t, language, locale, onOpenPlayer, onOpenTeam }: TransfersProps) {
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const month = new Intl.DateTimeFormat(locale, { month: '2-digit', year: 'numeric' })
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 2 })
  if (team.transfers.length === 0) return <p className="md-empty">{t.noTransfers}</p>
  const sections: [string, SportsTeamTransfer[]][] = [
    [t.arrivals, team.transfers.filter((move) => move.direction === 'in')],
    [t.departures, team.transfers.filter((move) => move.direction === 'out')],
    [t.extensions, team.transfers.filter((move) => move.direction === 'extension')],
  ]
  return (
    <>
      {sections.filter(([, moves]) => moves.length > 0).map(([title, moves]) => {
        const sum = moves.reduce((total, move) => total + (move.feeKind === 'fee' || move.feeKind === 'loan' ? move.fee ?? 0 : 0), 0)
        return (
          <section key={title} className="tp-section">
            <h4>{title} <span className="sp-count">{moves.length}</span></h4>
            <ol className="tp-transfers">
              {moves.map((move) => {
                // the other club of the move: where an arrival came from, where a departure went
                const other = move.direction === 'in'
                  ? { name: move.from, id: move.fromId, logo: move.fromLogo, word: t.fromWord }
                  : move.direction === 'out' ? { name: move.to, id: move.toId, logo: move.toLogo, word: t.toWord } : null
                const otherName = other?.name ? teamName(other.name, language) : null
                return (
                  <li key={`${move.date}-${move.player}-${move.direction}`}>
                    <span className="pp-date">{date.format(new Date(move.date))}</span>
                    <span className="tp-move">
                      {move.playerId
                        ? <button type="button" className="tp-player-link" onClick={() => onOpenPlayer(move.playerId!, move.player)}>{move.player}</button>
                        : <strong>{move.player}</strong>}
                      <small>
                        {move.position?.text && <span className="tp-position">{move.position.text}</span>}
                        {other && otherName && (other.id ? (
                          <button type="button" className="tp-team-link tp-move-club" title={t.openTeam(otherName)} onClick={() => onOpenTeam(other.id!)}>
                            <span>{other.word}</span>
                            {other.logo && <Crest side={{ logo: other.logo }} />}
                            <strong>{otherName}</strong>
                          </button>
                        ) : (
                          <span className="tp-team-link tp-move-club">
                            <span>{other.word}</span>
                            {other.logo && <Crest side={{ logo: other.logo }} />}
                            <strong>{otherName}</strong>
                          </span>
                        ))}
                        {move.until && <span>{t.until(month.format(new Date(move.until)))}</span>}
                      </small>
                    </span>
                    <span className={`pp-fee is-${move.feeKind}`}>{feeText(move, t, money)}</span>
                  </li>
                )
              })}
            </ol>
            {sum > 0 && <p className="pp-sum">{t.sum(money.format(sum))}</p>}
          </section>
        )
      })}
    </>
  )
}

/** The squad as one table, the groups (coach, keepers, ...) as its sections: every column stays in line from top to bottom. */
function Squad({ team, t, language, locale, onOpenPlayer }: { team: SportsTeamProfile; t: Copy; language: Language; locale: string; onOpenPlayer: (id: string, name: string) => void }) {
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })
  if (team.squad.length === 0) return <p className="md-empty">{t.noSquad}</p>
  return (
    <table className="tp-squad">
      <colgroup><col className="is-shirt" /><col /><col className="is-age" /><col className="is-rating" /><col className="is-value" /></colgroup>
      <thead>
        <tr>
          <th scope="col">{t.number}</th>
          <th scope="col" className="is-left">{t.player}</th>
          <th scope="col">{t.age}</th>
          <th scope="col">{t.rating}</th>
          <th scope="col" className="is-right">{t.value}</th>
        </tr>
      </thead>
      {team.squad.map((group: SportsSquadGroup) => (
        <tbody key={group.key}>
          <tr className="tp-group"><th scope="rowgroup" colSpan={5}>{t.groups[group.key]}{group.key !== 'coach' && <span className="sp-count">{group.members.length}</span>}</th></tr>
          {group.members.map((member) => (
            <tr key={member.id} className={member.injured ? 'is-injured' : undefined}>
              <td className="tp-shirt">{member.shirt ?? ''}</td>
              <th scope="row" className="is-left">
                <span className="tp-member">
                  <CountryFlag country={member.country} language={language} />
                  <button type="button" className="tp-player-link" title={t.profile(member.name)} onClick={() => onOpenPlayer(member.id, member.name)}>{member.name}</button>
                  {member.injured && <span className="tp-injured" role="img" aria-label={t.injured} title={t.injured}>+</span>}
                </span>
              </th>
              <td>{member.age ?? '–'}</td>
              <td>{group.key === 'coach' ? '' : member.rating !== null ? <Rating value={member.rating} locale={locale} /> : '–'}</td>
              <td className="is-right">{member.marketValue !== null ? money.format(member.marketValue) : group.key === 'coach' ? '' : '–'}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}

interface TeamProfileProps {
  team: SportsTeamRef
  language: Language
  locale: string
  /** Shown as "back" when the page was opened from a match panel. */
  onBack?: () => void
  backLabel?: string
}

/**
 * The page of a football team: the last and next matches (more on request), titles with their seasons, news, transfers and
 * squad. A click on an opponent opens its page, a click on a player his profile; "back" walks the way back.
 */
export function TeamProfile(props: TeamProfileProps) {
  return <DetailBoundary><TeamContent {...props} /></DetailBoundary>
}
function TeamContent({ team: current, language, locale, onBack, backLabel }: TeamProfileProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const { team, missing, loading, retry } = useTeam(current)
  const [tab, setTab] = useState<Tab>('matches')
  const navigation = useDetailNavigation()!
  const tabs: { id: Tab; label: string }[] = [
    { id: 'matches', label: t.matches },
    { id: 'titles', label: t.titles },
    { id: 'news', label: t.news },
    { id: 'transfers', label: t.transfers },
    { id: 'squad', label: t.squad },
  ]

  const toTeam = language === 'de' ? `Zurück zu ${team ? teamName(team.name, language) : t.backToTeam}` : `Back to ${team?.name ?? 'team'}`
  function openTeam(id: string, label = toTeam) {
    navigation.push({ backLabel: label, content: <TeamProfile team={{ id }} language={language} locale={locale} backLabel={label} onBack={navigation.back} /> })
  }
  const openPlayer = (id: string, name: string) => navigation.push({ backLabel: t.backToTeam, content: <PlayerProfile id={id} name={name} language={language} locale={locale} backLabel={t.backToTeam} onBack={navigation.back} /> })

  let body: ReactNode
  if (!team) {
    body = loading
      ? <p className="md-empty" aria-live="polite">{t.loading}</p>
      : <div className="md-empty" aria-live="polite"><span>{missing ? t.notFound : t.down}</span> <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></div>
  } else {
    const facts: [string, ReactNode][] = []
    if (team.venue) facts.push([t.stadium, [team.venue, team.city].filter(Boolean).join(', ') + (team.capacity ? ` · ${t.seats(new Intl.NumberFormat(locale).format(team.capacity))}` : '')])
    if (team.coach) facts.push([t.coach, team.coach])
    body = (
      <>
        <header className="tp-head">
          <Crest side={team} />
          <div>
            <h3>{teamName(team.name, language)}</h3>
            <p>
              <CountryFlag country={team.country} language={language} />
              {[team.league, team.season ? t.season(team.season) : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </header>
        {facts.length > 0 && (
          <dl className="pp-facts tp-facts">
            {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
        <div className="sp-filter md-tabs" role="tablist" aria-label={team.name}>
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'matches' && <Matches key={team.id} team={team} t={t} language={language} locale={locale} onOpenTeam={openTeam} />}
          {tab === 'titles' && <Titles team={team} t={t} />}
          {tab === 'news' && <News teamId={team.id} t={t} language={language} locale={locale} />}
          {tab === 'transfers' && <Transfers team={team} t={t} language={language} locale={locale} onOpenPlayer={openPlayer} onOpenTeam={openTeam} />}
          {tab === 'squad' && <Squad team={team} t={t} language={language} locale={locale} onOpenPlayer={openPlayer} />}
        </div>
      </>
    )
  }

  return (
    <div className="tp">
      <DetailBack onBack={onBack} label={backLabel ?? t.back} />
      {body}
    </div>
  )
}
