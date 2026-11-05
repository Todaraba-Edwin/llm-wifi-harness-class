import 'server-only';

// Exact (method, path) allowlist for the auth route. Everything else (update-user, sign-up/email,
// sign-in/email, link-social, change-email, delete-user, ...) never reaches the library handler.
// The match is on the parsed pathname with no normalization of our own: a trailing slash, a double
// slash, an encoded slash (%2F), `..` segments or a different case are simply not in the set.
const PREFIX = '/api/auth/';
const ALLOWED: ReadonlySet<string> = new Set([
  'GET sign-in/social',
  'POST sign-in/social',
  'GET callback/github',
  'GET get-session',
  'POST sign-out',
  'GET ok',
  'GET error',
]);

export function isAllowedAuthRequest(method: string, url: string): boolean {
  try {
    const { pathname } = new URL(url);
    if (!pathname.startsWith(PREFIX)) return false;
    return ALLOWED.has(`${method} ${pathname.slice(PREFIX.length)}`);
  } catch {
    return false;
  }
}
