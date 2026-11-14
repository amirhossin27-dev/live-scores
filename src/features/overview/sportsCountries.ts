import type { Language } from '../../types/platform'
import type { SportsCountry } from './sportsApi'
import { localeFor } from './overviewCopy'
import countries from '../../../shared/sportsCountries.json'

// The home nations have no ISO country code that Intl knows.
const homeNations: Record<string, { de: string; en: string }> = {
  'gb-eng': { de: 'England', en: 'England' },
  'gb-sct': { de: 'Schottland', en: 'Scotland' },
  'gb-wls': { de: 'Wales', en: 'Wales' },
  'gb-nir': { de: 'Nordirland', en: 'Northern Ireland' },
}

const countryIdentifiers: { fifa: string; iso: string; codeAliases?: string[] }[] = countries
const isoByFifa = new Map(countryIdentifiers.flatMap((country) =>
  [country.fifa, ...(country.codeAliases ?? [])].map((code) => [code, country.iso] as const)))

/** Resolve explicit source identifiers using the same complete catalog as the API, including older cached responses. */
function countryIso(country: SportsCountry | null) {
  const iso = country?.iso?.trim().toLowerCase()
  if (iso && (/^[a-z]{2}$/.test(iso) || Object.hasOwn(homeNations, iso))) return iso
  const fifa = country?.code?.trim().toUpperCase()
  return fifa ? isoByFifa.get(fifa) ?? null : null
}

/** Flat flags by explicit ISO/FIFA codes; country, player and team names never determine the image. */
export function rectangularFlagUrl(country: SportsCountry | null) {
  const iso = countryIso(country)
  return iso ? `https://flagcdn.com/w40/${iso}.png` : null
}

/** The country name in the UI language, with the source name as fallback. */
export function countryName(country: SportsCountry, language: Language) {
  const lang = language === 'de' ? 'de' : 'en'
  const iso = countryIso(country)
  if (iso && homeNations[iso]) return homeNations[iso][lang]
  if (iso && /^[a-z]{2}$/.test(iso)) {
    try {
      return new Intl.DisplayNames([localeFor(language)], { type: 'region' }).of(iso.toUpperCase()) ?? country.name
    } catch {
      return country.name
    }
  }
  return country.name
}
