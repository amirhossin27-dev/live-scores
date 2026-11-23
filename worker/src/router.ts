import { serveScores } from './scores'
import type { WorkerStatus } from './watcher'

/** What the HTTP layer needs from the Durable Object (its RPC methods). */
export interface WatcherApi {
  register(body: unknown): Promise<{ ok: true; key: string } | { error: string }>
  unregister(endpoint: string): Promise<void>
  status(endpoint: string): Promise<WorkerStatus>
  health(): Promise<{ lastTickAt: number | null; lastSuccessAt: number | null; devices: number; lastError: string | null }>
}

export const allowedOrigins = ['https://amirhossin27-dev.github.io', 'http://localhost:5180', 'http://127.0.0.1:5180']
const maxBody = 32 * 1024

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message) } }

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin')
  if (!origin || !allowedOrigins.includes(origin)) return {}
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.length > maxBody) throw new HttpError(413, 'Zu groß.')
  try { return JSON.parse(text) } catch { throw new HttpError(400, 'Kein gültiges JSON.') }
}

async function readEndpoint(request: Request): Promise<string> {
  const body = await readJson(request)
  const endpoint = typeof body === 'object' && body !== null ? (body as { endpoint?: unknown }).endpoint : undefined
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > 1024) throw new HttpError(400, 'Push-Endpunkt fehlt.')
  return endpoint
}

export async function route(request: Request, watcher: WatcherApi): Promise<Response> {
  const headers = cors(request)
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers })
  const { pathname } = new URL(request.url)
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (pathname === '/api/sports/scores' && request.method === 'GET') return await serveScores(new URL(request.url), headers)
    if (pathname === '/subscription' && request.method === 'PUT') {
      const result = await watcher.register(await readJson(request))
      return 'error' in result ? json({ error: result.error }, 400) : json({ ok: true })
    }
    if (pathname === '/subscription' && request.method === 'DELETE') {
      await watcher.unregister(await readEndpoint(request))
      return new Response(null, { status: 204, headers })
    }
    if (pathname === '/subscription/status' && request.method === 'POST') return json(await watcher.status(await readEndpoint(request)))
    if (pathname === '/health' && request.method === 'GET') return json(await watcher.health())
    return json({ error: 'Nicht gefunden.' }, 404)
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    return json({ error: 'Interner Fehler.' }, 500)
  }
}
