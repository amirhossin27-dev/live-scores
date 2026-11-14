import { useMemo, useState } from 'react'
import type { Language } from '../../types/platform'
import { localeFor } from './overviewCopy'
import type { SportsBracketTeam, SportsMatchup, SportsRound, SportsStandings, SportsTable, SportsTableColumn, SportsText } from './sportsApi'
import { teamName } from './sportsNames'
import type { StandingsView } from './sportsStandings'
import { FormCell } from './TableForm'
import { zoneAppearance } from './sportsZones'
import { TopScorers } from './TopScorers'
import { useStandings } from './sportsHooks'
import { SportsSeasonSelect } from './SportsSeasonSelect'
import { sportsSeasonOptions } from './sportsSeasons'
import './sportsStandingsZones.css'

const copy = {
  de: {
    table: 'Tabelle',
    rank: 'Platz',
    zones: 'Tabellenbereiche',
    unknownZone: 'Tabellenbereich ohne Bezeichnung',
    team: 'Team',
    driver: 'Fahrer',
    allGroups: 'Alle Gruppen zeigen',
    ownGroups: 'Nur die Gruppe des Spiels',
    rounds: 'Runden',
    open: 'Noch offen',
    live: 'Live',
    aet: 'n. V.',
    pen: 'n. E.',
    season: (season: string) => `Saison ${season}`,
    liveTable: 'Live-Tabelle',
    liveHint: 'Die laufenden Spiele sind so eingerechnet, als wären sie jetzt zu Ende; wird alle 30 s aktualisiert.',
    liveResult: (score: string, minute: string) => `Läuft: ${score} (${minute})`,
    moveUp: (count: number) => `${count} ${count === 1 ? 'Platz' : 'Plätze'} hoch`,
    moveDown: (count: number) => `${count} ${count === 1 ? 'Platz' : 'Plätze'} runter`,
    openTeam: (name: string) => `Verein: ${name}`,
  },
  en: {
    table: 'Table',
    rank: 'Position',
    zones: 'Table zones',
    unknownZone: 'Table zone without a label',
    team: 'Team',
    driver: 'Driver',
    allGroups: 'Show all groups',
    ownGroups: 'Only the group of the match',
    rounds: 'Rounds',
    open: 'To be decided',
    live: 'Live',
    aet: 'AET',
    pen: 'Pens',
    season: (season: string) => `Season ${season}`,
    liveTable: 'Live table',
    liveHint: 'The running matches are counted as if they ended now; refreshed every 30 s.',
    liveResult: (score: string, minute: string) => `Running: ${score} (${minute})`,
    moveUp: (count: number) => `Up ${count} ${count === 1 ? 'place' : 'places'}`,
    moveDown: (count: number) => `Down ${count} ${count === 1 ? 'place' : 'places'}`,
    openTeam: (name: string) => `Team: ${name}`,
  },
}

type Copy = (typeof copy)['de']

const columnLabels: Record<SportsTableColumn, { de: [string, string]; en: [string, string] }> = {
  gamesPlayed: { de: ['Sp', 'Spiele'], en: ['P', 'Played'] },
  wins: { de: ['S', 'Siege'], en: ['W', 'Won'] },
  ties: { de: ['U', 'Unentschieden'], en: ['D', 'Drawn'] },
  losses: { de: ['N', 'Niederlagen'], en: ['L', 'Lost'] },
  goals: { de: ['Tore', 'Tore'], en: ['Goals', 'Goals'] },
  goalDifference: { de: ['Diff', 'Tordifferenz'], en: ['GD', 'Goal difference'] },
  points: { de: ['Pkt', 'Punkte'], en: ['Pts', 'Points'] },
  winPercent: { de: ['Quote', 'Siegquote'], en: ['PCT', 'Win percentage'] },
  gamesBehind: { de: ['Rückst.', 'Rückstand in Spielen'], en: ['GB', 'Games behind'] },
  otLosses: { de: ['N n. V.', 'Niederlagen nach Verlängerung oder Penaltyschießen'], en: ['OTL', 'Overtime losses'] },
}

function columnLabel(column: SportsTableColumn, competition: string, language: Language) {
  // in American football a tie is a tie, not a draw
  if (column === 'ties' && competition.startsWith('football/') && language !== 'de') return ['T', 'Ties']
  return columnLabels[column][language === 'de' ? 'de' : 'en']
}

/** The meaning of a colour of the table in German: by FotMob's key or by ESPN's English text; unknown ones stay English. */
const zoneLabels: Record<string, string> = {
  championsleague: 'Champions League',
  'champions league': 'Champions League',
  'champions league qualifying': 'Champions-League-Qualifikation',
  europaleague: 'Europa League',
  'europa league': 'Europa League',
  'europa league qualifying': 'Europa-League-Qualifikation',
  europa_conference_league: 'Conference-League-Qualifikation',
  'conference league': 'Conference League',
  'uefa conference league': 'Conference League',
  'conference league qualifying': 'Conference-League-Qualifikation',
  'conference league qualification': 'Conference-League-Qualifikation',
  relegation: 'Abstieg',
  relegated: 'Abstieg',
  relegationqual: 'Relegation',
  'relegation qualification': 'Relegation',
  'relegation playoff': 'Relegation',
  'relegation playoffs': 'Relegation',
  promotion: 'Aufstieg',
  'promotion playoff': 'Aufstiegsrelegation',
  'promotion playoffs': 'Aufstiegs-Play-offs',
  championship_playoff: 'Meisterrunde',
  'championship playoff': 'Meisterrunde',
  'championship playoffs': 'Meisterrunde',
  'european playoffs': 'Europa-Play-offs',
  eliminated: 'Ausgeschieden',
  q1of8finals: 'Achtelfinale',
  'qualification to 1/8 finals': 'Achtelfinale',
  'qualifies for round of 16': 'Achtelfinale',
  q1of16finals: 'K.-o.-Play-offs',
  'qualification to 1/16 finals': 'K.-o.-Play-offs',
  'knockout phase playoffs - seeded': 'K.-o.-Play-offs (gesetzt)',
  'knockout phase playoffs - unseeded': 'K.-o.-Play-offs (ungesetzt)',
  'qualifies for ko playoffs': 'K.-o.-Play-offs',
  'qualifies for sudamericana ko playoffs': 'K.-o.-Play-offs der Copa Sudamericana',
  'advance to round of 32': 'Sechzehntelfinale',
  'best 8 advance': 'Weiter als einer der acht besten Dritten',
  'four best 3rd placed nations qualify for round of 16': 'Die vier besten Dritten erreichen das Achtelfinale',
  'four best third-placed teams advance': 'Die vier besten Dritten kommen weiter',
  'qualifies for quarterfinals': 'Viertelfinale',
  'qualifies for world cup': 'WM-Teilnahme',
  'qualifies for world cup playoffs': 'WM-Play-offs',
  'inter-confederation playoffs': 'Interkontinentale Play-offs',
  qualification_next_stage: 'Nächste Runde',
  'qualification next stage': 'Nächste Runde',
  possible_qualification_next_stage: 'Mögliche nächste Runde',
  'possible qualification next stage': 'Mögliche nächste Runde',
}

function zoneLabel(label: SportsText, language: Language) {
  if (language !== 'de') return label.text
  return (label.key && zoneLabels[label.key]) ?? zoneLabels[label.text.trim().toLowerCase()] ?? label.text
}

/** "Group A" / FotMob's "Grp. A", "League Phase", "League A, Group B", the two classifications of Formula 1. */
function groupName(name: string, language: Language) {
  if (language !== 'de') return name.replace(/^Grp\.\s*/, 'Group ')
  return name
    .replace(/^Grp\.\s*/, 'Gruppe ')
    .replace(/\bGroup\b/g, 'Gruppe')
    .replace(/\bLeague Phase\b/i, 'Ligaphase')
    .replace(/\bLeague ([A-D])\b/g, 'Liga $1')
    .replace(/^Driver Standings$/, 'Fahrerwertung')
    .replace(/^Constructor Standings$/, 'Konstrukteurswertung')
}

function stageLabel(stage: string, language: Language) {
  const de = language === 'de'
  if (/^\d+$/.test(stage)) return de ? `${stage}. Runde` : `Round ${stage}`
  const labels: Record<string, [string, string]> = {
    playoff: ['Play-offs', 'Play-offs'],
    '1/64': ['1/64-Finale', 'Round of 128'],
    '1/32': ['1/32-Finale', 'Round of 64'],
    '1/16': ['Sechzehntelfinale', 'Round of 32'],
    '1/8': ['Achtelfinale', 'Round of 16'],
    '1/4': ['Viertelfinale', 'Quarter-finals'],
    '1/2': ['Halbfinale', 'Semi-finals'],
    final: ['Finale', 'Final'],
    bronze: ['Spiel um Platz 3', 'Third place'],
  }
  return labels[stage]?.[de ? 0 : 1] ?? stage
}

function Logo({ src, className }: { src: string | null; className: string }) {
  return src ? <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className={`${className} is-empty`} aria-hidden="true" />
}

interface TableProps {
  table: SportsTable
  competition: string
  language: Language
  /** In the panel of a match: only the groups of its teams at first. */
  focus: boolean
  t: Copy
  onOpenTeam?: (id: string) => void
}

function StandingsTable({ table, competition, language, focus, t, onOpenTeam }: TableProps) {
  const [allGroups, setAllGroups] = useState(false)
  const marked = table.groups.filter((group) => group.rows.some((row) => row.highlight))
  const narrowed = focus && marked.length > 0 && marked.length < table.groups.length
  const groups = narrowed && !allGroups ? marked : table.groups
  const colorKey = (color: string) => color.trim().toLowerCase()
  const rowKey = (row: SportsTable['groups'][number]['rows'][number]) => row.zoneKey ?? (row.zone ? colorKey(row.zone) : null)
  const zoneKey = (zone: SportsTable['zones'][number]) => zone.key ?? colorKey(zone.color)
  const shownZones = new Set(groups.flatMap((group) => group.rows.flatMap((row) => rowKey(row) ? [rowKey(row)!] : [])))
  const sourceZones = [...new Map(table.zones.filter((zone) => shownZones.has(zoneKey(zone))).map((zone) => [zoneKey(zone), zone])).values()]
  // Some sources mark a rank but omit its meaning. Keep the marker and say that the label is missing.
  for (const key of shownZones) {
    if (!sourceZones.some((zone) => zoneKey(zone) === key)) sourceZones.push({ key, color: key, label: { key: null, text: t.unknownZone } })
  }
  const zones = sourceZones.map((zone) => ({
    ...zone,
    name: zoneLabel(zone.label, language),
    style: zoneAppearance(zone.label),
  }))
  const zoneOf = (key: string | null) => key ? zones.find((zone) => zoneKey(zone) === key) : undefined
  const racing = competition.startsWith('racing/')

  return (
    <div className={`st-tables${table.live ? ' is-live' : ''}`}>
      {table.live && (
        <p className="st-live" title={t.liveHint}><span className="sp-dot is-live" aria-hidden="true" />{t.liveTable}</p>
      )}
      {groups.map((group, index) => {
        const title = group.name ? groupName(group.name, language) : null
        const who = racing && !/constructor/i.test(group.name ?? '') ? t.driver : t.team
        return (
          <section key={group.name ?? index} className="st-group" aria-label={title ?? t.table}>
            {title && <h3 className="st-group-name">{title}</h3>}
            <table className={`st-table${table.columns.length > 5 ? ' is-wide' : ''}`}>
              <thead>
                <tr>
                  <th scope="col" className="st-rank"><abbr title={t.rank}>#</abbr></th>
                  <th scope="col" className="st-name">{who}</th>
                  {table.columns.map((column) => {
                    const [short, long] = columnLabel(column, competition, language)
                    return <th key={column} scope="col" className={`st-num is-${column}`}><abbr title={long}>{short}</abbr></th>
                  })}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, rowIndex) => {
                  const zone = zoneOf(rowKey(row))
                  const zoneStart = zone && rowIndex > 0 && rowKey(row) !== rowKey(group.rows[rowIndex - 1])
                  return (
                  <tr key={`${row.rank}-${row.name}`} className={[row.highlight ? 'is-highlight' : '', row.live ? 'is-live' : '', zone ? 'has-zone' : '', zoneStart ? 'st-zone-start' : ''].filter(Boolean).join(' ') || undefined} style={zone?.style}>
                    <td className={`st-rank${zone ? ' has-zone' : ''}`}>
                      <span className="st-rank-number" role={zone ? 'img' : undefined} title={zone?.name} aria-label={zone ? `${t.rank} ${row.rank}: ${zone.name}` : undefined}>{row.rank}</span>
                    </td>
                    <td className="st-name">
                      <span className="st-team">
                        {row.teamId && onOpenTeam ? (
                          <button type="button" className="st-team-link" aria-label={t.openTeam(teamName(row.name, language))} title={t.openTeam(teamName(row.name, language))} onClick={() => onOpenTeam(row.teamId!)}>
                            <Logo src={row.logo} className="st-logo" />
                            <span className="st-team-name">{teamName(row.name, language)}</span>
                          </button>
                        ) : (
                          <>
                            <Logo src={row.logo} className="st-logo" />
                            <span className="st-team-name">{teamName(row.name, language)}</span>
                          </>
                        )}
                        {table.live && row.rankChange ? (
                          <i className={`st-move ${row.rankChange > 0 ? 'is-up' : 'is-down'}`} role="img" aria-label={row.rankChange > 0 ? t.moveUp(row.rankChange) : t.moveDown(-row.rankChange)} title={row.rankChange > 0 ? t.moveUp(row.rankChange) : t.moveDown(-row.rankChange)} />
                        ) : null}
                        {row.live && (
                          <span className={`st-result is-${row.live.outcome}`} title={t.liveResult(row.live.score, row.live.minute)} aria-label={t.liveResult(row.live.score, row.live.minute)}>{row.live.score}</span>
                        )}
                      </span>
                    </td>
                    {row.values.map((value, column) => (
                      <td key={table.columns[column] ?? column} className={`st-num is-${table.columns[column]}`}>
                        {table.columns[column] === 'gamesPlayed' ? <FormCell row={row} value={value} language={language} /> : value}
                      </td>
                    ))}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )
      })}
      {narrowed && (
        <button type="button" className="sp-text-button st-more" onClick={() => setAllGroups((value) => !value)}>{allGroups ? t.ownGroups : t.allGroups}</button>
      )}
      {zones.length > 0 && (
        <ul className="st-legend st-zone-legend" aria-label={t.zones}>
          {zones.map((zone) => (
            <li key={zoneKey(zone)} style={zone.style}><span className="st-zone-legend-swatch" aria-hidden="true" /><span>{zone.name}</span></li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The round to start with: the round of the match, else the first round that is not over yet, else the last one. */
function startRound(rounds: SportsRound[]) {
  const marked = rounds.findIndex((round) => round.matchups.some((tie) => tie.highlight))
  if (marked >= 0) return marked
  const running = rounds.findIndex((round) => round.matchups.some((tie) => tie.games.some((game) => game.status === 'scheduled' || game.status === 'live')))
  return running >= 0 ? running : rounds.length - 1
}

// A stable callback ref: React calls it when the tie appears, not on every render.
function revealOnMount(element: HTMLElement | null) {
  element?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
}

interface TieProps {
  tie: SportsMatchup
  language: Language
  t: Copy
  date: Intl.DateTimeFormat
  onOpenTeam?: (id: string) => void
}

function TieSide({ team, score, language, t, onOpenTeam }: { team: SportsBracketTeam | null; score: number | null; language: Language; t: Copy; onOpenTeam?: (id: string) => void }) {
  const name = team ? teamName(team.name, language) : t.open
  const content = (
    <>
      <Logo src={team?.logo ?? null} className="br-logo" />
      <span className="br-name" title={name}>{name}</span>
    </>
  )
  return (
    <span className={`br-side${team?.winner ? ' is-winner' : ''}${team ? '' : ' is-open'}`}>
      {team?.teamId && onOpenTeam
        ? <button type="button" className="br-team-link" aria-label={t.openTeam(name)} title={t.openTeam(name)} onClick={() => onOpenTeam(team.teamId!)}>{content}</button>
        : content}
      <b className="br-score">{score ?? ''}</b>
    </span>
  )
}

function Tie({ tie, language, t, date, onOpenTeam }: TieProps) {
  const played = tie.games.filter((game) => game.status === 'live' || game.status === 'finished')
  const live = tie.games.some((game) => game.status === 'live')
  const next = tie.games.find((game) => game.status === 'scheduled')
  const note = played[played.length - 1]?.note
  const decided = Boolean(tie.home?.winner || tie.away?.winner)
  const meta = [
    live ? t.live : null,
    tie.games.length > 1 && played.length > 0 ? played.map((game) => `${game.homeScore ?? '–'}:${game.awayScore ?? '–'}`).join(' · ') : null,
    note ? t[note] : null,
    next && !live ? date.format(new Date(next.start)) : null,
  ].filter(Boolean)
  return (
    <div
      className={`br-tie${tie.highlight ? ' is-highlight' : ''}${live ? ' is-live' : ''}${decided ? ' is-decided' : ''}`}
      ref={tie.highlight ? revealOnMount : undefined}
      aria-current={tie.highlight ? 'true' : undefined}
    >
      <TieSide team={tie.home} score={tie.homeScore} language={language} t={t} onOpenTeam={onOpenTeam} />
      <TieSide team={tie.away} score={tie.awayScore} language={language} t={t} onOpenTeam={onOpenTeam} />
      {meta.length > 0 && <small className="br-meta">{meta.join(' · ')}</small>}
    </div>
  )
}

function Bracket({ rounds, language, t, onOpenTeam }: { rounds: SportsRound[]; language: Language; t: Copy; onOpenTeam?: (id: string) => void }) {
  const [chosen, setChosen] = useState<number | null>(null)
  const initial = useMemo(() => startRound(rounds), [rounds])
  const date = useMemo(() => new Intl.DateTimeFormat(localeFor(language), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [language])
  const start = chosen !== null && chosen < rounds.length ? chosen : initial
  // the chosen round, and the rounds after it as long as each one is fed by the one before: that is the tree
  const columns = [rounds[start]]
  for (let index = start; rounds[index].feedsNext && index + 1 < rounds.length; index += 1) columns.push(rounds[index + 1])

  return (
    <div className="br">
      {rounds.length > 1 && (
        <div className="sp-filter br-rounds" role="group" aria-label={t.rounds}>
          {rounds.map((round, index) => (
            <button key={round.stage} type="button" className={index === start ? 'active' : ''} aria-pressed={index === start} onClick={() => setChosen(index)}>
              {stageLabel(round.stage, language)}
            </button>
          ))}
        </div>
      )}
      <div className={`br-tree${columns.length > 1 ? ' is-tree' : ''}`}>
        {columns.map((round, column) => (
          <section key={round.stage} className={`br-column${column > 0 ? ' is-fed' : ''}${column < columns.length - 1 ? ' is-feeding' : ''}`} aria-label={stageLabel(round.stage, language)}>
            <h3 className="br-column-title">{stageLabel(round.stage, language)}</h3>
            <ol className="br-slots">
              {round.matchups.map((tie, index) => (
                <li key={index} className="br-slot"><Tie tie={tie} language={language} t={t} date={date} onOpenTeam={onOpenTeam} /></li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}

interface BodyProps {
  standings: SportsStandings
  view: StandingsView
  language: Language
  /** In the panel of a match: the groups of its teams first. */
  focus?: boolean
  /** The team names open the team page (football). */
  onOpenTeam?: (id: string) => void
}

/** The table, the top scorers or the tree of a competition, with the season underneath. */
export function StandingsBody({ standings, view, language, focus = false, onOpenTeam }: BodyProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const [chosenSeason, setChosenSeason] = useState<string | null>(null)
  const { standings: historical, loading, failed, retry } = useStandings(chosenSeason ? standings.competition : null, null, chosenSeason)
  const selected = chosenSeason === null ? standings : historical
  const seasons = sportsSeasonOptions([standings.season, chosenSeason], standings.seasons ?? [], historical?.seasons ?? [])
  if (view === 'scorers') return <TopScorers key={standings.competition} competition={standings.competition} season={chosenSeason ?? standings.season} language={language} />
  return (
    <>
      <SportsSeasonSelect season={chosenSeason ?? standings.season} seasons={seasons} language={language} onChange={setChosenSeason} />
      {loading && <p className="md-empty" role="status">{language === 'de' ? 'Saison wird geladen …' : 'Loading season …'}</p>}
      {failed && <p className="md-empty" role="status">{language === 'de' ? 'Die Saison ist gerade nicht erreichbar.' : 'This season is not reachable right now.'} <button type="button" className="sp-text-button" onClick={retry}>{language === 'de' ? 'Erneut versuchen' : 'Try again'}</button></p>}
      {selected && (view === 'table' && selected.table
        ? <StandingsTable table={selected.table} competition={selected.competition} language={language} focus={focus} t={t} onOpenTeam={onOpenTeam} />
        : view === 'bracket' && selected.bracket ? <Bracket rounds={selected.bracket.rounds} language={language} t={t} onOpenTeam={onOpenTeam} />
          : <p className="md-empty">{language === 'de' ? 'Für diese Saison sind keine Daten verfügbar.' : 'No data is available for this season.'}</p>)}
      {selected?.season && <p className="sp-foot st-foot">{t.season(selected.season)}</p>}
    </>
  )
}
