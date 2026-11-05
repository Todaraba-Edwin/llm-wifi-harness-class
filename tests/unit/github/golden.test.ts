import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { errorsOf, loadWiki } from '@/lib/content/corpus';
import { resolveDisplayTitles, type TitlePageInput } from '@/lib/content/display-titles';
import { appendLog, insertIndexEntry } from '@/lib/github/index-log';
import { renderSynthesis } from '@/lib/github/render-synthesis';
import type { ValidatedAnswer } from '@/lib/qa/validate';
import { REPO, tmpDir } from '../helpers';

const ANSWER: ValidatedAnswer = {
  answerable: true,
  title_en: 'What a harness does',
  title_ko: '하네스가 하는 일',
  summary: '요약',
  sentences: [{ text: '하네스는 모델을 감쌉니다.', cites: [{ slug: 'agent-harness', quote: 'quote not checked here' }, { slug: 'harness-engineering', quote: 'quote not checked here' }] }],
  notCovered: ['세부 수치'],
};
const SLUG = 'qa-golden-check';
const roots: string[] = [];
afterAll(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

/** A temp copy of the real wiki/ and raw/ (read-only here), with the save transforms applied. */
function savedCopy(mutate: (page: string) => string = (p) => p): string {
  const root = tmpDir('golden-');
  roots.push(root);
  fs.cpSync(path.join(REPO, 'wiki'), path.join(root, 'wiki'), { recursive: true });
  fs.cpSync(path.join(REPO, 'raw'), path.join(root, 'raw'), { recursive: true });
  const before = loadWiki(root);
  const sourcesOf = (slug: string) => before.pages.find((p) => p.slug === slug)?.sources;
  const page = renderSynthesis({ question: '하네스는 무엇을 하나요?', answer: ANSWER, today: '2026-11-05', sourcesOf });
  fs.writeFileSync(path.join(root, 'wiki/syntheses', `${SLUG}.md`), mutate(page));
  const idxPath = path.join(root, 'wiki/index.md');
  const logPath = path.join(root, 'wiki/log.md');
  fs.writeFileSync(idxPath, insertIndexEntry(fs.readFileSync(idxPath, 'utf8'), SLUG, '하네스는 무엇을 하나요?'));
  fs.writeFileSync(logPath, appendLog(fs.readFileSync(logPath, 'utf8'), '2026-11-05', '하네스는 무엇을 하나요?', SLUG));
  return root;
}

const titleInputs = (root: string): TitlePageInput[] => loadWiki(root).pages.map((p) => ({ slug: p.slug, title: p.title, titleEn: p.titleEn, titleKo: p.titleKo }));

describe('saved answer applied to a copy of the real wiki', () => {
  it('stays a valid 40-page wiki with zero errors and the pair as its display title', () => {
    const baseline = loadWiki(REPO);
    expect(baseline.pages).toHaveLength(39);
    const root = savedCopy();
    const load = loadWiki(root);
    expect(errorsOf(load).map((i) => i.message)).toEqual([]);
    expect(load.pages).toHaveLength(40);
    const saved = load.pages.find((p) => p.slug === SLUG)!;
    expect(saved).toMatchObject({ type: 'synthesis', titleEn: 'What a harness does', titleKo: '하네스가 하는 일', title: '하네스는 무엇을 하나요?' });
    expect(saved.outgoing).toEqual(['agent-harness', 'harness-engineering']);

    const titles = resolveDisplayTitles(titleInputs(root));
    expect(titles.errors).toEqual([]);
    expect(Object.keys(titles.displayTitles)).toHaveLength(40);
    expect(titles.displayTitles[SLUG]).toBe('What a harness does (하네스가 하는 일)');
  });

  it('negative control: without title_en/title_ko the title check names the page', () => {
    const root = savedCopy((page) => page.replace(/^title_(en|ko): .*\n/gm, ''));
    expect(errorsOf(loadWiki(root))).toEqual([]);
    const titles = resolveDisplayTitles(titleInputs(root));
    expect(titles.errors).toHaveLength(1);
    expect(titles.errors[0]).toContain(SLUG);
    expect(titles.errors[0]).toContain('표시 제목 없음');
  });

  it('never touches the real wiki', () => {
    expect(fs.existsSync(path.join(REPO, 'wiki/syntheses', `${SLUG}.md`))).toBe(false);
    expect(fs.readFileSync(path.join(REPO, 'wiki/index.md'), 'utf8')).not.toContain(SLUG);
  });
});
