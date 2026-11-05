import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuth, type Auth } from '@/lib/auth/auth';
import { checkOwner, requireOwner } from '@/lib/auth/require-owner';
import { BASE, Jar, OWNER, SECRET, STRANGER, newAuth, req, signIn, startNetworkMock, stopNetworkMock } from './helpers';

beforeAll(startNetworkMock);
afterAll(stopNetworkMock);

const ENV_NAMES = ['AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'OWNER_GITHUB_ID', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'BETTER_AUTH_URL', 'VERCEL', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL'];

function configure(extra: Record<string, string> = {}): void {
  Object.assign(process.env, {
    AUTH_SECRET: SECRET,
    AUTH_GITHUB_ID: 'dummy-client-id',
    AUTH_GITHUB_SECRET: 'dummy-client-secret',
    OWNER_GITHUB_ID: OWNER,
    OPENAI_API_KEY: 'dummy-key',
    OPENAI_MODEL: 'dummy-model',
    UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
    UPSTASH_REDIS_REST_TOKEN: 'dummy-token',
    BETTER_AUTH_URL: BASE,
    ...extra,
  });
}

beforeEach(() => {
  for (const n of ENV_NAMES) delete process.env[n];
});
afterEach(() => {
  for (const n of ENV_NAMES) delete process.env[n];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function statusOf(r: Awaited<ReturnType<typeof requireOwner>>): Promise<[number, unknown]> {
  if (r.ok) return [200, r];
  return [r.response.status, await r.response.json()];
}

describe('requireOwner (environment-driven, as used by handlers)', () => {
  it('503 QA_UNAVAILABLE when nothing is configured', async () => {
    expect(await statusOf(await requireOwner(req('/api/qa')))).toEqual([503, { code: 'QA_UNAVAILABLE' }]);
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['non-numeric', 'octocat'],
    ['numeric with junk', '123abc'],
  ])('503 when OWNER_GITHUB_ID is %s', async (_n, value) => {
    configure();
    if (value === undefined) delete process.env.OWNER_GITHUB_ID;
    else process.env.OWNER_GITHUB_ID = value;
    expect((await statusOf(await requireOwner(req('/api/qa'))))[0]).toBe(503);
  });

  it('503 on Vercel Preview without BETTER_AUTH_URL even when Q&A env is complete', async () => {
    configure({ VERCEL: '1', VERCEL_ENV: 'preview' });
    delete process.env.BETTER_AUTH_URL;
    expect((await statusOf(await requireOwner(req('/api/qa'))))[0]).toBe(503);
  });

  it('401 without any cookie', async () => {
    configure();
    expect(await statusOf(await requireOwner(req('/api/qa')))).toEqual([401, { code: 'UNAUTHORIZED' }]);
  });

  it('passes for the owner and returns the id', async () => {
    configure();
    const { jar } = await signIn(getAuth()!, OWNER);
    expect(await requireOwner(req('/api/qa', { jar }))).toEqual({ ok: true, ownerId: OWNER });
  });

  it('403 for a signed-in non-owner (ids are compared, never logins)', async () => {
    configure();
    const { jar } = await signIn(newAuth(false), STRANGER); // gate off: only possible through the test seam
    expect(await statusOf(await requireOwner(req('/api/qa', { jar })))).toEqual([403, { code: 'FORBIDDEN' }]);
  });

  it('trusts exactly the resolved origin', async () => {
    configure();
    const ctx = await getAuth()!.$context;
    expect(ctx.options.trustedOrigins).toEqual([BASE]);
    expect(ctx.options.baseURL).toBe(BASE);
  });

  it('401 for forged, junk, wrong-secret, expired and missing-id cookies', async () => {
    configure();
    const { jar } = await signIn(getAuth()!, OWNER);

    const junk = new Jar();
    for (const name of jar.cookies.keys()) junk.cookies.set(name, 'forged');
    expect((await statusOf(await requireOwner(req('/api/qa', { jar: junk }))))[0]).toBe(401);

    const missingId = new Jar();
    for (const [n, v] of jar.cookies) if (!n.includes('account_data')) missingId.cookies.set(n, v);
    expect((await statusOf(await requireOwner(req('/api/qa', { jar: missingId }))))[0]).toBe(401);

    // Same cookies, rotated AUTH_SECRET (the documented kill switch).
    process.env.AUTH_SECRET = 'rotated-secret-0123456789abcdef0123456789abcd';
    expect((await statusOf(await requireOwner(req('/api/qa', { jar }))))[0]).toBe(401);
    process.env.AUTH_SECRET = SECRET;
    expect((await requireOwner(req('/api/qa', { jar }))).ok).toBe(true);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 25 * 3600 * 1000);
    expect((await statusOf(await requireOwner(req('/api/qa', { jar }))))[0]).toBe(401);
  });
});

describe('checkOwner: any exception denies', () => {
  const throwing = (where: 'getSession' | 'context') =>
    ({
      api: { getSession: async () => { if (where === 'getSession') throw new Error('boom SECRET-VALUE'); return { user: { id: 'u1' } }; } },
      get $context(): Promise<never> { return Promise.reject(new Error('boom SECRET-VALUE')); },
    }) as unknown as Auth;

  it.each(['getSession', 'context'] as const)('library throw in %s -> 401, never a pass, nothing leaked', async (where) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await checkOwner(throwing(where), OWNER, req('/api/qa'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(401);
      expect(r.response.headers.get('cache-control')).toBe('no-store');
    }
    expect(warn.mock.calls.flat().join(' ')).not.toContain('SECRET-VALUE');
  });
});

describe('logging', () => {
  it('denials log only the event name, a fixed reason code and a status', async () => {
    configure();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { jar } = await signIn(newAuth(false), STRANGER);
    await requireOwner(req('/api/qa', { jar }));
    const lines = warn.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, unknown>);
    expect(lines).toContainEqual({ event: 'qa.auth_denied', reason: 'not_owner', status: 403 });
    const text = JSON.stringify(lines);
    for (const secret of [SECRET, 'dummy-client-secret', STRANGER, OWNER]) expect(text).not.toContain(secret);
  });
});

describe('ownerGate (the production instance from getAuth)', () => {
  it('rejects a non-owner GitHub id at sign-in: no session cookie is ever issued', async () => {
    configure();
    const prod = getAuth()!;
    const { jar, callback } = await signIn(prod, STRANGER);
    expect(callback.headers.get('location')).toContain('/api/auth/error');
    expect([...jar.cookies.keys()].filter((n) => n.includes('session') || n.includes('account'))).toEqual([]);
    expect((await checkOwner(prod, OWNER, req('/api/qa', { jar }))).ok).toBe(false);
  });

  it('the test-seam instance with the gate off lets the same id through, proving the gate is what blocked it', async () => {
    const { jar } = await signIn(newAuth(false), STRANGER);
    expect([...jar.cookies.keys()].some((n) => n.includes('session_token'))).toBe(true);
  });

  it('accepts the owner id', async () => {
    configure();
    const { jar } = await signIn(getAuth()!, OWNER);
    expect([...jar.cookies.keys()].some((n) => n.includes('session_token'))).toBe(true);
  });
});

describe('requireOwner in local development mode', () => {
  it('passes without sign-in only when the dev build/runtime triple check holds and just the OpenAI key is set', async () => {
    const saved = { ...process.env };
    try {
      vi.stubEnv('NODE_ENV', 'development');
      for (const k of Object.keys(process.env)) if (/^(AUTH_|OWNER_|UPSTASH_|KV_|VERCEL)/.test(k)) delete process.env[k];
      process.env.OPENAI_API_KEY = 'k';
      vi.resetModules();
      const { requireOwner: dev } = await import('@/lib/auth/require-owner');
      const r = await dev(new Request('http://localhost:3000/api/qa', { method: 'POST' }));
      expect(r.ok).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  });
});
