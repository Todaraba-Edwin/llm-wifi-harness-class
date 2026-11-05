import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/qa/prompt', () => ({
  NOT_COVERED_TEXT: '위키에 없음',
  buildMessages: (q: string) => ({ instructions: 'rules', input: `context\n${q}` }),
}));

import { askOpenAI } from '@/lib/qa/openai';
import { ATTEMPT_DEADLINE_MS } from '@/lib/qa/budget';

const KEY = 'sk-test-SUPER-SECRET-KEY-123';
const ENV = {
  AUTH_SECRET: 's'.repeat(32),
  AUTH_GITHUB_ID: 'id',
  AUTH_GITHUB_SECRET: 'sec',
  OWNER_GITHUB_ID: '12345',
  OPENAI_API_KEY: KEY,
  OPENAI_MODEL: 'test-model',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN: 'dummy-token',
};
const ANSWER = { answerable: false, title_en: 'T', title_ko: '제목', summary: 's', sentences: [], notCovered: [] };

function responsesBody(text: string) {
  return {
    id: 'resp_1',
    object: 'response',
    created_at: 1,
    status: 'completed',
    model: 'test-model',
    output: [{ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }],
    parallel_tool_calls: false,
    tool_choice: 'auto',
    tools: [],
  };
}

interface Seen {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
  signal: AbortSignal | null | undefined;
}

function fakeFetch(reply: (n: number) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? '{}')),
      signal: init?.signal,
    });
    return reply(seen.length);
  }) as typeof fetch;
  return { fn, seen };
}

beforeEach(() => {
  Object.assign(process.env, ENV);
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
});

describe('askOpenAI (real SDK, fake fetch)', () => {
  it('sends one strict json_schema Responses request and returns the parsed JSON', async () => {
    const { fn, seen } = fakeFetch(() => Response.json(responsesBody(JSON.stringify(ANSWER))));
    expect(await askOpenAI({ question: 'Q?', deadlineMs: 5000, fetch: fn })).toEqual(ANSWER);
    expect(seen).toHaveLength(1);
    const { url, body, headers } = seen[0];
    expect(url).toContain('/responses');
    expect(body).toMatchObject({ model: 'test-model', store: false, instructions: 'rules', input: 'context\nQ?' });
    expect(typeof body.max_output_tokens).toBe('number');
    expect(body.text).toMatchObject({ format: { type: 'json_schema', name: 'wiki_answer', strict: true } });
    expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
  });

  it('never retries on 429 (maxRetries is 0) and throws a fixed error without the key', async () => {
    const { fn, seen } = fakeFetch(() => Response.json({ error: { message: `bad key ${KEY}` } }, { status: 429, headers: { 'retry-after': '0' } }));
    const err = await askOpenAI({ question: 'Q?', deadlineMs: 5000, fetch: fn }).catch((e: Error) => e);
    expect(seen).toHaveLength(1);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('openai_failed');
    expect(JSON.stringify(err) + String((err as Error).stack) + (err as Error).message).not.toContain(KEY);
  });

  it('never retries on 500', async () => {
    const { fn, seen } = fakeFetch(() => new Response('oops', { status: 500 }));
    await expect(askOpenAI({ question: 'Q?', deadlineMs: 5000, fetch: fn })).rejects.toThrow('openai_failed');
    expect(seen).toHaveLength(1);
  });

  it('fails on unparseable output text', async () => {
    const { fn } = fakeFetch(() => Response.json(responsesBody('not json')));
    await expect(askOpenAI({ question: 'Q?', deadlineMs: 5000, fetch: fn })).rejects.toThrow('openai_failed');
  });

  it('aborts a request that never resolves at the per-call deadline, well before the SDK timeout', async () => {
    const { fn, seen } = fakeFetch(() => new Promise<Response>(() => {}));
    // The SDK passes its own controller signal; make the fake honor it.
    const hanging = ((input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        void fn(input, init);
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    const t0 = Date.now();
    await expect(askOpenAI({ question: 'Q?', deadlineMs: 50, fetch: hanging })).rejects.toThrow('openai_failed');
    expect(Date.now() - t0).toBeLessThan(ATTEMPT_DEADLINE_MS / 4);
    expect(seen).toHaveLength(1);
    expect(seen[0].signal).toBeTruthy();
  });

  it('fails closed without configuration and without a network call', async () => {
    delete process.env.OPENAI_API_KEY;
    const { fn, seen } = fakeFetch(() => Response.json(responsesBody(JSON.stringify(ANSWER))));
    await expect(askOpenAI({ question: 'Q?', deadlineMs: 5000, fetch: fn })).rejects.toThrow('openai_failed');
    expect(seen).toHaveLength(0);
  });
});
