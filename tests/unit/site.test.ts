import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import config, { projectRoot } from '../../next.config';
import { runSelftest, scanTree, formatFinding } from '../../scripts/verify-build';
import { buildSentinels } from '../../scripts/lib/shingles';
import { REPO, tmpDir, write } from './helpers';

describe('next config', () => {
  it('pins outputFileTracingRoot to the repository root', () => {
    expect(path.resolve(config.outputFileTracingRoot!)).toBe(REPO);
    expect(projectRoot).toBe(REPO);
  });
  it('excludes non-site directories from tracing', () => {
    const ex = config.outputFileTracingExcludes!['*'];
    for (const g of ['raw/**', 'docs/**', 'artifacts/**', '.gjc/**', '.gjc-env/**', 'AGENTS.md']) expect(ex).toContain(g);
  });
  it('sends X-Robots-Tag noindex and defines no robots route', async () => {
    const h = await config.headers!();
    expect(h[0].headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    for (const f of ['robots.ts', 'robots.txt', 'robots.js']) {
      expect(fs.existsSync(path.join(REPO, 'src/app', f))).toBe(false);
      expect(fs.existsSync(path.join(REPO, 'public', f))).toBe(false);
    }
  });
  it('layout declares noindex metadata', () => {
    expect(fs.readFileSync(path.join(REPO, 'src/app/layout.tsx'), 'utf8')).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });
});

describe('Scanner v2', () => {
  it('self-test: every fixture behaves as specified', () => {
    const r = runSelftest();
    expect(r.lines.filter((l) => l.startsWith('BAD'))).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.lines.length).toBeGreaterThanOrEqual(25);
  });
  it('failure reports never contain sentinel text or secret values', () => {
    const root = tmpDir();
    const sentence = 'Zebra quantum harness protocol governs every unusual asynchronous negotiation between distributed observers';
    write(root, 'raw/blogs/a.md', `---\nsource: https://e.test/a\ntitle: t\nfetched: 2026-11-05\n---\n\n${sentence}\n`);
    write(root, 'wiki/index.md', '# Index\n');
    write(root, '.next/server/app/p.html', `<p>${sentence}</p>`);
    write(root, '.next/static/chunks/k.js', 'var k="LiteralSecretValue123456"');
    const { findings } = scanTree(root, buildSentinels(root), { env: { AUTH_SECRET: 'LiteralSecretValue123456' }, projectRoot: root });
    expect(findings.length).toBeGreaterThanOrEqual(2);
    const report = findings.map(formatFinding).join('\n');
    expect(report).not.toMatch(/Zebra|quantum|LiteralSecretValue/i);
  });
});

describe('lazy env', () => {
  it('importing the module does not read or validate the environment', async () => {
    vi.resetModules();
    const saved = { ...process.env };
    for (const k of Object.keys(process.env)) if (/^(AUTH_|OWNER_|OPENAI_|QA_|UPSTASH_|GH_|GITHUB_)/.test(k)) delete process.env[k];
    const mod = await import('@/lib/env.server');
    expect(mod.getEnv({})).toBeNull();
    expect(mod.isQaConfigured({})).toBe(false);
    Object.assign(process.env, saved);
  });
  it('requires a numeric owner id, applies the default cap, and memoizes per snapshot', async () => {
    const { getEnv } = await import('@/lib/env.server');
    const base = { AUTH_SECRET: 's'.repeat(32), AUTH_GITHUB_ID: 'id', AUTH_GITHUB_SECRET: 'sec', OWNER_GITHUB_ID: '12345', OPENAI_API_KEY: 'dummy-key', OPENAI_MODEL: 'dummy-model', UPSTASH_REDIS_REST_URL: 'https://redis.example.test', UPSTASH_REDIS_REST_TOKEN: 'dummy-token' };
    expect(getEnv({ ...base })?.cap).toBe(50);
    expect(getEnv({ ...base, QA_DAILY_CAP: '2' })?.cap).toBe(2);
    expect(getEnv({ ...base, OWNER_GITHUB_ID: 'octocat' })).toBeNull();
    expect(getEnv({ ...base, OWNER_GITHUB_ID: '' })).toBeNull();
    const a = getEnv({ ...base });
    expect(getEnv({ ...base })).toBe(a);
  });
});

describe('baseline', () => {
  it('baseline lists exactly the 39 pages on disk', () => {
    const b = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/baseline.json'), 'utf8')) as { slugs: string[] };
    const m = JSON.parse(fs.readFileSync(path.join(REPO, 'src/generated/manifest.json'), 'utf8')) as { slugs: string[] };
    expect(b.slugs).toHaveLength(39);
    expect([...b.slugs].sort()).toEqual([...m.slugs].sort());
  });
});
