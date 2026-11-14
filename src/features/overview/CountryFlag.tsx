import { useState } from 'react'
import type { Language } from '../../types/platform'
import type { SportsCountry } from './sportsApi'
import { countryName, rectangularFlagUrl } from './sportsCountries'

/** A country flag, optionally using a flat rectangular asset, with a localized name; hidden if its image fails. */
export function CountryFlag({ country, language, rectangular = false }: { country: SportsCountry | null; language: Language; rectangular?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const source = rectangular ? rectangularFlagUrl(country) : country?.flag
  if (!country || !source || failedSource === source) return null
  const name = countryName(country, language)
  return <img className="sp-country-flag" src={source} alt={name} title={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} />
}
