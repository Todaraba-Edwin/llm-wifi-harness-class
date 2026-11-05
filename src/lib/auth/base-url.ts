import 'server-only';
import { isProductionLike, type EnvSource } from '../runtime-mode';

/** Environment variables the resolver reads; part of the getAuth() memo key. */
export const BASE_URL_ENV_KEYS = ['BETTER_AUTH_URL', 'VERCEL_PROJECT_PRODUCTION_URL'] as const;

function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The single source of truth for the auth base URL and trusted origin (an origin, no path).
 * - `BETTER_AUTH_URL` when set (blank = unset); an invalid value is unresolvable.
 * - Vercel Production: `https://${VERCEL_PROJECT_PRODUCTION_URL}`.
 * - Vercel Preview (or any other Vercel environment) without `BETTER_AUTH_URL`: unresolvable.
 * - `http://localhost:3000` only when there is no `VERCEL` and the runtime is not production-like.
 * `null` means unconfigured; callers answer 503.
 */
export function resolveBaseUrl(source: EnvSource = process.env): string | null {
  const explicit = source.BETTER_AUTH_URL?.trim();
  if (explicit) return originOf(explicit);
  if (source.VERCEL) {
    const host = source.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (source.VERCEL_ENV === 'production' && host) return originOf(`https://${host}`);
    return null;
  }
  return isProductionLike(source) ? null : 'http://localhost:3000';
}
