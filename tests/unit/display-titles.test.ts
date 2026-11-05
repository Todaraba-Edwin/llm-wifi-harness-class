import { describe, expect, it } from 'vitest';
import { loadWiki } from '@/lib/content/corpus';
import { parsePage } from '@/lib/content/frontmatter';
import {
  checkPairFormat,
  DISPLAY_TITLE_MAP,
  formatDisplayTitle,
  matchesFrontmatterTitle,
  resolveDisplayTitles,
} from '@/lib/content/display-titles';
import { page, REPO } from './helpers';

const DISPLAY_RE = /^.+ \(.+\)$/;

describe('formatDisplayTitle', () => {
  it('always renders "en (ko)" and keeps an existing parenthesis inside its own side', () => {
    expect(formatDisplayTitle({ en: 'Agent harness', ko: '에이전트 하네스' })).toBe('Agent harness (에이전트 하네스)');
    const t = formatDisplayTitle({ en: 'Generator-evaluator separation (planner / generator / evaluator)', ko: '생성-평가 분리' });
    expect(t).toBe('Generator-evaluator separation (planner / generator / evaluator) (생성-평가 분리)');
    expect(t).toMatch(DISPLAY_RE);
  });
});

describe('checkPairFormat and matchesFrontmatterTitle', () => {
  it('requires Latin in en, Hangul in ko, no newlines and no blanks', () => {
    expect(checkPairFormat({ en: 'Anthropic', ko: '앤트로픽' })).toEqual([]);
    expect(checkPairFormat({ en: '앤트로픽', ko: '앤트로픽' })).toContain('en 에 라틴 문자가 없음');
    expect(checkPairFormat({ en: 'Anthropic', ko: 'Anthropic' })).toContain('ko 에 한글이 없음');
    expect(checkPairFormat({ en: 'A\nB', ko: '가' })).toContain('개행 포함');
    expect(checkPairFormat({ en: ' ', ko: '' })).toContain('en/ko 중 빈 값');
  });
  it('single-language titles must match their own side exactly; mixed titles must keep every token', () => {
    expect(matchesFrontmatterTitle({ en: 'OpenAI', ko: '오픈AI' }, 'OpenAI')).toBe(true);
    expect(matchesFrontmatterTitle({ en: 'Open AI', ko: '오픈AI' }, 'OpenAI')).toBe(false);
    expect(matchesFrontmatterTitle({ en: 'Gaps', ko: '공백과 후속 과제' }, '공백과 후속 과제')).toBe(true);
    expect(matchesFrontmatterTitle({ en: 'Gaps', ko: '공백' }, '공백과 후속 과제')).toBe(false);
    expect(matchesFrontmatterTitle({ en: 'Harness engineering reading order', ko: '학습 순서' }, 'Harness engineering 학습 순서')).toBe(true);
    expect(matchesFrontmatterTitle({ en: 'Harness reading order', ko: '학습 순서' }, 'Harness engineering 학습 순서')).toBe(false);
  });
});

describe('resolveDisplayTitles', () => {
  const pages = [{ slug: 'alpha', title: 'Alpha' }];
  it('uses the map for pages without a frontmatter pair', () => {
    const r = resolveDisplayTitles(pages, { alpha: { en: 'Alpha', ko: '알파' } });
    expect(r.errors).toEqual([]);
    expect(r.displayTitles.alpha).toBe('Alpha (알파)');
  });
  it('uses the frontmatter pair and skips the title-match check for it', () => {
    const r = resolveDisplayTitles([{ slug: 'q', title: '이 질문은 무엇인가요?', titleEn: 'What is this question', titleKo: '이 질문은 무엇인가요?' }], {});
    expect(r.errors).toEqual([]);
    expect(r.displayTitles.q).toBe('What is this question (이 질문은 무엇인가요?)');
  });
  it('fails by name when a page has no source (no silent fallback)', () => {
    const r = resolveDisplayTitles(pages, {});
    expect(r.errors.join('\n')).toMatch(/alpha: 표시 제목 없음/);
    expect(r.displayTitles.alpha).toBeUndefined();
  });
  it('fails when both sources exist (duplicate)', () => {
    const r = resolveDisplayTitles([{ slug: 'alpha', title: 'Alpha', titleEn: 'Alpha', titleKo: '알파' }], { alpha: { en: 'Alpha', ko: '알파' } });
    expect(r.errors.join('\n')).toMatch(/alpha: frontmatter 쌍과 맵 항목이 중복/);
  });
  it('fails when the map names a slug that is not a content page (index and log included)', () => {
    const r = resolveDisplayTitles(pages, { alpha: { en: 'Alpha', ko: '알파' }, index: { en: 'Index', ko: '목차' }, log: { en: 'Log', ko: '기록' } });
    expect(r.errors).toContain('display-titles: 맵에 콘텐츠 페이지가 아닌 슬러그가 있음: index');
    expect(r.errors).toContain('display-titles: 맵에 콘텐츠 페이지가 아닌 슬러그가 있음: log');
  });
  it('fails when a map entry does not reproduce the frontmatter title', () => {
    const r = resolveDisplayTitles(pages, { alpha: { en: 'Alfa', ko: '알파' } });
    expect(r.errors.join('\n')).toMatch(/alpha: 맵 항목이 frontmatter 제목 "Alpha" 과 일치하지 않음/);
  });
});

describe('frontmatter pair', () => {
  const text = (extra: string) => page('Alpha', 'Body.').replace('type: concept', `type: concept\n${extra}`);
  it('accepts both halves, accepts neither, rejects one half', () => {
    expect(parsePage(text('title_en: "Alpha"\ntitle_ko: "알파"')).ok).toBe(true);
    expect(parsePage(page('Alpha', 'Body.')).ok).toBe(true);
    const half = parsePage(text('title_en: "Alpha"'));
    expect(half.ok).toBe(false);
    expect(half.ok === false && half.error).toMatch(/title_en/);
  });
});

describe('real wiki', () => {
  const load = loadWiki(REPO);
  const result = resolveDisplayTitles(load.pages);
  it('every one of the 39 pages resolves with no errors and every title looks like "en (ko)"', () => {
    expect(load.pages).toHaveLength(39);
    expect(result.errors).toEqual([]);
    expect(Object.keys(result.displayTitles).sort()).toEqual(load.pages.map((p) => p.slug).sort());
    for (const [slug, t] of Object.entries(result.displayTitles)) expect(t, slug).toMatch(DISPLAY_RE);
  });
  it('the curated map has no entry for index or log and one entry per content page', () => {
    expect(DISPLAY_TITLE_MAP.index).toBeUndefined();
    expect(DISPLAY_TITLE_MAP.log).toBeUndefined();
    expect(Object.keys(DISPLAY_TITLE_MAP).sort()).toEqual(load.pages.map((p) => p.slug).sort());
  });
});
