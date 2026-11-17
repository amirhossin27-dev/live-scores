import { describe, expect, it } from 'vitest'
import { zoneAppearance } from './sportsZones'

function appearance(text: string, key: string | null = null) {
  return zoneAppearance({ key, text }) as Record<string, string>
}

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map((channel) => parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(one: string, two: string) {
  return (Math.max(luminance(one), luminance(two)) + 0.05) / (Math.min(luminance(one), luminance(two)) + 0.05)
}

describe('table zone palettes', () => {
  it.each(['Relegation playoff', 'Relegation Play-Offs', 'Relegation qualification', 'Relegation (playoffs)', 'Play-offs against relegation'])(
    'uses light red for %s and dark red for direct relegation in both themes', (label) => {
      const playoff = appearance(label)
      const direct = appearance('Relegation')
      for (const mode of ['light', 'dark']) {
        expect(luminance(playoff[`--st-zone-${mode}`])).toBeGreaterThan(luminance(direct[`--st-zone-${mode}`]))
      }
      expect(playoff['--st-zone-light']).toBe('#fecaca')
      expect(playoff['--st-zone-dark']).toBe('#fda4af')
      expect(direct['--st-zone-light']).toBe('#991b1b')
      expect(direct['--st-zone-dark']).toBe('#b91c1c')
    },
  )

  it('recognizes the provider key and does not confuse promotion playoffs with relegation', () => {
    expect(appearance('Relegation', 'relegationqual')).toEqual(appearance('Relegation playoff'))
    expect(appearance('Promotion Play-Offs')['--st-zone-light']).not.toBe(appearance('Relegation playoff')['--st-zone-light'])
  })

  it('keeps Conference League distinct from Champions League, Europa League and promotion', () => {
    for (const mode of ['light', 'dark']) {
      const conference = appearance('UEFA Europa Conference League')[`--st-zone-${mode}`]
      expect(conference).toBe(appearance('Conference League', 'europa_conference_league')[`--st-zone-${mode}`])
      for (const label of ['Champions League', 'Europa League', 'Promotion']) {
        expect(conference).not.toBe(appearance(label)[`--st-zone-${mode}`])
      }
    }
  })

  it('keeps rank numbers readable and red badge boundaries visible in both themes', () => {
    for (const label of ['Champions League', 'Europa League', 'Conference League', 'Promotion', 'Relegation', 'Relegation playoff', 'Playoff', 'Eliminated', 'Qualification next stage', 'Unknown']) {
      const palette = appearance(label)
      for (const mode of ['light', 'dark']) {
        expect(contrast(palette[`--st-zone-${mode}`], palette[`--st-zone-text-${mode}`])).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const label of ['Relegation', 'Relegation playoff']) {
      const palette = appearance(label)
      expect(contrast(palette['--st-zone-edge-light'], '#ffffff')).toBeGreaterThanOrEqual(3)
      expect(contrast(palette['--st-zone-edge-dark'], '#172033')).toBeGreaterThanOrEqual(3)
    }
  })

  it('uses a neutral marker when the source provides no known meaning', () => {
    expect(appearance('Unknown table zone')).toEqual(appearance('Eliminated'))
  })
})

it('distinguishes promotion qualification from direct promotion, including provider keys', () => {
  const promotion = zoneAppearance({ key: 'promotion', text: 'Promotion' })
  const playoff = zoneAppearance({ key: 'promotionqual', text: 'Promotion qualification' })
  expect(playoff).toEqual(zoneAppearance({ key: null, text: 'Promotion playoff' }))
  expect(playoff).not.toEqual(promotion)
})

it('distinguishes direct playoff berths, play-in qualification and first-round byes', () => {
  const direct = zoneAppearance({ key: 'playoff_berth', text: 'Playoffs' })
  const playIn = zoneAppearance({ key: 'playin', text: 'Play-In Tournament' })
  const bye = zoneAppearance({ key: 'playoff_bye', text: 'Playoffs with a first-round bye' })
  expect(direct).not.toEqual(playIn)
  expect(bye).not.toEqual(playIn)
  expect(bye).not.toEqual(direct)
})
