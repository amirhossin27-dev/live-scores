import { DurableObject } from 'cloudflare:workers'
import { route, type WatcherApi } from './router'
import { DurableStore } from './store'
import { health, register, status, tick, unregister, type WatcherDeps } from './watcher'
import { sendPush, type VapidKeys } from './webpush'

interface Env {
  WATCHER: DurableObjectNamespace<Watcher>
  API_BASE_URL: string
  VAPID_PUBLIC_KEY: string
  /** JWK of the private key, set with `npx wrangler secret put VAPID_PRIVATE_KEY`. */
  VAPID_PRIVATE_KEY: string
}

const subject = 'https://amirhossin27-dev.github.io/live-scores/'

/** The single watcher: all devices, favourites and match states in one consistent SQLite storage. */
export class Watcher extends DurableObject<Env> implements WatcherApi {
  private deps(): WatcherDeps {
    const vapid: VapidKeys = { publicKey: this.env.VAPID_PUBLIC_KEY, privateKeyJwk: JSON.parse(this.env.VAPID_PRIVATE_KEY), subject }
    const base = this.env.API_BASE_URL.replace(/\/$/, '')
    return {
      store: new DurableStore(this.ctx.storage.kv),
      now: () => Date.now(),
      api: (path) => fetch(base + path, { headers: { Accept: 'application/json', 'User-Agent': 'live-scores-push/1.0' }, signal: AbortSignal.timeout(90_000) }),
      push: (sub, msg) => sendPush(sub, msg, vapid, Date.now()),
    }
  }
  tick() { return tick(this.deps()) }
  register(body: unknown) { return register(this.deps(), body) }
  unregister(endpoint: string) { return unregister(this.deps(), endpoint) }
  status(endpoint: string) { return status(this.deps(), endpoint) }
  health() { return health(this.deps()) }
}

const watcher = (env: Env) => env.WATCHER.get(env.WATCHER.idFromName('main'))

export default {
  fetch(request, env) {
    return route(request, watcher(env) as unknown as WatcherApi)
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(watcher(env).tick())
  },
} satisfies ExportedHandler<Env>
