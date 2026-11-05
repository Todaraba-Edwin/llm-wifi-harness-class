import { describe, expect, it } from 'vitest';
import { createSavePr, kstParts, type SavePrInput } from '@/lib/github/pr';
import type { ValidatedAnswer } from '@/lib/qa/validate';
import { fakeGithub, INDEX, LOG, MAIN_SHA, TREE_SHA } from './fake';

const ANSWER: ValidatedAnswer = {
  answerable: true,
  title_en: 'Harness basics',
  title_ko: '하네스 기초',
  summary: 's',
  sentences: [{ text: '문장입니다.', cites: [{ slug: 'alpha', quote: 'quote text one' }] }],
  notCovered: [],
};
const NOW = Date.parse('2026-11-05T23:50:00+09:00');
const input = (over: Partial<SavePrInput> = {}): SavePrInput => ({
  repo: 'owner/wiki',
  question: '질문입니다',
  answer: ANSWER,
  slug: 'my-slug',
  summary: '요약',
  now: NOW,
  sourcesOf: () => ['raw/blogs/a.md'],
  ...over,
});

describe('kstParts', () => {
  it('uses Korea time across the UTC date boundary', () => {
    expect(kstParts(Date.parse('2026-11-05T16:30:00Z'))).toEqual({ date: '2026-11-06', stamp: '202611060130', slugStamp: '20261106-0130' });
  });
});

describe('createSavePr', () => {
  it('commits three files on main\'s head and opens a PR through createRef only', async () => {
    const f = fakeGithub();
    const out = await createSavePr(f.api, input());
    expect(out).toEqual({ url: 'https://github.test/o/r/pull/7', number: 7 });
    expect(f.calls).toEqual(['getRef', 'getCommit', 'getTree', 'getBlob', 'getBlob', 'pulls.list', 'createBlob', 'createBlob', 'createBlob', 'createTree', 'createCommit', 'createRef', 'pulls.create']);
    expect(f.refs).toEqual(['refs/heads/qa/my-slug-202611052350']);
    expect(f.refs.every((r) => r.startsWith('refs/heads/qa/'))).toBe(true);

    expect(f.trees[0]).toMatchObject({ base_tree: TREE_SHA });
    const paths = (f.trees[0].tree as { path: string; sha: string }[]).map((t) => t.path);
    expect(paths).toEqual(['wiki/syntheses/my-slug.md', 'wiki/index.md', 'wiki/log.md']);
    const content = (p: string) => f.blobs.get((f.trees[0].tree as { path: string; sha: string }[]).find((t) => t.path === p)!.sha)!;
    expect(content('wiki/index.md')).toBe(`${INDEX}- [[my-slug]]: 요약\n`);
    expect(content('wiki/log.md')).toBe(`${LOG}\n## [2026-11-05] query | 질문입니다\n- 생성: my-slug\n`);
    expect(content('wiki/syntheses/my-slug.md')).toContain('# 질문입니다');

    expect(f.commits[0]).toEqual({ owner: 'owner', repo: 'wiki', message: 'query: my-slug', tree: 'c'.repeat(40), parents: [MAIN_SHA] });
    expect(f.commits[0]).not.toHaveProperty('author');
    expect(f.commits[0]).not.toHaveProperty('committer');
    expect(f.prs[0]).toMatchObject({ base: 'main', head: 'qa/my-slug-202611052350', title: 'query: 질문입니다', body: '근거 페이지: alpha' });
  });

  it('truncates the PR title question to 72 code points', async () => {
    const f = fakeGithub();
    await createSavePr(f.api, input({ question: 'q'.repeat(300) }));
    expect([...(f.prs[0].title as string).replace('query: ', '')]).toHaveLength(72);
  });

  it.each(['my-slug', 'index', 'log', 'alpha', 'gamma'])('409 SLUG_EXISTS for existing/reserved slug %s with no writes', async (slug) => {
    const f = fakeGithub();
    if (slug === 'my-slug') f.api = fakeGithub({ files: { 'wiki/index.md': INDEX, 'wiki/log.md': LOG, 'wiki/entities/my-slug.md': 'x' } }).api;
    await expect(createSavePr(f.api, input({ slug }))).rejects.toMatchObject({ status: 409, code: 'SLUG_EXISTS' });
    expect(f.calls.some((c) => c.startsWith('create'))).toBe(false);
  });

  it('409 QA_PR_OPEN when any open PR head starts with qa/, nothing is written', async () => {
    const f = fakeGithub({ openPrHeads: ['feature/x', 'qa/other-202601010000'] });
    await expect(createSavePr(f.api, input())).rejects.toMatchObject({ status: 409, code: 'QA_PR_OPEN' });
    expect(f.calls.some((c) => c.startsWith('create'))).toBe(false);
    const g = fakeGithub({ openPrHeads: ['feature/x', 'qa-not-prefix'] });
    await expect(createSavePr(g.api, input())).resolves.toMatchObject({ number: 7 });
  });

  it('422 NO_SYNTHESES_SECTION when main\'s index lacks the section; nothing is written', async () => {
    const f = fakeGithub({ files: { 'wiki/index.md': '# Index\n', 'wiki/log.md': LOG } });
    await expect(createSavePr(f.api, input())).rejects.toMatchObject({ status: 422, code: 'NO_SYNTHESES_SECTION' });
    expect(f.calls.some((c) => c.startsWith('create'))).toBe(false);
  });

  it('maps a 422 from createRef to BRANCH_EXISTS and never opens a PR', async () => {
    const f = fakeGithub({ failRef: 422 });
    await expect(createSavePr(f.api, input())).rejects.toMatchObject({ status: 409, code: 'BRANCH_EXISTS' });
    expect(f.calls).not.toContain('pulls.create');
  });

  it('maps a PR failure after the ref to PR_FAILED without deleting the branch', async () => {
    const f = fakeGithub({ failPr: true });
    await expect(createSavePr(f.api, input())).rejects.toMatchObject({ status: 502, code: 'PR_FAILED' });
    expect(f.refs).toHaveLength(1);
  });

  it('errors never carry user text', async () => {
    const f = fakeGithub({ failPr: true });
    const err = await createSavePr(f.api, input({ question: 'SECRET-QUESTION' })).catch((e) => e as Error);
    expect(String((err as Error).message)).toBe('PR_FAILED');
  });

  it('the guard Proxy really throws on forbidden calls', () => {
    const f = fakeGithub();
    expect(() => (f.api.git as unknown as Record<string, unknown>).updateRef).toThrow('forbidden');
    expect(() => (f.api as unknown as { repos: Record<string, unknown> }).repos.merge).toThrow('forbidden');
  });
});
