import https from 'node:https';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createAuth } from '@/lib/auth/auth';
import type { AuthSettings } from '@/lib/env.server';

export const BASE = 'https://wiki.example.test';
export const OWNER = '1234567';
export const STRANGER = '7654321';
export const SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

export const settings: AuthSettings = {
  secret: SECRET,
  githubClientId: 'dummy-client-id',
  githubClientSecret: 'dummy-client-secret',
  ownerGithubId: OWNER,
};

export const calls: string[] = [];

/**
 * tests/setup/guards.ts replaces globalThis.fetch with a blocker, and msw 3 intercepts below the real
 * fetch (at the socket layer) rather than replacing it. This minimal https-based fetch is what msw sits
 * under: it never reaches a network because every request here is answered by a msw handler
 * (onUnhandledFrame: 'error' turns anything else into a failure).
 */
export function mswBackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const request = new Request(input, init);
    request
      .arrayBuffer()
      .then((buf) => {
        const out = https.request(new URL(request.url), { method: request.method, headers: Object.fromEntries(request.headers) }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const status = res.statusCode ?? 500;
            const headers = new Headers();
            for (const [k, v] of Object.entries(res.headers)) for (const item of Array.isArray(v) ? v : [v]) if (item !== undefined) headers.append(k, item);
            const nullBody = status === 204 || status === 205 || status === 304;
            resolve(new Response(nullBody ? null : Buffer.concat(chunks), { status, headers }));
          });
        });
        out.on('error', reject);
        out.end(buf.byteLength > 0 ? Buffer.from(buf) : undefined);
      })
      .catch(reject);
  });
}

const blockedFetch = globalThis.fetch;

/** Call in beforeAll / afterAll of every auth test file that drives OAuth. */
export function startNetworkMock(): void {
  globalThis.fetch = mswBackedFetch as typeof fetch;
  server.listen({ onUnhandledFrame: 'error' });
}
export function stopNetworkMock(): void {
  server.close();
  globalThis.fetch = blockedFetch;
}

/** The OAuth `code` doubles as the GitHub user id: token = `tok-<id>`, /user answers with that id. */
export const server = setupServer(
  http.post('https://github.com/login/oauth/access_token', async ({ request }) => {
    calls.push('token');
    const params = new URLSearchParams(await request.text());
    return HttpResponse.json({ access_token: `tok-${params.get('code')}`, token_type: 'bearer', scope: 'read:user' });
  }),
  http.get('https://api.github.com/user', ({ request }) => {
    calls.push('user');
    const id = request.headers.get('authorization')?.replace('Bearer tok-', '') ?? '';
    return HttpResponse.json({ id: Number(id), login: `user-${id}`, name: `User ${id}`, email: null, avatar_url: 'https://example.test/a.png' });
  }),
  http.get('https://api.github.com/user/emails', () => {
    calls.push('emails');
    // The token only has `read:user`, so GitHub refuses the email list.
    return new HttpResponse(null, { status: 404 });
  }),
);

export function newAuth(ownerGate: boolean) {
  return createAuth({ ownerGate, settings, baseURL: BASE });
}

export class Jar {
  readonly cookies = new Map<string, string>();
  absorb(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const maxAge = attrs.map((a) => a.trim().toLowerCase()).find((a) => a.startsWith('max-age='));
      if (value === '' || maxAge === 'max-age=0') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

type Handler = { handler: (req: Request) => Promise<Response> };

export function req(path: string, init: RequestInit & { jar?: Jar; json?: unknown } = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('origin', BASE);
  if (init.jar) headers.set('cookie', init.jar.header());
  let body: string | undefined;
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.json);
  }
  return new Request(`${BASE}${path}`, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body });
}

/** sign-in/social -> follow the state cookie -> callback/github. Returns the jar holding the session cookies. */
export async function signIn(auth: Handler, githubId: string, jar = new Jar()): Promise<{ jar: Jar; callback: Response }> {
  const start = await auth.handler(req('/api/auth/sign-in/social', { json: { provider: 'github', callbackURL: '/ask' }, jar }));
  jar.absorb(start);
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get('state');
  const callback = await auth.handler(req(`/api/auth/callback/github?code=${githubId}&state=${state}`, { jar }));
  jar.absorb(callback);
  return { jar, callback };
}

export async function startUrl(auth: Handler): Promise<URL> {
  const start = await auth.handler(req('/api/auth/sign-in/social', { json: { provider: 'github', callbackURL: '/ask' } }));
  return new URL(((await start.json()) as { url: string }).url);
}
