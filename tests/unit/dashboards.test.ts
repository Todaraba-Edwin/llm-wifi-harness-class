import { describe, expect, it } from 'vitest';
import { loadWiki } from '@/lib/content/corpus';
import { DashboardError, parsePostings, parseReading, parseSkills, type DashboardInput } from '@/lib/content/dashboards';
import type { RawFrontmatter } from '@/lib/content/raw-frontmatter';
import { REPO } from './helpers';

const titles = { 'org-openai': 'OpenAI', 'org-scale-ai': 'Scale AI', 'org-thinking-machines': 'Thinking Machines', 'src-x': 'X' };

const rawFor = (p: string): RawFrontmatter | null =>
  p.startsWith('raw/') ? { path: p, source: `https://jobs.example/${p.split('/').at(-1)}`, title: `T ${p}`, fetched: '2026-11-05' } : null;

function postingsInput(rows: string[], sources: string[], header = '| 회사 | 포지션 | harness 맥락 |'): DashboardInput {
  const body = `# P\n\n${header}\n|---|---|---|\n${rows.join('\n')}\n`;
  return { pages: { 'src-job-postings': { title: 'P', body, sources } }, titles, rawFor };
}
const ROWS = ['| OpenAI | A | c1 |', '| Scale AI | B | c2 |', '| Thinking Machines | C | c3 |'];
const SRC = ['raw/jobs/openai-codex.md', 'raw/jobs/scale-rl-environments.md', 'raw/jobs/thinkingmachines-evals.md'];

describe('postings positional join', () => {
  it('joins row i to sources[i]', () => {
    const p = parsePostings(postingsInput(ROWS, SRC));
    expect(p.map((x) => x.url)).toEqual(SRC.map((s) => `https://jobs.example/${s.split('/').at(-1)}`));
    expect(p[1]).toMatchObject({ company: 'Scale AI', position: 'B', context: 'c2' });
  });
  it('fails on a swapped pair of rows (prefix mismatch)', () => {
    const swapped = [ROWS[1], ROWS[0], ROWS[2]];
    expect(() => parsePostings(postingsInput(swapped, SRC))).toThrow(DashboardError);
  });
  it('fails on count mismatch, wrong header, non-jobs source and non-https URL', () => {
    expect(() => parsePostings(postingsInput(ROWS.slice(0, 2), SRC))).toThrow(/불일치/);
    expect(() => parsePostings(postingsInput(ROWS, SRC, '| 회사 | 직무 | harness 맥락 |'))).toThrow(/머리글/);
    expect(() => parsePostings(postingsInput(ROWS, ['raw/blogs/openai.md', SRC[1], SRC[2]]))).toThrow(/공고 경로/);
    const input = postingsInput(ROWS, SRC);
    input.rawFor = (p) => ({ path: p, source: 'http://insecure.example/x', title: 't', fetched: null });
    expect(() => parsePostings(input)).toThrow(/URL/);
  });
  it('error messages carry row index and company only (no source text)', () => {
    try {
      parsePostings(postingsInput([ROWS[1], ROWS[0], ROWS[2]], SRC));
    } catch (e) {
      expect((e as Error).message).toMatch(/1번 행/);
      expect((e as Error).message).not.toMatch(/c1|c2/);
    }
  });
});

describe('skills and reading parsers', () => {
  const skills = (body: string): DashboardInput => ({ pages: { 'harness-job-requirements': { title: 'S', body, sources: [] } }, titles, rawFor });
  it('chips follow the org-title rule; non-matching text is a caption only', () => {
    const body = [
      '1. **Eval**: desc one (OpenAI, Anthropic "x", Scale AI 음성). [[src-x]]',
      '2. **Many**: d (거의 모든 공고)',
      '3. **None**: plain without parenthetical',
      '4. **Order**: d (Thinking Machines, OpenAI, openai, SCALE AI)',
      '5. **Word**: d (OpenAIX, notScale AI)',
    ].join('\n');
    const s = parseSkills(skills(body));
    expect(s[0]).toMatchObject({ n: 1, title: 'Eval', desc: 'desc one', slugs: ['src-x'] });
    expect(s[0].chips.map((c) => c.title)).toEqual(['OpenAI', 'Scale AI']);
    expect(s[1].chips).toEqual([]);
    expect(s[1].parenthetical).toBe('거의 모든 공고');
    expect(s[2]).toMatchObject({ parenthetical: null, chips: [] });
    expect(s[3].chips.map((c) => c.title)).toEqual(['Thinking Machines', 'OpenAI', 'Scale AI']);
    expect(s[4].chips.map((c) => c.title)).toEqual([]);
  });
  it('fails when an item does not start with bold text or lists are ambiguous', () => {
    expect(() => parseSkills(skills('1. plain start (OpenAI)'))).toThrow(DashboardError);
    expect(() => parseSkills(skills('1. **a**\n\ntext\n\n1. **b**'))).toThrow(/정확히 1개/);
  });
  it('reading order extracts steps, slugs and arxiv ids with links when present', () => {
    const input: DashboardInput = {
      pages: { 'harness-reading-order': { title: 'R', body: '1. [[src-x]]: first\n2. 논문: 2606.10106(정의) -> 2605.13357(프레임)', sources: [] } },
      titles,
      rawFor: (p) => (p.endsWith('arxiv-2606.10106.md') ? { path: p, source: 'https://arxiv.org/abs/2606.10106', title: null, fetched: null } : null),
    };
    const r = parseReading(input);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ n: 1, slugs: ['src-x'], text: 'X: first' });
    expect(r[1].arxivIds).toEqual(['2606.10106', '2605.13357']);
    expect(r[1].arxivLinks).toEqual({ '2606.10106': 'https://arxiv.org/abs/2606.10106' });
  });
});

describe('real dashboards', () => {
  const d = loadWiki(REPO, { dashboards: true }).dashboards!;
  it('has 7 steps, 9 skills, 13 postings', () => {
    expect(d.reading).toHaveLength(7);
    expect(d.skills).toHaveLength(9);
    expect(d.postings).toHaveLength(13);
    expect(d.reading[5].arxivIds).toHaveLength(4);
    expect(Object.keys(d.reading[5].arxivLinks)).toHaveLength(4);
  });
  it('chips: item 3 none, item 6 OpenAI/Anthropic/Decagon, item 7 four companies', () => {
    expect(d.skills[2].chips).toEqual([]);
    expect(d.skills[5].chips.map((c) => c.title)).toEqual(['OpenAI', 'Anthropic', 'Decagon']);
    expect(d.skills[6].chips.map((c) => c.title)).toEqual(['OpenAI', 'Anthropic', 'Perplexity', 'Thinking Machines']);
    expect(d.skills.filter((s) => s.slugs.length === 0).map((s) => s.n)).toEqual(expect.arrayContaining([5, 6, 8]));
  });
  it('every posting has an https URL', () => {
    for (const p of d.postings) expect(p.url).toMatch(/^https:\/\//);
  });
});
