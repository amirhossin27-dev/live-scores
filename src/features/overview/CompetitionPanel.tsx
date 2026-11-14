import { useState } from 'react'
import type { ReactNode } from 'react'
import { SideDrawer } from '../../components/SideDrawer'
import './sportsDetailPanel.css'
import type { Language } from '../../types/platform'
import { MatchLayers } from './MatchDetails'
import { localeFor } from './overviewCopy'
import type { SportsStandings } from './sportsApi'
import type { SportsCompetition } from './sportsCatalog'
import { competitionCountry, competitionName } from './sportsCatalog'
import { useStandings } from './sportsHooks'
import { standingsViews } from './sportsStandings'
import type { StandingsView } from './sportsStandings'
import { StandingsBody } from './Standings'
import { SportsTabs } from './SportsTabs'
import { TeamProfile } from './TeamProfile'

const copy = {
  de: {
    table: 'Tabelle',
    scorers: 'Top Scorers',
    bracket: 'Turnierbaum',
    close: 'Schließen',
    loading: 'Tabelle wird geladen …',
    down: 'Die Tabelle ist gerade nicht erreichbar.',
    retry: 'Erneut versuchen',
    none: 'Für diesen Wettbewerb gibt es (noch) keine Tabelle und keinen Turnierbaum.',
    backToTable: 'Zurück zur Tabelle',
  },
  en: {
    table: 'Table',
    scorers: 'Top Scorers',
    bracket: 'Bracket',
    close: 'Close',
    loading: 'Loading the table …',
    down: 'The table is not reachable right now.',
    retry: 'Try again',
    none: 'This competition has no table and no bracket (yet).',
    backToTable: 'Back to the table',
  },
}

/** The view a competition opens on: the tree once its knock-out stage has begun, else the table. */
function firstView(standings: SportsStandings, views: StandingsView[]): StandingsView {
  if (views.length < 2) return views[0] ?? 'table'
  const begun = standings.bracket?.rounds.some((round) => round.matchups.some((tie) => tie.games.some((game) => game.status !== 'scheduled')))
  return begun ? 'bracket' : 'table'
}

interface PanelProps {
  competition: SportsCompetition
  language: Language
  onClose: () => void
}

/**
 * The table, the top scorers and the knock-out tree of a competition in a side panel; opened from the title of a competition in the live scores.
 * Matches opened from the form of a team or from a team page lie over the table until "back".
 */
export function CompetitionPanel({ competition, language, onClose }: PanelProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const { standings, loading, retry } = useStandings(competition.id, null)
  const [chosen, setChosen] = useState<StandingsView | null>(null)
  const [team, setTeam] = useState<string | null>(null)
  const views = standingsViews(standings)
  const football = competition.id.startsWith('soccer/')
  const view = chosen && views.includes(chosen) ? chosen : standings ? firstView(standings, views) : 'table'

  let body: ReactNode
  if (!standings) {
    body = loading
      ? <p className="md-empty" aria-live="polite">{t.loading}</p>
      : <div className="md-empty" aria-live="polite"><span>{t.down}</span> <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></div>
  } else if (views.length === 0) {
    body = <p className="md-empty">{t.none}</p>
  } else {
    body = <StandingsBody standings={standings} view={view} language={language} onOpenTeam={football ? setTeam : undefined} />
  }

  return (
    <MatchLayers
      language={language}
      frame={(content) => (
        <SideDrawer className="sports-detail-drawer" title={competitionName(competition, language)} subtitle={competitionCountry(competition, language)} closeLabel={t.close} onClose={onClose}>
          {content}
        </SideDrawer>
      )}
    >
      {team ? (
        <TeamProfile key={team} team={{ id: team }} language={language} locale={localeFor(language)} backLabel={t.backToTable} onBack={() => setTeam(null)} />
      ) : (
        <SportsTabs tabs={views.map((item) => ({ id: item, label: t[item] }))} active={view} label={competitionName(competition, language)} onSelect={setChosen}>
          {body}
        </SportsTabs>
      )}
    </MatchLayers>
  )
}
