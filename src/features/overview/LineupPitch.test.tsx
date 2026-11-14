import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SportsCountry, SportsEvent, SportsEventKind, SportsLineup, SportsPlayer } from './sportsApi'
import { LineupPitch } from './LineupPitch'

afterEach(cleanup)

const germany: SportsCountry = { name: 'Germany', code: 'GER', iso: 'de', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/ger.png' }
const scotland: SportsCountry = { name: 'Scotland', code: 'SCO', iso: 'gb-sct', flag: 'https://images.fotmob.com/image_resources/logo/teamlogo/sco.png' }

function player(name: string, country?: SportsCountry | null): SportsPlayer {
  return { name, jersey: '9', position: null, x: 0.5, y: 0.2, rating: 7.2, profileId: name, subIn: null, subOut: null, captain: false, country }
}

function lineups(starter = player('Max Beispiel', germany), bench = player('Scott Example', scotland)): SportsLineup[] {
  return [{ side: 'home', formation: '4-4-2', starters: [starter], bench: [bench], source: 'fotmob', coach: null }]
}

describe('LineupPitch nationalities', () => {
  it('opens coaches with a source profile ID and leaves unknown coaches as text', () => {
    const onOpenPlayer = vi.fn()
    const teams = lineups()
    teams[0] = { ...teams[0], coach: 'Vincent Kompany', coachId: '39027' }
    const { rerender } = render(<LineupPitch lineups={teams} events={[]} homeName="Heim" awayName="Gast" language="de" locale="de-DE" onOpenPlayer={onOpenPlayer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vincent Kompany' }))
    expect(onOpenPlayer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Vincent Kompany', profileId: '39027' }))
    rerender(<LineupPitch lineups={[{ ...teams[0], coachId: null }]} events={[]} homeName="Heim" awayName="Gast" language="de" locale="de-DE" onOpenPlayer={onOpenPlayer} />)
    expect(screen.queryByRole('button', { name: 'Vincent Kompany' })).toBeNull()
    expect(screen.getByText('Trainer: Vincent Kompany')).toBeTruthy()
  })

  it('keeps nationality flags in the starter status and directly after substitute numbers', () => {
    const onOpen = vi.fn()
    render(<LineupPitch lineups={lineups()} events={[]} homeName="Heim" awayName="Gast" language="de" locale="de-DE" onOpenPlayer={onOpen} />)
    const starterButton = screen.getByRole('button', { name: /Max Beispiel.*Nationalität: Deutschland/ })
    const starter = starterButton.closest('.lp-player') as HTMLElement
    expect(within(starter).queryByText('Deutschland')).toBeNull()
    expect(within(starter).getByRole('img', { name: 'Deutschland' }).parentElement?.className).toBe('lp-country-slot')
    expect(within(starter).getByRole('img', { name: 'Deutschland' }).closest('.lp-status')).toBeTruthy()
    expect(starter.querySelector('.lp-nationality')).toBeNull()
    const substitute = screen.getByRole('button', { name: /Scott Example/ }).closest('.lp-bench-row') as HTMLElement
    expect(within(substitute).queryByText('Schottland')).toBeNull()
    const flag = within(substitute).getByRole('img', { name: 'Schottland' })
    expect(flag.parentElement?.className).toBe('lp-bench-flag')
    expect(substitute.querySelector('.md-jersey')?.nextElementSibling).toBe(flag.parentElement)
    expect(substitute.querySelector('.lp-status')).toBeNull()
    fireEvent.click(starterButton)
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: 'Max Beispiel' }))
  })

  it('uses rectangular assets for starters and substitutes and routes their flags to national teams', () => {
    const onOpenPlayer = vi.fn()
    const onOpenCountry = vi.fn()
    const starterCountry = { ...germany, flag: null }
    const benchCountry = { ...scotland, flag: null }
    render(<LineupPitch lineups={lineups(player('Max Beispiel', starterCountry), player('Scott Example', benchCountry))} events={[]} homeName="Heim" awayName="Gast" language="de" locale="de-DE" onOpenPlayer={onOpenPlayer} onOpenCountry={onOpenCountry} />)
    const starterFlag = screen.getByRole('button', { name: 'Nationalmannschaft von Deutschland öffnen' })
    const benchFlag = screen.getByRole('button', { name: 'Nationalmannschaft von Schottland öffnen' })
    expect(within(starterFlag).getByRole('img', { name: 'Deutschland' }).getAttribute('src')).toBe('https://flagcdn.com/w40/de.png')
    expect(within(benchFlag).getByRole('img', { name: 'Schottland' }).getAttribute('src')).toBe('https://flagcdn.com/w40/gb-sct.png')
    fireEvent.click(starterFlag)
    expect(onOpenCountry).toHaveBeenLastCalledWith(starterCountry)
    fireEvent.click(benchFlag)
    expect(onOpenCountry).toHaveBeenLastCalledWith(benchCountry)
    expect(onOpenCountry).toHaveBeenCalledTimes(2)
    expect(onOpenPlayer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Max Beispiel.*Profil von Max Beispiel/ }))
    expect(onOpenPlayer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Max Beispiel' }))
  })

  it('keeps a Suriname flag and its national-team action available for the confirmed SUR code without ISO metadata', () => {
    const onOpenPlayer = vi.fn()
    const onOpenCountry = vi.fn()
    const country: SportsCountry = { name: 'Suriname', code: 'SUR', iso: null, flag: null }
    render(<LineupPitch lineups={lineups(player('Sean Klaiber', country), player('Scott Example', null))} events={[]} homeName="Heim" awayName="Gast" language="de" locale="de-DE" onOpenPlayer={onOpenPlayer} onOpenCountry={onOpenCountry} />)
    const flag = screen.getByRole('button', { name: 'Nationalmannschaft von Suriname öffnen' })
    expect(within(flag).getByRole('img', { name: 'Suriname' }).getAttribute('src')).toBe('https://flagcdn.com/w40/sr.png')
    fireEvent.click(flag)
    expect(onOpenCountry).toHaveBeenCalledWith(country)
    expect(onOpenPlayer).not.toHaveBeenCalled()
  })

  it('opens Mascarell’s national team from the localized EQG flag even when source ISO metadata is missing', () => {
    const onOpenPlayer = vi.fn()
    const onOpenCountry = vi.fn()
    const country: SportsCountry = { name: 'Equatorial Guinea', code: 'EQG', iso: null, flag: null }
    render(<LineupPitch lineups={lineups(player('Omar Mascarell', country), player('Scott Example', null))} events={[]} homeName="Heim" awayName="Gast" language="de" locale="de-DE" onOpenPlayer={onOpenPlayer} onOpenCountry={onOpenCountry} />)
    const flag = screen.getByRole('button', { name: 'Nationalmannschaft von Äquatorialguinea öffnen' })
    expect(within(flag).getByRole('img', { name: 'Äquatorialguinea' }).getAttribute('src')).toBe('https://flagcdn.com/w40/gq.png')
    fireEvent.click(flag)
    expect(onOpenCountry).toHaveBeenCalledWith(country)
    expect(onOpenPlayer).not.toHaveBeenCalled()
  })

  it('does not create a national-team flag button by guessing a missing ISO from the player country name', () => {
    const onOpenCountry = vi.fn()
    render(<LineupPitch lineups={lineups(player('Max Beispiel', { ...germany, iso: null, code: 'ZZZ' }), player('Scott Example', null))} events={[]} homeName="Heim" awayName="Gast" language="de" locale="de-DE" onOpenPlayer={vi.fn()} onOpenCountry={onOpenCountry} />)
    expect(screen.queryByRole('button', { name: /Nationalmannschaft/ })).toBeNull()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(onOpenCountry).not.toHaveBeenCalled()
  })

  it('keeps the country accessible without adding a country line when the flag cannot load', () => {
    render(<LineupPitch lineups={lineups()} events={[]} homeName="Home" awayName="Away" language="en" locale="en-GB" onOpenPlayer={vi.fn()} />)
    const starter = screen.getByRole('button', { name: /Max Beispiel.*Nationality: Germany/ }).closest('.lp-player') as HTMLElement
    fireEvent.error(within(starter).getByRole('img', { name: 'Germany' }))
    expect(within(starter).queryByRole('img')).toBeNull()
    expect(starter.querySelector('.lp-country-slot')?.childElementCount).toBe(0)
    expect(within(starter).queryByText('Germany')).toBeNull()
    expect(screen.queryByText('Scotland')).toBeNull()
    expect(screen.getByRole('img', { name: 'Scotland' })).toBeTruthy()
  })

  it('omits unknown starter nationalities without deriving a flag from team or player names', () => {
    render(<LineupPitch lineups={lineups({ ...player('Max Beispiel'), rating: null }, player('Scott Example', null))} events={[]} homeName="Germany" awayName="Scotland" language="en" locale="en-GB" onOpenPlayer={vi.fn()} />)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    const starter = screen.getByRole('button', { name: /Max Beispiel/ }).closest('.lp-player') as HTMLElement
    expect(starter.textContent).toBe('9Beispiel')
    const status = starter.querySelector('.lp-status') as HTMLElement
    expect([...status.children].map((slot) => slot.className)).toEqual(['lp-country-slot', 'lp-rating-slot', 'lp-events'])
    expect(status.textContent).toBe('')
    expect(screen.getByRole('button', { name: /Scott Example/ }).textContent).not.toContain('—')
    expect(starter.querySelector('.lp-nationality')).toBeNull()
  })
})

describe('LineupPitch match marks', () => {
  function event(kind: SportsEventKind, playerName = 'Max Beispiel', side: 'home' | 'away' = 'home'): SportsEvent {
    return { kind, player: playerName, side, minute: '67′', other: null }
  }

  it.each<{ cards: SportsEventKind[]; label: string; className: string }>([
    { cards: ['yellow', 'yellow-red', 'red'], label: 'Gelb-Rote Karte', className: 'is-yellow-red' },
    { cards: ['red', 'yellow-red', 'yellow'], label: 'Gelb-Rote Karte', className: 'is-yellow-red' },
    { cards: ['yellow', 'red'], label: 'Rote Karte', className: 'is-red' },
    { cards: ['yellow'], label: 'Gelbe Karte', className: '' },
  ])('groups goals, rating and $label above the shirt and preserves explicit dismissal semantics', ({ cards, label, className }) => {
    const events = [event('goal'), event('penalty'), event('own-goal'), ...cards.map((kind) => event(kind))]
    render(<LineupPitch lineups={lineups()} events={events} homeName="Heim" awayName="Gast" language="de" locale="de-DE" onOpenPlayer={vi.fn()} />)
    const starter = screen.getByRole('button', { name: new RegExp(`Max Beispiel.*2 Tore, ${label}`) }).closest('.lp-player') as HTMLElement
    const status = starter.querySelector('.lp-status') as HTMLElement
    expect(status.parentElement).toBe(starter)
    expect([...status.children].map((slot) => slot.className)).toEqual(['lp-country-slot', 'lp-rating-slot', 'lp-events'])
    expect(status.classList.contains('has-marks')).toBe(false)
    expect(within(status).getByText('7,2').closest('.lp-rating-slot')).toBeTruthy()
    expect(within(status).getByRole('img', { name: '2 Tore' }).textContent).toBe('2')
    expect(status.querySelectorAll('svg.football-icon')).toHaveLength(1)
    const card = within(status).getByRole('img', { name: label })
    expect(card.className).toBe(`lp-card${className ? ` ${className}` : ''}`)
    expect(status.querySelectorAll('.lp-card')).toHaveLength(1)
    expect(status.querySelector('.lp-rating-slot')?.nextElementSibling?.firstElementChild).toBe(card)
    expect(starter.querySelector('.lp-marks')).toBeNull()
    expect(within(starter).getByRole('img', { name: 'Deutschland' }).parentElement?.className).toBe('lp-country-slot')
  })

  it('places substitute goals and second yellow after the name and keeps the rating at the row end in English', () => {
    render(<LineupPitch lineups={lineups()} events={[event('goal', 'Scott Example'), event('yellow-red', 'Scott Example')]} homeName="Home" awayName="Away" language="en" locale="en-GB" onOpenPlayer={vi.fn()} />)
    const substitute = screen.getByRole('button', { name: /Scott Example/ }).closest('.lp-bench-row') as HTMLElement
    const events = substitute.querySelector('.lp-events') as HTMLElement
    expect(substitute.querySelector('.lp-bench-name')?.nextElementSibling).toBe(events)
    expect(within(events).getByRole('img', { name: 'Goal' })).toBeTruthy()
    expect(within(events).getByRole('img', { name: 'Second yellow card' }).className).toBe('lp-card is-yellow-red')
    expect(within(substitute).getByText('7.2').closest('.lp-bench-rating')).toBe(substitute.lastElementChild)
    expect(substitute.querySelector('.lp-status')).toBeNull()
  })

})

describe('LineupPitch orientation', () => {
  it.each([false, true])('keeps home above and away below regardless of source order (reversed: %s)', (reversed) => {
    const teams: SportsLineup[] = [
      { side: 'home', formation: '4-4-2', starters: [{ ...player('Home Keeper'), x: 0.5, y: 0.1 }, { ...player('Home Striker'), x: 0.2, y: 0.9 }], bench: [], source: 'fotmob', coach: null },
      { side: 'away', formation: '4-4-2', starters: [{ ...player('Away Keeper'), x: 0.5, y: 0.1 }, { ...player('Away Striker'), x: 0.2, y: 0.9 }], bench: [], source: 'fotmob', coach: null },
    ]
    render(<LineupPitch lineups={reversed ? [...teams].reverse() : teams} events={[]} homeName="Home" awayName="Away" language="en" locale="en-GB" onOpenPlayer={vi.fn()} />)
    const position = (name: string, axis: 'top' | 'left') => {
      const element = screen.getByRole('button', { name: new RegExp(name) }).closest('.lp-player') as HTMLElement
      return Number(element.style[axis].match(/([\d.]+)%/)?.[1])
    }
    expect(position('Home Keeper', 'top')).toBeLessThan(position('Home Striker', 'top'))
    expect(position('Home Striker', 'top')).toBeLessThan(50)
    expect(position('Away Keeper', 'top')).toBeGreaterThan(position('Away Striker', 'top'))
    expect(position('Away Striker', 'top')).toBeGreaterThan(50)
    expect(position('Home Striker', 'left')).toBeLessThan(50)
    expect(position('Away Striker', 'left')).toBeGreaterThan(50)
    expect([...document.querySelectorAll('.lp-team > span')].map((name) => name.textContent)).toEqual(['Home', 'Away'])
  })
})
