import { expect, test } from 'vitest'
import { buildEventMessage, outageMessage, recoveryMessage } from '../src/messages'
import type { ApiMatch } from '../src/types'

const match: ApiMatch = {
  id: '123', start: '2026-11-21T14:30:00Z', status: 'live', statusText: "67'",
  home: { name: 'FC Bayern München', shortName: 'Bayern', score: '2' },
  away: { name: 'Borussia Dortmund', shortName: 'Dortmund', score: '1' },
}

test('goal message', () =>
  expect(buildEventMessage('soccer/ger.1', match, { kind: 'goal', side: 'home', index: 2 }, 'Musiala'))
    .toEqual({ title: '⚽ Tor für Bayern', body: "Bayern 2:1 Dortmund · 67' · Musiala", tag: 'soccer/ger.1|123|goal|home|2', url: './' }))

test('red, second yellow and cancelled goal titles', () => {
  expect(buildEventMessage('soccer/ger.1', match, { kind: 'red', side: 'away', index: 1 }).title).toBe('🟥 Rot für Dortmund')
  expect(buildEventMessage('soccer/ger.1', match, { kind: 'yellow-red', side: 'away', index: 1 }).title).toBe('🟨🟥 Gelb-Rot für Dortmund')
  expect(buildEventMessage('soccer/ger.1', match, { kind: 'goal-cancelled', side: 'home', index: 3 }).title).toBe('Tor aberkannt')
})

test('no minute and no player leave no dangling dots', () =>
  expect(buildEventMessage('soccer/ger.1', { ...match, statusText: '' }, { kind: 'goal', side: 'home', index: 2 }).body).toBe('Bayern 2:1 Dortmund'))

test('falls back to the full name without a short name', () =>
  expect(buildEventMessage('soccer/ger.1', { ...match, home: { name: 'FC Bayern München', score: '2' } }, { kind: 'goal', side: 'home', index: 2 }).title).toBe('⚽ Tor für FC Bayern München'))

test('outage and recovery messages', () => {
  expect(outageMessage()).toEqual({ title: '⚠️ Live-Daten gerade nicht erreichbar', body: 'Mitteilungen können fehlen.', tag: 'outage', url: './' })
  expect(recoveryMessage()).toEqual({ title: '✅ Live-Daten wieder da', body: 'Mitteilungen laufen wieder.', tag: 'outage', url: './' })
})
