import type { List, ListItem, Root, Strong, Table } from 'mdast';
import { parseMarkdown, scanWikilinks, toPlainText } from './wikilinks';
import { isHttps, isJobSource, rawPaperPath, type RawFrontmatter } from './raw-frontmatter';

export const READING_SLUG = 'harness-reading-order';
export const SKILLS_SLUG = 'harness-job-requirements';
export const POSTINGS_SLUG = 'src-job-postings';

export class DashboardError extends Error {}

export interface ReadingStep {
  n: number;
  text: string;
  slugs: string[];
  arxivIds: string[];
  arxivLinks: Record<string, string>;
}
export interface Chip {
  slug: string;
  title: string;
}
export interface SkillItem {
  n: number;
  title: string;
  desc: string;
  parenthetical: string | null;
  chips: Chip[];
  slugs: string[];
}
export interface Posting {
  company: string;
  position: string;
  context: string;
  url: string;
  rawTitle: string;
  fetched: string | null;
}
export interface Dashboards {
  reading: ReadingStep[];
  skills: SkillItem[];
  postings: Posting[];
}

export interface DashboardInput {
  pages: Record<string, { title: string; body: string; sources: string[] }>;
  titles: Record<string, string>;
  rawFor: (relPath: string) => RawFrontmatter | null;
}

function wrap(node: ListItem): Root {
  return { type: 'root', children: [node] };
}

function onlyOrderedList(tree: Root, slug: string): List {
  const lists = tree.children.filter((c): c is List => c.type === 'list' && c.ordered === true);
  if (lists.length !== 1) throw new DashboardError(`${slug}: 순서 있는 목록이 정확히 1개여야 함 (현재 ${lists.length})`);
  return lists[0];
}

function pageOf(input: DashboardInput, slug: string) {
  const p = input.pages[slug];
  if (!p) throw new DashboardError(`${slug}: 페이지 없음`);
  return p;
}

export function parseReading(input: DashboardInput): ReadingStep[] {
  const page = pageOf(input, READING_SLUG);
  const list = onlyOrderedList(parseMarkdown(page.body), READING_SLUG);
  const start = list.start ?? 1;
  return list.children.map((item, i) => {
    const text = toPlainText(wrap(item), input.titles);
    const arxivIds = [...new Set(text.match(/\b\d{4}\.\d{5}\b/g) ?? [])];
    const arxivLinks: Record<string, string> = {};
    for (const id of arxivIds) {
      const fm = input.rawFor(rawPaperPath(id));
      if (fm && isHttps(fm.source)) arxivLinks[id] = fm.source;
    }
    return { n: start + i, text, slugs: [...new Set(scanWikilinks(wrap(item)).targets)], arxivIds, arxivLinks };
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseSkills(input: DashboardInput): SkillItem[] {
  const page = pageOf(input, SKILLS_SLUG);
  const list = onlyOrderedList(parseMarkdown(page.body), SKILLS_SLUG);
  const orgs = Object.entries(input.titles).filter(([s]) => s.startsWith('org-'));
  const start = list.start ?? 1;
  return list.children.map((item, i) => {
    const para = item.children[0];
    const strong = para?.type === 'paragraph' ? para.children[0] : undefined;
    if (!strong || strong.type !== 'strong') {
      throw new DashboardError(`${SKILLS_SLUG}: ${start + i}번 항목은 굵은 글씨 제목으로 시작해야 함`);
    }
    const title = toPlainText({ type: 'root', children: [{ type: 'paragraph', children: (strong as Strong).children }] }, input.titles);
    const end = item.position!.end.offset!;
    let rest = page.body
      .slice(strong.position!.end.offset!, end)
      .replace(/\[\[[^\]]*\]\]/g, '')
      .replace(/[*`]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*[:：]\s*/, '')
      .trim();
    let parenthetical: string | null = null;
    const groups = [...rest.matchAll(/\(([^()]*)\)/g)];
    const last = groups.at(-1);
    if (last) {
      parenthetical = last[1].trim();
      rest = (rest.slice(0, last.index) + rest.slice(last.index + last[0].length)).replace(/\s+/g, ' ');
    }
    const desc = rest.replace(/[\s.。]+$/, '').trim();
    const found: { idx: number; chip: Chip }[] = [];
    if (parenthetical) {
      for (const [slug, orgTitle] of orgs) {
        const m = new RegExp(`(?<![A-Za-z0-9])${escapeRe(orgTitle)}(?![A-Za-z0-9])`, 'i').exec(parenthetical);
        if (m) found.push({ idx: m.index, chip: { slug, title: orgTitle } });
      }
    }
    found.sort((a, b) => a.idx - b.idx);
    return {
      n: start + i,
      title,
      desc,
      parenthetical,
      chips: found.map((f) => f.chip),
      slugs: [...new Set(scanWikilinks(wrap(item)).targets)],
    };
  });
}

const POSTING_HEADER = ['회사', '포지션', 'harness 맥락'];
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function parsePostings(input: DashboardInput): Posting[] {
  const page = pageOf(input, POSTINGS_SLUG);
  const tree = parseMarkdown(page.body);
  const tables = tree.children.filter((c): c is Table => c.type === 'table');
  if (tables.length !== 1) throw new DashboardError(`${POSTINGS_SLUG}: 표가 정확히 1개여야 함 (현재 ${tables.length})`);
  const cell = (c: Table['children'][number]['children'][number]) =>
    toPlainText({ type: 'root', children: [{ type: 'paragraph', children: c.children }] }, input.titles);
  const [head, ...rows] = tables[0].children;
  const header = head.children.map(cell);
  if (header.join('|') !== POSTING_HEADER.join('|')) {
    throw new DashboardError(`${POSTINGS_SLUG}: 표 머리글이 '${POSTING_HEADER.join(' | ')}' 이어야 함`);
  }
  const sources = page.sources;
  if (rows.length !== sources.length) {
    throw new DashboardError(`${POSTINGS_SLUG}: 표 행 수(${rows.length})와 sources 수(${sources.length}) 불일치`);
  }
  return rows.map((row, i) => {
    const [company, position, context] = row.children.map(cell);
    if (row.children.length !== 3) throw new DashboardError(`${POSTINGS_SLUG}: ${i + 1}번 행 열 수 오류`);
    const src = sources[i];
    const base = src.split('/').at(-1) ?? '';
    if (!isJobSource(src)) throw new DashboardError(`${POSTINGS_SLUG}: ${i + 1}번 sources 항목이 공고 경로가 아님`);
    const seg = alnum(base.split('-')[0]);
    if (!seg || !alnum(company).startsWith(seg)) {
      throw new DashboardError(`${POSTINGS_SLUG}: ${i + 1}번 행 회사(${company})와 sources 파일 접두어 불일치`);
    }
    const fm = input.rawFor(src);
    if (!fm || !isHttps(fm.source)) throw new DashboardError(`${POSTINGS_SLUG}: ${i + 1}번 행(${company}) 원문 URL 오류`);
    return { company, position, context, url: fm.source, rawTitle: fm.title ?? '', fetched: fm.fetched };
  });
}

export function buildDashboards(input: DashboardInput): Dashboards {
  return { reading: parseReading(input), skills: parseSkills(input), postings: parsePostings(input) };
}
