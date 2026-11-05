import 'server-only';
import { getAccountCookie, parseCookies } from 'better-auth/cookies';
import { authSettings, getEnv } from '../env.server';
import { logEvent } from '../log';
import { getAuth, type Auth } from './auth';

/**
 * Result of the owner check: a discriminated union, never a thrown error.
 * - `{ ok: true, ownerId }` only when the server-owned GitHub id equals the configured owner id exactly.
 * - `{ ok: false, response }` carries the ready 503 / 401 / 403 JSON response.
 */
export type OwnerCheck = { ok: true; ownerId: string } | { ok: false; response: Response };

export type DenyReason = 'unconfigured' | 'no_session' | 'no_account_id' | 'not_owner' | 'error';

const NUMERIC = /^\d+$/;

function deny(status: 503 | 401 | 403, reason: DenyReason): OwnerCheck {
  logEvent('qa.auth_denied', { reason, status });
  const body = status === 503 ? { code: 'QA_UNAVAILABLE' } : { code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN' };
  return { ok: false, response: Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) };
}

/**
 * Reads the GitHub numeric id from the library's account cookie (written only by the OAuth callback from
 * the provider's response, encrypted with the auth secret) through the library's own decoder, and requires it to
 * belong to the same user as the validated session. Returns null when absent or not numeric.
 */
async function serverOwnedGithubId(auth: Auth, headers: Headers, sessionUserId: string): Promise<string | null> {
  const context = await auth.$context;
  const cookies = parseCookies(headers.get('cookie') ?? '');
  const data = await getAccountCookie({
    context,
    headers,
    getCookie: (name: string) => cookies.get(name) ?? null,
  } as unknown as Parameters<typeof getAccountCookie>[0]);
  if (!data || data.providerId !== 'github' || data.userId !== sessionUserId) return null;
  const id = String(data.accountId ?? '');
  return NUMERIC.test(id) ? id : null;
}

/** Core check against an explicit auth instance. Any exception denies. */
export async function checkOwner(auth: Auth, ownerGithubId: string, req: Request): Promise<OwnerCheck> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) return deny(401, 'no_session');
    const id = await serverOwnedGithubId(auth, req.headers, session.user.id);
    if (id === null) return deny(401, 'no_account_id');
    if (id !== ownerGithubId) return deny(403, 'not_owner');
    return { ok: true, ownerId: id };
  } catch {
    return deny(401, 'error');
  }
}

/**
 * Runs first in every owner-only handler (never middleware-only).
 * 503 QA_UNAVAILABLE when env is invalid or no base URL resolves; 401 without a valid session / on lookup
 * failure / without a numeric server-owned id; 403 for a different id (ids are compared, never logins).
 */
export async function requireOwner(req: Request): Promise<OwnerCheck> {
  try {
    const env = getEnv();
    // Local `next dev` with only the OpenAI key configured: there is no owner sign-in to check (see env.server.ts).
    if (env?.devLocal) return { ok: true, ownerId: 'local-dev' };
    const auth = getAuth();
    if (!env || !auth) return deny(503, 'unconfigured');
    return await checkOwner(auth, authSettings(env).ownerGithubId, req);
  } catch {
    return deny(401, 'error');
  }
}
