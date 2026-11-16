// Creates a VAPID key pair. The public key goes into wrangler.jsonc and public/config.js,
// the private JWK only into `npx wrangler secret put VAPID_PRIVATE_KEY` – never into the repository.
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
console.log('VAPID_PUBLIC_KEY=' + Buffer.from(raw).toString('base64url'))
console.log('VAPID_PRIVATE_KEY=' + JSON.stringify(jwk))
