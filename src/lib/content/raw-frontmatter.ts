// The only module under src/ allowed to touch the immutable source directory.
// It reads up to the closing frontmatter delimiter and nothing else.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export const RAW_PATH_RE = /^raw\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.md$/;

export interface RawFrontmatter {
  path: string;
  source: string | null;
  title: string | null;
  fetched: string | null;
}

export interface FsLike {
  openSync(p: string, flags: string): number;
  readSync(fd: number, buf: Buffer, off: number, len: number, pos: number): number;
  closeSync(fd: number): void;
}

const CHUNK = 256;
const MAX_FRONTMATTER = 64 * 1024;

export function rawPaperPath(arxivId: string): string {
  return `raw/papers/arxiv-${arxivId}.md`;
}

export function isJobSource(relPath: string): boolean {
  return relPath.startsWith('raw/jobs/');
}

export function rawExists(root: string, relPath: string): boolean {
  try {
    fs.accessSync(path.join(root, relPath), fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** Returns the frontmatter block text (including both delimiters) or null. */
export function readFrontmatterBlock(absPath: string, impl: FsLike = fs): string | null {
  const fd = impl.openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(CHUNK);
    let acc = '';
    let pos = 0;
    for (;;) {
      const n = impl.readSync(fd, buf, 0, CHUNK, pos);
      if (n <= 0) return null;
      pos += n;
      acc += buf.subarray(0, n).toString('utf8');
      if (!acc.startsWith('---')) return null;
      const m = /\r?\n---[ \t]*(\r?\n|$)/.exec(acc.slice(3));
      if (m && (m[1] !== '' || n < CHUNK)) return acc.slice(0, 3 + m.index + m[0].length - m[1].length);
      if (acc.length > MAX_FRONTMATTER) return null;
    }
  } finally {
    impl.closeSync(fd);
  }
}

function str(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  return null;
}

/** Frontmatter-only read of one source file; null when the file is missing. */
export function readRawFrontmatter(root: string, relPath: string, impl: FsLike = fs): RawFrontmatter | null {
  if (!RAW_PATH_RE.test(relPath)) return null;
  const abs = path.join(root, relPath);
  let block: string | null;
  try {
    block = readFrontmatterBlock(abs, impl);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  if (block === null) return { path: relPath, source: null, title: null, fetched: null };
  const data = matter(block + '\n').data as Record<string, unknown>;
  return { path: relPath, source: str(data.source), title: str(data.title), fetched: str(data.fetched) };
}

export function isHttps(url: string | null): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function sourceLabel(fm: RawFrontmatter): string {
  if (fm.title) return fm.title;
  try {
    const u = new URL(fm.source ?? '');
    return u.hostname + u.pathname;
  } catch {
    return fm.path;
  }
}
