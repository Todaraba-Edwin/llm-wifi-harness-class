import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The pattern is written with a character class so this file does not match itself.
const RAW_REF = /r[a]w\/|['"`]r[a]w['"`]/;
const SRC_IMPORTS_SCRIPTS = /(?:from|import)\s*\(?\s*['"][^'"]*\bscripts\//;

export const ALLOWED = new Set([
  'src/lib/content/raw-frontmatter.ts',
  'next.config.ts',
  'eslint.config.mjs',
  'scripts/verify-build.ts',
  'scripts/lib/shingles.ts',
  'scripts/lint-wiki.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

export interface Violation {
  file: string;
  line: number;
  rule: 'raw-reference' | 'src-imports-scripts';
}

export function lintRawAccess(root: string): Violation[] {
  const files = [
    ...walk(path.join(root, 'src')),
    ...walk(path.join(root, 'scripts')),
    ...fs.readdirSync(root).filter((f) => /^[^.].*\.config\.(ts|mjs|js)$/.test(f)).map((f) => path.join(root, f)),
  ];
  const out: Violation[] = [];
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (rel.startsWith('src/generated/')) continue;
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!ALLOWED.has(rel) && RAW_REF.test(line)) out.push({ file: rel, line: i + 1, rule: 'raw-reference' });
      if (rel.startsWith('src/') && SRC_IMPORTS_SCRIPTS.test(line)) out.push({ file: rel, line: i + 1, rule: 'src-imports-scripts' });
    });
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const v = lintRawAccess(process.cwd());
  for (const x of v) console.error(`lint-raw-access: ${x.rule} ${x.file}:${x.line}`);
  console.log(`lint-raw-access: ${v.length} violation(s)`);
  process.exit(v.length ? 1 : 0);
}
