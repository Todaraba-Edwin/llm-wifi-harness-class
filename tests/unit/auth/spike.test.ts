/*
 * M7a SPIKE RESULT (better-auth 1.7.17, offline, msw + auth.handler(new Request(...)))
 *
 *   D1-a  PASSED  -> chosen. Owner id = account-cookie `accountId` for provider `github` (numeric GitHub id),
 *                    read with the library's own `getAccountCookie` (better-auth/cookies) and required to belong
 *                    to the same user id as the validated session.
 *   D1-b  not needed (not attempted; check (vii) therefore does not apply).
 *   D2    not needed.
 *
 *   (i)   PASS  Non-owner session (ownerGate off) calling update-user / sign-up/email / sign-in/email /
 *               link-social / change-email with the owner id in every id-like field: the id read afterwards is
 *               still the non-owner's, and the owner check still answers 403. Through the route wrapper: 404.
 *               NEGATIVE CONTROL: a throwaway config with `input:true` githubId and the id read from
 *               session.user.githubId is forged by update-user; the same test body FAILS for it (asserted below).
 *               (`POST /api/qa` 403 + OpenAI spy 0 is S3; requireOwner is the gate it will call.)
 *   (ii)  PASS  A Next `NextRequest` (the Route Handler request type) `.headers` is enough for the session and the id.
 *   (iii) PASS  Authorization URL requests exactly `read:user` (default `user:email` disabled); the sign-in still
 *               completes when GitHub refuses /user/emails, using a noreply address.
 *   (iv)  PASS  Tampered cookies, junk cookies and a cookie minted with another AUTH_SECRET yield no session.
 *   (v)   PASS  emailAndPassword is disabled at library level: sign-up/email and sign-in/email give no session.
 *   (vi)  PASS  First and repeat sign-in each carry the numeric id; every cookie is < 4 KiB; session and account
 *               cookies have Max-Age <= 86400; a request after 24h answers 401 (no stale pass).
 *   (vii) n/a   D1-b only.
 */
import { betterAuth } from 'better-auth';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as routeGET, POST as routePOST } from '@/app/api/auth/[...all]/route';
import { createAuth } from '@/lib/auth/auth';
import { checkOwner } from '@/lib/auth/require-owner';
import { BASE, Jar, OWNER, SECRET, STRANGER, newAuth, req, settings, signIn, startNetworkMock, startUrl, stopNetworkMock } from './helpers';

beforeAll(startNetworkMock);
afterAll(stopNetworkMock);
afterEach(() => vi.useRealTimers());

type Handler = { handler: (r: Request) => Promise<Response> };

const FORGERY_CALLS: Array<[string, unknown]> = [
  ['/api/auth/update-user', { githubId: OWNER, accountId: OWNER, id: OWNER, name: 'x' }],
  ['/api/auth/sign-up/email', { email: 'a@b.test', password: 'password-12345', name: 'x', githubId: OWNER, id: OWNER }],
  ['/api/auth/sign-in/email', { email: 'a@b.test', password: 'password-12345', githubId: OWNER }],
  ['/api/auth/link-social', { provider: 'github', callbackURL: '/ask', accountId: OWNER, id: OWNER }],
  ['/api/auth/change-email', { newEmail: 'c@d.test', githubId: OWNER }],
];

/** True when a non-owner session can still not be turned into the owner's after calling every forgery endpoint. */
async function forgeryResisted(auth: Handler, readId: (jar: Jar) => Promise<string | null>): Promise<boolean> {
  const { jar } = await signIn(auth, STRANGER);
  if ((await readId(jar)) !== STRANGER) throw new Error('control setup: sign-in did not yield the non-owner id');
  for (const [path, json] of FORGERY_CALLS) {
    jar.absorb(await auth.handler(req(path, { json, jar })));
  }
  return (await readId(jar)) === STRANGER;
}

describe('(i) owner id is server-owned and no client endpoint can change it', () => {
  it('library level: every forgery call leaves the non-owner id intact', async () => {
    const auth = newAuth(false);
    const idOf = async (jar: Jar) => {
      for (const candidate of [STRANGER, OWNER]) {
        const r = await checkOwner(auth, candidate, req('/api/x', { jar }));
        if (r.ok) return r.ownerId;
      }
      return null;
    };
    expect(await forgeryResisted(auth, idOf)).toBe(true);
    const { jar } = await signIn(auth, STRANGER);
    const before = await checkOwner(auth, OWNER, req('/api/x', { jar }));
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.response.status).toBe(403);
  });

  it('route wrapper: the same calls are 404 and never reach the library', async () => {
    for (const [path, json] of FORGERY_CALLS) {
      const res = await routePOST(req(path, { json }));
      expect(res.status, path).toBe(404);
    }
  });

  it('NEGATIVE CONTROL: input:true + id from session.user.githubId is forgeable, so the test body detects the bug', async () => {
    const control = betterAuth({
      baseURL: BASE,
      secret: SECRET,
      trustedOrigins: [BASE],
      emailAndPassword: { enabled: false },
      account: { storeAccountCookie: true, accountLinking: { enabled: false } },
      session: { expiresIn: 86400, cookieCache: { enabled: true, maxAge: 86400, strategy: 'jwe', refreshCache: true } },
      user: { additionalFields: { githubId: { type: 'string', required: false, input: true } } },
      socialProviders: {
        github: {
          clientId: 'x',
          clientSecret: 'y',
          disableDefaultScope: true,
          scope: ['read:user'],
          mapProfileToUser: (profile) => ({ githubId: String(profile.id), email: `${profile.id}@users.noreply.github.com` }),
        },
      },
    });
    const readId = async (jar: Jar) => {
      const res = await control.handler(req('/api/auth/get-session', { jar }));
      jar.absorb(res);
      const body = (await res.json()) as { user?: { githubId?: string } } | null;
      return body?.user?.githubId ?? null;
    };
    expect(await forgeryResisted(control, readId)).toBe(false);
  });
});

describe('(ii) session + id readable from a Route Handler request', () => {
  it('NextRequest headers carry everything the owner check needs; get-session works through the wrapper', async () => {
    const auth = newAuth(true);
    const { jar } = await signIn(auth, OWNER);
    const nextReq = new NextRequest(`${BASE}/ask`, { headers: { cookie: jar.header() } });
    const r = await checkOwner(auth, OWNER, nextReq);
    expect(r).toEqual({ ok: true, ownerId: OWNER });
  });
});

describe('(iii) scope', () => {
  it('requests only read:user', async () => {
    const url = await startUrl(newAuth(true));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('read:user');
  });
});

describe('(iv) forged / tampered / wrong-secret cookies', () => {
  it('yield no session', async () => {
    const auth = newAuth(true);
    const { jar } = await signIn(auth, OWNER);
    expect((await checkOwner(auth, OWNER, req('/api/x', { jar }))).ok).toBe(true);

    // Flipping bytes of the encrypted account cookie must remove the id, never change it.
    const tampered = new Jar();
    for (const [n, v] of jar.cookies) tampered.cookies.set(n, n.includes('account_data') ? v.slice(0, -4) + (v.endsWith('AAAA') ? 'BBBB' : 'AAAA') : v);
    const t = await checkOwner(auth, OWNER, req('/api/x', { jar: tampered }));
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.response.status).toBe(401);

    const junk = new Jar();
    for (const name of jar.cookies.keys()) junk.cookies.set(name, 'not-a-token');
    expect((await checkOwner(auth, OWNER, req('/api/x', { jar: junk }))).ok).toBe(false);

    const wrongSecret = createAuth({ ownerGate: true, baseURL: BASE, settings: { ...settings, secret: 'another-secret-0123456789abcdef0123456789ab' } });
    const r = await checkOwner(wrongSecret, OWNER, req('/api/x', { jar }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('a session cookie alone (account cookie removed) is not an owner pass', async () => {
    const auth = newAuth(true);
    const { jar } = await signIn(auth, OWNER);
    for (const name of [...jar.cookies.keys()]) if (name.includes('account_data')) jar.cookies.delete(name);
    const r = await checkOwner(auth, OWNER, req('/api/x', { jar }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });
});

describe('(v) email/password disabled at library level', () => {
  it('sign-up/email and sign-in/email never create a session', async () => {
    const auth = newAuth(true);
    for (const path of ['/api/auth/sign-up/email', '/api/auth/sign-in/email']) {
      const jar = new Jar();
      const res = await auth.handler(req(path, { json: { email: 'a@b.test', password: 'password-12345', name: 'x' } }));
      jar.absorb(res);
      expect(res.status, path).toBeGreaterThanOrEqual(400);
      const r = await checkOwner(auth, OWNER, req('/api/x', { jar }));
      expect(r.ok, path).toBe(false);
    }
  });
});

describe('(vi) stateless account-cookie robustness and lifetime', () => {
  it('first and repeat sign-in each carry the id; cookies are small; lifetimes <= 24h', async () => {
    const auth = newAuth(true);
    const first = await signIn(auth, OWNER);
    expect((await checkOwner(auth, OWNER, req('/api/x', { jar: first.jar }))).ok).toBe(true);

    const repeat = await signIn(auth, OWNER, first.jar); // same browser, signing in again
    expect((await checkOwner(auth, OWNER, req('/api/x', { jar: repeat.jar }))).ok).toBe(true);
    const fresh = await signIn(auth, OWNER); // new browser
    expect((await checkOwner(auth, OWNER, req('/api/x', { jar: fresh.jar }))).ok).toBe(true);

    for (const [name, value] of fresh.jar.cookies) expect(`${name}=${value}`.length, name).toBeLessThan(4096);

    const lines = (await signInSetCookies(auth)).filter((l) => /session_token|session_data|account_data/.test(l));
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      const m = /max-age=(\d+)/i.exec(line);
      expect(m, line.split('=')[0]).not.toBeNull();
      expect(Number(m![1])).toBeLessThanOrEqual(86400);
    }
  });

  it('a request after expiry is 401, never a stale pass', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const auth = newAuth(true);
    const { jar } = await signIn(auth, OWNER);
    expect((await checkOwner(auth, OWNER, req('/api/x', { jar }))).ok).toBe(true);
    vi.setSystemTime(Date.now() + 24 * 3600 * 1000 + 60_000);
    const r = await checkOwner(auth, OWNER, req('/api/x', { jar }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });
});

describe('route wrapper reaches the library only for the allowlist', () => {
  it('ok and sign-in/social are forwarded to the handler (503 here: no env configured)', async () => {
    expect((await routeGET(req('/api/auth/ok'))).status).toBe(503);
    expect((await routeGET(req('/api/auth/nope'))).status).toBe(404);
  });
});

async function signInSetCookies(auth: Handler): Promise<string[]> {
  const start = await auth.handler(req('/api/auth/sign-in/social', { json: { provider: 'github', callbackURL: '/ask' } }));
  const jar = new Jar();
  jar.absorb(start);
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get('state');
  const cb = await auth.handler(req(`/api/auth/callback/github?code=${OWNER}&state=${state}`, { jar }));
  return cb.headers.getSetCookie();
}
