import { describe, expect, test } from 'vitest'
import { base64url, encryptPayload, fromBase64url, sendPush, vapidAuthorization } from '../src/webpush'
import { decryptForTest, importEcdhPair, makeReceiver, makeVapid, verifyEs256 } from './helpers'

describe('encryptPayload', () => {
  test('round-trips with the receiver key (RFC 8291)', async () => {
    const { receiver, auth, sub } = await makeReceiver()
    const body = await encryptPayload(sub, new TextEncoder().encode('{"title":"⚽"}'))
    expect(new TextDecoder().decode(await decryptForTest(body, receiver, auth))).toBe('{"title":"⚽"}')
  })

  test('matches RFC 8291 Appendix A byte for byte', async () => {
    const serverKeys = await importEcdhPair(
      'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw')
    const sub = { endpoint: 'https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV', keys: {
      p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      auth: 'BTBZMqHH6r4Tts7J_aSIgg' } }
    const body = await encryptPayload(sub, fromBase64url('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'),
      { salt: fromBase64url('DGv6ra1nlYgDCS1FRnbzlw'), serverKeys })
    // The complete message of RFC 8291 section 5 (header and ciphertext of Appendix A, encoded together).
    expect(base64url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml'
      + 'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT'
      + 'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN')
  })
})

describe('vapidAuthorization', () => {
  test('signs ES256 for the endpoint origin with 12h expiry', async () => {
    const vapid = await makeVapid()
    const header = await vapidAuthorization('https://web.push.apple.com/abc', vapid, 1_700_000_000_000)
    const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!
    expect(k).toBe(vapid.publicKey)
    const claims = JSON.parse(new TextDecoder().decode(fromBase64url(jwt.split('.')[1])))
    expect(claims).toEqual({ aud: 'https://web.push.apple.com', exp: 1_700_000_000 + 12 * 3600, sub: 'https://amirhossin27-dev.github.io/live-scores/' })
    expect(await verifyEs256(jwt, k)).toBe(true)
  })
})

describe('sendPush', () => {
  test('posts aes128gcm with TTL and urgency and returns the status', async () => {
    const vapid = await makeVapid()
    const { receiver, auth, sub } = await makeReceiver()
    let seen: { url: string; init: RequestInit } | undefined
    const fetchFn = async (url: string | URL | Request, init?: RequestInit) => { seen = { url: String(url), init: init! }; return new Response(null, { status: 201 }) }
    const result = await sendPush(sub, { title: 'T', body: 'B' }, vapid, 1_700_000_000_000, fetchFn as typeof fetch)
    expect(result).toEqual({ status: 201 })
    expect(seen!.url).toBe(sub.endpoint)
    expect(seen!.init.method).toBe('POST')
    const headers = new Headers(seen!.init.headers)
    expect(headers.get('Content-Encoding')).toBe('aes128gcm')
    expect(headers.get('TTL')).toBe('3600')
    expect(headers.get('Urgency')).toBe('high')
    expect(headers.get('Authorization')).toMatch(/^vapid t=.+, k=.+$/)
    const plain = await decryptForTest(new Uint8Array(seen!.init.body as ArrayBuffer), receiver, auth)
    expect(JSON.parse(new TextDecoder().decode(plain))).toEqual({ title: 'T', body: 'B' })
  })
})
