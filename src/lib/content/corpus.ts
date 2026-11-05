import fs from 'node:fs';
import path from 'node:path';
import { parsePage, type PageType } from './frontmatter';
import { parseMarkdown, scanWikilinks, toPlainText } from './wikilinks';
import { buildGraph, type GraphData } from './graph';
import { buildDashboards, DashboardError, type Dashboards } from './dashboards';
import {
  isHttps,
  readRawFrontmatter,
  sourceLabel,
  type RawFrontmatter,
} from './raw-frontmatter';

export const RESERVED = ['index', 'log'] as const;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const QA_WARN_BYTES = 250_000;
export const QA_ERROR_BYTES = 300_000;

const DIR_TYPE: Record<string, PageType> = {
  sources: 'source',
  concepts: 'concept',
  entities: 'entity',
  syntheses: 'synthesis',
};

export interface Issue {
  level: 'error' | 'warn';
  code: string;
  message: string;
  slug?: string;
}

export interface SourceLink {
  path: string;
  url: string;
  label: string;
  fetched: string | null;
}

export interface WikiPage {
  slug: string;
  title: string;
  /** Optional frontmatter display pair (see display-titles.ts). */
  titleEn?: string;
  titleKo?: string;
  type: PageType;
  tags: string[];
  sources: string[];
  updated: string;
  dir: string;
  /** Markdown with frontmatter and the leading H1 removed. */
  body: string;
  /** Markdown with frontmatter removed (H1 kept). Used for plain text corpora. */
  fullBody: string;
  outgoing: string[];
  backlinks: string[];
  sourceLinks: SourceLink[];
}

export interface WikiLoad {
  root: string;
  pages: WikiPage[];
  indexBody: string;
  logBody: string;
  graph: GraphData;
  plaintext: Record<string, string>;
  qaCorpusBytes: number;
  dashboards: Dashboards | null;
  issues: Issue[];
}

export interface LoadOptions {
  dashboards?: boolean;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out.sort();
}

export function stripLeadingH1(body: string): string {
  return body.replace(/^\s*# [^\n]*\n+/, '');
}

export function loadWiki(root: string, opts: LoadOptions = {}): WikiLoad {
  const issues: Issue[] = [];
  const err = (code: string, message: string, slug?: string) => issues.push({ level: 'error', code, message, slug });
  const warn = (code: string, message: string, slug?: string) => issues.push({ level: 'warn', code, message, slug });
  const wikiDir = path.join(root, 'wiki');

  const files = walk(wikiDir);
  const pages: WikiPage[] = [];
  const seen = new Map<string, string>();
  let indexBody = '';
  let logBody = '';

  for (const file of files) {
    const rel = path.relative(wikiDir, file).split(path.sep).join('/');
    const slug = path.basename(file, '.md');
    const text = fs.readFileSync(file, 'utf8');
    if (rel === 'index.md') {
      indexBody = text;
      continue;
    }
    if (rel === 'log.md') {
      logBody = text;
      continue;
    }
    if (!SLUG_RE.test(slug)) {
      err('slug', `슬러그가 kebab-case가 아님: ${rel}`);
      continue;
    }
    if ((RESERVED as readonly string[]).includes(slug)) {
      err('reserved', `예약된 슬러그: ${rel}`);
      continue;
    }
    if (seen.has(slug)) {
      err('duplicate', `슬러그 중복: ${rel} / ${seen.get(slug)}`, slug);
      continue;
    }
    seen.set(slug, rel);
    const parsed = parsePage(text);
    if (!parsed.ok) {
      err('frontmatter', `${rel}: ${parsed.error}`, slug);
      continue;
    }
    const dir = rel.includes('/') ? rel.split('/')[0] : '';
    if (DIR_TYPE[dir] && DIR_TYPE[dir] !== parsed.data.type) {
      warn('type-dir', `${rel}: type '${parsed.data.type}' 이(가) 디렉터리와 불일치`, slug);
    }
    pages.push({
      slug,
      title: parsed.data.title,
      ...(parsed.data.title_en !== undefined ? { titleEn: parsed.data.title_en, titleKo: parsed.data.title_ko } : {}),
      type: parsed.data.type,
      tags: parsed.data.tags,
      sources: parsed.data.sources,
      updated: parsed.data.updated,
      dir,
      body: stripLeadingH1(parsed.body),
      fullBody: parsed.body,
      outgoing: [],
      backlinks: [],
      sourceLinks: [],
    });
  }
  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  const slugs = new Set(pages.map((p) => p.slug));
  const titles = Object.fromEntries(pages.map((p) => [p.slug, p.title]));

  // Wikilinks.
  const checkLinks = (label: string, md: string, slug?: string, all?: Set<string>): string[] => {
    const scan = scanWikilinks(parseMarkdown(md));
    for (const raw of scan.invalid) err('wikilink-form', `${label}: 지원하지 않는 링크 형식 [[${raw}]]`, slug);
    const ok: string[] = [];
    for (const t of scan.targets) {
      all?.add(t);
      if (!slugs.has(t)) err('broken-link', `${label}: 깨진 링크 [[${t}]]`, slug);
      else ok.push(t);
    }
    return ok;
  };
  for (const p of pages) p.outgoing = [...new Set(checkLinks(`${p.dir}/${p.slug}`, p.fullBody, p.slug))];
  const indexTargets = new Set<string>();
  checkLinks('index', indexBody, undefined, indexTargets);
  checkLinks('log', logBody);

  // Rule IM: slugs on disk == slugs linked from index.md.
  if (indexBody === '') err('index-missing', 'wiki/index.md 없음');
  for (const s of slugs) if (!indexTargets.has(s)) err('IM', `index에 없는 페이지: ${s}`, s);
  for (const s of indexTargets) if (!slugs.has(s)) err('IM', `index가 링크하지만 디스크에 없는 페이지: ${s}`, s);

  // Graph and backlinks.
  const { graph, backlinks } = buildGraph(pages);
  for (const p of pages) p.backlinks = backlinks[p.slug];
  for (const p of pages) {
    if (p.backlinks.length === 0) warn('orphan', `인바운드 링크 없음: ${p.slug}`, p.slug);
    if (p.outgoing.length === 0) warn('no-outbound', `아웃바운드 링크 없음: ${p.slug}`, p.slug);
  }

  // Source mapping (frontmatter-only reads, memoized).
  const rawCache = new Map<string, RawFrontmatter | null>();
  const rawFor = (rel: string): RawFrontmatter | null => {
    if (!rawCache.has(rel)) rawCache.set(rel, readRawFrontmatter(root, rel));
    return rawCache.get(rel)!;
  };
  for (const p of pages) {
    for (const rel of p.sources) {
      const fm = rawFor(rel);
      if (!fm) {
        err('source-missing', `${p.slug}: sources 파일 없음 ${rel}`, p.slug);
        continue;
      }
      if (!isHttps(fm.source)) {
        err('source-url', `${p.slug}: ${rel} 의 source 가 없거나 https 가 아님`, p.slug);
        continue;
      }
      p.sourceLinks.push({ path: rel, url: fm.source, label: sourceLabel(fm), fetched: fm.fetched });
    }
  }

  // Plain text corpus (displayed text) and QA corpus size guard.
  const plaintext: Record<string, string> = {};
  for (const p of pages) plaintext[p.slug] = toPlainText(parseMarkdown(p.fullBody), titles);
  const qaCorpusBytes =
    Buffer.byteLength(indexBody) + pages.reduce((n, p) => n + Buffer.byteLength(p.fullBody) + Buffer.byteLength(p.title) + 64, 0);
  if (qaCorpusBytes > QA_ERROR_BYTES) err('qa-corpus-size', `Q&A 코퍼스 ${qaCorpusBytes}B > ${QA_ERROR_BYTES}B`);
  else if (qaCorpusBytes > QA_WARN_BYTES) warn('qa-corpus-size', `Q&A 코퍼스 ${qaCorpusBytes}B > ${QA_WARN_BYTES}B`);

  // Dashboards (strict shape; drift is a build error).
  let dashboards: Dashboards | null = null;
  if (opts.dashboards) {
    try {
      dashboards = buildDashboards({
        pages: Object.fromEntries(pages.map((p) => [p.slug, { title: p.title, body: p.fullBody, sources: p.sources }])),
        titles,
        rawFor,
      });
    } catch (e) {
      if (e instanceof DashboardError) err('dashboard', e.message);
      else throw e;
    }
  }

  return { root, pages, indexBody, logBody, graph, plaintext, qaCorpusBytes, dashboards, issues };
}

export function errorsOf(load: WikiLoad): Issue[] {
  return load.issues.filter((i) => i.level === 'error');
}

export function formatIssue(i: Issue): string {
  return `${i.level === 'error' ? 'ERROR' : 'warn '} [${i.code}] ${i.message}`;
}
