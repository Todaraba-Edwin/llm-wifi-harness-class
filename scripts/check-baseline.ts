// Asserts the page set against tests/baseline.json.
// --exact: the 39 baseline slugs are exactly the pages (fixed-39 gate before any write-back PR).
// default: baseline slugs are a subset of the pages and the page count equals the files on disk.
import fs from 'node:fs';
import path from 'node:path';
import { loadWiki } from '../src/lib/content/corpus';

const exact = process.argv.includes('--exact');
const root = process.cwd();
const baseline = (JSON.parse(fs.readFileSync(path.join(root, 'tests/baseline.json'), 'utf8')) as { slugs: string[] }).slugs;
const load = loadWiki(root);
const disk = load.pages.map((p) => p.slug);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/manifest.json'), 'utf8')) as { pageCount: number };

const problems: string[] = [];
const missing = baseline.filter((s) => !disk.includes(s));
if (missing.length) problems.push(`baseline pages missing on disk: ${missing.join(', ')}`);
if (manifest.pageCount !== disk.length) problems.push(`manifest.pageCount ${manifest.pageCount} != files on disk ${disk.length}`);
if (exact) {
  const extra = disk.filter((s) => !baseline.includes(s));
  if (extra.length) problems.push(`pages not in baseline: ${extra.join(', ')}`);
  if (disk.length !== 39 || baseline.length !== 39) problems.push(`expected exactly 39 pages (disk ${disk.length}, baseline ${baseline.length})`);
}
for (const p of problems) console.error(`check-baseline: ${p}`);
console.log(`check-baseline${exact ? ' --exact' : ''}: ${disk.length} pages, baseline ${baseline.length}, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
