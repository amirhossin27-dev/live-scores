import { base64url, fromBase64url } from '../src/webpush'

export async function rawPublic(pair: CryptoKeyPair): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer)
}

/** An ECDH key pair from the raw public key (65 octets) and the private scalar, both base64url. */
export async function importEcdhPair(publicB64: string, privateB64: string): Promise<CryptoKeyPair> {
  const raw = fromBase64url(publicB64)
  const jwk = { kty: 'EC', crv: 'P-256', x: base64url(raw.slice(1, 33)), y: base64url(raw.slice(33, 65)), d: privateB64, ext: true }
  const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publicKey = await crypto.subtle.importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  return { privateKey, publicKey }
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}
const concat = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length } return out }
const text = (s: string) => new TextEncoder().encode(s)

/** The user agent's side of RFC 8291: decrypts one aes128gcm record. Independent of the code under test. */
export async function decryptForTest(body: Uint8Array, receiver: CryptoKeyPair, auth: Uint8Array): Promise<Uint8Array> {
  const salt = body.slice(0, 16)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const ciphertext = body.slice(21 + idlen)
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, receiver.privateKey, 256))
  const uaPublic = await rawPublic(receiver)
  const prkKey = await hmac(auth, ecdh)
  const ikm = await hmac(prkKey, concat(text('WebPush: info\u0000'), uaPublic, asPublic, new Uint8Array([1])))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(text('Content-Encoding: aes128gcm\u0000'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(text('Content-Encoding: nonce\u0000'), new Uint8Array([1])))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext))
  let end = padded.length - 1
  while (padded[end] === 0) end--
  if (padded[end] !== 2) throw new Error('missing padding delimiter')
  return padded.slice(0, end)
}

/** Verifies an ES256 JWT with the raw public key from the `k=` parameter. */
export async function verifyEs256(jwt: string, publicB64: string): Promise<boolean> {
  const [h, p, s] = jwt.split('.')
  const key = await crypto.subtle.importKey('raw', fromBase64url(publicB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64url(s), text(`${h}.${p}`))
}

export async function makeVapid() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer)
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey) as JsonWebKey
  return { publicKey: base64url(raw), privateKeyJwk, subject: 'https://amirhossin27-dev.github.io/live-scores/' }
}

export async function makeReceiver(endpoint = 'https://web.push.apple.com/QGx') {
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const sub = { endpoint, keys: { p256dh: base64url(await rawPublic(receiver)), auth: base64url(auth) } }
  return { receiver, auth, sub }
}
