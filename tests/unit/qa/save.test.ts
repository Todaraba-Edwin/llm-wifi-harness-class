import { describe, expect, it, vi } from 'vitest';
import { getEnv, githubWriteback } from '@/lib/env.server';
import { createSaveHandler, type SaveDeps } from '@/lib/qa/save-handler';
import { signAnswer } from '@/lib/qa/sign';
import type { ValidatedAnswer, ValidationResult } from '@/lib/qa/validate';
import { fakeGithub, type Fake, type FakeOptions } from '../github/fake';

const BASE = 'https://wiki.example.test';
const SECRET = 'save-secret-0123456789abcdef0123456789';
const NOW = Date.parse('2026-11-05T12:00:00+09:00');
const ENV = {
  AUTH_SECRET: SECRET,
  AUTH_GITHUB_ID: 'id',
  AUTH_GITHUB_SECRET: 'sec',
  OWNER_GITHUB_ID: '12345',
  OPENAI_API_KEY: 'dummy-key',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN: 'dummy-token',
  BETTER_AUTH_URL: BASE,
  GITHUB_REPO: 'owner/wiki',
  GH_WRITEBACK_TOKEN: 'dummy-writeback-token',
};
const ANSWER: ValidatedAnswer = {
  answerable: true,
  title_en: 'Harness',
  title_ko: '하네스',
  summary: '요약',
  sentences: [{ text: '하네스는 중요합니다.', cites: [{ slug: 'alpha', quote: 'harness matters' }] }],
  notCovered: [],
};
const QUESTION = 'SECRET-QUESTION 하네스란?';

function signed(over: { question?: string; answer?: ValidatedAnswer; iat?: number } = {}) {
  const p = { question: over.question ?? QUESTION, answer: over.answer ?? ANSWER, iat: over.iat ?? NOW - 1000 };
  return { ...p, sig: signAnswer(p, SECRET) };
}

interface Opts {
  env?: Record<string, string>;
  owner?: 'ok' | 'unauth' | 'forbidden';
  validation?: ValidationResult;
  github?: FakeOptions;
}

function setup(o: Opts = {}) {
  const env = { ...ENV, ...(o.env ?? {}) };
  const fake: Fake = fakeGithub(o.github);
  const tokens: string[] = [];
  const requireOwner = vi.fn(async () => {
    if (o.owner === 'unauth') return { ok: false as const, response: Response.json({ code: 'UNAUTHORIZED' }, { status: 401 }) };
    if (o.owner === 'forbidden') return { ok: false as const, response: Response.json({ code: 'FORBIDDEN' }, { status: 403 }) };
    return { ok: true as const, ownerId: '12345' };
  });
  const github = vi.fn((token: string) => (tokens.push(token), fake.api));
  const validateAnswer = vi.fn((raw: unknown): ValidationResult => o.validation ?? { ok: true, answer: raw as ValidatedAnswer });
  const deps: SaveDeps = {
    getEnv: () => getEnv(env),
    baseUrl: () => env.BETTER_AUTH_URL ?? null,
    requireOwner,
    validateAnswer,
    github,
    sourcesOf: () => ['raw/blogs/a.md'],
    now: () => NOW,
  };
  return { handler: createSaveHandler(deps), fake, requireOwner, github, validateAnswer, tokens };
}

function post(body: unknown, headers: Record<string, string> = {}, raw?: string): Request {
  return new Request(`${BASE}/api/qa/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE, ...headers },
    body: raw ?? JSON.stringify(body),
  });
}

describe('githubWriteback accessor / env', () => {
  it('needs both the token and a valid owner/name repo; a blank token is unset and never invalidates the Q&A config', () => {
    const qa: Record<string, string> = { ...ENV };
    delete qa.GH_WRITEBACK_TOKEN;
    delete qa.GITHUB_REPO;
    expect(getEnv(qa)).not.toBeNull();
    expect(githubWriteback(getEnv(qa)!)).toBeNull();
    expect(githubWriteback(getEnv({ ...qa, GH_WRITEBACK_TOKEN: '  ', GITHUB_REPO: 'o/r' })!)).toBeNull();
    expect(githubWriteback(getEnv({ ...qa, GH_WRITEBACK_TOKEN: 't' })!)).toBeNull();
    expect(githubWriteback(getEnv({ ...qa, GH_WRITEBACK_TOKEN: 't', GITHUB_REPO: 'not-a-repo' })!)).toBeNull();
    expect(githubWriteback(getEnv({ ...qa, GH_WRITEBACK_TOKEN: 't', GITHUB_REPO: 'o/r' })!)).toEqual({ token: 't', repo: 'o/r' });
  });
});

describe('POST /api/qa/save', () => {
  it('503 SAVE_UNAVAILABLE without the token / repo / Q&A config, before the owner check', async () => {
    for (const env of [{ GH_WRITEBACK_TOKEN: '' }, { GITHUB_REPO: '' }, { OPENAI_API_KEY: '' }] as Record<string, string>[]) {
      const s = setup({ env });
      const res = await s.handler(post(signed()));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'SAVE_UNAVAILABLE' });
      expect(s.requireOwner).not.toHaveBeenCalled();
      expect(s.github).not.toHaveBeenCalled();
    }
  });

  it('rejects non-POST, a mismatching Origin and non-JSON content before anything else', async () => {
    const s = setup();
    expect((await s.handler(new Request(`${BASE}/api/qa/save`, { method: 'GET' }))).status).toBe(405);
    expect((await s.handler(post(signed(), { origin: 'https://evil.example.test' }))).status).toBe(403);
    expect((await s.handler(post(signed(), { 'content-type': 'text/plain' }))).status).toBe(415);
    expect(s.requireOwner).not.toHaveBeenCalled();
  });

  it.each([
    ['unauth', 401],
    ['forbidden', 403],
  ] as const)('%s owner is answered %i before the body is parsed', async (owner, status) => {
    const s = setup({ owner });
    const res = await s.handler(post(null, {}, '{not json'));
    expect(res.status).toBe(status);
    expect(s.github).not.toHaveBeenCalled();
    expect(s.validateAnswer).not.toHaveBeenCalled();
  });

  it('400 for a malformed body', async () => {
    const s = setup();
    expect((await s.handler(post(null, {}, '{nope'))).status).toBe(400);
    expect((await s.handler(post({ question: 'q' }))).status).toBe(400);
    expect((await s.handler(post({ ...signed(), iat: 'x' }))).status).toBe(400);
    expect(s.github).not.toHaveBeenCalled();
  });

  it.each<[string, (b: ReturnType<typeof signed>) => unknown]>([
    ['tampered answer', (b) => ({ ...b, answer: { ...b.answer, title_en: 'Evil' } })],
    ['tampered question', (b) => ({ ...b, question: 'another' })],
    ['tampered iat', (b) => ({ ...b, iat: b.iat + 1 })],
    ['wrong signature', (b) => ({ ...b, sig: 'f'.repeat(64) })],
    ['expired (older than 7 days)', () => signed({ iat: NOW - 7 * 86_400_000 - 1 })],
    ['issued in the future', () => signed({ iat: NOW + 10 * 60_000 })],
  ])('403 BAD_SIGNATURE for %s; no GitHub, no validator', async (_n, mutate) => {
    const s = setup();
    const res = await s.handler(post(mutate(signed())));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'BAD_SIGNATURE' });
    expect(s.validateAnswer).not.toHaveBeenCalled();
    expect(s.github).not.toHaveBeenCalled();
  });

  it('422 INVALID_ANSWER when the validator rejects a correctly signed answer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup({ validation: { ok: false, reason: 'quote_not_found' } });
    const res = await s.handler(post(signed()));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'INVALID_ANSWER' });
    expect(s.github).not.toHaveBeenCalled();
  });

  it.each([
    [{ slug: 'Bad Slug' }, 'BAD_SLUG'],
    [{ slug: 'a--b' }, 'BAD_SLUG'],
    [{ slug: '-a' }, 'BAD_SLUG'],
    [{ slug: 'x'.repeat(81) }, 'BAD_SLUG'],
    [{ summary: 'two\nlines' }, 'BAD_SUMMARY'],
    [{ summary: 'has [[link' }, 'BAD_SUMMARY'],
    [{ summary: 'x'.repeat(121) }, 'BAD_SUMMARY'],
  ])('422 for %j', async (extra, code) => {
    const s = setup();
    const res = await s.handler(post({ ...signed(), ...extra }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: code });
    expect(s.github).not.toHaveBeenCalled();
  });

  it('200 {url, number}: default slug (KST) and default summary; uses the write-back token; only qa/ refs', async () => {
    const s = setup();
    const res = await s.handler(post(signed({ question: '가'.repeat(100) })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://github.test/o/r/pull/7', number: 7 });
    expect(s.tokens).toEqual(['dummy-writeback-token']);
    expect(s.fake.refs).toEqual(['refs/heads/qa/qa-20261105-1200-202611051200']);
    const tree = s.fake.trees[0].tree as { path: string; sha: string }[];
    const indexText = s.fake.blobs.get(tree.find((t) => t.path === 'wiki/index.md')!.sha)!;
    expect(indexText).toContain(`- [[qa-20261105-1200]]: ${'가'.repeat(80)}…\n`);
  });

  it('uses the owner-edited slug and summary', async () => {
    const s = setup();
    const res = await s.handler(post({ ...signed(), slug: ' my-answer ', summary: ' 내 요약 ' }));
    expect(res.status).toBe(200);
    expect(s.fake.refs).toEqual(['refs/heads/qa/my-answer-202611051200']);
    const tree = s.fake.trees[0].tree as { path: string; sha: string }[];
    expect(s.fake.blobs.get(tree.find((t) => t.path === 'wiki/index.md')!.sha)).toContain('- [[my-answer]]: 내 요약\n');
  });

  it.each([
    [{ openPrHeads: ['qa/x'] }, 409, 'QA_PR_OPEN'],
    [{ failRef: 422 }, 409, 'BRANCH_EXISTS'],
    [{ failPr: true }, 502, 'PR_FAILED'],
  ] as [FakeOptions, number, string][])('maps %j to %i %s', async (github, status, code) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup({ github });
    const res = await s.handler(post(signed()));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
  });

  it('409 SLUG_EXISTS for an existing page', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup();
    const res = await s.handler(post({ ...signed(), slug: 'alpha' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'SLUG_EXISTS' });
  });

  it('logs and responds without token, question or answer text', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warn.mockClear();
    const ok = setup();
    const bodies = [await (await ok.handler(post(signed()))).text()];
    const fail = setup({ github: { failPr: true } });
    bodies.push(await (await fail.handler(post(signed()))).text());
    bodies.push(await (await setup({ validation: { ok: false, reason: 'schema' } }).handler(post(signed()))).text());
    const seen = JSON.stringify([...warn.mock.calls, ...bodies]);
    expect(warn).toHaveBeenCalled();
    for (const secret of ['dummy-writeback-token', 'SECRET-QUESTION', '하네스는 중요합니다', SECRET]) expect(seen).not.toContain(secret);
  });
});
