import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/qa/web', () => ({ askWeb: vi.fn() }));
vi.mock('@/lib/qa/cap', () => ({ reserveCap: vi.fn() }));
vi.mock('@/lib/env.server', () => ({ getEnv: vi.fn() }));
vi.mock('@/lib/auth/require-owner', () => ({ requireOwner: vi.fn() }));
vi.mock('@/lib/auth/base-url', () => ({ resolveBaseUrl: vi.fn() }));

import { createWebHandler, type WebDeps } from '@/lib/qa/web-handler';

const BASE = 'https://wiki.example.test';

function setup(over: Partial<WebDeps> = {}) {
  const deps = {
    getEnv: vi.fn(() => ({}) as never),
    baseUrl: vi.fn(() => BASE),
    requireOwner: vi.fn(async () => ({ ok: true as const, ownerId: '1' })),
    reserveCap: vi.fn(async () => ({ ok: true as const, count: 1, cap: 50 })),
    askWeb: vi.fn(async () => ({ text: 'ans', sources: [{ title: 't', url: 'https://x.test' }] })),
    ...over,
  } as WebDeps & Record<string, ReturnType<typeof vi.fn>>;
  return { deps, handle: createWebHandler(deps) };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${BASE}/api/qa/web`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE, ...headers }, body: JSON.stringify(body) });

describe('POST /api/qa/web', () => {
  it('answers with sources and reserves exactly one cap unit', async () => {
    const { deps, handle } = setup();
    const res = await handle(post({ question: 'q' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ web: true, text: 'ans' });
    expect(deps.reserveCap).toHaveBeenCalledTimes(1);
  });

  it('rejects a foreign origin and a non-JSON body before the owner check', async () => {
    const { deps, handle } = setup();
    expect((await handle(post({ question: 'q' }, { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await handle(post({ question: 'q' }, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect(deps.requireOwner).not.toHaveBeenCalled();
  });

  it('non-owner gets the owner response without parsing the body, reserving cap or calling the provider', async () => {
    const denied = Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    const { deps, handle } = setup({ requireOwner: vi.fn(async () => ({ ok: false as const, response: denied })) as never });
    const req = post({ question: 'q' });
    const json = vi.spyOn(req, 'json');
    expect((await handle(req)).status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(deps.reserveCap).not.toHaveBeenCalled();
    expect(deps.askWeb).not.toHaveBeenCalled();
  });

  it('503 when unconfigured; 400 on a bad body without spending cap', async () => {
    expect((await setup({ getEnv: vi.fn(() => null) as never }).handle(post({ question: 'q' }))).status).toBe(503);
    const { deps, handle } = setup();
    expect((await handle(post({ question: '   ' }))).status).toBe(400);
    expect(deps.reserveCap).not.toHaveBeenCalled();
  });

  it('429 over the cap and 503 when the store fails; the provider is never called', async () => {
    const over = setup({ reserveCap: vi.fn(async () => ({ ok: false as const, reason: 'exceeded', cap: 50 })) as never });
    expect((await over.handle(post({ question: 'q' }))).status).toBe(429);
    expect(over.deps.askWeb).not.toHaveBeenCalled();
    const down = setup({ reserveCap: vi.fn(async () => { throw new Error('x'); }) as never });
    expect((await down.handle(post({ question: 'q' }))).status).toBe(503);
  });

  it('502 carries only the numeric provider status, never provider or question text', async () => {
    const err = Object.assign(new Error('SECRET-PROVIDER-TEXT'), { providerStatus: 401 });
    const { handle } = setup({ askWeb: vi.fn(async () => { throw err; }) as never });
    const res = await handle(post({ question: 'SECRET-QUESTION' }));
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).toContain('HTTP 401');
    expect(text).not.toContain('SECRET');
  });
});
