import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePage } from '@/lib/content/frontmatter';
import { parseMarkdown, scanWikilinks, toPlainText } from '@/lib/content/wikilinks';
import { buildGraph } from '@/lib/content/graph';
import { errorsOf, loadWiki } from '@/lib/content/corpus';
import { FsLike, readFrontmatterBlock, readRawFrontmatter } from '@/lib/content/raw-frontmatter';
import { lintRawAccess } from '../../scripts/lint-raw-access';
import { baseWiki, page, REPO, tmpDir, write } from './helpers';

describe('frontmatter', () => {
  const ok = (extra = '') =>
    `---\ntitle: "T"\ntype: concept\ntags: [a]\nsources: [raw/blogs/a.md]\nupdated: 2026-11-05\n${extra}---\nbody\n`;
  it('normalizes YAML dates and returns the body', () => {
    const r = parsePage(ok());
    expect(r.ok && r.data.updated).toBe('2026-11-05');
    expect(r.ok && r.body.trim()).toBe('body');
  });
  it('rejects bad type, bad source path and unquoted ": " YAML', () => {
    expect(parsePage(ok().replace('concept', 'essay')).ok).toBe(false);
    expect(parsePage(ok().replace('raw/blogs/a.md', '../etc/passwd')).ok).toBe(false);
    expect(parsePage(ok('note: a: b\n')).ok).toBe(false);
  });
});

describe('wikilinks', () => {
  it('collects targets from text nodes only, skipping code', () => {
    const t = parseMarkdown('See [[a]] and `[[code]]`.\n\n```\n[[fenced]]\n```\n\n[[b]]');
    expect(scanWikilinks(t)).toEqual({ targets: ['a', 'b'], invalid: [] });
  });
  it('flags alias and anchor forms', () => {
    const s = scanWikilinks(parseMarkdown('[[a|b]] [[c#d]] [[ ]]'));
    expect(s.targets).toEqual([]);
    expect(s.invalid).toHaveLength(3);
  });
  it('plain text uses displayed titles, table cells, inline code, image alt; drops html', () => {
    const md = '# H\n\nSee [[a]] with `code` ![alt text](x.png)\n\n| c1 | c2 |\n|---|---|\n| x | **y** |\n\n<div>hidden</div>\n';
    const txt = toPlainText(parseMarkdown(md), { a: 'Title A' });
    expect(txt).toBe('H See Title A with code alt text c1 c2 x y');
  });
});

describe('graph', () => {
  it('dedupes edges, drops self links, sorts backlinks, keeps all nodes', () => {
    const mk = (slug: string, outgoing: string[]) => ({ slug, title: slug, type: 'concept' as const, tags: [], outgoing });
    const { graph, backlinks } = buildGraph([mk('b', ['a', 'a', 'b']), mk('a', ['c']), mk('c', []), mk('d', [])]);
    expect(graph.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(graph.edges).toEqual([
      { source: 'a', target: 'c' },
      { source: 'b', target: 'a' },
    ]);
    expect(backlinks.a).toEqual(['b']);
    expect(backlinks.d).toEqual([]);
  });
});

describe('raw frontmatter reader', () => {
  const content = '---\nsource: https://x.test/p\ntitle: "T  "\nfetched: 2026-11-05\n---\n' + 'SECRET-BODY '.repeat(2000);
  function fakeFs(): FsLike & { maxRead: number } {
    const buf = Buffer.from(content);
    const f = {
      maxRead: 0,
      openSync: () => 1,
      closeSync: () => undefined,
      readSync(_fd: number, b: Buffer, off: number, len: number, pos: number) {
        const n = Math.max(0, Math.min(len, buf.length - pos));
        buf.copy(b, off, pos, pos + n);
        f.maxRead = Math.max(f.maxRead, pos + n);
        return n;
      },
    };
    return f;
  }
  it('never reads past the closing delimiter by more than one chunk and never returns body text', () => {
    const f = fakeFs();
    const block = readFrontmatterBlock('/x', f)!;
    const end = content.indexOf('\n---\n') + 4;
    expect(block).not.toContain('SECRET-BODY');
    expect(block.endsWith('---')).toBe(true);
    expect(f.maxRead).toBeLessThanOrEqual(end + 256);
    expect(f.maxRead).toBeLessThan(content.length / 10);
  });
  it('parses source/title/fetched; missing file is null', () => {
    const root = tmpDir();
    write(root, 'raw/blogs/a.md', content);
    expect(readRawFrontmatter(root, 'raw/blogs/a.md')).toEqual({ path: 'raw/blogs/a.md', source: 'https://x.test/p', title: 'T', fetched: '2026-11-05' });
    expect(readRawFrontmatter(root, 'raw/blogs/none.md')).toBeNull();
  });
});

describe('raw-access lint', () => {
  it('flags source references outside the allowed files and src importing scripts', () => {
    const root = tmpDir();
    write(root, 'src/bad.ts', "import x from '../scripts/y';\nconst p = 'ra' + 'w';\nfs.readFileSync('raw/blogs/a.md');\n");
    write(root, 'src/ok.ts', "const s = 'rawr';\n");
    const v = lintRawAccess(root);
    expect(v.map((x) => `${x.rule}:${x.file}:${x.line}`).sort()).toEqual(['raw-reference:src/bad.ts:3', 'src-imports-scripts:src/bad.ts:1']);
  });
  it('passes on the real repository', () => {
    expect(lintRawAccess(REPO)).toEqual([]);
  });
});

describe('wiki load (fixtures)', () => {
  it('accepts a consistent wiki', () => {
    const root = tmpDir();
    baseWiki(root);
    const l = loadWiki(root);
    expect(errorsOf(l)).toEqual([]);
    expect(l.pages.map((p) => p.slug)).toEqual(['alpha', 'beta']);
    expect(l.pages[0].backlinks).toEqual(['beta']);
    expect(l.pages[0].sourceLinks[0]).toMatchObject({ url: 'https://example.com/a', label: 'Raw A' });
  });
  it('rule IM: a page missing from the index is an error', () => {
    const root = tmpDir();
    baseWiki(root);
    write(root, 'wiki/concepts/gamma.md', page('Gamma', 'See [[alpha]].'));
    const e = errorsOf(loadWiki(root));
    expect(e.some((i) => i.code === 'IM' && i.slug === 'gamma')).toBe(true);
  });
  it('rule IM: an index link to a missing page is an error', () => {
    const root = tmpDir();
    baseWiki(root);
    write(root, 'wiki/index.md', '# Index\n\n- [[alpha]]\n- [[beta]]\n- [[ghost]]\n');
    const e = errorsOf(loadWiki(root));
    expect(e.some((i) => i.code === 'IM' && i.slug === 'ghost')).toBe(true);
    expect(e.some((i) => i.code === 'broken-link')).toBe(true);
  });
  it('broken links and alias links are errors; orphan and no-outbound are warnings only', () => {
    const root = tmpDir();
    baseWiki(root);
    write(root, 'wiki/concepts/alpha.md', page('Alpha', 'See [[missing]] and [[beta|b]].'));
    const l = loadWiki(root);
    const codes = errorsOf(l).map((i) => i.code);
    expect(codes).toContain('broken-link');
    expect(codes).toContain('wikilink-form');
    const root2 = tmpDir();
    baseWiki(root2);
    write(root2, 'wiki/concepts/beta.md', page('Beta', 'No links here.'));
    const l2 = loadWiki(root2);
    expect(errorsOf(l2)).toEqual([]);
    expect(l2.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['no-outbound', 'orphan']));
  });
  it('missing source file and non-https source are errors', () => {
    const root = tmpDir();
    baseWiki(root);
    write(root, 'wiki/concepts/alpha.md', page('Alpha', 'See [[beta]].', { sources: ['raw/blogs/a.md', 'raw/blogs/nope.md'] }));
    expect(errorsOf(loadWiki(root)).map((i) => i.code)).toContain('source-missing');
    const root2 = tmpDir();
    baseWiki(root2);
    write(root2, 'raw/blogs/a.md', '---\nsource: http://example.com/a\ntitle: x\nfetched: 2026-11-05\n---\nbody\n');
    expect(errorsOf(loadWiki(root2)).map((i) => i.code)).toContain('source-url');
  });
  it('source label falls back to hostname+path when the raw title is absent', () => {
    const root = tmpDir();
    baseWiki(root);
    write(root, 'raw/blogs/a.md', '---\nsource: https://example.com/a/b\nfetched: 2026-11-05\n---\nbody\n');
    expect(loadWiki(root).pages[0].sourceLinks[0].label).toBe('example.com/a/b');
  });
});

describe('real wiki', () => {
  const load = loadWiki(REPO, { dashboards: true });
  it('has 39 pages, no errors, IM holds, every source mapped', () => {
    expect(errorsOf(load)).toEqual([]);
    expect(load.pages).toHaveLength(39);
    const sources = new Set(load.pages.flatMap((p) => p.sources));
    const mapped = new Set(load.pages.flatMap((p) => p.sourceLinks.map((s) => s.path)));
    expect(sources.size).toBe(30);
    expect(mapped).toEqual(sources);
  });
  it('verified pair: src-job-postings links harness-job-requirements and shows in its backlinks', () => {
    const by = Object.fromEntries(load.pages.map((p) => [p.slug, p]));
    expect(by['src-job-postings'].outgoing).toContain('harness-job-requirements');
    expect(by['harness-job-requirements'].backlinks).toContain('src-job-postings');
  });
  it('graph nodes equal content pages equal slugs linked from index', () => {
    const idx = new Set([...load.indexBody.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]));
    expect(new Set(load.graph.nodes.map((n) => n.id))).toEqual(idx);
    expect(load.graph.nodes).toHaveLength(39);
  });
  it('plain text corpus resolves wikilinks to titles and has no brackets', () => {
    for (const t of Object.values(load.plaintext)) expect(t).not.toMatch(/\[\[|\]\]/);
    expect(load.plaintext['src-job-postings']).toContain('종합 분석은 공고로 본 harness 엔지니어 요구 역량');
  });
  it('qa corpus is under the warn threshold', () => {
    expect(load.qaCorpusBytes).toBeLessThan(250_000);
  });
  it('generated outputs exist and agree', () => {
    const m = JSON.parse(fs.readFileSync(path.join(REPO, 'src/generated/manifest.json'), 'utf8'));
    expect(m.pageCount).toBe(load.pages.length);
    for (const f of ['pages', 'graph', 'search-index', 'dashboards', 'qa-corpus', 'qa-plaintext', 'manifest']) {
      expect(fs.existsSync(path.join(REPO, `src/generated/${f}.json`)), f).toBe(true);
    }
  });
});
