import { describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/auth/[...all]/route';
import { isAllowedAuthRequest } from '@/lib/auth/allowed-paths';

const U = (p: string) => `https://wiki.example.test${p}`;

describe('isAllowedAuthRequest: exact (method, path) match', () => {
  it.each([
    ['GET', '/api/auth/sign-in/social'],
    ['POST', '/api/auth/sign-in/social'],
    ['GET', '/api/auth/callback/github'],
    ['GET', '/api/auth/get-session'],
    ['POST', '/api/auth/sign-out'],
    ['GET', '/api/auth/ok'],
    ['GET', '/api/auth/error'],
  ])('allows %s %s (query string ignored)', (method, path) => {
    expect(isAllowedAuthRequest(method, U(path))).toBe(true);
    expect(isAllowedAuthRequest(method, U(`${path}?a=1`))).toBe(true);
  });

  it.each([
    ['POST', '/api/auth/get-session'],
    ['GET', '/api/auth/sign-out'],
    ['POST', '/api/auth/callback/github'],
    ['DELETE', '/api/auth/ok'],
    ['GET', '/api/auth/sign-in/social/'],
    ['GET', '/api/auth/ok/'],
    ['GET', '/api/auth//ok'],
    ['GET', '/api/auth/sign-in//social'],
    ['GET', '/api/auth/sign-in%2Fsocial'],
    ['GET', '/api/auth/sign-in%2fsocial'],
    ['GET', '/api/auth/sign-in/social%2F'],
    ['GET', '/api/auth/../auth/ok/x'],
    ['GET', '/api/auth/ok/..'],
    ['GET', '/api/auth/%2e%2e/ok'],
    ['GET', '/api/auth/OK'],
    ['GET', '/api/auth/sign-in/social;x'],
    ['GET', '/api/auth'],
    ['GET', '/api/auth/'],
    ['POST', '/api/auth/update-user'],
    ['POST', '/api/auth/sign-up/email'],
    ['POST', '/api/auth/sign-in/email'],
    ['POST', '/api/auth/link-social'],
    ['POST', '/api/auth/change-email'],
    ['POST', '/api/auth/delete-user'],
  ])('rejects %s %s', (method, path) => {
    expect(isAllowedAuthRequest(method, U(path))).toBe(false);
  });

  it('rejects a malformed URL', () => {
    expect(isAllowedAuthRequest('GET', 'not a url')).toBe(false);
  });
});

describe('route wrapper answers 404 before the library for every non-allowlisted request', () => {
  const rejected: Array<[string, string]> = [
    ['POST', '/api/auth/update-user'],
    ['POST', '/api/auth/sign-up/email'],
    ['POST', '/api/auth/sign-in/email'],
    ['POST', '/api/auth/link-social'],
    ['POST', '/api/auth/change-email'],
    ['POST', '/api/auth/delete-user'],
    ['GET', '/api/auth/ok/'],
    ['GET', '/api/auth//ok'],
    ['GET', '/api/auth/sign-in%2Fsocial'],
    ['GET', '/api/auth/ok/..'],
  ];
  it.each(rejected)('%s %s -> 404', async (method, path) => {
    const req = new Request(U(path), { method, headers: method === 'POST' ? { 'content-type': 'application/json' } : {}, body: method === 'POST' ? '{}' : undefined });
    const res = await (method === 'GET' ? GET : POST)(req);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: 'NOT_FOUND' });
  });
});
