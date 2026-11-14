import type { Language } from '../../types/platform'
import type { FlagCode } from './Flag'

/** More than the API takes in one request would be refused. */
export const maxCompetitions = 40

export type SportsGroup = 'leagues' | 'cups' | 'europe' | 'national' | 'motorsport' | 'fighting' | 'usa'

export interface SportsCompetition {
  /** Path of the scoreboard at ESPN: `<sport>/<league>`. */
  id: string
  flag: FlagCode
  group: SportsGroup
  country: { de: string; en: string }
  name: { de: string; en: string }
  /** On from the start (the leagues of the Flashscore list, the cups of the top four leagues, the big tournaments). */
  preset: boolean
}

function entry(id: string, flag: FlagCode, group: SportsGroup, country: [string, string], name: [string, string], preset = false): SportsCompetition {
  return { id, flag, group, country: { de: country[0], en: country[1] }, name: { de: name[0], en: name[1] }, preset }
}

/** The order here is the order on the page. */
export const sportsCatalog: SportsCompetition[] = [
  entry('soccer/ger.1', 'de', 'leagues', ['Deutschland', 'Germany'], ['Bundesliga', 'Bundesliga'], true),
  entry('soccer/ger.2', 'de', 'leagues', ['Deutschland', 'Germany'], ['2. Bundesliga', '2. Bundesliga'], true),
  entry('soccer/eng.1', 'gb-eng', 'leagues', ['England', 'England'], ['Premier League', 'Premier League'], true),
  entry('soccer/fra.1', 'fr', 'leagues', ['Frankreich', 'France'], ['Ligue 1', 'Ligue 1'], true),
  entry('soccer/ita.1', 'it', 'leagues', ['Italien', 'Italy'], ['Serie A', 'Serie A'], true),
  entry('soccer/ksa.1', 'sa', 'leagues', ['Saudi-Arabien', 'Saudi Arabia'], ['Premier League', 'Saudi Pro League'], true),
  entry('soccer/esp.1', 'es', 'leagues', ['Spanien', 'Spain'], ['LaLiga', 'LaLiga'], true),
  entry('soccer/tur.1', 'tr', 'leagues', ['Türkei', 'Turkey'], ['Süper Lig', 'Süper Lig'], true),
  entry('soccer/eng.2', 'gb-eng', 'leagues', ['England', 'England'], ['Championship', 'Championship']),
  entry('soccer/ned.1', 'nl', 'leagues', ['Niederlande', 'Netherlands'], ['Eredivisie', 'Eredivisie']),
  entry('soccer/por.1', 'pt', 'leagues', ['Portugal', 'Portugal'], ['Liga Portugal', 'Liga Portugal']),
  entry('soccer/bel.1', 'be', 'leagues', ['Belgien', 'Belgium'], ['Pro League', 'Pro League']),
  entry('soccer/aut.1', 'at', 'leagues', ['Österreich', 'Austria'], ['Bundesliga', 'Bundesliga']),
  entry('soccer/sui.1', 'ch', 'leagues', ['Schweiz', 'Switzerland'], ['Super League', 'Super League']),
  entry('soccer/sco.1', 'gb-sct', 'leagues', ['Schottland', 'Scotland'], ['Premiership', 'Premiership']),
  entry('soccer/usa.1', 'us', 'leagues', ['USA', 'USA'], ['MLS', 'MLS']),
  entry('soccer/mex.1', 'mx', 'leagues', ['Mexiko', 'Mexico'], ['Liga MX', 'Liga MX']),
  entry('soccer/bra.1', 'br', 'leagues', ['Brasilien', 'Brazil'], ['Série A', 'Série A']),
  entry('soccer/arg.1', 'ar', 'leagues', ['Argentinien', 'Argentina'], ['Liga Profesional', 'Liga Profesional']),

  entry('soccer/ger.dfb_pokal', 'de', 'cups', ['Deutschland', 'Germany'], ['DFB-Pokal', 'DFB-Pokal'], true),
  entry('soccer/eng.fa', 'gb-eng', 'cups', ['England', 'England'], ['FA Cup', 'FA Cup'], true),
  entry('soccer/esp.copa_del_rey', 'es', 'cups', ['Spanien', 'Spain'], ['Copa del Rey', 'Copa del Rey'], true),
  entry('soccer/ita.coppa_italia', 'it', 'cups', ['Italien', 'Italy'], ['Coppa Italia', 'Coppa Italia'], true),
  entry('soccer/eng.league_cup', 'gb-eng', 'cups', ['England', 'England'], ['EFL Cup', 'EFL Cup']),
  entry('soccer/fra.coupe_de_france', 'fr', 'cups', ['Frankreich', 'France'], ['Coupe de France', 'Coupe de France']),
  entry('soccer/ger.super_cup', 'de', 'cups', ['Deutschland', 'Germany'], ['Supercup', 'Supercup']),

  entry('soccer/uefa.champions', 'eu', 'europe', ['Europa', 'Europe'], ['Champions League', 'Champions League'], true),
  entry('soccer/uefa.europa', 'eu', 'europe', ['Europa', 'Europe'], ['Europa League', 'Europa League'], true),
  entry('soccer/uefa.europa.conf', 'eu', 'europe', ['Europa', 'Europe'], ['Conference League', 'Conference League'], true),
  entry('soccer/uefa.super_cup', 'eu', 'europe', ['Europa', 'Europe'], ['UEFA Super Cup', 'UEFA Super Cup']),
  entry('soccer/fifa.cwc', 'world', 'europe', ['Welt', 'World'], ['Klub-Weltmeisterschaft', 'Club World Cup']),
  entry('soccer/conmebol.libertadores', 'world', 'europe', ['Südamerika', 'South America'], ['Copa Libertadores', 'Copa Libertadores']),
  entry('soccer/conmebol.sudamericana', 'world', 'europe', ['Südamerika', 'South America'], ['Copa Sudamericana', 'Copa Sudamericana']),
  entry('soccer/concacaf.champions', 'world', 'europe', ['Nord-/Mittelamerika', 'North/Central America'], ['Champions Cup', 'Champions Cup']),

  entry('soccer/fifa.world', 'world', 'national', ['Welt', 'World'], ['Weltmeisterschaft', 'World Cup'], true),
  entry('soccer/uefa.euro', 'eu', 'national', ['Europa', 'Europe'], ['Europameisterschaft', 'European Championship'], true),
  entry('soccer/uefa.nations', 'eu', 'national', ['Europa', 'Europe'], ['Nations League', 'Nations League'], true),
  entry('soccer/fifa.friendly', 'world', 'national', ['Welt', 'World'], ['Länderspiele (Freundschaft)', 'International friendlies']),
  entry('soccer/fifa.worldq.uefa', 'eu', 'national', ['Europa', 'Europe'], ['WM-Qualifikation', 'World Cup qualifying']),
  entry('soccer/uefa.euroq', 'eu', 'national', ['Europa', 'Europe'], ['EM-Qualifikation', 'Euro qualifying']),
  entry('soccer/fifa.worldq.conmebol', 'world', 'national', ['Südamerika', 'South America'], ['WM-Qualifikation', 'World Cup qualifying']),
  entry('soccer/conmebol.america', 'world', 'national', ['Südamerika', 'South America'], ['Copa América', 'Copa América']),
  entry('soccer/caf.nations', 'world', 'national', ['Afrika', 'Africa'], ['Afrika-Cup', 'Africa Cup of Nations']),
  entry('soccer/concacaf.gold', 'world', 'national', ['Nord-/Mittelamerika', 'North/Central America'], ['Gold Cup', 'Gold Cup']),
  entry('soccer/concacaf.nations.league', 'world', 'national', ['Nord-/Mittelamerika', 'North/Central America'], ['Nations League', 'Nations League']),

  entry('racing/f1', 'racing', 'motorsport', ['Motorsport', 'Motorsport'], ['Formel 1', 'Formula 1'], true),
  entry('racing/irl', 'racing', 'motorsport', ['Motorsport', 'Motorsport'], ['IndyCar', 'IndyCar']),
  entry('racing/nascar-premier', 'racing', 'motorsport', ['Motorsport', 'Motorsport'], ['NASCAR Cup', 'NASCAR Cup']),

  entry('mma/ufc', 'fight', 'fighting', ['Kampfsport', 'Combat sports'], ['UFC', 'UFC'], true),
  entry('mma/pfl', 'fight', 'fighting', ['Kampfsport', 'Combat sports'], ['PFL', 'PFL']),
  entry('mma/bellator', 'fight', 'fighting', ['Kampfsport', 'Combat sports'], ['Bellator', 'Bellator']),

  entry('basketball/nba', 'us', 'usa', ['Basketball', 'Basketball'], ['NBA', 'NBA']),
  entry('basketball/wnba', 'us', 'usa', ['Basketball', 'Basketball'], ['WNBA', 'WNBA']),
  entry('football/nfl', 'us', 'usa', ['American Football', 'American football'], ['NFL', 'NFL']),
  entry('hockey/nhl', 'us', 'usa', ['Eishockey', 'Ice hockey'], ['NHL', 'NHL']),
  entry('baseball/mlb', 'us', 'usa', ['Baseball', 'Baseball'], ['MLB', 'MLB']),
]

export const sportsGroups: SportsGroup[] = ['leagues', 'cups', 'europe', 'national', 'motorsport', 'fighting', 'usa']

export const groupLabels: Record<SportsGroup, { de: string; en: string }> = {
  leagues: { de: 'Fußball – Ligen', en: 'Football – leagues' },
  cups: { de: 'Fußball – Landespokale', en: 'Football – domestic cups' },
  europe: { de: 'Fußball – Vereinswettbewerbe', en: 'Football – club competitions' },
  national: { de: 'Fußball – Nationalmannschaften', en: 'Football – national teams' },
  motorsport: { de: 'Motorsport', en: 'Motorsport' },
  fighting: { de: 'Kampfsport', en: 'Combat sports' },
  usa: { de: 'US-Sport', en: 'US sports' },
}

export const presetSelection = sportsCatalog.filter((competition) => competition.preset).map((competition) => competition.id)

const byId = new Map(sportsCatalog.map((competition) => [competition.id, competition]))

export function competitionById(id: string) {
  return byId.get(id)
}

/** Fight cards have no table, friendlies neither a table nor a knock-out tree (the API refuses both). */
export function hasStandings(id: string) {
  return !id.startsWith('mma/') && id !== 'soccer/fifa.friendly'
}

export function competitionName(competition: SportsCompetition, language: Language) {
  return competition.name[language === 'de' ? 'de' : 'en']
}

export function competitionCountry(competition: SportsCompetition, language: Language) {
  return competition.country[language === 'de' ? 'de' : 'en']
}

/** "Germany · Bundesliga", as the live scores name a competition (its id when it is not in the catalog). */
export function competitionLabelOf(id: string, language: Language) {
  const competition = byId.get(id)
  return competition ? `${competitionCountry(competition, language)} · ${competitionName(competition, language)}` : id
}
