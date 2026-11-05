// Secret variable names (from .env.example: names ending in KEY, SECRET or TOKEN) may appear as literals in src/ and
// public/ only inside an explicit allowlist of reader modules. Prints file names only.
import fs from 'node:fs';
import path from 'node:path';

const ALLOWLIST = new Set(['src/lib/env.server.ts', 'src/lib/qa/openai.ts']);
const SCAN_DIRS = ['src', 'public'];

export function secretNames(root: string): string[] {
  const file = path.join(root, '.env.example');
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1])
    .filter((n): n is string => Boolean(n) && /(KEY|SECRET|TOKEN)$/.test(n as string));
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
}

export function findViolations(root: string, names: string[]): string[] {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(path.join(root, d), files);
  const bad: string[] = [];
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    if (ALLOWLIST.has(rel)) continue;
    const text = fs.readFileSync(f, 'utf8');
    if (names.some((n) => text.includes(n))) bad.push(rel);
  }
  return bad.sort();
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const root = process.cwd();
  const names = secretNames(root);
  const bad = findViolations(root, names);
  for (const f of bad) console.error(`secret name outside allowlist: ${f}`);
  console.log(`lint-secret-names: ${names.length} names, ${bad.length} violation(s)`);
  process.exit(bad.length ? 1 : 0);
}
