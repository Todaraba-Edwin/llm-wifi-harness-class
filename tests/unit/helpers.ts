import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REPO = path.resolve(import.meta.dirname, '../..');

export function tmpDir(prefix = 'wikitest-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function write(root: string, rel: string, text: string): void {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
}

export const RAW_A = 'raw/blogs/a.md';

export function page(title: string, body: string, opts: { type?: string; sources?: string[] } = {}): string {
  const sources = (opts.sources ?? [RAW_A]).join(', ');
  return `---\ntitle: ${JSON.stringify(title)}\ntype: ${opts.type ?? 'concept'}\ntags: [t]\nsources: [${sources}]\nupdated: 2026-11-05\n---\n\n# ${title}\n\n${body}\n`;
}

/** Minimal valid wiki: two concept pages linking each other, both in the index. */
export function baseWiki(root: string): void {
  write(root, RAW_A, '---\nsource: https://example.com/a\ntitle: "Raw A"\nfetched: 2026-11-05\n---\n\nBODY-NEVER-READ\n');
  write(root, 'wiki/index.md', '# Index\n\n- [[alpha]]: a\n- [[beta]]: b\n');
  write(root, 'wiki/log.md', '# Log\n');
  write(root, 'wiki/concepts/alpha.md', page('Alpha', 'See [[beta]].'));
  write(root, 'wiki/concepts/beta.md', page('Beta', 'See [[alpha]].'));
}
