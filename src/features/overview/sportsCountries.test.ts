import { describe, expect, it } from 'vitest'
import countries from '../../../shared/sportsCountries.json'
import type { SportsCountry } from './sportsApi'
import { countryName, rectangularFlagUrl } from './sportsCountries'

function country(code: string | null, iso: string | null = null, name = 'Source country'): SportsCountry {
  return { name, code, iso, flag: 'https://example.test/source-country.png' }
}

describe('shared football country catalog', () => {
  it('covers all 211 FIFA associations with unique primary FIFA codes', () => {
    expect(countries).toHaveLength(211)
    expect(new Set(countries.map((entry) => entry.fifa)).size).toBe(211)
  })

  it.each(countries)('resolves $fifa to the shared ISO and PNG when the source omits ISO', ({ fifa, iso }) => {
    const source = country(fifa)
    expect(rectangularFlagUrl(source)).toBe(`https://flagcdn.com/w40/${iso}.png`)
  })

  it.each([
    { fifa: 'EQG', iso: 'gq', de: 'Äquatorialguinea' },
    { fifa: 'SUR', iso: 'sr', de: 'Suriname' },
    { fifa: 'SGP', iso: 'sg', de: 'Singapur' },
    { fifa: 'SIN', iso: 'sg', de: 'Singapur' },
  ])('uses a stable known mapping and localized label for $fifa', ({ fifa, iso, de }) => {
    const source = country(fifa)
    expect(rectangularFlagUrl(source)).toBe(`https://flagcdn.com/w40/${iso}.png`)
    expect(countryName(source, 'de')).toBe(de)
  })

  it.each([
    { fifa: 'GNB', iso: 'gw' },
    { fifa: 'CGO', iso: 'cg' },
    { fifa: 'BER', iso: 'bm' },
    { fifa: 'TPE', iso: 'tw' },
    { fifa: 'TAH', iso: 'pf' },
    { fifa: 'PLE', iso: 'ps' },
    { fifa: 'SKN', iso: 'kn' },
  ])('retains the verified mapping for previously missing association $fifa', ({ fifa, iso }) => {
    expect(rectangularFlagUrl(country(fifa))).toBe(`https://flagcdn.com/w40/${iso}.png`)
  })

  it('normalizes source metadata and prioritizes an explicit valid ISO over FIFA fallback', () => {
    expect(rectangularFlagUrl(country('GER', ' FR '))).toBe('https://flagcdn.com/w40/fr.png')
    expect(countryName(country('GER', ' FR '), 'de')).toBe('Frankreich')
    expect(rectangularFlagUrl(country(' eqg ', 'not-an-iso'))).toBe('https://flagcdn.com/w40/gq.png')
    expect(countryName(country(' eqg ', 'not-an-iso'), 'de')).toBe('Äquatorialguinea')
    expect(rectangularFlagUrl(country(' ger ', ''))).toBe('https://flagcdn.com/w40/de.png')
  })

  it.each([null, '', 'ZZZ', 'Germany', 'Deutschland', 'GER-other', 'Taiwan', 'French Polynesia'])('does not guess an ISO from names or source logos when code is %s', (code) => {
    const source = country(code, null, 'Germany')
    expect(rectangularFlagUrl(source)).toBeNull()
    expect(countryName(source, 'de')).toBe('Germany')
  })

  it('does not guess a flag from invalid ISO metadata when FIFA data is also unavailable', () => {
    expect(rectangularFlagUrl(country(null, '../de', 'Germany'))).toBeNull()
    expect(rectangularFlagUrl(country(null, 'gb-other', 'Scotland'))).toBeNull()
    expect(rectangularFlagUrl(null)).toBeNull()
  })
})
