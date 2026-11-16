/**
 * The storage of the watcher. Synchronous on purpose: the SQLite storage of a Durable Object offers `ctx.storage.kv`
 * without awaits, so a read followed by a write (the lease of a tick) cannot interleave with another request.
 */
export interface Store {
  get<T>(key: string): T | undefined
  put(key: string, value: unknown): void
  delete(key: string): void
  list<T>(prefix: string): Map<string, T>
}

/** For tests; values are cloned like the real storage does. */
export class MemoryStore implements Store {
  private readonly data = new Map<string, string>()
  get<T>(key: string): T | undefined {
    const value = this.data.get(key)
    return value === undefined ? undefined : JSON.parse(value) as T
  }
  put(key: string, value: unknown) { this.data.set(key, JSON.stringify(value)) }
  delete(key: string) { this.data.delete(key) }
  list<T>(prefix: string): Map<string, T> {
    const out = new Map<string, T>()
    for (const [key, value] of this.data) if (key.startsWith(prefix)) out.set(key, JSON.parse(value) as T)
    return out
  }
}

export class DurableStore implements Store {
  constructor(private readonly kv: SyncKvStorage) {}
  get<T>(key: string) { return this.kv.get<T>(key) }
  put(key: string, value: unknown) { this.kv.put(key, value) }
  delete(key: string) { this.kv.delete(key) }
  list<T>(prefix: string) { return new Map(this.kv.list<T>({ prefix })) }
}
