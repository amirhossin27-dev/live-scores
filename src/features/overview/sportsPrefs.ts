import { competitionById, maxCompetitions, presetSelection } from './sportsCatalog'

const storageKey = 'dwh.sports.v1'

/** The competitions the user picked in the settings of the sports widget; stored in this browser only. Nothing stored yet: the preset. */
export function readSportsSelection(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')
    if (Array.isArray(stored)) {
      const known = stored.filter((id): id is string => typeof id === 'string' && competitionById(id) !== undefined)
      return [...new Set(known)].slice(0, maxCompetitions)
    }
  } catch {
    // Unreadable or blocked storage: fall back to the preset.
  }
  return presetSelection
}

export function saveSportsSelection(ids: string[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids))
  } catch {
    // The choice only lasts for this visit.
  }
}

const favoritesKey = 'dwh.sports.favorites.v1'
// A favourite is forgotten two weeks after its kick-off, so the list does not grow forever.
const favoriteLifetimeMs = 14 * 24 * 60 * 60 * 1000

/** A match the user marked with the star: the competition and the id of the source, and the kick-off. */
export interface SportsFavorite {
  competition: string
  id: string
  start: string
}

export function favoriteKey(competition: string, id: string) {
  return `${competition}|${id}`
}

/** The favourite matches of this browser, without the ones that are long over. */
export function readSportsFavorites(now = Date.now()): SportsFavorite[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(favoritesKey) ?? 'null')
    if (Array.isArray(stored)) {
      return stored.filter((item): item is SportsFavorite =>
        typeof item === 'object' && item !== null
        && typeof (item as SportsFavorite).competition === 'string'
        && typeof (item as SportsFavorite).id === 'string'
        && typeof (item as SportsFavorite).start === 'string'
        && now - new Date((item as SportsFavorite).start).getTime() < favoriteLifetimeMs)
    }
  } catch {
    // Unreadable or blocked storage: no favourites.
  }
  return []
}

export function saveSportsFavorites(favorites: SportsFavorite[]) {
  try {
    window.localStorage.setItem(favoritesKey, JSON.stringify(favorites))
  } catch {
    // The stars only last for this visit.
  }
}

const favoriteCompetitionsKey = 'dwh.sports.favoriteCompetitions.v1'

/** The competitions the user marked with the star of their title: all their matches count as favourites. */
export function readFavoriteCompetitions(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(favoriteCompetitionsKey) ?? 'null')
    if (Array.isArray(stored)) return [...new Set(stored.filter((id): id is string => typeof id === 'string' && competitionById(id) !== undefined))]
  } catch {
    // Unreadable or blocked storage: no favourite competitions.
  }
  return []
}

export function saveFavoriteCompetitions(ids: string[]) {
  try {
    window.localStorage.setItem(favoriteCompetitionsKey, JSON.stringify(ids))
  } catch {
    // The stars only last for this visit.
  }
}
