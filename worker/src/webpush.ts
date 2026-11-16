/**
 * Web Push without libraries: message encryption after RFC 8291 (aes128gcm, RFC 8188) and VAPID after RFC 8292,
 * both with WebCrypto as Cloudflare Workers provide it.
 */

export interface PushSubscriptionJSON { endpoint: string; keys: { p256dh: string; auth: string } }
export interface VapidKeys { publicKey: string; privateKeyJwk: JsonWebKey; subject: string }

const encoder = new TextEncoder()
const recordSize = 4096

export function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, data))
}

/** HKDF with one block of output, enough for all lengths here (at most 32 octets). */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm)
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length)
}

/** The whole aes128gcm body for one push message: header (salt, record size, server key) and a single record. */
export async function encryptPayload(sub: PushSubscriptionJSON, plaintext: Uint8Array, opts: { salt?: Uint8Array; serverKeys?: CryptoKeyPair } = {}): Promise<Uint8Array> {
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const serverKeys = opts.serverKeys ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const uaPublic = fromBase64url(sub.keys.p256dh)
  const auth = fromBase64url(sub.keys.auth)
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, serverKeys.privateKey, 256))

  const ikm = await hkdf(auth, ecdhSecret, concat(encoder.encode('WebPush: info\u0000'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\u0000'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\u0000'), 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const padded = concat(plaintext, new Uint8Array([2]))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, padded))

  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, recordSize)
  header[20] = asPublic.length
  return concat(header, asPublic, ciphertext)
}

/** `Authorization` header value: a VAPID JWT (ES256) for the origin of the endpoint, valid for 12 hours. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now: number): Promise<string> {
  const header = base64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject }
  const payload = base64url(encoder.encode(JSON.stringify(claims)))
  const key = await crypto.subtle.importKey('jwk', vapid.privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  // WebCrypto already returns the raw r||s form that JWS needs.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${payload}`)))
  return `vapid t=${header}.${payload}.${base64url(signature)}, k=${vapid.publicKey}`
}

/** Sends one push message; the status tells whether the subscription still exists (404/410: gone). */
export async function sendPush(sub: PushSubscriptionJSON, payload: object, vapid: VapidKeys, now: number, fetchFn: typeof fetch = fetch): Promise<{ status: number }> {
  const body = await encryptPayload(sub, encoder.encode(JSON.stringify(payload)))
  const response = await fetchFn(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
      Authorization: await vapidAuthorization(sub.endpoint, vapid, now),
    },
    body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
  })
  return { status: response.status }
}
