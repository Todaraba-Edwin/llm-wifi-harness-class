import 'server-only';
import { z } from 'zod';
import { resolveBaseUrl } from '@/lib/auth/base-url';
import { requireOwner, type OwnerCheck } from '@/lib/auth/require-owner';
import { getEnv, type QaEnv } from '@/lib/env.server';
import { logEvent } from '@/lib/log';
import { reserveCap, type CapResult } from '@/lib/qa/cap';
import { QUESTION_MAX } from '@/lib/qa/schema';
import { askWeb, type WebAnswer } from '@/lib/qa/web';

const H = { 'Cache-Control': 'no-store' };
const json = (b: unknown, status: number) => Response.json(b, { status, headers: H });
const Body = z.object({ question: z.string().trim().min(1).max(QUESTION_MAX) });

export interface WebDeps {
  getEnv(): QaEnv | null;
  baseUrl(): string | null;
  requireOwner(req: Request): Promise<OwnerCheck>;
  reserveCap(): Promise<CapResult>;
  askWeb(args: { question: string; deadlineMs: number }): Promise<WebAnswer>;
}

export const defaultWebDeps: WebDeps = {
  getEnv: () => getEnv(),
  baseUrl: () => resolveBaseUrl(),
  requireOwner,
  reserveCap: () => reserveCap(),
  askWeb: (args) => askWeb(args),
};

/** Web-search fallback: same guard order as /api/qa (origin, content type, config, owner, body, cap), one billed call. */
export function createWebHandler(deps: WebDeps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const base = deps.baseUrl();
    const origin = req.headers.get('origin');
    if (origin !== null && base !== null && origin !== base) return json({ error: 'FORBIDDEN_ORIGIN' }, 403);
    if ((req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
    if (!deps.getEnv() || !base) return json({ error: 'QA_UNAVAILABLE' }, 503);
    const owner = await deps.requireOwner(req);
    if (!owner.ok) return owner.response;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'BAD_REQUEST', message: '질문을 1자 이상 1000자 이하로 입력하세요.' }, 400);
    let cap: CapResult;
    try {
      cap = await deps.reserveCap();
    } catch {
      return json({ error: 'QA_UNAVAILABLE' }, 503);
    }
    if (!cap.ok) {
      const exceeded = cap.reason === 'exceeded';
      logEvent('qa.cap_denied', { reason: cap.reason, status: exceeded ? 429 : 503 });
      return json(
        { error: exceeded ? 'CAP_EXCEEDED' : 'STORE_UNAVAILABLE', message: exceeded ? `오늘 질문 한도(${cap.cap}회)를 모두 사용했습니다. 한국 시간 자정 이후에 다시 시도해 주세요.` : 'Q&A 저장소에 연결할 수 없어 요청을 처리하지 않았습니다.' },
        exceeded ? 429 : 503,
      );
    }
    try {
      const a = await deps.askWeb({ question: parsed.data.question, deadlineMs: 120_000 });
      logEvent('qa.answered', { status: 200 });
      return json({ web: true, text: a.text, sources: a.sources }, 200);
    } catch (err) {
      const ps = (err as { providerStatus?: unknown }).providerStatus;
      return json({ error: 'WEB_FAILED', message: `웹 검색 답변을 가져오지 못했습니다${typeof ps === 'number' ? ` (HTTP ${ps})` : ''}.` }, 502);
    }
  };
}
