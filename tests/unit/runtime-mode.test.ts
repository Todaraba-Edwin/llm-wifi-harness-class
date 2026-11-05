import { afterEach, describe, expect, it, vi } from 'vitest';
import { capNamespace, isDevCapOptOutAllowed, isProductionLike } from '@/lib/runtime-mode';
import { getEnv } from '@/lib/env.server';

const base = { AUTH_SECRET: 's'.repeat(32), AUTH_GITHUB_ID: 'id', AUTH_GITHUB_SECRET: 'sec', OWNER_GITHUB_ID: '12345', OPENAI_API_KEY: 'dummy-key', OPENAI_MODEL: 'dummy-model', UPSTASH_REDIS_REST_URL: 'https://redis.example.test', UPSTASH_REDIS_REST_TOKEN: 'dummy-token' };

describe('isDevCapOptOutAllowed', () => {
  it.each([
    ['all three agree (local next dev)', 'development', { NODE_ENV: 'development' }, true],
    ['build literal is production but runtime says development (next start of a build)', 'production', { NODE_ENV: 'development' }, false],
    ['runtime NODE_ENV is production', 'development', { NODE_ENV: 'production' }, false],
    ['runtime NODE_ENV is test', 'development', { NODE_ENV: 'test' }, false],
    ['runtime NODE_ENV unset', 'development', {}, false],
    ['VERCEL is set', 'development', { NODE_ENV: 'development', VERCEL: '1' }, false],
    ['build literal missing', undefined, { NODE_ENV: 'development' }, false],
  ])('%s', (_name, build, source, expected) => {
    expect(isDevCapOptOutAllowed(source, build)).toBe(expected);
  });
});

describe('isProductionLike and capNamespace', () => {
  it('treats the build literal, runtime NODE_ENV and VERCEL each as production-like', () => {
    expect(isProductionLike({}, 'production')).toBe(true);
    expect(isProductionLike({ NODE_ENV: 'production' }, 'development')).toBe(true);
    expect(isProductionLike({ VERCEL: '1' }, 'development')).toBe(true);
    expect(isProductionLike({ NODE_ENV: 'development' }, 'development')).toBe(false);
  });
  it('separates local, preview and production budgets', () => {
    expect(capNamespace({ NODE_ENV: 'development' }, 'development')).toBe('local');
    expect(capNamespace({ VERCEL: '1', VERCEL_ENV: 'preview' }, 'production')).toBe('preview');
    expect(capNamespace({ VERCEL: '1', VERCEL_ENV: 'production' }, 'production')).toBe('production');
    expect(capNamespace({}, 'production')).toBe('production');
  });
});

describe('local development mode (OPENAI_API_KEY only)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it('needs only the OpenAI key in a local dev build, uses the default model, and skips owner auth', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { getEnv: dev } = await import('@/lib/env.server');
    const env = dev({ NODE_ENV: 'development', OPENAI_API_KEY: 'k' });
    expect(env?.devLocal).toBe(true);
    expect(env?.OPENAI_MODEL).toBe('gpt-6-luna');
    expect(env?.cap).toBe(50);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(dev({ NODE_ENV: 'development' })).toBeNull();
    // A complete owner-auth set keeps real sign-in in development (devLocal only when it is incomplete).
    const auth = { AUTH_SECRET: 's'.repeat(32), AUTH_GITHUB_ID: 'id', AUTH_GITHUB_SECRET: 'sec', OWNER_GITHUB_ID: '12345' };
    expect(dev({ NODE_ENV: 'development', OPENAI_API_KEY: 'k', ...auth })?.devLocal).toBe(false);
    expect(dev({ NODE_ENV: 'development', OPENAI_API_KEY: 'k', ...auth })?.AUTH_GITHUB_ID).toBe('id');
    // Any production-like signal keeps the full requirement.
    expect(dev({ NODE_ENV: 'development', VERCEL: '1', OPENAI_API_KEY: 'k' })).toBeNull();
    expect(dev({ NODE_ENV: 'production', OPENAI_API_KEY: 'k' })).toBeNull();
  });
  it('a non-development build never enters local mode', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getEnv({ NODE_ENV: 'development', OPENAI_API_KEY: 'k' })).toBeNull();
  });
});

describe('getEnv QA_DAILY_CAP', () => {
  afterEach(() => vi.restoreAllMocks());

  it('treats unset and blank as the default 50, and a positive integer as itself', () => {
    expect(getEnv({ ...base })?.cap).toBe(50);
    expect(getEnv({ ...base, QA_DAILY_CAP: '' })?.cap).toBe(50);
    expect(getEnv({ ...base, QA_DAILY_CAP: '   ' })?.cap).toBe(50);
    expect(getEnv({ ...base, QA_DAILY_CAP: '7' })?.cap).toBe(7);
  });

  it('keeps the other optional keys alive when they are blank (blank means unset)', () => {
    const env = getEnv({ ...base, GITHUB_REPO: ' ' });
    expect(env).not.toBeNull();
    expect(env?.GITHUB_REPO).toBeUndefined();
  });

  it('defaults the model to gpt-6-luna and requires the OpenAI key and the Upstash pair (blank = unset), with KV fallback names', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getEnv({ ...base, OPENAI_MODEL: '' })?.OPENAI_MODEL).toBe('gpt-6-luna');
    expect(getEnv({ ...base, OPENAI_MODEL: 'other-model' })?.OPENAI_MODEL).toBe('other-model');
    expect(getEnv({ ...base, OPENAI_API_KEY: ' ' })).toBeNull();
    expect(getEnv({ ...base, UPSTASH_REDIS_REST_URL: '' })).toBeNull();
    expect(getEnv({ ...base, UPSTASH_REDIS_REST_TOKEN: undefined })).toBeNull();
    const rest: Record<string, string | undefined> = { ...base };
    delete rest.UPSTASH_REDIS_REST_URL;
    delete rest.UPSTASH_REDIS_REST_TOKEN;
    const env = getEnv({ ...rest, KV_REST_API_URL: 'https://kv.example.test', KV_REST_API_TOKEN: 'kv-token' });
    expect(env?.UPSTASH_REDIS_REST_URL).toBe('https://kv.example.test');
    expect(env?.UPSTASH_REDIS_REST_TOKEN).toBe('kv-token');
  });

  it('voids the whole env for malformed values instead of falling back to 50', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const v of ['abc', '-1', '1.5', '1e3', '9007199254740993']) {
      expect(getEnv({ ...base, QA_DAILY_CAP: v })).toBeNull();
    }
  });

  it('rejects 0 whenever the development opt-out is not allowed (vitest build literal is not development)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const NODE_ENV of ['production', 'test', 'development', undefined]) {
      expect(getEnv({ ...base, QA_DAILY_CAP: '0', NODE_ENV })).toBeNull();
    }
    expect(getEnv({ ...base, QA_DAILY_CAP: '0', NODE_ENV: 'development', VERCEL: '1' })).toBeNull();
  });

  it('honors 0 as unlimited only when the module was built/loaded as development and the runtime agrees', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const dev = await import('@/lib/env.server');
    expect(dev.getEnv({ ...base, QA_DAILY_CAP: '0', NODE_ENV: 'development' })?.cap).toBe('unlimited');
    expect(dev.getEnv({ ...base, QA_DAILY_CAP: '0', NODE_ENV: 'development', VERCEL: '1' })).toBeNull();
    expect(dev.getEnv({ ...base, QA_DAILY_CAP: '0', NODE_ENV: 'production' })).toBeNull();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('memoizes per snapshot but recomputes when NODE_ENV, VERCEL or VERCEL_ENV change', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = getEnv({ ...base, QA_DAILY_CAP: '3', NODE_ENV: 'development' });
    const b = getEnv({ ...base, QA_DAILY_CAP: '3', NODE_ENV: 'development' });
    expect(b).toBe(a);
    const c = getEnv({ ...base, QA_DAILY_CAP: '3', NODE_ENV: 'production' });
    expect(c).not.toBe(a);
    const d = getEnv({ ...base, QA_DAILY_CAP: '3', NODE_ENV: 'production', VERCEL_ENV: 'preview' });
    expect(d).not.toBe(c);
  });

  it('logs qa.env_invalid with variable names only, never values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getEnv({ ...base, AUTH_SECRET: 'SECRET-VALUE-MUST-NOT-LEAK', QA_DAILY_CAP: '0', NODE_ENV: 'production' });
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({ event: 'qa.env_invalid', invalidKeys: ['QA_DAILY_CAP'] });
    expect(line).not.toContain('SECRET-VALUE-MUST-NOT-LEAK');
  });

  it('does not log for a fully empty environment (plain builds)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getEnv({})).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
