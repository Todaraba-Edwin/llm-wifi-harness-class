// Scanner v2: proves that source bodies and secrets are absent from the build output.
// Failure reports never echo the matched text or any secret value.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { buildSentinels, isBinary, scanTokens, tokenStreams, walk, type Sentinels } from './lib/shingles';

export type Rule = 'sentinel' | 'trace' | 'secret' | 'secret-name' | 'config';
export interface Finding {
  rule: Rule;
  outputFile: string;
  decodedOffset?: number;
  rawSourceFile?: string;
  rawTokenIndex?: number;
  patternId?: string;
}

const SECRET_PATTERNS: { id: string; re: RegExp }[] = [
  { id: 'openai-key', re: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}/ },
  { id: 'github-pat', re: /github_pat_[A-Za-z0-9_]{20,}/ },
  { id: 'github-token', re: /gh[pousr]_[A-Za-z0-9]{30,}/ },
];
export const SECRET_ENV = ['AUTH_SECRET', 'AUTH_GITHUB_SECRET', 'OPENAI_API_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN', 'GH_WRITEBACK_TOKEN'];
const TRACE_FORBIDDEN = ['raw/', 'docs/', 'artifacts/', '.gjc/', '.gjc-env/'];

const scanExclude = (rel: string) => !(rel === 'cache/' || rel.startsWith('cache/'));

function toRel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}

export function scanTargets(root: string): string[] {
  const out = [
    ...walk(path.join(root, '.next'), scanExclude, path.join(root, '.next')),
    ...walk(path.join(root, 'public'), () => true),
    ...walk(path.join(root, '.vercel/output'), () => true),
  ];
  return out;
}

export interface ScanOptions {
  env?: Record<string, string | undefined>;
  /** Root against which `.nft.json` entries are checked (the pinned outputFileTracingRoot). */
  projectRoot?: string;
}

export function scanContent(file: string, rel: string, buf: Buffer, sentinels: Sentinels, opts: ScanOptions = {}): Finding[] {
  const findings: Finding[] = [];
  if (isBinary(file, buf)) return findings;
  const text = buf.toString('utf8');

  for (const tokens of tokenStreams(file, text)) {
    const hit = scanTokens(tokens, sentinels);
    if (hit) {
      findings.push({ rule: 'sentinel', outputFile: rel, ...hit });
      break;
    }
  }
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) findings.push({ rule: 'secret', outputFile: rel, patternId: p.id });
  for (const name of SECRET_ENV) {
    const v = opts.env?.[name];
    if (v && v.length >= 16 && text.includes(v)) findings.push({ rule: 'secret', outputFile: rel, patternId: `env:${name}` });
  }
  if (/(^|\/)(\.next\/static|public)\//.test(rel) || rel.startsWith('.next/static/') || rel.startsWith('public/')) {
    for (const name of SECRET_ENV) if (text.includes(name)) findings.push({ rule: 'secret-name', outputFile: rel, patternId: `name:${name}` });
  }
  return findings;
}

/** `.nft.json` entries resolve against the file's own directory. */
export function checkTrace(nftAbs: string, rel: string, projectRoot: string): Finding[] {
  const findings: Finding[] = [];
  let files: string[] = [];
  try {
    files = (JSON.parse(fs.readFileSync(nftAbs, 'utf8')) as { files?: string[] }).files ?? [];
  } catch {
    return [{ rule: 'trace', outputFile: rel, patternId: 'unparseable' }];
  }
  for (const entry of files) {
    const abs = path.resolve(path.dirname(nftAbs), entry);
    const r = path.relative(projectRoot, abs).split(path.sep).join('/');
    const inNodeModules = r.split('/').includes('node_modules');
    if (r.startsWith('..') && !inNodeModules) {
      findings.push({ rule: 'trace', outputFile: rel, patternId: 'outside-root' });
      continue;
    }
    if (inNodeModules) continue;
    const base = r.split('/').at(-1) ?? '';
    if (TRACE_FORBIDDEN.some((p) => r.startsWith(p)) || r === 'AGENTS.md' || /^\.env/.test(base)) {
      findings.push({ rule: 'trace', outputFile: rel, patternId: 'forbidden-path' });
    }
  }
  return findings;
}

export function scanTree(scanRoot: string, sentinels: Sentinels, opts: ScanOptions = {}): { findings: Finding[]; files: number } {
  const findings: Finding[] = [];
  const projectRoot = opts.projectRoot ?? scanRoot;
  const targets = scanTargets(scanRoot);
  for (const abs of targets) {
    const rel = toRel(scanRoot, abs);
    const buf = fs.readFileSync(abs);
    findings.push(...scanContent(abs, rel, buf, sentinels, opts));
    if (abs.endsWith('.nft.json') && rel.startsWith('.next/')) findings.push(...checkTrace(abs, rel, projectRoot));
  }
  return { findings, files: targets.length };
}

export function formatFinding(f: Finding): string {
  const parts = [`rule=${f.rule}`, `outputFile=${f.outputFile}`];
  if (f.decodedOffset !== undefined) parts.push(`decodedOffset=${f.decodedOffset}`);
  if (f.rawSourceFile) parts.push(`rawSourceFile=${f.rawSourceFile}`);
  if (f.rawTokenIndex !== undefined) parts.push(`rawTokenIndex=${f.rawTokenIndex}`);
  if (f.patternId) parts.push(`patternId=${f.patternId}`);
  return `FAIL ${parts.join(' ')}`;
}

/** Longest paragraph of the first source file with one, used by --mutate. */
function pickRawParagraph(root: string): string {
  const files = walk(path.join(root, 'raw'), (r) => r.endsWith('/') || r.endsWith('.md'));
  let best = '';
  for (const f of files) {
    for (const para of matter(fs.readFileSync(f, 'utf8')).content.split(/\n{2,}/)) {
      const t = para.replace(/\s+/g, ' ').trim();
      if (t.split(' ').length >= 14 && !t.startsWith('#') && t.length > best.length && t.length < 600) best = t;
    }
  }
  if (!best) throw new Error('no source paragraph available for --mutate');
  return best;
}

export async function pinnedRootOk(root: string): Promise<boolean> {
  const mod = (await import(pathToFileURL(path.join(root, 'next.config.ts')).href)) as { default: { outputFileTracingRoot?: string } };
  return !!mod.default.outputFileTracingRoot && path.resolve(mod.default.outputFileTracingRoot) === path.resolve(root);
}

function mutate(root: string, sentinels: Sentinels): number {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-mutate-'));
  try {
    fs.cpSync(path.join(root, '.next'), path.join(tmp, '.next'), {
      recursive: true,
      filter: (src) => !toRel(path.join(root, '.next'), src).startsWith('cache'),
    });
    const target = walk(path.join(tmp, '.next/server/app'), (r) => r.endsWith('/') || r.endsWith('.html'))[0];
    if (!target) {
      console.error('verify-build --mutate: no html page found in the copied build');
      return 1;
    }
    const words = pickRawParagraph(root).split(' ');
    const escaped = words
      .map((w, i) => (i % 3 === 2 ? `<em>${w}</em>` : w))
      .join(' ')
      .replace(/'/g, '&#x27;')
      .replace(/"/g, '&quot;');
    fs.appendFileSync(target, `<p>${escaped}</p>`);
    const { findings } = scanTree(tmp, sentinels, { env: process.env, projectRoot: root });
    const caught = findings.some((f) => f.rule === 'sentinel' && f.outputFile === toRel(tmp, target));
    console.log(`verify-build --mutate: injected escaped source paragraph into copied page -> ${caught ? 'detected (expected FAIL observed)' : 'NOT detected'}`);
    return caught ? 0 : 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------
// Self-test (git-free): synthetic fixture trees.
// ---------------------------------------------------------------------------------------

const SENT = 'Our platform engineers design reliable evaluation harnesses for long running autonomous agents across many production workloads';
const SENT_APOS = "Our platform engineers don't design brittle evaluation harnesses for \"long running\" autonomous agents across many production workloads";
const QUOTED = 'Context resets and compaction both reduce the pressure on a long running session but they trade away different kinds of state';
const XCORP = 'At X Corp the research platform team builds agent harnesses that evaluate long horizon reasoning with strict reproducible scoring';
const TITLE = 'A Very Long Source Title About Evaluating Autonomous Agent Harnesses In Production';

export interface SelfCase {
  name: string;
  expect: 'FAIL' | 'PASS';
  files: Record<string, string>;
  env?: Record<string, string>;
}

function fixtureBase(dir: string): void {
  const w = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w('raw/blogs/syn-a.md', `---\nsource: https://example.com/a\ntitle: "${TITLE}"\nfetched: 2026-11-05\n---\n\n# ${TITLE}\n\n${SENT}\n\n${SENT_APOS}\n\n${QUOTED}\n\n${XCORP}\n`);
  w('wiki/index.md', '# Index\n\n- [[concept-a]]: a\n');
  w('wiki/concept-a.md', `---\ntitle: "Concept A"\ntype: concept\ntags: []\nsources: [raw/blogs/syn-a.md]\nupdated: 2026-11-05\n---\n\n# Concept A\n\nThe source says: ${QUOTED}.\n\nAt [[org-x]] the research platform team builds agent harnesses that evaluate long horizon reasoning with strict reproducible scoring.\n`);
  w('src/generated/qa-plaintext.json', JSON.stringify({ 'concept-a': `Concept A The source says: ${QUOTED}. At X Corp the research platform team builds agent harnesses that evaluate long horizon reasoning with strict reproducible scoring.` }));
}

const nft = (files: string[]) => JSON.stringify({ version: 1, files });
const NFT_DIR = '.next/server/app/wiki/[slug]/page.js.nft.json';

export function selfCases(): SelfCase[] {
  const html = (s: string) => `<html><body>${s}</body></html>`;
  const jsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, '\\u2019');
  const push = (s: string) => `self.__next_f.push([1,"${s}"])`;
  const words = SENT.split(' ');
  const half = Math.floor(words.length / 2);
  const out = '.next/server/app/x.html';
  return [
    { name: 'plain sentinel', expect: 'FAIL', files: { [out]: html(`<p>${SENT}</p>`) } },
    { name: 'HTML-escaped entities', expect: 'FAIL', files: { [out]: html(`<p>${SENT_APOS.replace(/'/g, '&#x27;').replace(/"/g, '&quot;')}</p>`) } },
    { name: 'words separated by inline tags', expect: 'FAIL', files: { [out]: html(`<p>${words.map((w, i) => (i % 2 ? `<em>${w}</em>` : w)).join(' ')}</p>`) } },
    { name: 'JSON-escaped RSC push (unicode apostrophe, escaped quotes)', expect: 'FAIL', files: { '.next/server/app/x.rsc': push(jsEsc(SENT_APOS)) } },
    { name: 'double-escaped', expect: 'FAIL', files: { '.next/static/chunks/x.js': `var a="${jsEsc(jsEsc(SENT_APOS))}"` } },
    {
      name: 'split across two __next_f.push chunks',
      expect: 'FAIL',
      files: { [out]: html(`<script>${push(words.slice(0, half).join(' ') + ' ')}</script><script>${push(words.slice(half).join(' '))}</script>`) },
    },
    { name: 'minified JS between a<b and c>d', expect: 'FAIL', files: { '.next/static/chunks/m.js': `if(a<b){var s="${SENT}"}c>d` } },
    { name: 'minified JS pattern inside HTML', expect: 'FAIL', files: { [out]: html(`<script>if(a<b){var s="${SENT}"}c>d</script>`) } },
    { name: 'source title as link label', expect: 'PASS', files: { [out]: html(`<a href="https://example.com/a">${TITLE}</a>`) } },
    { name: 'wiki sentence quoting source', expect: 'PASS', files: { [out]: html(`<p>The source says: ${QUOTED}.</p>`) } },
    {
      name: 'rendered wikilink title also present in source (qa-plaintext allowlist)',
      expect: 'PASS',
      files: { [out]: html(`<p>At <a href="/wiki/org-x">X Corp</a> the research platform team builds agent harnesses that evaluate long horizon reasoning with strict reproducible scoring.</p>`) },
    },
    { name: 'trace: nested entry resolving into source dir', expect: 'FAIL', files: { [NFT_DIR]: nft(['../../../../../raw/x.md']) } },
    { name: 'trace: nested entry outside root', expect: 'FAIL', files: { [NFT_DIR]: nft(['../../../../../../outside/x.js']) } },
    { name: 'trace: nested node_modules docs path', expect: 'PASS', files: { [NFT_DIR]: nft(['../../../../../node_modules/foo/docs/x.js']) } },
    { name: 'trace: depth-0 nft with source entry', expect: 'FAIL', files: { '.next/x.nft.json': nft(['../raw/x.md']) } },
    { name: 'trace: nested-depth entry written into a depth-0 nft (base is the file dir)', expect: 'FAIL', files: { '.next/y.nft.json': nft(['../../../../../raw/x.md']) } },
    { name: 'trace: depth-0 entry written for nested depth is not misread (base is file dir)', expect: 'FAIL', files: { [NFT_DIR]: nft(['../../../../../raw/x.md', '../../../../chunks/x.js']) } },
    { name: 'trace: legit chunk inside .next', expect: 'PASS', files: { [NFT_DIR]: nft(['../../../../chunks/x.js']) } },
    { name: 'trace: .env file', expect: 'FAIL', files: { [NFT_DIR]: nft(['../../../../../.env.local']) } },
    { name: 'planted sk- key', expect: 'FAIL', files: { '.next/static/chunks/k.js': `var k="sk-${'a1B2c3D4e5'.repeat(3)}"` } },
    { name: 'planted literal secret value (>=16)', expect: 'FAIL', files: { '.next/static/chunks/k.js': 'var k="Zq9xLmN2pR7sT4vW8yB1"' }, env: { AUTH_SECRET: 'Zq9xLmN2pR7sT4vW8yB1' } },
    { name: 'short literal secret value (<16)', expect: 'PASS', files: { '.next/static/chunks/k.js': 'var k="short-secret1"' }, env: { AUTH_SECRET: 'short-secret1' } },
    { name: 'redacted-looking token (ta[REDACTED])', expect: 'PASS', files: { '.next/static/chunks/k.js': 'var k="ta[REDACTED]"' } },
    { name: 'secret env name in client bundle', expect: 'FAIL', files: { '.next/static/chunks/n.js': 'process.env.OPENAI_API_KEY' } },
    { name: 'secret env name in server output only', expect: 'PASS', files: { '.next/server/chunks/n.js': 'process.env.OPENAI_API_KEY' } },
  ];
}

export function runSelftest(): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  for (const c of selfCases()) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-selftest-'));
    try {
      fixtureBase(dir);
      for (const [rel, text] of Object.entries(c.files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
      }
      const sentinels = buildSentinels(dir);
      const { findings } = scanTree(dir, sentinels, { env: c.env, projectRoot: dir });
      const got = findings.length > 0 ? 'FAIL' : 'PASS';
      const good = got === c.expect;
      ok &&= good;
      lines.push(`${good ? 'ok  ' : 'BAD '} expect=${c.expect} got=${got}  ${c.name}`);
      // Reports must never echo matches or secret values.
      const report = findings.map(formatFinding).join('\n');
      const leaks = [SENT.slice(0, 40), 'Zq9xLmN2pR7sT4vW8yB1', 'a1B2c3D4e5'];
      if (leaks.some((l) => report.includes(l))) {
        ok = false;
        lines.push(`BAD  report echoes sensitive text in case: ${c.name}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  const sizes = buildSentinelsForSizeCheck();
  lines.push(`ok   sentinel construction deterministic across runs (${sizes} sentinels)`);
  return { ok, lines };
}

function buildSentinelsForSizeCheck(): number {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-selftest-'));
  try {
    fixtureBase(dir);
    const a = [...buildSentinels(dir).map.keys()].sort();
    const b = [...buildSentinels(dir).map.keys()].sort();
    if (a.join('\n') !== b.join('\n')) throw new Error('sentinel set is not deterministic');
    return a.length;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const root = process.cwd();
  if (args.includes('--selftest')) {
    const r = runSelftest();
    for (const l of r.lines) console.log(l);
    console.log(`verify-build selftest: ${r.ok ? 'PASS' : 'FAIL'}`);
    return r.ok ? 0 : 1;
  }
  if (!fs.existsSync(path.join(root, '.next'))) {
    console.error('verify-build: .next not found; run next build first');
    return 1;
  }
  const sentinels = buildSentinels(root);
  if (args.includes('--mutate')) return mutate(root, sentinels);

  const findings: Finding[] = [];
  if (!(await pinnedRootOk(root))) findings.push({ rule: 'config', outputFile: 'next.config.ts', patternId: 'outputFileTracingRoot-not-pinned' });
  const r = scanTree(root, sentinels, { env: process.env, projectRoot: root });
  findings.push(...r.findings);
  for (const f of findings) console.error(formatFinding(f));
  console.log(`verify-build: scanned ${r.files} files, ${sentinels.map.size} sentinels, ${findings.length} finding(s)`);
  return findings.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c));
}
