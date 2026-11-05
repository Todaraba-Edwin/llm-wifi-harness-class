import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { renderSynthesis, yamlString } from '@/lib/github/render-synthesis';
import { parsePage } from '@/lib/content/frontmatter';
import type { ValidatedAnswer } from '@/lib/qa/validate';

const ANSWER: ValidatedAnswer = {
  answerable: true,
  title_en: 'Harness basics',
  title_ko: '하네스 기초',
  summary: 'SUMMARY-NOT-IN-FILE',
  sentences: [
    { text: '첫 문장입니다.', cites: [{ slug: 'page-a', quote: 'q one two' }, { slug: 'page-b', quote: 'q three four' }] },
    { text: '둘째 문장입니다.', cites: [{ slug: 'page-a', quote: 'q five six' }, { slug: 'page-a', quote: 'q seven eight' }] },
  ],
  notCovered: ['세부 수치'],
};
const SOURCES: Record<string, string[]> = {
  'page-a': ['raw/blogs/z.md', 'raw/blogs/a.md'],
  'page-b': ['raw/blogs/a.md', 'raw/papers/m.md'],
};
const input = (over: Partial<Parameters<typeof renderSynthesis>[0]> = {}) => ({
  question: '하네스란 무엇인가?',
  answer: ANSWER,
  today: '2026-11-05',
  sourcesOf: (s: string) => SOURCES[s],
  ...over,
});

describe('renderSynthesis', () => {
  it('renders the frontmatter and body, parsed back by the real page parser', () => {
    const text = renderSynthesis(input());
    const parsed = parsePage(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toEqual({
      title: '하네스란 무엇인가?',
      title_en: 'Harness basics',
      title_ko: '하네스 기초',
      type: 'synthesis',
      tags: ['query'],
      sources: ['raw/blogs/a.md', 'raw/blogs/z.md', 'raw/papers/m.md'],
      updated: '2026-11-05',
    });
    expect(parsed.body).toBe('\n# 하네스란 무엇인가?\n\n첫 문장입니다. [[page-a]] [[page-b]]\n\n둘째 문장입니다. [[page-a]]\n\n위키에 없음: 세부 수치\n');
    expect(text).not.toContain('SUMMARY-NOT-IN-FILE');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('serializes hostile question text safely (YAML quoting, no wikilinks, one line)', () => {
    const q = 'a: "b" #c\n- d: [[evil]] \u2028 end\\';
    const text = renderSynthesis(input({ question: q }));
    const fm = matter(text).data;
    expect(Object.keys(fm).sort()).toEqual(['sources', 'tags', 'title', 'title_en', 'title_ko', 'type', 'updated']);
    expect(String(fm.title)).not.toMatch(/\[\[|\n/);
    expect(text.match(/^# .*$/m)?.[0]).toBe('# a: "b" #c - d: evil end\\');
    expect(parsePage(text).ok).toBe(true);
  });

  it('truncates the title to 80 code points but keeps the full heading', () => {
    const q = '가'.repeat(200);
    const text = renderSynthesis(input({ question: q }));
    const parsed = parsePage(text);
    expect(parsed.ok && [...parsed.data.title]).toHaveLength(80);
    expect(text).toContain(`# ${q}`);
  });

  it('yamlString escapes line separators', () => {
    expect(yamlString('a\u2028b\u0085')).toBe('"a\\u2028b\\u0085"');
  });

  it('422 for no sources, a bad title pair or an empty question', () => {
    expect(() => renderSynthesis(input({ sourcesOf: () => [] }))).toThrowError(expect.objectContaining({ status: 422, code: 'NO_SOURCES' }));
    expect(() => renderSynthesis(input({ answer: { ...ANSWER, sentences: [], answerable: false } }))).toThrowError(expect.objectContaining({ code: 'NO_SOURCES' }));
    expect(() => renderSynthesis(input({ answer: { ...ANSWER, title_en: '한글만' } }))).toThrowError(expect.objectContaining({ status: 422, code: 'BAD_TITLE' }));
    expect(() => renderSynthesis(input({ answer: { ...ANSWER, title_ko: 'latin only' } }))).toThrowError(expect.objectContaining({ code: 'BAD_TITLE' }));
    expect(() => renderSynthesis(input({ answer: { ...ANSWER, title_en: 'a\nb' } }))).toThrowError(expect.objectContaining({ code: 'BAD_TITLE' }));
    expect(() => renderSynthesis(input({ question: ' [[ ]] ' }))).toThrowError(expect.objectContaining({ code: 'BAD_QUESTION' }));
  });
});
