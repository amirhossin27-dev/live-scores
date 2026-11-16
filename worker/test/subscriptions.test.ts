import { describe, expect, test } from 'vitest'
import { endpointKey, parseRegistration } from '../src/subscriptions'

const keys = { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' }
const apple = { endpoint: 'https://web.push.apple.com/QGxyz', keys }

describe('parseRegistration', () => {
  test('accepts an Apple subscription with football favourites', () =>
    expect(parseRegistration({ subscription: apple, favorites: [{ competition: 'soccer/ger.1', id: '7', start: '2026-11-21T14:30:00Z' }], competitions: ['soccer/eng.1'] }))
      .toEqual({ subscription: apple, favorites: [{ competition: 'soccer/ger.1', id: '7', start: '2026-11-21T14:30:00Z' }], competitions: ['soccer/eng.1'] }))

  test('accepts the other known push services', () => {
    for (const endpoint of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-db5p.notify.windows.com/w/?token=x'])
      expect(parseRegistration({ subscription: { endpoint, keys }, favorites: [], competitions: [] })).not.toHaveProperty('error')
  })

  test('rejects endpoints outside the known push services', () => {
    for (const endpoint of ['https://evil.example/x', 'http://web.push.apple.com/x', 'https://web.push.apple.com.evil.example/x', 'https://notify.windows.com.evil.example/x', 'not a url'])
      expect(parseRegistration({ subscription: { endpoint, keys }, favorites: [], competitions: [] })).toEqual({ error: expect.any(String) })
  })

  test('rejects keys that are not base64url of the right length', () => {
    expect(parseRegistration({ subscription: { endpoint: apple.endpoint, keys: { p256dh: 'abc', auth: keys.auth } }, favorites: [], competitions: [] })).toEqual({ error: expect.any(String) })
    expect(parseRegistration({ subscription: { endpoint: apple.endpoint, keys: { p256dh: keys.p256dh, auth: '!!' } }, favorites: [], competitions: [] })).toEqual({ error: expect.any(String) })
  })

  test('rejects bodies that are not objects', () => {
    for (const body of [null, 'x', 1, [], { subscription: null }]) expect(parseRegistration(body)).toEqual({ error: expect.any(String) })
  })

  test('drops non-football and malformed favourites and competitions', () => {
    const result = parseRegistration({
      subscription: apple,
      favorites: [{ competition: 'racing/f1', id: '1', start: '2026-11-21T14:30:00Z' }, { competition: 'soccer/ger.1', id: 2, start: 'x' }, { competition: 'soccer/ger.1', id: '3', start: 'not a date' }, { competition: 'soccer/ger.1', id: '4', start: '2026-11-21T14:30:00Z' }],
      competitions: ['racing/f1', 'soccer/ger.1', 5, 'soccer/ger.1'],
    })
    expect(result).toEqual({ subscription: apple, favorites: [{ competition: 'soccer/ger.1', id: '4', start: '2026-11-21T14:30:00Z' }], competitions: ['soccer/ger.1'] })
  })

  test('caps favourites at 200 and competitions at 40', () => {
    const favorites = Array.from({ length: 250 }, (_, i) => ({ competition: 'soccer/ger.1', id: String(i), start: '2026-11-21T14:30:00Z' }))
    const competitions = Array.from({ length: 50 }, (_, i) => `soccer/x.${i}`)
    const result = parseRegistration({ subscription: apple, favorites, competitions })
    if ('error' in result) throw new Error(result.error)
    expect(result.favorites).toHaveLength(200)
    expect(result.competitions).toHaveLength(40)
  })
})

test('endpointKey is the hex SHA-256 of the endpoint', async () => {
  expect(await endpointKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
