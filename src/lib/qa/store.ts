import 'server-only';
import { Redis } from '@upstash/redis';
import { getEnv, upstashSettings } from '../env.server';
import { isDevCapOptOutAllowed, isProductionLike, type EnvSource } from '../runtime-mode';

export interface CounterStore {
  /** Atomically reserves one unit under `key` up to `cap`. `count` is the counter after the call (== cap when rejected). */
  reserve(key: string, cap: number): Promise<{ allowed: boolean; count: number }>;
}

export const KEY_TTL_SECONDS = 48 * 60 * 60;
export const STORE_TIMEOUT_MS = 5000;

/** Single atomic script (7.1): INCR, EXPIRE on first, DECR + reject above the cap. Returns {allowed, count}. */
export const RESERVE_LUA = `local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2])) end
if n > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return {0, tonumber(ARGV[1])}
end
return {1, n}`;

/** The slice of the Upstash client this store uses; injectable for tests. */
export interface EvalClient {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export class UpstashCounterStore implements CounterStore {
  private client: EvalClient | undefined;

  constructor(
    private readonly config: { url: string; token: string } | undefined,
    client?: EvalClient,
    private readonly timeoutMs: number = STORE_TIMEOUT_MS,
  ) {
    this.client = client;
  }

  private getClient(): EvalClient {
    if (!this.client) {
      if (!this.config) throw new Error('store_unconfigured');
      this.client = new Redis({ url: this.config.url, token: this.config.token, retry: false, enableTelemetry: false });
    }
    return this.client;
  }

  async reserve(key: string, cap: number): Promise<{ allowed: boolean; count: number }> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('store_timeout')), this.timeoutMs);
      });
      const raw = await Promise.race([this.getClient().eval(RESERVE_LUA, [key], [String(cap), String(KEY_TTL_SECONDS)]), timeout]);
      if (!Array.isArray(raw) || raw.length !== 2) throw new Error('store_bad_reply');
      const [allowed, count] = raw.map(Number);
      if (!Number.isFinite(allowed) || !Number.isFinite(count)) throw new Error('store_bad_reply');
      return { allowed: allowed === 1, count };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/** Same semantics as RESERVE_LUA for tests and local development. Refuses to exist in a production-like environment. */
export class MemoryCounterStore implements CounterStore {
  private readonly counts = new Map<string, number>();

  constructor(source: EnvSource = process.env) {
    if (isProductionLike(source)) throw new Error('memory_store_forbidden');
  }

  async reserve(key: string, cap: number): Promise<{ allowed: boolean; count: number }> {
    // Synchronous read-modify-write: atomic within the event loop, like the Lua script.
    const n = (this.counts.get(key) ?? 0) + 1;
    if (n > cap) return { allowed: false, count: cap };
    this.counts.set(key, n);
    return { allowed: true, count: n };
  }
}

let devStore: MemoryCounterStore | undefined;

/** The configured Upstash store, or null when unconfigured (callers fail closed; there is no in-memory fallback). */
export function getCounterStore(source: EnvSource = process.env): CounterStore | null {
  const env = getEnv(source);
  if (!env) return null;
  // Development without an Upstash pair counts in memory; production-like environments never reach this branch.
  if (isDevCapOptOutAllowed(source) && !env.UPSTASH_REDIS_REST_URL) return (devStore ??= new MemoryCounterStore(source));
  return new UpstashCounterStore(upstashSettings(env));
}
