import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/qa/prompt', () => ({ NOT_COVERED_TEXT: '위키에 없음', buildMessages: () => ({ instructions: '', input: '' }) }));
vi.mock('@/lib/qa/validate', () => ({ validateAnswer: vi.fn(), loadCorpus: vi.fn() }));

import { createHandler, type Deps } from '@/lib/qa/handler';
import { reserveCap } from '@/lib/qa/cap';
import { MemoryCounterStore, type CounterStore } from '@/lib/qa/store';
import { getEnv } from '@/lib/env.server';
import { askOpenAI } from '@/lib/qa/openai';
import { verifyAnswerSignature } from '@/lib/qa/sign';
import type { ValidatedAnswer, ValidationResult } from '@/lib/qa/validate';

const BASE = 'https://wiki.example.test';
const SECRET = 'route-secret-0123456789abcdef0123456789';
const ENV = {
  AUTH_SECRET: SECRET,
  AUTH_GITHUB_ID: 'id',
  AUTH_GITHUB_SECRET: 'sec',
  OWNER_GITHUB_ID: '12345',
  OPENAI_API_KEY: 'dummy-key',
  OPENAI_MODEL: 'dummy-model',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN: 'dummy-token',
  BETTER_AUTH_URL: BASE,
};

const GOOD: ValidatedAnswer = {
  answerable: true,
  title_en: 'Harness',
  title_ko: '하네스',
  summary: '요약',
  sentences: [{ text: '하네스는 중요합니다.', cites: [{ slug: 'page-a', quote: 'harness matters' }] }],
  notCovered: ['세부 수치'],
};
const ok = (answer: ValidatedAnswer = GOOD): ValidationResult => ({ ok: true, answer });
const bad: ValidationResult = { ok: false, reason: 'quote_not_found' };

interface Opts {
  env?: Record<string, string>;
  owner?: 'ok' | 'unauth' | 'forbidden';
  store?: CounterStore;
  validations?: ValidationResult[];
  openai?: () => Promise<unknown>;
}

function setup(o: Opts = {}) {
  const env = { ...ENV, ...(o.env ?? {}) };
  const store = o.store ?? new MemoryCounterStore({});
  const openai = vi.fn(o.openai ?? (async () => ({ any: 'thing' })));
  const validations = [...(o.validations ?? [ok()])];
  const requireOwner = vi.fn(async () => {
    if (o.owner === 'unauth') return { ok: false as const, response: Response.json({ code: 'UNAUTHORIZED' }, { status: 401 }) };
    if (o.owner === 'forbidden') return { ok: false as const, response: Response.json({ code: 'FORBIDDEN' }, { status: 403 }) };
    return { ok: true as const, ownerId: '12345' };
  });
  const reserve = vi.fn(() => reserveCap(env, store, new Date('2026-11-05T12:00:00+09:00')));
  const deps: Deps = {
    getEnv: () => getEnv(env),
    baseUrl: () => (env.BETTER_AUTH_URL ?? null),
    requireOwner,
    reserveCap: reserve,
    askOpenAI: openai,
    validateAnswer: () => validations.shift() ?? bad,
    titleOf: (s) => `Title of ${s}`,
    now: () => Date.now(),
  };
  return { handler: createHandler(deps), openai, requireOwner, reserve, store };
}

function post(body: unknown, headers: Record<string, string> = {}, raw?: string): Request {
  return new Request(`${BASE}/api/qa`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE, ...headers },
    body: raw ?? JSON.stringify(body),
  });
}

describe('POST /api/qa', () => {
  it('503 QA_UNAVAILABLE when unconfigured, before the owner check and any call', async () => {
    const s = setup({ env: { OPENAI_API_KEY: '' } });
    const res = await s.handler(post({ question: 'q' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'QA_UNAVAILABLE' });
    expect(s.requireOwner).not.toHaveBeenCalled();
    expect(s.openai).not.toHaveBeenCalled();
  });

  it.each([
    ['unauth', 401],
    ['forbidden', 403],
  ] as const)('%s owner is answered %i before the body is parsed; no cap, no OpenAI', async (owner, status) => {
    const store = { reserve: vi.fn() } as unknown as CounterStore;
    const s = setup({ owner, store });
    const res = await s.handler(post(null, {}, '{not json'));
    expect(res.status).toBe(status);
    expect(s.openai).not.toHaveBeenCalled();
    expect(store.reserve).not.toHaveBeenCalled();
  });

  it('rejects non-POST, a mismatching Origin (403) and non-JSON content (415) first', async () => {
    const s = setup();
    expect((await s.handler(new Request(`${BASE}/api/qa`, { method: 'GET' }))).status).toBe(405);
    expect((await s.handler(post({ question: 'q' }, { origin: 'https://evil.example.test' }))).status).toBe(403);
    expect((await s.handler(post({ question: 'q' }, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect(s.requireOwner).not.toHaveBeenCalled();
    expect(s.openai).not.toHaveBeenCalled();
  });

  it('400 for an invalid question without spending cap', async () => {
    const s = setup();
    for (const q of ['', '   ', 'x'.repeat(1001)]) expect((await s.handler(post({ question: q }))).status).toBe(400);
    expect((await s.handler(post(null, {}, '{nope'))).status).toBe(400);
    expect(s.reserve).not.toHaveBeenCalled();
  });

  it('QA_DAILY_CAP=2 gives 200, 200, 429 and exactly two OpenAI calls (cap units == calls)', async () => {
    const s = setup({ env: { QA_DAILY_CAP: '2' }, validations: [ok(), ok(), ok()] });
    expect((await s.handler(post({ question: 'q' }))).status).toBe(200);
    expect((await s.handler(post({ question: 'q' }))).status).toBe(200);
    const res = await s.handler(post({ question: 'q' }));
    expect(res.status).toBe(429);
    expect((await res.json()).message).toBe('오늘 질문 한도(2회)를 모두 사용했습니다. 한국 시간 자정 이후에 다시 시도해 주세요.');
    expect(s.openai).toHaveBeenCalledTimes(2);
  });

  it('503 with zero OpenAI calls when the store fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store: CounterStore = { reserve: async () => { throw new Error('down'); } };
    const s = setup({ store });
    const res = await s.handler(post({ question: 'q' }));
    expect(res.status).toBe(503);
    expect((await res.json()).message).toBe('Q&A 저장소에 연결할 수 없어 요청을 처리하지 않았습니다.');
    expect(s.openai).not.toHaveBeenCalled();
  });

  it('retries once after a validation failure with a NEW cap reservation', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reserveSpy = vi.fn();
    const mem = new MemoryCounterStore({});
    const store: CounterStore = { reserve: (k, c) => (reserveSpy(), mem.reserve(k, c)) };
    const s = setup({ store, validations: [bad, ok()] });
    const res = await s.handler(post({ question: 'q' }));
    expect(res.status).toBe(200);
    expect(s.openai).toHaveBeenCalledTimes(2);
    expect(reserveSpy).toHaveBeenCalledTimes(2);
  });

  it('502 after two validation failures and never returns model text', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup({ validations: [bad, bad], openai: async () => ({ sentences: [{ text: 'LEAKED-UNVALIDATED' }] }) });
    const res = await s.handler(post({ question: 'q' }));
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ error: 'QA_FAILED', message: '근거를 검증하지 못했습니다' });
    expect(text).not.toContain('LEAKED');
    expect(s.openai).toHaveBeenCalledTimes(2);
  });

  it('502 on a provider failure without a retry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup({ openai: async () => { throw new Error('openai_failed'); } });
    expect((await s.handler(post({ question: 'q' }))).status).toBe(502);
    expect(s.openai).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the remaining budget is below the retry minimum', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup({ validations: [bad, ok()] });
    let t = 0;
    const deps: Deps = {
      getEnv: () => getEnv(ENV),
      baseUrl: () => BASE,
      requireOwner: async () => ({ ok: true, ownerId: '12345' }),
      reserveCap: s.reserve,
      askOpenAI: s.openai,
      validateAnswer: (() => { const v = [bad, ok()]; return () => v.shift()!; })(),
      titleOf: (x) => x,
      now: () => (t += 70_000),
    };
    const res = await createHandler(deps)(post({ question: 'q' }));
    expect(res.status).toBe(502);
    expect(s.openai).toHaveBeenCalledTimes(1);
  });

  it('returns a signed answer with titles, cites and server-rendered not-covered lines', async () => {
    const s = setup();
    const res = await s.handler(post({ question: '  q  ' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      answerable: true,
      title_en: 'Harness',
      title_ko: '하네스',
      summary: '요약',
      sentences: [{ text: '하네스는 중요합니다.', cites: [{ slug: 'page-a', title: 'Title of page-a', quote: 'harness matters' }] }],
      notCovered: ['위키에 없음: 세부 수치'],
    });
    expect(body.question).toBe('q');
    expect(body.answer).toEqual(GOOD);
    expect(verifyAnswerSignature({ question: body.question, answer: GOOD, iat: body.iat }, body.sig, SECRET, body.iat)).toBe(true);
    expect(verifyAnswerSignature({ question: 'other', answer: GOOD, iat: body.iat }, body.sig, SECRET, body.iat)).toBe(false);
  });

  it('answerable=false returns exactly the not-covered text', async () => {
    const none: ValidatedAnswer = { answerable: false, title_en: 'T', title_ko: '제목', summary: 's', sentences: [], notCovered: [] };
    const s = setup({ validations: [ok(none)] });
    const body = await (await s.handler(post({ question: 'q' }))).json();
    expect(body.sentences).toEqual([{ text: '위키에 없음', cites: [] }]);
    expect(body.notCovered).toEqual([]);
    expect(verifyAnswerSignature({ question: 'q', answer: none, iat: body.iat }, body.sig, SECRET, body.iat)).toBe(true);
  });

  it("cap 'unlimited' (development) skips the store and never needs the network", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const dev = await import('@/lib/qa/cap');
    const envMod = await import('@/lib/env.server');
    const store = { reserve: vi.fn() } as unknown as CounterStore;
    const env = { ...ENV, QA_DAILY_CAP: '0', NODE_ENV: 'development' };
    const r = await dev.reserveCap(env, store);
    expect(envMod.getEnv(env)?.cap).toBe('unlimited');
    vi.unstubAllEnvs();
    expect(r).toMatchObject({ ok: true, cap: 'unlimited' });
    expect(store.reserve).not.toHaveBeenCalled();
  });

  it('cap units equal real-SDK fetch calls (a failing provider is one call per reservation, no SDK retry)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.assign(process.env, ENV);
    try {
      const fetchCalls: string[] = [];
      const fake = (async (input: RequestInfo | URL) => {
        fetchCalls.push(String(input));
        return new Response('x', { status: 500 });
      }) as typeof fetch;
      const mem = new MemoryCounterStore({});
      const reserved: string[] = [];
      const store: CounterStore = { reserve: (k, c) => (reserved.push(k), mem.reserve(k, c)) };
      const deps: Deps = {
        getEnv: () => getEnv(ENV),
        baseUrl: () => BASE,
        requireOwner: async () => ({ ok: true, ownerId: '12345' }),
        reserveCap: () => reserveCap(ENV, store, new Date('2026-11-05T12:00:00+09:00')),
        askOpenAI: (a) => askOpenAI({ ...a, fetch: fake }),
        validateAnswer: () => bad,
        titleOf: (x) => x,
        now: () => Date.now(),
      };
      const res = await createHandler(deps)(post({ question: 'q' }));
      expect(res.status).toBe(502);
      expect(fetchCalls).toHaveLength(1);
      expect(reserved).toHaveLength(1);
    } finally {
      for (const k of Object.keys(ENV)) delete process.env[k];
    }
  });
});
