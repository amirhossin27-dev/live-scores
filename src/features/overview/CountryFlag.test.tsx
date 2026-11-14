import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CountryFlag } from './CountryFlag'
import type { SportsCountry } from './sportsApi'

const germany: SportsCountry = {
  name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png',
}

afterEach(cleanup)

describe('CountryFlag sources', () => {
  it('keeps the original source by default and uses the flat PNG asset only when rectangular is requested', () => {
    const { rerender } = render(<CountryFlag country={germany} language="de" />)
    expect(screen.getByRole('img', { name: 'Deutschland' }).getAttribute('src')).toBe(germany.flag)
    rerender(<CountryFlag country={germany} language="de" rectangular />)
    expect(screen.getByRole('img', { name: 'Deutschland' }).getAttribute('src')).toBe('https://flagcdn.com/w40/de.png')
  })

  it('uses the supplied two-letter ISO, case-insensitively, even without a source logo', () => {
    render(<CountryFlag country={{ ...germany, iso: ' DE ', flag: null }} language="en" rectangular />)
    expect(screen.getByRole('img', { name: 'Germany' }).getAttribute('src')).toBe('https://flagcdn.com/w40/de.png')
  })

  it.each([
    { iso: 'GB-ENG', de: 'England', en: 'England' },
    { iso: 'gb-sct', de: 'Schottland', en: 'Scotland' },
    { iso: 'gb-wls', de: 'Wales', en: 'Wales' },
    { iso: 'gb-nir', de: 'Nordirland', en: 'Northern Ireland' },
  ])('uses the specific home-nation PNG for $iso with localized accessible names', ({ iso, de, en }) => {
    const country = { ...germany, name: 'United Kingdom', iso }
    const { rerender } = render(<CountryFlag country={country} language="de" rectangular />)
    expect(screen.getByRole('img', { name: de }).getAttribute('src')).toBe(`https://flagcdn.com/w40/${iso.toLowerCase()}.png`)
    rerender(<CountryFlag country={country} language="en" rectangular />)
    expect(screen.getByRole('img', { name: en }).getAttribute('src')).toBe(`https://flagcdn.com/w40/${iso.toLowerCase()}.png`)
  })

  it.each([null, '', 'GER', 'Germany', 'gb-other', '../de', 'de?round=true'])('falls back to a known explicit FIFA code when source ISO is missing or invalid (%s)', (iso) => {
    const country = { ...germany, iso }
    const { rerender } = render(<CountryFlag country={country} language="en" rectangular />)
    expect(screen.getByRole('img', { name: 'Germany' }).getAttribute('src')).toBe('https://flagcdn.com/w40/de.png')
    rerender(<CountryFlag country={country} language="en" />)
    expect(screen.getByRole('img', { name: 'Germany' }).getAttribute('src')).toBe(germany.flag)
  })

  it('uses the confirmed SUR code fallback when ISO is missing without guessing other codes from the country name', () => {
    const country: SportsCountry = { name: 'Suriname', code: 'SUR', iso: null, flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/sur.png' }
    const { rerender } = render(<CountryFlag country={country} language="en" rectangular />)
    expect(screen.getByRole('img', { name: 'Suriname' }).getAttribute('src')).toBe('https://flagcdn.com/w40/sr.png')
    rerender(<CountryFlag country={{ ...country, code: 'ZZZ' }} language="en" rectangular />)
    expect(screen.queryByRole('img')).toBeNull()
    rerender(<CountryFlag country={{ ...country, code: null }} language="en" rectangular />)
    expect(screen.queryByRole('img')).toBeNull()
    rerender(<CountryFlag country={country} language="en" />)
    expect(screen.getByRole('img', { name: 'Suriname' }).getAttribute('src')).toBe(country.flag)
  })

  it('resolves EQG without ISO metadata and localizes the flag label as Äquatorialguinea', () => {
    const country: SportsCountry = { name: 'Equatorial Guinea', code: ' EQG ', iso: null, flag: null }
    const { rerender } = render(<CountryFlag country={country} language="de" rectangular />)
    expect(screen.getByRole('img', { name: 'Äquatorialguinea' }).getAttribute('src')).toBe('https://flagcdn.com/w40/gq.png')
    rerender(<CountryFlag country={country} language="en" rectangular />)
    expect(screen.getByRole('img', { name: 'Equatorial Guinea' }).getAttribute('src')).toBe('https://flagcdn.com/w40/gq.png')
  })

  it.each([null, '', 'ZZZ', 'Germany', 'GER-other'])('does not infer a flag from a known country name or old logo when the FIFA code is %s', (code) => {
    render(<CountryFlag country={{ ...germany, code, iso: null }} language="de" rectangular />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders nothing for an absent country', () => {
    render(<CountryFlag country={null} language="en" rectangular />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('hides a failed URL but displays a replacement source without remounting the component', () => {
    const { rerender } = render(<CountryFlag country={germany} language="en" />)
    fireEvent.error(screen.getByRole('img', { name: 'Germany' }))
    expect(screen.queryByRole('img')).toBeNull()
    rerender(<CountryFlag country={{ ...germany }} language="de" />)
    expect(screen.queryByRole('img')).toBeNull()
    const replacement = 'https://example.test/flags/germany.svg'
    rerender(<CountryFlag country={{ ...germany, flag: replacement }} language="de" />)
    expect(screen.getByRole('img', { name: 'Deutschland' }).getAttribute('src')).toBe(replacement)
  })

  it('recovers from a failed rectangular source when the ISO or rendering mode changes', () => {
    const { rerender } = render(<CountryFlag country={germany} language="en" rectangular />)
    fireEvent.error(screen.getByRole('img', { name: 'Germany' }))
    expect(screen.queryByRole('img')).toBeNull()
    const scotland = { name: 'Scotland', code: 'SCO', iso: 'gb-sct', flag: germany.flag }
    rerender(<CountryFlag country={scotland} language="en" rectangular />)
    expect(screen.getByRole('img', { name: 'Scotland' }).getAttribute('src')).toBe('https://flagcdn.com/w40/gb-sct.png')
    fireEvent.error(screen.getByRole('img', { name: 'Scotland' }))
    expect(screen.queryByRole('img')).toBeNull()
    rerender(<CountryFlag country={scotland} language="en" />)
    expect(screen.getByRole('img', { name: 'Scotland' }).getAttribute('src')).toBe(germany.flag)
  })
})
