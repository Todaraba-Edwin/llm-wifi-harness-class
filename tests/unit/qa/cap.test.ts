import { afterEach, describe, expect, it, vi } from 'vitest';
import { capKey, reserveCap, seoulDay } from '@/lib/qa/cap';
import { MemoryCounterStore, type CounterStore } from '@/lib/qa/store';

const base = {
  AUTH_SECRET: 's'.repeat(32),
  AUTH_GITHUB_ID: 'id',
  AUTH_GITHUB_SECRET: 'sec',
  OWNER_GITHUB_ID: '12345',
  OPENAI_API_KEY: 'dummy-key',
  OPENAI_MODEL: 'dummy-model',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN: 'dummy-token',
};
const NOON = new Date('2026-11-05T12:00:00+09:00');

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('@/lib/env.server');
  vi.resetModules();
});

describe('reserveCap', () => {
  it('allows up to the cap and rejects the next one (boundary 49/50/51)', async () => {
    const store = new MemoryCounterStore({});
    const env = { ...base, QA_DAILY_CAP: '50' };
    let last;
    for (let i = 1; i <= 49; i++) last = await reserveCap(env, store, NOON);
    expect(last).toEqual({ ok: true, count: 49, cap: 50 });
    expect(await reserveCap(env, store, NOON)).toEqual({ ok: true, count: 50, cap: 50 });
    expect(await reserveCap(env, store, NOON)).toEqual({ ok: false, reason: 'exceeded', cap: 50 });
  });
  it('QA_DAILY_CAP=2 allows 2 then rejects', async () => {
    const store = new MemoryCounterStore({});
    const env = { ...base, QA_DAILY_CAP: '2' };
    expect((await reserveCap(env, store, NOON)).ok).toBe(true);
    expect((await reserveCap(env, store, NOON)).ok).toBe(true);
    expect(await reserveCap(env, store, NOON)).toEqual({ ok: false, reason: 'exceeded', cap: 2 });
  });
  it('defaults to 50 and is atomic under concurrency (60 parallel -> exactly 50 allowed)', async () => {
    const store = new MemoryCounterStore({});
    const results = await Promise.all(Array.from({ length: 60 }, () => reserveCap({ ...base }, store, NOON)));
    expect(results.filter((r) => r.ok)).toHaveLength(50);
    expect(results.filter((r) => !r.ok)).toHaveLength(10);
  });
  it('rolls over at Seoul midnight', async () => {
    const store = new MemoryCounterStore({});
    const env = { ...base, QA_DAILY_CAP: '1' };
    expect((await reserveCap(env, store, new Date('2026-11-05T23:59:59+09:00'))).ok).toBe(true);
    expect((await reserveCap(env, store, new Date('2026-11-05T23:59:59+09:00'))).ok).toBe(false);
    expect((await reserveCap(env, store, new Date('2026-11-06T00:00:00+09:00'))).ok).toBe(true);
    expect(seoulDay(new Date('2026-11-05T14:59:59Z'))).toBe('2026-11-05');
    expect(seoulDay(new Date('2026-11-05T15:00:00Z'))).toBe('2026-11-06');
  });
  it('separates local / preview / production budgets and keys', async () => {
    expect(capKey({}, NOON)).toBe('qa:cap:local:2026-11-05');
    expect(capKey({ VERCEL: '1', VERCEL_ENV: 'preview' }, NOON)).toBe('qa:cap:preview:2026-11-05');
    expect(capKey({ VERCEL: '1', VERCEL_ENV: 'production' }, NOON)).toBe('qa:cap:production:2026-11-05');
    const keys: string[] = [];
    const store: CounterStore = { reserve: async (k) => (keys.push(k), { allowed: true, count: 1 }) };
    await reserveCap({ ...base, VERCEL: '1', VERCEL_ENV: 'preview', BETTER_AUTH_URL: 'https://x.example.test' }, store, NOON);
    expect(keys).toEqual(['qa:cap:preview:2026-11-05']);
  });
  it('fails closed as unavailable on store errors, a missing store and invalid config', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing: CounterStore = { reserve: async () => { throw new Error('down'); } };
    expect(await reserveCap({ ...base }, failing, NOON)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await reserveCap({ ...base }, null, NOON)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await reserveCap({}, new MemoryCounterStore({}), NOON)).toMatchObject({ ok: false, reason: 'unavailable' });
  });
  it("'unlimited' skips the store and logs qa.cap_disabled in a development build", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const dev = await import('@/lib/qa/cap');
    const store: CounterStore = { reserve: vi.fn() };
    const r = await dev.reserveCap({ ...base, QA_DAILY_CAP: '0', NODE_ENV: 'development' }, store, NOON);
    vi.unstubAllEnvs();
    expect(r).toEqual({ ok: true, count: 0, cap: 'unlimited' });
    expect(store.reserve).not.toHaveBeenCalled();
    expect(warn.mock.calls.some((c) => String(c[0]).includes('qa.cap_disabled'))).toBe(true);
  });
  it("throws if 'unlimited' ever reaches cap.ts without the development allowance", async () => {
    vi.resetModules();
    vi.doMock('@/lib/env.server', () => ({ getEnv: () => ({ cap: 'unlimited' }) }));
    const mod = await import('@/lib/qa/cap');
    const store: CounterStore = { reserve: vi.fn() };
    await expect(mod.reserveCap({ NODE_ENV: 'production' }, store, NOON)).rejects.toThrow('unlimited_cap_not_allowed');
    expect(store.reserve).not.toHaveBeenCalled();
  });
});
