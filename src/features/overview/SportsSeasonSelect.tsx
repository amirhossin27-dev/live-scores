import type { Language } from '../../types/platform'
import './sportsSeasons.css'

import { normalizeSportsSeason, sportsSeasonOptions } from './sportsSeasons'

export function SportsSeasonSelect({ season, seasons, language, onChange }: {
  season: string | null
  seasons: readonly string[]
  language: Language
  onChange: (season: string) => void
}) {
  const value = normalizeSportsSeason(season) ?? ''
  const options = sportsSeasonOptions([value], seasons)
  return <label className="sports-season">{language === 'de' ? 'Saison' : 'Season'}<select value={value} onChange={(event) => onChange(event.target.value)}>
    {!value && <option value="">{language === 'de' ? 'Aktuelle Saison' : 'Current season'}</option>}
    {options.map((item) => <option key={item} value={item}>{item}</option>)}
  </select></label>
}
