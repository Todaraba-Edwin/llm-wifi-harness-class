import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertPortFree,
  childEnv,
  copyRepo,
  envExampleNames,
  findForbidden,
  isExcluded,
  nextResolvesInside,
  pickFreePort,
} from '../../scripts/clean-gate';
import { tmpDir, write } from './helpers';

const SENTINEL = 'CLEAN-GATE-SENTINEL';

function fakeRepo(): string {
  const root = tmpDir('cg-src-');
  write(root, 'package.json', '{}');
  write(root, 'src/app/page.tsx', 'export default 1;');
  write(root, 'src/generated/manifest.json', '{}');
  write(root, '.env', SENTINEL);
  write(root, '.env.local', SENTINEL);
  write(root, '.env.production', SENTINEL);
  write(root, '.env.example', 'AUTH_SECRET=\nQA_DAILY_CAP=\nOPENAI_API_KEY=\n');
  write(root, 'a/b/.env.local', SENTINEL);
  write(root, '.vercel/project.json', SENTINEL);
  write(root, 'k.pem', SENTINEL);
  write(root, 'sub/.npmrc', SENTINEL);
  write(root, '.git/config', SENTINEL);
  write(root, '.gjc/state.json', SENTINEL);
  write(root, '.next/BUILD_ID', 'x');
  write(root, 'coverage/lcov.info', 'x');
  write(root, 'out/index.html', 'x');
  // Package-shipped files inside node_modules are left alone, except .env*.
  write(root, 'node_modules/.pnpm/next@1/node_modules/next/package.json', '{}');
  write(root, 'node_modules/.pnpm/next@1/node_modules/next/server.pem', 'package-shipped');
  write(root, 'node_modules/.pnpm/next@1/node_modules/next/out/keep.txt', 'package-shipped');
  write(root, 'node_modules/.pnpm/next@1/node_modules/next/.env.sample', SENTINEL);
  fs.symlinkSync('.pnpm/next@1/node_modules/next', path.join(root, 'node_modules/next'));
  return root;
}

describe('clean-gate copy', () => {
  it('does not copy .env*, nested .env*, .vercel, .pem, .npmrc, .git, .gjc, build output, or src/generated', () => {
    const src = fakeRepo();
    const dest = path.join(tmpDir('cg-dst-'), 'copy');
    copyRepo(src, dest);
    for (const rel of ['.env', '.env.local', '.env.production', '.env.example', 'a/b/.env.local', '.vercel', 'k.pem', 'sub/.npmrc', '.git', '.gjc', '.next', 'coverage', 'out', 'src/generated']) {
      if (rel === '.env.example') continue;
      expect(fs.existsSync(path.join(dest, rel)), rel).toBe(false);
    }
    // .env.example holds names only and is a real input of the gates (dummy secret names).
    expect(fs.existsSync(path.join(dest, '.env.example'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'src/app/page.tsx'))).toBe(true);
    expect(findForbidden(dest)).toEqual([]);
  });

  it('keeps package-shipped files in node_modules except .env*', () => {
    const src = fakeRepo();
    const dest = path.join(tmpDir('cg-dst-'), 'copy');
    copyRepo(src, dest);
    const pkg = 'node_modules/.pnpm/next@1/node_modules/next';
    expect(fs.existsSync(path.join(dest, pkg, 'server.pem'))).toBe(true);
    expect(fs.existsSync(path.join(dest, pkg, 'out/keep.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dest, pkg, '.env.sample'))).toBe(false);
  });

  it('walk-after-copy catches a leftover sentinel file (negative control)', () => {
    const src = fakeRepo();
    const dest = path.join(tmpDir('cg-dst-'), 'copy');
    copyRepo(src, dest);
    write(dest, 'deep/er/.env.local', SENTINEL);
    write(dest, 'x/k.pem', SENTINEL);
    write(dest, 'node_modules/pkg/.env', SENTINEL);
    const found = findForbidden(dest).sort();
    expect(found).toEqual(['deep/er/.env.local', 'node_modules/pkg/.env', 'x/k.pem']);
  });

  it('never prints sentinel contents when reporting', () => {
    const src = fakeRepo();
    const dest = path.join(tmpDir('cg-dst-'), 'copy');
    copyRepo(src, dest);
    write(dest, '.env', SENTINEL);
    expect(JSON.stringify(findForbidden(dest))).not.toContain(SENTINEL);
  });

  it('keeps relative pnpm symlinks pointing inside the copy', () => {
    const src = fakeRepo();
    const dest = path.join(tmpDir('cg-dst-'), 'copy');
    copyRepo(src, dest);
    expect(fs.readlinkSync(path.join(dest, 'node_modules/next'))).toBe('.pnpm/next@1/node_modules/next');
    expect(nextResolvesInside(dest)).toBe(true);
  });

  it('detects a next link that resolves outside the copy', () => {
    const outside = tmpDir('cg-out-');
    write(outside, 'next/package.json', '{}');
    const dest = tmpDir('cg-bad-');
    fs.mkdirSync(path.join(dest, 'node_modules'), { recursive: true });
    fs.symlinkSync(path.join(outside, 'next'), path.join(dest, 'node_modules/next'));
    expect(nextResolvesInside(dest)).toBe(false);
  });
});

describe('isExcluded', () => {
  it.each([
    ['.env', true],
    ['x/y/.env.production.local', true],
    ['node_modules/p/.env', true],
    ['node_modules/p/server.pem', false],
    ['node_modules/p/out/a.js', false],
    ['docs/server.pem', true],
    ['src/generated', true],
    ['src/generated/manifest.json', false],
    ['src/app/page.tsx', false],
  ])('%s -> %s', (rel, expected) => {
    // `src/generated/manifest.json` is excluded through its parent directory entry during the copy.
    expect(isExcluded(rel)).toBe(expected);
  });
});

describe('childEnv', () => {
  it('contains exactly the documented keys', () => {
    expect(Object.keys(childEnv({ port: 4123 })).sort()).toEqual(['CI', 'E2E_PORT', 'HOME', 'NEXT_TELEMETRY_DISABLED', 'PATH']);
    expect(childEnv({ port: 4123 }).E2E_PORT).toBe('4123');
    expect(childEnv({ port: 4123 }).CI).toBe('1');
  });

  it('adds one dummy value per secret name, skips QA_DAILY_CAP, and never copies parent values', () => {
    process.env.SOME_PARENT_ONLY_VALUE = 'parent-value';
    const env = childEnv({ port: 1, dummySecrets: { names: ['AUTH_SECRET', 'OPENAI_API_KEY', 'QA_DAILY_CAP'] } });
    expect(env.AUTH_SECRET).toBe('dummy-AUTH_SECRET-not-a-secret');
    expect(env.OPENAI_API_KEY).toBe('dummy-OPENAI_API_KEY-not-a-secret');
    expect('QA_DAILY_CAP' in env).toBe(false);
    expect('SOME_PARENT_ONLY_VALUE' in env).toBe(false);
    delete process.env.SOME_PARENT_ONLY_VALUE;
  });

  it('derives names from .env.example', () => {
    const root = fakeRepo();
    expect(envExampleNames(root)).toEqual(['AUTH_SECRET', 'QA_DAILY_CAP', 'OPENAI_API_KEY']);
  });
});

describe('port isolation', () => {
  it('picks a free port and fails when the port is occupied', async () => {
    const port = await pickFreePort();
    await expect(assertPortFree(port)).resolves.toBeUndefined();
    const srv = net.createServer();
    await new Promise<void>((r) => srv.listen(port, '127.0.0.1', r));
    try {
      await expect(assertPortFree(port)).rejects.toThrow(/already in use/);
    } finally {
      await new Promise<void>((r) => srv.close(() => r()));
    }
  });
});
