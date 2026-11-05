import 'server-only';
import { z } from 'zod';
import corpusJson from '@/generated/qa-corpus.json';
import { resolveBaseUrl } from '@/lib/auth/base-url';
import { requireOwner, type OwnerCheck } from '@/lib/auth/require-owner';
import { authSettings, getEnv, type QaEnv } from '@/lib/env.server';
import { logEvent } from '@/lib/log';
import { attemptDeadline, canRetry, REQUEST_BUDGET_MS } from '@/lib/qa/budget';
import { reserveCap, type CapResult } from '@/lib/qa/cap';
import { askOpenAI } from '@/lib/qa/openai';
import { NOT_COVERED_TEXT } from '@/lib/qa/prompt';
import { QUESTION_MAX } from '@/lib/qa/schema';
import { signAnswer } from '@/lib/qa/sign';
import { validateAnswer, type ValidationResult } from '@/lib/qa/validate';

const HEADERS = { 'Cache-Control': 'no-store' };
const Body = z.object({ question: z.string().trim().min(1).max(QUESTION_MAX) });

export interface Deps {
  getEnv(): QaEnv | null;
  baseUrl(): string | null;
  requireOwner(req: Request): Promise<OwnerCheck>;
  reserveCap(): Promise<CapResult>;
  askOpenAI(args: { question: string; deadlineMs: number }): Promise<unknown>;
  validateAnswer(raw: unknown): ValidationResult;
  titleOf(slug: string): string;
  now(): number;
}

let titles: Map<string, string> | undefined;
function defaultTitleOf(slug: string): string {
  if (!titles) titles = new Map((corpusJson as { pages: { slug: string; title: string }[] }).pages.map((p) => [p.slug, p.title]));
  return titles.get(slug) ?? slug;
}

export const defaultDeps: Deps = {
  getEnv: () => getEnv(),
  baseUrl: () => resolveBaseUrl(),
  requireOwner,
  reserveCap: () => reserveCap(),
  askOpenAI: (args) => askOpenAI(args),
  validateAnswer: (raw) => validateAnswer(raw),
  titleOf: defaultTitleOf,
  now: () => Date.now(),
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: HEADERS });
}

const UNAVAILABLE = () => json({ error: 'QA_UNAVAILABLE' }, 503);
const FAILED = () => json({ error: 'QA_FAILED', message: '근거를 검증하지 못했습니다' }, 502);

function capDenied(r: Extract<CapResult, { ok: false }>): Response {
  if (r.reason === 'exceeded') {
    return json({ error: 'CAP_EXCEEDED', message: `오늘 질문 한도(${r.cap}회)를 모두 사용했습니다. 한국 시간 자정 이후에 다시 시도해 주세요.` }, 429);
  }
  return json({ error: 'STORE_UNAVAILABLE', message: 'Q&A 저장소에 연결할 수 없어 요청을 처리하지 않았습니다.' }, 503);
}

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const base = deps.baseUrl();
    const origin = req.headers.get('origin');
    if (origin !== null && base !== null && origin !== base) return json({ error: 'FORBIDDEN_ORIGIN' }, 403);
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') return json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415);

    const env = deps.getEnv();
    if (!env || !base) return UNAVAILABLE();

    const owner = await deps.requireOwner(req);
    if (!owner.ok) return owner.response;

    let parsed: z.infer<typeof Body>;
    try {
      const r = Body.safeParse(await req.json());
      if (!r.success) return json({ error: 'BAD_REQUEST', message: '질문을 1자 이상 1000자 이하로 입력하세요.' }, 400);
      parsed = r.data;
    } catch {
      return json({ error: 'BAD_REQUEST', message: '질문을 1자 이상 1000자 이하로 입력하세요.' }, 400);
    }

    const start = deps.now();
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = REQUEST_BUDGET_MS - (deps.now() - start);
      if (attempt > 0 && !canRetry(remaining)) break;
      const deadlineMs = attemptDeadline(remaining);
      if (deadlineMs <= 0) break;

      let cap: CapResult;
      try {
        cap = await deps.reserveCap();
      } catch {
        return UNAVAILABLE();
      }
      if (!cap.ok) {
        logEvent('qa.cap_denied', { reason: cap.reason, status: cap.reason === 'exceeded' ? 429 : 503 });
        return capDenied(cap);
      }

      let raw: unknown;
      try {
        raw = await deps.askOpenAI({ question: parsed.question, deadlineMs });
      } catch (err) {
        logEvent('qa.failed', { reason: 'provider', status: 502 });
        const ps = (err as { providerStatus?: unknown }).providerStatus;
        return typeof ps === 'number' ? json({ error: 'QA_FAILED', message: `OpenAI 호출에 실패했습니다 (HTTP ${ps}). 모델명(OPENAI_MODEL)과 API 키를 확인하세요.` }, 502) : FAILED();
      }

      const v = deps.validateAnswer(raw);
      if (!v.ok) {
        logEvent('qa.validation_failed', { reason: v.reason });
        continue;
      }

      const a = v.answer;
      const iat = deps.now();
      const sig = signAnswer({ question: parsed.question, answer: a, iat }, authSettings(env).secret);
      logEvent('qa.answered', { status: 200, ...(typeof cap.cap === 'number' ? { remaining: cap.cap - cap.count } : {}) });
      return json(
        {
          question: parsed.question,
          iat,
          answer: a,
          answerable: a.answerable,
          title_en: a.title_en,
          title_ko: a.title_ko,
          summary: a.summary,
          sentences: a.answerable
            ? a.sentences.map((s) => ({ text: s.text, cites: s.cites.map((c) => ({ slug: c.slug, title: deps.titleOf(c.slug), quote: c.quote })) }))
            : [{ text: NOT_COVERED_TEXT, cites: [] }],
          notCovered: a.answerable ? a.notCovered.map((item) => `${NOT_COVERED_TEXT}: ${item}`) : [],
          sig,
        },
        200,
      );
    }
    logEvent('qa.failed', { reason: 'unverified', status: 502 });
    return FAILED();
  };
}
