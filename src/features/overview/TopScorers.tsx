import { DetailBoundary, useDetailNavigation } from '../../components/DetailNavigation'
import { useState } from 'react'
import type { Language } from '../../types/platform'
import { localeFor } from './overviewCopy'
import { teamName } from './sportsNames'
import { sortScorers, useScorers } from './sportsScorers'
import type { ScorerDirection, ScorerMetric } from './sportsScorers'
import './sportsScorers.css'
import { PlayerProfile } from './PlayerProfile'
import { TeamProfile } from './TeamProfile'
import { SportsSeasonSelect } from './SportsSeasonSelect'
import { normalizeSportsSeason, sportsSeasonOptions } from './sportsSeasons'

const copy = {
  de: {
    title: 'Top Scorers',
    player: 'Spieler', team: 'Team', rank: 'Platz', goals: 'Tore', assists: 'Assists', scorings: 'Scorerpunkte',
    loading: 'Scorer-Tabelle wird geladen …', unavailable: 'Für diesen Wettbewerb und diese Saison sind noch keine Scorer-Daten verfügbar.',
    empty: 'In dieser Saison sind noch keine Scorerpunkte erfasst.',
    failed: 'Die Scorer-Daten sind gerade nicht erreichbar.', stale: 'Aktualisierung fehlgeschlagen. Angezeigt wird der letzte erfolgreiche Abruf.',
    retry: 'Erneut versuchen', unknown: 'Keine Angabe', more: 'Weitere Spieler anzeigen',
    retrieved: 'Abgerufen', season: 'Saison',
    sort: (label: string, ascending: boolean) => `${label} ${ascending ? 'aufsteigend' : 'absteigend'} sortieren`,
  },
  en: {
    title: 'Top Scorers',
    player: 'Player', team: 'Team', rank: 'Rank', goals: 'Goals', assists: 'Assists', scorings: 'Goal contributions',
    loading: 'Loading top scorers …', unavailable: 'Scorer data is not yet available for this competition and season.',
    empty: 'No goal contributions have been recorded this season yet.',
    failed: 'Scorer data is not reachable right now.', stale: 'Refresh failed. Showing the last successful response.',
    retry: 'Try again', unknown: 'Not reported', more: 'Show more players',
    retrieved: 'Retrieved', season: 'Season',
    sort: (label: string, ascending: boolean) => `Sort ${label.toLowerCase()} ${ascending ? 'ascending' : 'descending'}`,
  },
}

interface Props {
  competition: string
  season: string | null
  language: Language
}

function ScorerTable({ competition, season, language }: Props) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const [chosenSeason, setChosenSeason] = useState(season)
  const [knownSeasons, setKnownSeasons] = useState<string[]>([])
  const { data, loading, failed, retry } = useScorers(competition, chosenSeason)
  const selectedSeason = normalizeSportsSeason(chosenSeason) ?? normalizeSportsSeason(data?.season)
  const seasonOptions = sportsSeasonOptions([selectedSeason], data?.seasons ?? knownSeasons)
  const [metric, setMetric] = useState<ScorerMetric>('goals')
  const [direction, setDirection] = useState<ScorerDirection>('descending')
  const [count, setCount] = useState(25)
  const navigation = useDetailNavigation()!
  const players = sortScorers(data?.players ?? [], metric, direction)
  const ranked = sortScorers(data?.players ?? [], metric, 'descending')
  const rankOf = new Map<number, number>()
  ranked.forEach((player, index) => {
    const value = player[metric]
    if (value !== null && !rankOf.has(value)) rankOf.set(value, index + 1)
  })
  const metrics: ScorerMetric[] = ['goals', 'assists', 'scorings']
  const timestamp = data ? new Date(data.updatedAt) : null
  const retrieved = timestamp && Number.isFinite(timestamp.getTime())
    ? timestamp.toLocaleString(localeFor(language), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  function sort(next: ScorerMetric) {
    setMetric(next)
    setDirection(next === metric && direction === 'descending' ? 'ascending' : 'descending')
    setCount(25)
  }

  const backLabel = language === 'de' ? 'Zurück zu Top Scorers' : 'Back to Top Scorers'
  const openTeam = (id: string, label = backLabel) => navigation.push({ backLabel: label, content: <TeamProfile team={{ id }} language={language} locale={localeFor(language)} backLabel={label} onBack={navigation.back} /> })
  const openPlayer = (id: string, name: string) => navigation.push({ backLabel, content: <PlayerProfile id={id} name={name} language={language} locale={localeFor(language)} backLabel={backLabel} onBack={navigation.back} /> })

  return (
    <>
      <SportsSeasonSelect season={selectedSeason} seasons={seasonOptions} language={language} onChange={(value) => { setKnownSeasons(seasonOptions); setChosenSeason(value); setCount(25) }} />
      {loading && <p role="status" className="md-empty">{t.loading}</p>}
      {failed && <p role="status" className="scorer-status">{data ? t.stale : t.failed} <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></p>}
      {data && (!data.available || players.length === 0) && <p className="md-empty">{data.available ? t.empty : t.unavailable}</p>}
      {data?.available && players.length > 0 && (
        <>
          <div className="scorer-scroll" role="region" aria-label={t.title} tabIndex={0}>
            <table className="st-table scorer-table" aria-label={t.title}>
              <colgroup><col className="scorer-rank-col" /><col /><col className="scorer-team-col" />{metrics.map((item) => <col key={item} className="scorer-stat-col" />)}</colgroup>
              <thead><tr>
                <th scope="col"><abbr title={t.rank}>#</abbr></th>
                <th scope="col">{t.player}</th>
                <th scope="col">{t.team}</th>
                {metrics.map((item) => <th key={item} scope="col" className="scorer-number" aria-label={t[item]} aria-sort={metric === item ? direction : 'none'}>
                  <button type="button" aria-label={t.sort(t[item], metric === item && direction === 'descending')} onClick={() => sort(item)}>
                    <abbr title={t[item]}>{item === 'scorings' ? 'G+A' : item === 'goals' ? 'G' : 'A'}</abbr> <span aria-hidden="true">{metric === item ? direction === 'descending' ? '↓' : '↑' : '↕'}</span>
                  </button>
                </th>)}
              </tr></thead>
              <tbody>{players.slice(0, count).map((player) => <tr key={player.id}>
                <td className="scorer-number">{player[metric] === null ? '–' : rankOf.get(player[metric]!)}</td>
                <th scope="row"><div className="scorer-player-cell">{player.hasProfile !== false ? <button type="button" className="scorer-player-link" title={player.name} onClick={() => openPlayer(player.id, player.name)}>{player.name}</button> : <span className="scorer-player-link" title={player.name}>{player.name}</span>}</div></th>
                <td className="scorer-team">{player.teamId ? <button type="button" className="scorer-team-link" aria-label={player.team ? teamName(player.team, language) : t.team} title={player.team ? teamName(player.team, language) : t.team} onClick={() => openTeam(player.teamId!)}><ScorerBadge key={player.teamId} id={player.teamId} /></button> : player.teamLogo ? <span title={player.team ? teamName(player.team, language) : t.team}><ScorerBadge key={player.teamLogo} src={player.teamLogo} /></span> : '–'}</td>
                {metrics.map((item) => <td key={item} className={`scorer-number${item === metric ? ' is-sorted' : ''}`} title={player[item] === null ? t.unknown : undefined}>{player[item] ?? '–'}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
          {players.length > count && <button type="button" className="sp-text-button scorer-more" onClick={() => setCount((value) => value + 25)}>{t.more} ({count}/{players.length})</button>}
        </>
      )}
      {data && <p className="sp-foot scorer-foot">{[data.season ? `${t.season} ${data.season}` : null, retrieved ? `${t.retrieved}: ${retrieved}` : null].filter(Boolean).join(' · ')}</p>}
    </>
  )
}

function ScorerBadge({ id, src }: { id?: string; src?: string }) {
  const [failed, setFailed] = useState(false)
  return failed ? <span aria-hidden="true">◇</span> : <img src={src ?? `https://images.fotmob.com/image_resources/logo/teamlogo/${encodeURIComponent(id!)}.png`} alt="" width={22} height={22} loading="lazy" onError={() => setFailed(true)} />
}

/** The top scorers of a competition: the requests start when the tab is shown and stop when it is left. */
export function TopScorers(props: Props) {
  return <DetailBoundary><ScorerTable key={`${props.competition}|${props.season ?? ''}`} {...props} /></DetailBoundary>
}
