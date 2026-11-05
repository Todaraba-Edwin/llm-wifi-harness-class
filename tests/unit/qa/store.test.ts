import { describe, expect, it } from 'vitest';
import { MemoryCounterStore, RESERVE_LUA, UpstashCounterStore, KEY_TTL_SECONDS } from '@/lib/qa/store';

describe('MemoryCounterStore', () => {
  it('has the Lua semantics: counts up to the cap, then rejects without moving the counter', async () => {
    const s = new MemoryCounterStore({});
    expect(await s.reserve('k', 2)).toEqual({ allowed: true, count: 1 });
    expect(await s.reserve('k', 2)).toEqual({ allowed: true, count: 2 });
    expect(await s.reserve('k', 2)).toEqual({ allowed: false, count: 2 });
    expect(await s.reserve('k', 2)).toEqual({ allowed: false, count: 2 });
    expect(await s.reserve('other', 2)).toEqual({ allowed: true, count: 1 });
  });
  it('throws in a production-like environment', () => {
    expect(() => new MemoryCounterStore({ NODE_ENV: 'production' })).toThrow();
    expect(() => new MemoryCounterStore({ VERCEL: '1', VERCEL_ENV: 'preview' })).toThrow();
  });
});

describe('UpstashCounterStore', () => {
  it('sends the single atomic script with the key and cap/ttl args and maps the reply', async () => {
    const calls: unknown[][] = [];
    const client = { eval: async (...a: unknown[]) => (calls.push(a), [1, 7]) };
    const s = new UpstashCounterStore(undefined, client);
    expect(await s.reserve('qa:cap:local:2026-11-05', 50)).toEqual({ allowed: true, count: 7 });
    expect(calls).toEqual([[RESERVE_LUA, ['qa:cap:local:2026-11-05'], ['50', String(KEY_TTL_SECONDS)]]]);
    expect(KEY_TTL_SECONDS).toBe(172800);
    expect(RESERVE_LUA).toContain("redis.call('INCR', KEYS[1])");
    expect(RESERVE_LUA).toContain("redis.call('EXPIRE'");
    expect(RESERVE_LUA).toContain("redis.call('DECR', KEYS[1])");
  });
  it('maps a rejection reply', async () => {
    const s = new UpstashCounterStore(undefined, { eval: async () => [0, 50] });
    expect(await s.reserve('k', 50)).toEqual({ allowed: false, count: 50 });
  });
  it('rejects on client errors, malformed replies, timeouts and missing configuration', async () => {
    await expect(new UpstashCounterStore(undefined, { eval: async () => { throw new Error('boom'); } }).reserve('k', 1)).rejects.toThrow();
    await expect(new UpstashCounterStore(undefined, { eval: async () => 'OK' }).reserve('k', 1)).rejects.toThrow();
    await expect(new UpstashCounterStore(undefined, { eval: async () => ['a', 'b'] }).reserve('k', 1)).rejects.toThrow();
    await expect(new UpstashCounterStore(undefined, { eval: () => new Promise(() => {}) }, 20).reserve('k', 1)).rejects.toThrow('store_timeout');
    await expect(new UpstashCounterStore(undefined).reserve('k', 1)).rejects.toThrow();
  });
});
