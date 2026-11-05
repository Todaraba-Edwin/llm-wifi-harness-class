import 'server-only';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import pagesJson from '@/generated/pages.json';
import { resolveBaseUrl } from '@/lib/auth/base-url';
import { requireOwner, type OwnerCheck } from '@/lib/auth/require-owner';
import { authSettings, getEnv, githubWriteback, type QaEnv } from '@/lib/env.server';
import { oneLine, SaveError, truncate } from '@/lib/github/index-log';
import { createSavePr, kstParts, type GithubApi } from '@/lib/github/pr';
import { logEvent } from '@/lib/log';
import { QUESTION_MAX } from '@/lib/qa/schema';
import { verifyAnswerSignature } from '@/lib/qa/sign';
import { validateAnswer, type ValidationResult } from '@/lib/qa/validate';

const HEADERS = { 'Cache-Control': 'no-store' };
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX = 80;
const SUMMARY_MAX = 120;

const Body = z.object({
  question: z.string().min(1).max(QUESTION_MAX),
  answer: z.unknown().refine((v) => v !== undefined),
  iat: z.number().int(),
  sig: z.string().max(200),
  slug: z.string().max(200).optional(),
  summary: z.string().max(2000).optional(),
});

export interface SaveDeps {
  getEnv(): QaEnv | null;
  baseUrl(): string | null;
  requireOwner(req: Request): Promise<OwnerCheck>;
  validateAnswer(raw: unknown): ValidationResult;
  github(token: string): GithubApi;
  sourcesOf(slug: string): readonly string[] | undefined;
  now(): number;
}

let sources: Map<string, readonly string[]> | undefined;
function defaultSourcesOf(slug: string): readonly string[] | undefined {
  if (!sources) sources = new Map((pagesJson as { pages: { slug: string; sources: string[] }[] }).pages.map((p) => [p.slug, p.sources]));
  return sources.get(slug);
}

export const defaultSaveDeps: SaveDeps = {
  getEnv: () => getEnv(),
  baseUrl: () => resolveBaseUrl(),
  requireOwner,
  validateAnswer: (raw) => validateAnswer(raw),
  github: (token) => new Octokit({ auth: token }) as unknown as GithubApi,
  sourcesOf: defaultSourcesOf,
  now: () => Date.now(),
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: HEADERS });
}

export function createSaveHandler(deps: SaveDeps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const base = deps.baseUrl();
    const origin = req.headers.get('origin');
    if (origin !== null && base !== null && origin !== base) return json({ error: 'FORBIDDEN_ORIGIN' }, 403);
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') return json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415);

    const env = deps.getEnv();
    // Local dev mode skips the owner check and signs with a public key, so it never writes to GitHub.
    const wb = env && !env.devLocal ? githubWriteback(env) : null;
    if (!env || !base || !wb) return json({ error: 'SAVE_UNAVAILABLE' }, 503);

    const owner = await deps.requireOwner(req);
    if (!owner.ok) return owner.response;

    let body: z.infer<typeof Body>;
    try {
      const r = Body.safeParse(await req.json());
      if (!r.success) return json({ error: 'BAD_REQUEST' }, 400);
      body = r.data;
    } catch {
      return json({ error: 'BAD_REQUEST' }, 400);
    }

    const now = deps.now();
    const payload = { question: body.question, answer: body.answer as never, iat: body.iat };
    if (!verifyAnswerSignature(payload, body.sig, authSettings(env).secret, now)) {
      logEvent('qa.save_denied', { reason: 'bad_signature', status: 403 });
      return json({ error: 'BAD_SIGNATURE' }, 403);
    }

    const v = deps.validateAnswer(body.answer);
    if (!v.ok) {
      logEvent('qa.save_denied', { reason: v.reason, status: 422 });
      return json({ error: 'INVALID_ANSWER' }, 422);
    }

    const time = kstParts(now);
    const slug = body.slug === undefined || body.slug.trim() === '' ? `qa-${time.slugStamp}` : body.slug.trim();
    if (!SLUG_RE.test(slug) || slug.length > SLUG_MAX) return json({ error: 'BAD_SLUG' }, 422);

    const summary = body.summary === undefined || body.summary.trim() === '' ? truncate(oneLine(body.question), 80, true) : body.summary.trim();
    if (summary === '' || [...summary].length > SUMMARY_MAX || /[\r\n\u0085\u2028\u2029]/.test(summary) || summary.includes('[[') || summary.includes(']]')) {
      return json({ error: 'BAD_SUMMARY' }, 422);
    }

    try {
      const pr = await createSavePr(deps.github(wb.token), {
        repo: wb.repo,
        question: body.question,
        answer: v.answer,
        slug,
        summary,
        now,
        sourcesOf: deps.sourcesOf,
      });
      logEvent('qa.saved', { status: 200 });
      return json({ url: pr.url, number: pr.number }, 200);
    } catch (e) {
      if (e instanceof SaveError) {
        logEvent('qa.save_failed', { reason: e.code.toLowerCase(), status: e.status });
        return json({ error: e.code }, e.status);
      }
      logEvent('qa.save_failed', { reason: 'unexpected', status: 502 });
      return json({ error: 'GITHUB_FAILED' }, 502);
    }
  };
}
