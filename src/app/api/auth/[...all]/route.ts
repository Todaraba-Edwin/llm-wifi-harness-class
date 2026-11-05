import { getAuth } from '@/lib/auth/auth';
import { isAllowedAuthRequest } from '@/lib/auth/allowed-paths';
import { logEvent } from '@/lib/log';

export const dynamic = 'force-dynamic';

const json = (status: number, code: string) =>
  Response.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Forwards only the fixed (method, path) allowlist to the library handler; everything else is 404 here. */
async function handle(req: Request): Promise<Response> {
  if (!isAllowedAuthRequest(req.method, req.url)) return json(404, 'NOT_FOUND');
  try {
    const auth = getAuth();
    if (!auth) return json(503, 'QA_UNAVAILABLE');
    return await auth.handler(req);
  } catch {
    logEvent('qa.auth_denied', { reason: 'error', status: 503 });
    return json(503, 'QA_UNAVAILABLE');
  }
}

export const GET = handle;
export const POST = handle;
