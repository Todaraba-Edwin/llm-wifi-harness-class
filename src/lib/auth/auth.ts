import 'server-only';
import { betterAuth } from 'better-auth';
import { github, type GithubOptions } from 'better-auth/social-providers';
import { authSettings, getEnv, type AuthSettings, type QaEnv } from '../env.server';
import type { EnvSource } from '../runtime-mode';
import { BASE_URL_ENV_KEYS, resolveBaseUrl } from './base-url';

/** Session and account-cookie lifetime. Both are bounded by the same value (<= 24h). */
export const AUTH_LIFETIME_SECONDS = 24 * 60 * 60;


export interface CreateAuthOptions {
  /**
   * Test seam. `true` (what getAuth() always passes) makes a non-owner GitHub id unable to obtain a
   * session at all. Tests pass `false` to mint a non-owner session. It is never read from the environment.
   */
  ownerGate: boolean;
  settings: AuthSettings;
  /** Origin from resolveBaseUrl(); also the only trusted origin. */
  baseURL: string;
}

type GetUserInfo = NonNullable<GithubOptions['getUserInfo']>;

/**
 * Wraps the library's own GitHub profile fetch. The numeric id comes from the provider response,
 * is validated here, and the library stores it as the account `accountId` (signed/encrypted account
 * cookie). Returning null denies the sign-in before any session exists.
 */
function ownerGatedUserInfo(settings: AuthSettings, ownerGate: boolean): GetUserInfo {
  const inner = github({ clientId: settings.githubClientId, clientSecret: settings.githubClientSecret });
  return async (token) => {
    const info = await inner.getUserInfo(token);
    if (!info) return null;
    const id = String((info.data as { id?: unknown } | undefined)?.id ?? '');
    if (!/^\d+$/.test(id)) return null;
    if (ownerGate && id !== settings.ownerGithubId) return null;
    // With only `read:user` GitHub may return no public email; the library requires one.
    const email = info.user.email || `${id}@users.noreply.github.com`;
    return { ...info, user: { ...info.user, email } };
  };
}

export function createAuth({ ownerGate, settings, baseURL }: CreateAuthOptions) {
  return betterAuth({
    baseURL,
    secret: settings.secret,
    trustedOrigins: [baseURL],
    emailAndPassword: { enabled: false },
    account: { storeAccountCookie: true, accountLinking: { enabled: false } },
    session: {
      expiresIn: AUTH_LIFETIME_SECONDS,
      cookieCache: { enabled: true, maxAge: AUTH_LIFETIME_SECONDS, strategy: 'jwe', refreshCache: true },
    },
    socialProviders: {
      github: {
        clientId: settings.githubClientId,
        clientSecret: settings.githubClientSecret,
        disableDefaultScope: true,
        scope: ['read:user'],
        getUserInfo: ownerGatedUserInfo(settings, ownerGate),
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

let memo: { key: string; value: Auth | null } | undefined;

/**
 * The production auth instance, or null when Q&A is unconfigured or no base URL resolves (callers answer 503).
 * Lazy and memoized per environment snapshot; nothing here runs at import time. `ownerGate` is a literal `true`.
 */
export function getAuth(source: EnvSource = process.env): Auth | null {
  const env: QaEnv | null = getEnv(source);
  const baseURL = resolveBaseUrl(source);
  if (!env || !baseURL) return null;
  const settings = authSettings(env);
  const key = JSON.stringify([settings, baseURL, ...BASE_URL_ENV_KEYS.map((k) => source[k] ?? null)]);
  if (memo && memo.key === key) return memo.value;
  const value = createAuth({ ownerGate: true, settings, baseURL });
  memo = { key, value };
  return value;
}
