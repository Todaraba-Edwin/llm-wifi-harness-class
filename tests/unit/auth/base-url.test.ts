import { describe, expect, it } from 'vitest';
import { resolveBaseUrl } from '@/lib/auth/base-url';
import { getAuth } from '@/lib/auth/auth';

describe('resolveBaseUrl', () => {
  it('uses BETTER_AUTH_URL when set (origin only; blank = unset; invalid = unresolved)', () => {
    expect(resolveBaseUrl({ BETTER_AUTH_URL: 'https://wiki.example.test/some/path' })).toBe('https://wiki.example.test');
    expect(resolveBaseUrl({ BETTER_AUTH_URL: 'https://wiki.example.test', VERCEL: '1', VERCEL_ENV: 'preview' })).toBe('https://wiki.example.test');
    expect(resolveBaseUrl({ BETTER_AUTH_URL: 'not a url' })).toBeNull();
    expect(resolveBaseUrl({ BETTER_AUTH_URL: 'javascript:alert(1)' })).toBeNull();
  });

  it('Vercel Production derives https://VERCEL_PROJECT_PRODUCTION_URL; Preview without BETTER_AUTH_URL is unresolvable', () => {
    const prod = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'wiki.vercel.app' };
    expect(resolveBaseUrl(prod)).toBe('https://wiki.vercel.app');
    expect(resolveBaseUrl({ ...prod, VERCEL_PROJECT_PRODUCTION_URL: undefined })).toBeNull();
    expect(resolveBaseUrl({ ...prod, VERCEL_ENV: 'preview' })).toBeNull();
    expect(resolveBaseUrl({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_URL: 'branch-abc.vercel.app' })).toBeNull();
    expect(resolveBaseUrl({ VERCEL: '1' })).toBeNull();
  });

  it('localhost:3000 only without VERCEL and outside production', () => {
    expect(resolveBaseUrl({})).toBe('http://localhost:3000');
    expect(resolveBaseUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(resolveBaseUrl({ NODE_ENV: 'production' })).toBeNull();
    expect(resolveBaseUrl({ VERCEL: '1', VERCEL_ENV: 'development' })).toBeNull();
  });

  it('getAuth() is unconfigured when Q&A env is missing or the base URL is unresolved, and trusts only the resolved origin', () => {
    const qa = { AUTH_SECRET: 's'.repeat(40), AUTH_GITHUB_ID: 'id', AUTH_GITHUB_SECRET: 'sec', OWNER_GITHUB_ID: '42', OPENAI_API_KEY: 'dummy-key', OPENAI_MODEL: 'dummy-model', UPSTASH_REDIS_REST_URL: 'https://redis.example.test', UPSTASH_REDIS_REST_TOKEN: 'dummy-token' };
    expect(getAuth({})).toBeNull();
    expect(getAuth({ ...qa, VERCEL: '1', VERCEL_ENV: 'preview' })).toBeNull();
    const auth = getAuth({ ...qa, BETTER_AUTH_URL: 'https://wiki.example.test' });
    expect(auth).not.toBeNull();
    expect(getAuth({ ...qa, BETTER_AUTH_URL: 'https://wiki.example.test' })).toBe(auth); // memoized per snapshot
    expect(getAuth({ ...qa, BETTER_AUTH_URL: 'https://other.example.test' })).not.toBe(auth);
  });
});
