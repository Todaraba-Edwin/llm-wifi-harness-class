// Scanner v2 core: tokenization, decoding and sentinel construction.
// Tooling only; never imported by src/.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { decodeHTML } from 'entities';

export const K = 10;
export const MIN_LEN = 60;

export function norm(s: string): string[] {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, ' ')
    .split(' ')
    .filter(Boolean);
}

const JOINER = /\\*"\]\)(?:<|\\u003c)\/script(?:>|\\u003e)(?:<|\\u003c)script(?:>|\\u003e)self\.__next_f\.push\(\[1,\\*"/g;
const ESC: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', "'": "'", n: '\n', r: '\r', t: '\t' };

function rejoin(s: string): string {
  return s.replace(JOINER, '');
}

function unescapeJs(s: string): string {
  return s.replace(/\\(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(["\\/'nrt]))/g, (_m, u?: string, x?: string, c?: string) =>
    u ? String.fromCharCode(parseInt(u, 16)) : x ? String.fromCharCode(parseInt(x, 16)) : ESC[c as string],
  );
}

/** Rejoin flight chunks, decode JS/JSON string escapes in two passes, then HTML entities. */
export function decode(text: string): string {
  let s = text;
  for (let pass = 0; pass < 2; pass++) s = unescapeJs(rejoin(s));
  return decodeHTML(rejoin(s));
}

const TAG = /<\/?[A-Za-z][^<>]{0,256}>/g;
const MARKUP_FILE = /\.(html|rsc|txt)$/;

export function isBinary(file: string, head: Buffer): boolean {
  if (/\.(png|jpe?g|webp|ico|woff2?|avif)$/i.test(file)) return true;
  return head.subarray(0, 8192).includes(0);
}

/** U: unstripped tokens (every file). S: bounded-tag-stripped tokens (html / HTML-in-RSC only). */
export function tokenStreams(file: string, text: string): string[][] {
  const d = decode(text);
  const streams = [norm(d)];
  if (MARKUP_FILE.test(file)) streams.push(norm(d.replace(TAG, ' ')));
  return streams;
}

export function windowKeys(tokens: string[], onKey: (key: string, idx: number) => void): void {
  for (let i = 0; i + K <= tokens.length; i++) {
    const key = tokens.slice(i, i + K).join(' ');
    if (key.length >= MIN_LEN) onKey(key, i);
  }
}

function walk(dir: string, filter: (rel: string) => boolean, base = dir, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(base, p).split(path.sep).join('/');
    if (e.isDirectory()) {
      if (filter(rel + '/')) walk(p, filter, base, out);
    } else if (e.isFile() && filter(rel)) out.push(p);
  }
  return out.sort();
}
export { walk };

export interface Sentinels {
  map: Map<string, { file: string; idx: number }>;
  first: Set<string>;
}

function body(text: string): string {
  try {
    return matter(text).content;
  } catch {
    return text;
  }
}

/**
 * Sentinels = every K-token window (joined length >= 60) of every source body that is
 * not in the allowlist (wiki bodies, source frontmatter values, displayed plain text).
 */
export function buildSentinels(root: string, plaintextFile = path.join(root, 'src/generated/qa-plaintext.json')): Sentinels {
  const allow = new Set<string>();
  const addAllow = (text: string) => windowKeys(norm(text), (k) => allow.add(k));

  for (const f of walk(path.join(root, 'wiki'), (r) => r.endsWith('/') || r.endsWith('.md'))) addAllow(body(fs.readFileSync(f, 'utf8')));
  const rawFiles = walk(path.join(root, 'raw'), (r) => r.endsWith('/') || r.endsWith('.md'));
  for (const f of rawFiles) {
    const data = matter(fs.readFileSync(f, 'utf8')).data as Record<string, unknown>;
    for (const k of ['title', 'source', 'fetched']) {
      const v = data[k];
      if (v !== undefined && v !== null) addAllow(v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
    }
  }
  if (fs.existsSync(plaintextFile)) {
    const pt = JSON.parse(fs.readFileSync(plaintextFile, 'utf8')) as Record<string, string>;
    for (const v of Object.values(pt)) addAllow(v);
  }

  const map: Sentinels['map'] = new Map();
  for (const f of rawFiles) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    windowKeys(norm(body(fs.readFileSync(f, 'utf8'))), (k, idx) => {
      if (!allow.has(k) && !map.has(k)) map.set(k, { file: rel, idx });
    });
  }
  const first = new Set([...map.keys()].map((k) => k.slice(0, k.indexOf(' '))));
  return { map, first };
}

export interface SentinelHit {
  decodedOffset: number;
  rawSourceFile: string;
  rawTokenIndex: number;
}

export function scanTokens(tokens: string[], s: Sentinels): SentinelHit | null {
  for (let i = 0; i + K <= tokens.length; i++) {
    if (!s.first.has(tokens[i])) continue;
    const hit = s.map.get(tokens.slice(i, i + K).join(' '));
    if (hit) return { decodedOffset: i, rawSourceFile: hit.file, rawTokenIndex: hit.idx };
  }
  return null;
}
