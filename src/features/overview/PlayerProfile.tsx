import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Language } from '../../types/platform'
import { FootballIcon } from './FootballIcon'
import type { SportsCoachStint, SportsInjuryRecord, SportsPersonTrophy, SportsPlayerMatch, SportsPlayerProfile, SportsSeasonStat, SportsText, SportsTransfer } from './sportsApi'
import { usePlayerMatches, usePlayerProfile, usePlayerSeason } from './sportsHooks'
import './playerProfile.css'
import { useOpenMatch } from './sportsMatchNav'
import { Rating } from './sportsRating'

const copy = {
  de: {
    back: 'Zurück zum Spiel',
    loading: 'Profil wird geladen …',
    down: 'Das Profil ist gerade nicht erreichbar.',
    retry: 'Erneut versuchen',
    age: 'Alter',
    years: (count: number) => `${count} Jahre`,
    height: 'Größe',
    foot: 'Fuß',
    country: 'Nation',
    shirt: 'Nummer',
    value: 'Marktwert',
    contract: 'Vertrag bis',
    coachSince: 'Trainer seit',
    fit: 'Keine aktuelle Verletzung bekannt.',
    back_on: (when: string) => `Rückkehr: ${when}`,
    recent: 'Letzte Spiele',
    career: 'Karriere',
    transfers: 'Transfers',
    injuries: 'Verletzungen',
    titles: 'Titel',
    coachCareer: 'Trainerkarriere',
    playerCareer: 'Spielerkarriere',
    coach: 'Trainer',
    noRecent: 'Keine Spiele bekannt.',
    noCareer: 'Keine Stationen bekannt.',
    noCoachCareer: 'Keine Trainerstationen bekannt.',
    noTransfers: 'Keine Transfers bekannt.',
    noTitles: 'Keine Titel bekannt.',
    date: 'Datum',
    opponent: 'Gegner',
    result: 'Ergebnis',
    minutesShort: 'Min.',
    events: 'Tore, Vorlagen, Karten',
    rating: 'Note',
    bench: 'Bank',
    minutes: (count: number) => `${count}′`,
    clubs: 'Vereine',
    national: 'Nationalmannschaft',
    today: 'heute',
    apps: 'Spiele',
    goals: 'Tore',
    assists: 'Vorlagen',
    club: 'Verein',
    period: 'Zeitraum',
    matchesShort: 'Sp',
    matchesLong: 'Spiele',
    winsShort: 'S',
    winsLong: 'Siege',
    drawsShort: 'U',
    drawsLong: 'Unentschieden',
    lossesShort: 'N',
    lossesLong: 'Niederlagen',
    ppgShort: 'Ø Pkt',
    ppgLong: 'Punkte pro Spiel',
    record: (team: string) => `Bilanz bei ${team}`,
    youth: 'Jugend / Anfang',
    current: 'Aktuell',
    noFees: 'Ablösesummen sind für diesen Spieler nicht verfügbar.',
    free: 'ablösefrei',
    loan: 'Leihe',
    loanFee: (fee: string) => `Leihe · ${fee}`,
    loanEnd: 'Leihende',
    unknownFee: 'Ablöse unbekannt',
    valueThen: (value: string) => `Marktwert ${value}`,
    total: (sum: string) => `Summe der Ablösen: ${sum}`,
    from: 'Von',
    to: 'Zu',
    home: 'H',
    away: 'A',
    homeLong: 'Heimspiel',
    awayLong: 'Auswärtsspiel',
    win: 'Sieg',
    draw: 'Unentschieden',
    loss: 'Niederlage',
    yellow: 'Gelbe Karte',
    red: 'Rote Karte',
    goal: 'Tor',
    assist: 'Vorlage',
    injury: 'Verletzung',
    days: 'Tage',
    daysCount: (count: number) => `${count} ${count === 1 ? 'Tag' : 'Tage'}`,
    gamesMissed: 'Verpasste Spiele',
    gamesShort: 'Spiele',
    stillOut: 'offen',
    injuryCount: 'Verletzungen',
    seasonLine: (count: number, days: number) => `${count} ${count === 1 ? 'Verletzung' : 'Verletzungen'} · ${days} ${days === 1 ? 'Tag' : 'Tage'}`,
    noInjuries: 'Es sind keine Verletzungen eingetragen.',
    injuriesMissing: 'Für diesen Spieler ist keine Verletzungshistorie verfügbar.',
    asCoach: 'Als Trainer',
    asPlayer: 'Als Spieler',
    times: (count: number) => `${count}×`,
    runnerUp: (seasons: string) => `Zweiter: ${seasons}`,
    openTeam: (name: string) => `Verein: ${name}`,
    openMatch: (opponent: string) => `Spielinfo: gegen ${opponent}`,
    backToProfile: 'Zurück zum Profil',
    season: 'Saison',
    competition: 'Wettbewerb',
    seasonLoading: 'Saison wird geladen …',
    seasonDown: 'Die Zahlen dieser Saison sind gerade nicht erreichbar.',
    seasonEmpty: 'Für diese Saison gibt es keine Zahlen.',
    statistics: 'Statistik',
    allCompetitions: 'Alle Wettbewerbe',
    seasonMatchesLoading: 'Saisonspiele werden geladen …',
    latestAvailable: 'Zuletzt verfügbare Spiele',
    seasonMatchesDown: 'Die Spiele dieser Saison sind gerade nicht erreichbar.',
    noSeasonMatches: 'Für diese Saison sind keine Spiele verfügbar.',
    matchesCount: (count: number) => `${count} ${count === 1 ? 'Spiel' : 'Spiele'}`,
    competitionCount: (count: number) => `${count} ${count === 1 ? 'Wettbewerb' : 'Wettbewerbe'}`,
    matchesRange: (start: number, end: number, total: number) => `${start}–${end} von ${total} Spielen`,
    previousMatches: 'Vorherige Spiele',
    nextMatches: 'Nächste Spiele',
    matchPages: 'Spielseiten',
    unknownStat: 'Nicht verfügbar',
    careerSeasonsMissing: 'Saisonbilanzen sind für dieses Profil nicht verfügbar. Die Vereinsstationen zeigen die Gesamtsummen.',
    careerStints: 'Vereinsstationen',
    seasonTotal: 'Saison gesamt',
    seasonDetails: 'Vereine und Nationalmannschaften',
  },
  en: {
    back: 'Back to the match',
    loading: 'Loading profile …',
    down: 'The profile is not reachable right now.',
    retry: 'Try again',
    age: 'Age',
    years: (count: number) => `${count} years`,
    height: 'Height',
    foot: 'Foot',
    country: 'Country',
    shirt: 'Shirt',
    value: 'Market value',
    contract: 'Contract until',
    coachSince: 'Coach since',
    fit: 'No current injury known.',
    back_on: (when: string) => `Expected back: ${when}`,
    recent: 'Recent matches',
    career: 'Career',
    transfers: 'Transfers',
    injuries: 'Injuries',
    titles: 'Titles',
    coachCareer: 'Coaching career',
    playerCareer: 'Playing career',
    coach: 'Coach',
    noRecent: 'No matches known.',
    noCareer: 'No clubs known.',
    noCoachCareer: 'No coaching jobs known.',
    noTransfers: 'No transfers known.',
    noTitles: 'No titles known.',
    date: 'Date',
    opponent: 'Opponent',
    result: 'Result',
    minutesShort: 'Min',
    events: 'Goals, assists, cards',
    rating: 'Rating',
    bench: 'Bench',
    minutes: (count: number) => `${count}'`,
    clubs: 'Clubs',
    national: 'National team',
    today: 'today',
    apps: 'Apps',
    goals: 'Goals',
    assists: 'Assists',
    club: 'Club',
    period: 'Period',
    matchesShort: 'P',
    matchesLong: 'Matches',
    winsShort: 'W',
    winsLong: 'Wins',
    drawsShort: 'D',
    drawsLong: 'Draws',
    lossesShort: 'L',
    lossesLong: 'Losses',
    ppgShort: 'PPG',
    ppgLong: 'Points per game',
    record: (team: string) => `Record at ${team}`,
    youth: 'Youth / start',
    current: 'Current',
    noFees: 'Fees are not available for this player.',
    free: 'free transfer',
    loan: 'Loan',
    loanFee: (fee: string) => `Loan · ${fee}`,
    loanEnd: 'End of loan',
    unknownFee: 'Fee unknown',
    valueThen: (value: string) => `Value ${value}`,
    total: (sum: string) => `Total fees: ${sum}`,
    from: 'From',
    to: 'To',
    home: 'H',
    away: 'A',
    homeLong: 'Home match',
    awayLong: 'Away match',
    win: 'Win',
    draw: 'Draw',
    loss: 'Loss',
    yellow: 'Yellow card',
    red: 'Red card',
    goal: 'Goal',
    assist: 'Assist',
    injury: 'Injury',
    days: 'Days',
    daysCount: (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`,
    gamesMissed: 'Games missed',
    gamesShort: 'Games',
    stillOut: 'open',
    injuryCount: 'Injuries',
    seasonLine: (count: number, days: number) => `${count} ${count === 1 ? 'injury' : 'injuries'} · ${days} ${days === 1 ? 'day' : 'days'}`,
    noInjuries: 'No injuries are recorded.',
    injuriesMissing: 'An injury history is not available for this player.',
    asCoach: 'As coach',
    asPlayer: 'As player',
    times: (count: number) => `${count}×`,
    runnerUp: (seasons: string) => `Runner-up: ${seasons}`,
    openTeam: (name: string) => `Team: ${name}`,
    openMatch: (opponent: string) => `Match info: against ${opponent}`,
    backToProfile: 'Back to the profile',
    season: 'Season',
    competition: 'Competition',
    seasonLoading: 'Loading the season …',
    seasonDown: 'The figures of this season are not reachable right now.',
    seasonEmpty: 'There are no figures for this season.',
    statistics: 'Statistics',
    allCompetitions: 'All competitions',
    seasonMatchesLoading: 'Loading season matches …',
    latestAvailable: 'Latest available matches',
    seasonMatchesDown: 'The matches of this season are not reachable right now.',
    noSeasonMatches: 'No matches are available for this season.',
    matchesCount: (count: number) => `${count} ${count === 1 ? 'match' : 'matches'}`,
    competitionCount: (count: number) => `${count} ${count === 1 ? 'competition' : 'competitions'}`,
    matchesRange: (start: number, end: number, total: number) => `${start}–${end} of ${total} matches`,
    previousMatches: 'Previous matches',
    nextMatches: 'Next matches',
    matchPages: 'Match pages',
    unknownStat: 'Not available',
    careerSeasonsMissing: 'Season summaries are not available for this profile. Club stints show their overall totals.',
    careerStints: 'Club stints',
    seasonTotal: 'Season total',
    seasonDetails: 'Clubs and national teams',
  },
}

type Copy = (typeof copy)['de']

// FotMob's keys with German words; anything unknown keeps the English text of the source.
const german: Record<string, string> = {
  keeper_long: 'Torwart', keeper: 'Torwart', centerback_long: 'Innenverteidiger', center_back_long: 'Innenverteidiger', rightback_long: 'Rechter Verteidiger',
  right_back_long: 'Rechter Verteidiger', leftback_long: 'Linker Verteidiger', left_back_long: 'Linker Verteidiger', right_wingback_long: 'Rechter Schienenspieler',
  left_wingback_long: 'Linker Schienenspieler', defensive_midfielder_long: 'Defensives Mittelfeld', central_midfielder_long: 'Zentrales Mittelfeld',
  attacking_midfielder_long: 'Offensives Mittelfeld', right_midfielder_long: 'Rechtes Mittelfeld', left_midfielder_long: 'Linkes Mittelfeld',
  right_winger_long: 'Rechtsaußen', left_winger_long: 'Linksaußen', striker_long: 'Stürmer', defender_long: 'Abwehr', midfielder_long: 'Mittelfeld',
  attacker_long: 'Angriff', keeper_short: 'Torwart', leftwinger: 'Linksaußen', rightwinger: 'Rechtsaußen', striker: 'Stürmer', centerback: 'Innenverteidiger',
  rightback: 'Rechter Verteidiger', leftback: 'Linker Verteidiger', defensivemidfielder: 'Defensives Mittelfeld', centralmidfielder: 'Zentrales Mittelfeld',
  attackingmidfielder: 'Offensives Mittelfeld', rightmidfielder: 'Rechtes Mittelfeld', leftmidfielder: 'Linkes Mittelfeld', rightwingback: 'Rechter Schienenspieler',
  leftwingback: 'Linker Schienenspieler', transfer_type_back_from_loan: 'Leihende', transfer_type_on_loan: 'Leihe', transfer_type_free_transfer: 'Ablösefrei', right: 'Rechts', left: 'Links', both: 'Beidfüßig', free_transfer: 'Ablösefrei', on_loan: 'Leihe', loan: 'Leihe',
  end_of_loan: 'Leihende', back_from_loan: 'Leihende', contract_expired: 'Vertragsende', transfer: 'Transfer', injured: 'Verletzt', doubtful: 'Fraglich',
  suspended: 'Gesperrt', rating: 'Note', matches_uppercase: 'Spiele', matches: 'Spiele', minutes_played: 'Minuten', goals: 'Tore', assists: 'Vorlagen',
  goals_conceded: 'Gegentore', clean_sheet: 'Weiße Westen', clean_sheets: 'Weiße Westen', clean_sheet_title: 'Weiße Westen', saved_penalties: 'Gehaltene Elfmeter', yellow_cards: 'Gelbe Karten',
  red_cards: 'Rote Karten', started: 'Startelf', starts: 'Startelf', player_started_matches: 'Startelf', coach: 'Trainer',
}

function say(text: SportsText | null, language: Language) {
  if (!text) return null
  return language === 'de' && text.key && german[text.key] ? german[text.key] : text.text
}

type Tab = 'recent' | 'career' | 'transfers' | 'injuries' | 'titles' | 'coaching'

/** The opening of a team page from a club name of the profile (football teams FotMob knows). */
type OpenTeam = ((id: string) => void) | undefined

function Crest({ logo }: { logo: string | null | undefined }) {
  return logo ? <img className="pp-crest" src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="pp-crest is-empty" aria-hidden="true" />
}

/** A club with its crest; a button to the team page when FotMob's id is known. */
function Club({ name, logo, id, t, onOpenTeam, children }: { name: string; logo?: string | null; id?: string | null; t: Copy; onOpenTeam: OpenTeam; children?: ReactNode }) {
  const content = (
    <>
      <Crest logo={logo} />
      <span className="pp-club-text">
        <strong>{name}</strong>
        {children}
      </span>
    </>
  )
  return id && onOpenTeam
    ? <button type="button" className="pp-club is-link" title={t.openTeam(name)} onClick={() => onOpenTeam(id)}>{content}</button>
    : <span className="pp-club">{content}</span>
}

function Facts({ profile, t, language, locale }: { profile: SportsPlayerProfile; t: Copy; language: Language; locale: string }) {
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })
  const since = profile.coachCareer?.find((stint) => stint.active)?.start
  const facts: [string, string][] = profile.isCoach
    ? [
      [t.age, profile.age !== null ? t.years(profile.age) : ''],
      [t.country, profile.country ?? ''],
      [t.coachSince, since ? date.format(new Date(since)) : ''],
      [t.contract, profile.contractEnd ? date.format(new Date(profile.contractEnd)) : ''],
    ]
    : [
      [t.age, profile.age !== null ? t.years(profile.age) : ''],
      [t.height, profile.heightCm !== null ? `${profile.heightCm} cm` : ''],
      [t.foot, say(profile.foot, language) ?? ''],
      [t.country, profile.country ?? ''],
      [t.shirt, profile.shirt ?? ''],
      [t.value, profile.marketValue !== null ? money.format(profile.marketValue) : ''],
      [t.contract, profile.contractEnd ? date.format(new Date(profile.contractEnd)) : ''],
    ]
  return (
    <dl className="pp-facts">
      {facts.filter(([, value]) => value).map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  )
}

/** The result seen from the player's team: its own goals first, coloured by win, draw or loss. */
function outcome(match: SportsPlayerMatch) {
  const own = match.home ? match.homeScore : match.awayScore
  const other = match.home ? match.awayScore : match.homeScore
  if (own === null || other === null) return { score: '–:–', result: null }
  return { score: `${own}:${other}`, result: own > other ? 'win' as const : own < other ? 'loss' as const : 'draw' as const }
}

function MatchTable({ matches, t, locale, onOpenTeam }: { matches: SportsPlayerMatch[]; t: Copy; locale: string; onOpenTeam: OpenTeam }) {
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' })
  const year = new Intl.DateTimeFormat(locale, { year: 'numeric' })
  const openMatch = useOpenMatch()
  if (matches.length === 0) return <p className="md-empty">{t.noSeasonMatches}</p>
  // the whole row opens the match info (the opponent's page opens from the match)
  const rowClick = (match: SportsPlayerMatch) => () => openMatch?.({ fotmob: match.id, back: t.backToProfile })
  return (
    <table className="pp-table pp-recent">
      <colgroup><col className="is-date" /><col /><col className="is-events" /><col className="is-result" /><col className="is-minutes" /><col className="is-rating" /></colgroup>
      <thead>
        <tr>
          <th scope="col">{t.date}</th>
          <th scope="col" className="is-left">{t.opponent}</th>
          <th scope="col"><span className="pp-sr">{t.events}</span></th>
          <th scope="col">{t.result}</th>
          <th scope="col">{t.minutesShort}</th>
          <th scope="col">{t.rating}</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((match) => {
          const { score, result } = outcome(match)
          const when = new Date(match.date)
          const resultBox = <span className={`pp-result${result ? ` is-${result}` : ''}`} title={result ? t[result] : undefined}>{score}</span>
          return (
            <tr key={match.id} className={openMatch ? 'is-link' : undefined} onClick={rowClick(match)}>
              <td className="pp-date">{day.format(when)}<small>{year.format(when)}</small></td>
              <td className="is-left">
                <Club name={match.opponent} logo={match.opponentLogo} id={openMatch ? null : match.opponentId} t={t} onOpenTeam={onOpenTeam}>
                  <small><abbr title={match.home ? t.homeLong : t.awayLong}>{match.home ? t.home : t.away}</abbr> · {match.competition}</small>
                </Club>
              </td>
              <td>
                <span className="pp-did">
                  {Array.from({ length: Math.min(match.goals, 3) }, (_, index) => <span key={index} role="img" aria-label={t.goal} title={t.goal}><FootballIcon size={12} /></span>)}
                  {match.assists > 0 && <small className="pp-assist" title={t.assist}>A{match.assists > 1 ? match.assists : ''}</small>}
                  {match.redCards > 0 ? <span className="lp-card is-red" role="img" aria-label={t.red} title={t.red} /> : match.yellowCards > 0 && <span className="lp-card" role="img" aria-label={t.yellow} title={t.yellow} />}
                </span>
              </td>
              <td>{openMatch ? <button type="button" className="pp-match-link" aria-label={t.openMatch(match.opponent)} title={t.openMatch(match.opponent)}>{resultBox}</button> : resultBox}</td>
              <td className="pp-muted">{match.onBench && !match.minutes ? t.bench : match.minutes !== null ? t.minutes(match.minutes) : '–'}</td>
              <td>{match.rating !== null ? <Rating value={match.rating} locale={locale} /> : <span className="pp-muted">–</span>}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const requiredFigures = [
  { key: 'goals', title: 'Goals', value: '–' },
  { key: 'assists', title: 'Assists', value: '–' },
  { key: 'red_cards', title: 'Red cards', value: '–' },
]
const figureAliases: Record<string, string> = {
  matches: 'matches_uppercase', clean_sheet: 'clean_sheets', clean_sheet_title: 'clean_sheets',
  redcards: 'red_cards', red_card: 'red_cards',
}

/** Keep the three requested figures visible, including real zeros. Unknown source values remain unknown. */
function headline(stats: SportsSeasonStat[]) {
  const available = new Map(stats.map((stat) => {
    const key = figureAliases[stat.key] ?? stat.key
    return [key, { ...stat, key }] as const
  }))
  const keeper = available.has('goals_conceded') || available.has('clean_sheets')
  const extraOrder = keeper
    ? ['matches_uppercase', 'goals_conceded', 'clean_sheets', 'minutes_played', 'rating']
    : ['matches_uppercase', 'minutes_played', 'rating', 'started', 'player_started_matches']
  const extras = extraOrder.flatMap((key) => available.has(key) ? [available.get(key)!] : []).slice(0, 3)
  const required = requiredFigures.map((stat) => available.get(stat.key) ?? stat)
  const figures = [...extras.filter((stat) => stat.key === 'matches_uppercase'), ...required, ...extras.filter((stat) => stat.key !== 'matches_uppercase')]
  return figures
}

function Figures({ stats, language, locale }: { stats: SportsSeasonStat[]; language: Language; locale: string }) {
  const t = copy[language === 'de' ? 'de' : 'en']
  return (
    <ul>
      {stats.map((stat) => (
        <li key={stat.key}>
          <b title={stat.value === '–' ? t.unknownStat : undefined}>{stat.key === 'rating' && Number.isFinite(Number(stat.value)) ? <Rating value={Number(stat.value)} locale={locale} /> : stat.value}</b>
          <span>{language === 'de' && german[stat.key] ? german[stat.key] : stat.title}</span>
        </li>
      ))}
    </ul>
  )
}

/** Season names from FotMob can use a slash or a dash, and a two- or four-digit end year. */
function seasonKey(name: string | null | undefined) {
  const parts = name?.match(/^(\d{4})[/-](\d{2}|\d{4})$/)
  return parts ? `${parts[1]}/${parts[2].slice(-2)}` : name ?? ''
}

function profileSeason(profile: SportsPlayerProfile) {
  return profile.seasons?.find((item) => item.competitions.some((competition) => competition.entry === profile.seasonEntry))?.name
    ?? profile.seasons?.find((item) => seasonKey(item.name) === seasonKey(profile.season))?.name
    ?? profile.season
    ?? profile.seasons?.[0]?.name
    ?? profile.careerSeasons?.[0]?.season
    ?? null
}

/** Compact competition figures follow the season selected directly beneath Recent matches. */
function SeasonFigures({ profile, seasonName, t, language, locale }: { profile: SportsPlayerProfile; seasonName: string | null; t: Copy; language: Language; locale: string }) {
  const season = profile.seasons?.find((item) => seasonKey(item.name) === seasonKey(seasonName))
  const own = profile.seasonEntry ?? null
  const defaultEntry = season?.competitions.find((competition) => competition.entry === own)?.entry ?? season?.competitions[0]?.entry ?? null
  const [selection, setSelection] = useState<{ season: string | null; entry: string } | null>(null)
  const chosen = selection?.season === seasonName && season?.competitions.some((competition) => competition.entry === selection.entry) ? selection.entry : defaultEntry
  const current = seasonKey(seasonName) === seasonKey(profileSeason(profile))
  const other = chosen !== null && (chosen !== own || !current) ? chosen : null
  const { stats, loading, failed, retry } = usePlayerSeason(profile.id, other)
  const sourceStats = other ? stats ?? [] : current ? profile.seasonStats : []
  const figures = headline(sourceStats)

  let body: ReactNode
  if (other && !stats) {
    body = <><Figures stats={figures} language={language} locale={locale} />{loading
      ? <p className="pp-season-note" role="status">{t.seasonLoading}</p>
      : failed ? <p className="pp-season-note" role="status">{t.seasonDown} <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></p> : null}</>
  } else {
    body = <><Figures stats={figures} language={language} locale={locale} />{sourceStats.length === 0 && <p className="pp-season-note">{t.seasonEmpty}</p>}</>
  }

  return (
    <section className="pp-season pp-season-compact" aria-label={t.statistics}>
      <div className="pp-statistics-head">
        <h5>{t.statistics}</h5>
        {season && chosen ? (
          <select aria-label={t.competition} value={chosen} onChange={(event) => setSelection({ season: seasonName, entry: event.target.value })}>
            {season.competitions.map((competition) => <option key={competition.entry} value={competition.entry}>{competition.name}</option>)}
          </select>
        ) : current && profile.seasonLeague ? <span>{profile.seasonLeague}</span> : null}
      </div>
      {body}
    </section>
  )
}

function RecentMatches({ profile, t, language, locale, onOpenTeam }: { profile: SportsPlayerProfile; t: Copy; language: Language; locale: string; onOpenTeam: OpenTeam }) {
  const ownSeason = profileSeason(profile)
  const [selection, setSelection] = useState<string | null>(null)
  const seasonName = selection ?? ownSeason
  const seasonNames = [...(profile.seasons ?? []).map((season) => season.name), ...(profile.careerSeasons ?? []).map((season) => season.season), ...(ownSeason ? [ownSeason] : [])]
  const seasons = seasonNames.filter((name, index) => seasonNames.findIndex((item) => seasonKey(item) === seasonKey(name)) === index).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
  // Latest profile matches are a fallback while the complete current season loads; historical seasons never reuse them.
  const historical = seasonName !== null && seasonKey(seasonName) !== seasonKey(ownSeason)
  const { matches: loaded, loading, failed, retry } = usePlayerMatches(profile.id, seasonName)
  const fallback = !historical && loaded === null && profile.recentMatches.length > 0
  const matches = loaded ?? (historical ? [] : profile.recentMatches)
  const competitions = [...new Set(matches.map((match) => match.competition).filter(Boolean))]
  const [filter, setFilter] = useState<{ season: string | null; competition: string } | null>(null)
  const competition = filter?.season === seasonName && competitions.includes(filter.competition) ? filter.competition : null
  const shown = competition ? matches.filter((match) => match.competition === competition) : matches
  const [pagination, setPagination] = useState<{ key: string; page: number } | null>(null)
  const pageSize = 8
  const pageKey = `${seasonName}|${competition ?? ''}`
  const pages = Math.ceil(shown.length / pageSize)
  const page = pagination?.key === pageKey ? Math.min(pagination.page, Math.max(pages - 1, 0)) : 0
  const first = page * pageSize
  const visible = shown.slice(first, first + pageSize)

  return (
    <>
      <div className="pp-season-toolbar">
        {seasons.length > 0 && <label className="pp-season-control"><span>{t.season}</span><select value={seasonName ?? ''} onChange={(event) => { setSelection(event.target.value); setPagination(null) }}>{seasons.map((season) => <option key={season} value={season}>{season}</option>)}</select></label>}
        <div className="pp-match-summary" aria-live="polite">{!loading && !failed && <><strong>{t.matchesCount(matches.length)}</strong><span>{t.competitionCount(competitions.length)}</span></>}</div>
      </div>
      <SeasonFigures profile={profile} seasonName={seasonName} t={t} language={language} locale={locale} />
      {competitions.length > 0 && (
        <div className="pp-competition-chips" role="group" aria-label={t.competition}>
          <button type="button" aria-pressed={!competition} onClick={() => { setFilter(null); setPagination(null) }}>{t.allCompetitions}{' '}<span>{matches.length}</span></button>
          {competitions.map((name) => <button key={name} type="button" aria-pressed={competition === name} onClick={() => { setFilter({ season: seasonName, competition: name }); setPagination(null) }}>{name}{' '}<span>{matches.filter((match) => match.competition === name).length}</span></button>)}
        </div>
      )}
      <div className="pp-match-list" aria-busy={loading}>
        {loading && <p className="pp-season-note" role="status">{t.seasonMatchesLoading}</p>}
        {failed && <p className="pp-season-note" role="status">{t.seasonMatchesDown} <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></p>}
        {fallback && <p className="pp-season-note">{t.latestAvailable}</p>}
        {(!loading && !failed || fallback) && <MatchTable matches={visible} t={t} locale={locale} onOpenTeam={onOpenTeam} />}
      </div>
      {shown.length > pageSize && (!loading && !failed || fallback) && <nav className="pp-match-pagination" aria-label={t.matchPages}>
        <span aria-live="polite">{t.matchesRange(first + 1, Math.min(first + pageSize, shown.length), shown.length)}</span>
        <div><button type="button" aria-label={t.previousMatches} disabled={page === 0} onClick={() => setPagination({ key: pageKey, page: page - 1 })}>‹</button><button type="button" aria-label={t.nextMatches} disabled={page + 1 >= pages} onClick={() => setPagination({ key: pageKey, page: page + 1 })}>›</button></div>
      </nav>}
    </>
  )
}

function period(start: string | null, end: string | null, active: boolean, t: Copy, format: Intl.DateTimeFormat) {
  return `${start ? format.format(new Date(start)) : '?'} – ${end ? format.format(new Date(end)) : active ? t.today : '?'}`
}

function CareerStints({ profile, t, locale, onOpenTeam }: { profile: SportsPlayerProfile; t: Copy; locale: string; onOpenTeam: OpenTeam }) {
  const month = new Intl.DateTimeFormat(locale, { month: '2-digit', year: 'numeric' })
  const groups: [string, typeof profile.career][] = [
    [t.clubs, profile.career.filter((entry) => entry.kind === 'club')],
    [t.national, profile.career.filter((entry) => entry.kind === 'national')],
  ]
  if (profile.career.length === 0) return <p className="md-empty">{t.noCareer}</p>
  return (
    <table className="pp-table pp-career">
      <colgroup><col /><col className="is-number" /><col className="is-number" /><col className="is-number" /></colgroup>
      <thead>
        <tr>
          <th scope="col" className="is-left">{t.club}</th>
          <th scope="col"><abbr title={t.apps}>{t.apps}</abbr></th>
          <th scope="col">{t.goals}</th>
          <th scope="col">{t.assists}</th>
        </tr>
      </thead>
      {groups.filter(([, entries]) => entries.length > 0).map(([title, entries]) => (
        <tbody key={title}>
          <tr className="pp-group"><th scope="rowgroup" colSpan={4}>{title}</th></tr>
          {entries.map((entry) => (
            <tr key={`${entry.team}-${entry.start}`} className={entry.active ? 'is-active' : undefined}>
              <th scope="row" className="is-left">
                <Club name={entry.team} logo={entry.logo} id={entry.kind === 'club' ? entry.teamId : null} t={t} onOpenTeam={onOpenTeam}>
                  <small>{period(entry.start, entry.end, entry.active, t, month)}</small>
                </Club>
              </th>
              <td>{entry.appearances ?? '–'}</td>
              <td>{entry.goals ?? '–'}</td>
              <td>{entry.assists ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}

/** Season totals are only added from real season rows; career-long club totals are never split across years. */
function Career({ profile, t, locale, onOpenTeam }: { profile: SportsPlayerProfile; t: Copy; locale: string; onOpenTeam: OpenTeam }) {
  const seasons = profile.careerSeasons?.filter((season) => season.teams.length > 0) ?? []
  if (seasons.length === 0) return <>{!profile.isCoach && profile.career.length > 0 && <p className="pp-career-note">{t.careerSeasonsMissing}</p>}<CareerStints profile={profile} t={t} locale={locale} onOpenTeam={onOpenTeam} /></>
  const count = new Intl.NumberFormat(locale)
  const summary = (teams: (typeof seasons)[number]['teams'], key: 'appearances' | 'goals' | 'assists') => teams.some((team) => team[key] === null) ? '–' : count.format(teams.reduce((total, team) => total + (team[key] ?? 0), 0))
  return (
    <div className="pp-career-seasons">
      {[...seasons].sort((left, right) => right.season.localeCompare(left.season, undefined, { numeric: true })).map((season, index) => (
        <details key={season.season} className="pp-career-season" open={index === 0}>
          <summary>
            <span className="pp-career-season-name"><strong>{season.season}</strong><small>{[...new Set(season.teams.map((team) => team.team))].join(' · ')}</small></span>
            <span className="pp-career-totals" aria-label={t.seasonTotal}>
              <span><b>{summary(season.teams, 'appearances')}</b><small>{t.apps}</small></span>
              <span><b>{summary(season.teams, 'goals')}</b><small>{t.goals}</small></span>
              <span><b>{summary(season.teams, 'assists')}</b><small>{t.assists}</small></span>
            </span>
          </summary>
          <div className="pp-career-detail"><table className="pp-table pp-career" aria-label={`${season.season} · ${t.seasonDetails}`}>
            <thead><tr><th scope="col" className="is-left">{t.club}</th><th scope="col">{t.apps}</th><th scope="col">{t.goals}</th><th scope="col">{t.assists}</th></tr></thead>
            <tbody>{season.teams.map((team, teamIndex) => <tr key={`${team.teamId ?? team.team}-${team.kind}-${teamIndex}`}>
              <th scope="row" className="is-left"><Club name={team.team} logo={team.logo} id={team.teamId} t={t} onOpenTeam={onOpenTeam}><small>{team.kind === 'national' ? t.national : t.club}</small></Club></th>
              <td>{team.appearances === null ? '–' : count.format(team.appearances)}</td><td>{team.goals === null ? '–' : count.format(team.goals)}</td><td>{team.assists === null ? '–' : count.format(team.assists)}</td>
            </tr>)}</tbody>
          </table></div>
        </details>
      ))}
      {profile.career.length > 0 && <details className="pp-career-stints"><summary>{t.careerStints}</summary><CareerStints profile={profile} t={t} locale={locale} onOpenTeam={onOpenTeam} /></details>}
    </div>
  )
}

function CoachCareer({ stints, t, locale, onOpenTeam }: { stints: SportsCoachStint[]; t: Copy; locale: string; onOpenTeam: OpenTeam }) {
  const month = new Intl.DateTimeFormat(locale, { month: '2-digit', year: 'numeric' })
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (stints.length === 0) return <p className="md-empty">{t.noCoachCareer}</p>
  return (
    <table className="pp-table pp-coaching">
      <colgroup><col /><col className="is-number" /><col className="is-number" /><col className="is-number" /><col className="is-number" /><col className="is-ppg" /></colgroup>
      <thead>
        <tr>
          <th scope="col" className="is-left">{t.club}</th>
          <th scope="col"><abbr title={t.matchesLong}>{t.matchesShort}</abbr></th>
          <th scope="col"><abbr title={t.winsLong}>{t.winsShort}</abbr></th>
          <th scope="col"><abbr title={t.drawsLong}>{t.drawsShort}</abbr></th>
          <th scope="col"><abbr title={t.lossesLong}>{t.lossesShort}</abbr></th>
          <th scope="col"><abbr title={t.ppgLong}>{t.ppgShort}</abbr></th>
        </tr>
      </thead>
      <tbody>
        {stints.map((stint) => (
          <tr key={`${stint.team}-${stint.start}`} className={stint.active ? 'is-active' : undefined}>
            <th scope="row" className="is-left">
              <Club name={stint.team} logo={stint.logo} id={stint.teamId} t={t} onOpenTeam={onOpenTeam}>
                <small>{period(stint.start, stint.end, stint.active, t, month)}</small>
              </Club>
            </th>
            <td>{stint.matches ?? '–'}</td>
            <td>{stint.wins ?? '–'}</td>
            <td>{stint.draws ?? '–'}</td>
            <td>{stint.losses ?? '–'}</td>
            <td className="pp-strong">{stint.pointsPerGame !== null ? decimal.format(stint.pointsPerGame) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The record at the club the coach manages now, as the figures under the head of a player's profile. */
function CoachRecord({ stint, t, locale }: { stint: SportsCoachStint; t: Copy; locale: string }) {
  if (stint.matches === null) return null
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const figures: [string, string][] = [
    [t.matchesLong, String(stint.matches)],
    [t.winsLong, String(stint.wins ?? '–')],
    [t.drawsLong, String(stint.draws ?? '–')],
    [t.lossesLong, String(stint.losses ?? '–')],
    [t.ppgLong, stint.pointsPerGame !== null ? decimal.format(stint.pointsPerGame) : '–'],
  ]
  return (
    <div className="pp-season">
      <small>{t.record(stint.team)}</small>
      <ul>
        {figures.map(([label, value]) => <li key={label}><b>{value}</b><span>{label}</span></li>)}
      </ul>
    </div>
  )
}

function feeText(move: SportsTransfer, t: Copy, money: Intl.NumberFormat) {
  switch (move.feeKind) {
    case 'fee': return move.fee !== null ? money.format(move.fee) : t.unknownFee
    case 'free': return t.free
    case 'loan': return move.fee !== null ? t.loanFee(money.format(move.fee)) : t.loan
    case 'loan-end': return t.loanEnd
    case 'unknown': return '–'
    default: return null
  }
}

function Transfers({ profile, t, language, locale }: { profile: SportsPlayerProfile; t: Copy; language: Language; locale: string }) {
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 2 })
  if (profile.transfers.length === 0) return <p className="md-empty">{t.noTransfers}</p>
  const withFees = profile.transfersSource === 'transfermarkt'
  const sum = profile.transfers.reduce((total, move) => total + (move.feeKind === 'fee' || move.feeKind === 'loan' ? move.fee ?? 0 : 0), 0)
  return (
    <>
      <ol className="pp-moves">
        {profile.transfers.map((move) => {
          const fee = feeText(move, t, money) ?? say(move.type, language)
          return (
            <li key={`${move.date}-${move.from}-${move.to}`}>
              <span className="pp-date">{date.format(new Date(move.date))}</span>
              <span className="pp-route">
                <span className="pp-hop is-from" aria-label={`${t.from}: ${move.from ?? t.youth}`}>
                  <Crest logo={move.fromLogo} />
                  <span>{move.from ?? t.youth}</span>
                </span>
                <span className="pp-hop is-to" aria-label={`${t.to}: ${move.to}`}>
                  <i aria-hidden="true">→</i>
                  <Crest logo={move.toLogo} />
                  <strong>{move.to}</strong>
                </span>
              </span>
              <span className="pp-price">
                {fee && <b className={`pp-fee is-${move.feeKind ?? 'unknown'}`}>{fee}</b>}
                {move.marketValue !== null && <small>{t.valueThen(money.format(move.marketValue))}</small>}
              </span>
            </li>
          )
        })}
      </ol>
      {withFees && sum > 0 && <p className="pp-sum">{t.total(money.format(sum))}</p>}
      {!withFees && <p className="pp-note">{t.noFees}</p>}
    </>
  )
}

function CurrentInjury({ profile, t, language }: { profile: SportsPlayerProfile; t: Copy; language: Language }) {
  return profile.injury
    ? <p className="pp-injury is-hurt">{say(profile.injury.status, language)}{profile.injury.expectedReturn && ` · ${t.back_on(profile.injury.expectedReturn)}`}</p>
    : <p className="pp-injury">{t.fit}</p>
}

function Injuries({ profile, t, language, locale }: { profile: SportsPlayerProfile; t: Copy; language: Language; locale: string }) {
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: '2-digit' })
  const history = profile.injuryHistory
  const seasons = useMemo(() => {
    const groups = new Map<string, SportsInjuryRecord[]>()
    for (const record of history ?? []) groups.set(record.season ?? '–', [...(groups.get(record.season ?? '–') ?? []), record])
    return [...groups.entries()]
  }, [history])

  let body: ReactNode
  if (!history) {
    body = <p className="pp-note">{t.injuriesMissing}</p>
  } else if (history.length === 0) {
    body = <p className="md-empty">{t.noInjuries}</p>
  } else {
    const days = history.reduce((total, record) => total + (record.days ?? 0), 0)
    const games = history.reduce((total, record) => total + (record.gamesMissed ?? 0), 0)
    body = (
      <>
        <div className="pp-season">
          <ul>
            <li><b>{history.length}</b><span>{t.injuryCount}</span></li>
            <li><b>{days}</b><span>{t.days}</span></li>
            <li><b>{games}</b><span>{t.gamesMissed}</span></li>
          </ul>
        </div>
        <table className="pp-table pp-injury-table">
          <colgroup><col /><col className="is-days" /><col className="is-number" /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="is-left">{t.injury}</th>
              <th scope="col">{t.days}</th>
              <th scope="col"><abbr title={t.gamesMissed}>{t.gamesShort}</abbr></th>
            </tr>
          </thead>
          {seasons.map(([season, records]) => (
            <tbody key={season}>
              <tr className="pp-group">
                <th scope="rowgroup" colSpan={3}>
                  {season}
                  <small>{t.seasonLine(records.length, records.reduce((total, record) => total + (record.days ?? 0), 0))}</small>
                </th>
              </tr>
              {records.map((record, index) => (
                <tr key={`${record.from}-${record.injury}-${index}`} className={record.until === null ? 'is-open' : undefined}>
                  <th scope="row" className="is-left">
                    <span className="pp-injury-name">
                      <strong>{record.injury}</strong>
                      <small>{record.from ? date.format(new Date(record.from)) : '?'} – {record.until ? date.format(new Date(record.until)) : t.stillOut}</small>
                    </span>
                  </th>
                  <td>{record.days !== null ? record.days : '–'}</td>
                  <td>{record.gamesMissed !== null ? record.gamesMissed : '–'}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </>
    )
  }

  return (
    <div className="pp-injuries">
      <h4>{t.current}</h4>
      <CurrentInjury profile={profile} t={t} language={language} />
      {body}
    </div>
  )
}

function Titles({ trophies, t, onOpenTeam }: { trophies: SportsPersonTrophy[]; t: Copy; onOpenTeam: OpenTeam }) {
  const won = trophies.filter((trophy) => trophy.seasonsWon.length > 0)
  if (won.length === 0) return <p className="md-empty">{t.noTitles}</p>
  const groups: [string, SportsPersonTrophy[]][] = [
    [t.asCoach, won.filter((trophy) => trophy.role === 'coach')],
    [t.asPlayer, won.filter((trophy) => trophy.role === 'player')],
  ]
  const both = groups.every(([, items]) => items.length > 0)
  return (
    <>
      {groups.filter(([, items]) => items.length > 0).map(([title, items]) => (
        <section key={title} className="pp-titles">
          {both && <h4>{title}</h4>}
          <ul>
            {items.map((trophy) => (
              <li key={`${trophy.role}-${trophy.team}-${trophy.competition}`}>
                <div className="pp-title-head">
                  <span className="pp-title-name">
                    <strong>{trophy.competition}</strong>
                    <Club name={trophy.team} logo={trophy.logo} id={trophy.teamId} t={t} onOpenTeam={onOpenTeam} />
                  </span>
                  <span className="tp-count">{t.times(trophy.seasonsWon.length)}</span>
                </div>
                <div className="tp-seasons">
                  {trophy.seasonsWon.map((season) => <span key={season} className="tp-season">{season}</span>)}
                </div>
                {trophy.seasonsRunnerUp.length > 0 && <small className="tp-runner-up">{t.runnerUp(trophy.seasonsRunnerUp.join(', '))}</small>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

interface PlayerProfileProps {
  id: string
  name: string
  language: Language
  locale: string
  onBack: () => void
  backLabel?: string
  /** A club name of the profile opens the team page. */
  onOpenTeam?: (id: string) => void
}

function ProfilePortrait({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false)
  return <span className="pp-portrait">{failed ? <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="12" fill="currentColor" /><path d="M10 60v-6a22 22 0 0 1 44 0v6Z" fill="currentColor" /></svg> : <img src={`https://images.fotmob.com/image_resources/playerimages/${encodeURIComponent(id)}.png`} alt={name} width={72} height={72} referrerPolicy="no-referrer" onError={() => setFailed(true)} />}</span>
}

/** The profile of a player or a coach, shown in the panel instead of the match or the team until "back". */
export function PlayerProfile({ id, name, language, locale, onBack, backLabel, onOpenTeam }: PlayerProfileProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const { profile, loading, retry } = usePlayerProfile(id, language === 'de' ? 'de' : 'en')
  const [chosen, setChosen] = useState<Tab | null>(null)
  const coach = profile?.isCoach ?? false
  const tabs: { id: Tab; label: string }[] = coach
    ? [{ id: 'coaching', label: t.coachCareer }, { id: 'career', label: t.playerCareer }, { id: 'titles', label: t.titles }]
    : [{ id: 'recent', label: t.recent }, { id: 'career', label: t.career }, { id: 'transfers', label: t.transfers }, { id: 'injuries', label: t.injuries }, { id: 'titles', label: t.titles }]
  const tab = tabs.find((item) => item.id === chosen)?.id ?? tabs[0].id

  let body: ReactNode
  if (!profile) {
    body = loading
      ? <p className="md-empty" aria-live="polite">{t.loading}</p>
      : <div className="md-empty" aria-live="polite"><span>{t.down}</span> <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></div>
  } else {
    const current = profile.coachCareer?.find((stint) => stint.active)
    body = (
      <>
        <header className="pp-head">
          <ProfilePortrait key={profile.id} id={profile.id} name={profile.name} />
          <div><h3>{profile.name}</h3>
          <p>{[profile.team, coach ? t.coach : say(profile.position, language)].filter(Boolean).join(' · ')}</p></div>
        </header>
        <Facts profile={profile} t={t} language={language} locale={locale} />
        {coach ? (
          current && <CoachRecord stint={current} t={t} locale={locale} />
        ) : (
          <>
            <CurrentInjury profile={profile} t={t} language={language} />
          </>
        )}
        <div className="sp-filter md-tabs" role="tablist" aria-label={profile.name}>
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setChosen(item.id)}>{item.label}</button>
          ))}
        </div>
        <div role="tabpanel">
          {!coach && <section className="pp-recent-panel" hidden={tab !== 'recent'} key={profile.id}><RecentMatches profile={profile} t={t} language={language} locale={locale} onOpenTeam={onOpenTeam} /></section>}
          {tab === 'career' && <Career profile={profile} t={t} locale={locale} onOpenTeam={onOpenTeam} />}
          {tab === 'coaching' && <CoachCareer stints={profile.coachCareer ?? []} t={t} locale={locale} onOpenTeam={onOpenTeam} />}
          {tab === 'transfers' && <Transfers profile={profile} t={t} language={language} locale={locale} />}
          {tab === 'injuries' && <Injuries profile={profile} t={t} language={language} locale={locale} />}
          {tab === 'titles' && <Titles trophies={profile.trophies ?? []} t={t} onOpenTeam={onOpenTeam} />}
        </div>
      </>
    )
  }

  return (
    <div className="pp" aria-label={name}>
      <button type="button" className="sp-text-button pp-back" onClick={onBack}>‹ {backLabel ?? t.back}</button>
      {body}
    </div>
  )
}
