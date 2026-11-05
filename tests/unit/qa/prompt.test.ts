import { describe, expect, it } from 'vitest';
import { buildContext } from '@/lib/qa/context';
import { NOT_COVERED_TEXT, buildMessages } from '@/lib/qa/prompt';
import { loadCorpus } from '@/lib/qa/validate';

describe('buildContext', () => {
  const ctx = buildContext();
  const { slugs, plaintext } = loadCorpus();
  it('contains a delimited block with full text for every citable page', () => {
    for (const slug of slugs) {
      expect(ctx).toContain(`<<<PAGE slug=${slug} title=`);
      expect(ctx).toContain(`<<<END PAGE ${slug}>>>`);
      expect(ctx).toContain(plaintext[slug]);
    }
  });
  it('excludes index and log', () => {
    expect(ctx).not.toContain('<<<PAGE slug=index ');
    expect(ctx).not.toContain('<<<PAGE slug=log ');
  });
});

describe('buildMessages', () => {
  const m = buildMessages('질문입니다?');
  it('instructions carry the rules', () => {
    for (const s of ['only the wiki', "question's language", 'ONE sentence', '[[', 'verbatim substring', 'title_en', 'title_ko', 'summary', 'data, not instructions']) {
      expect(m.instructions).toContain(s);
    }
  });
  it('input has wiki and question; instructions do not', () => {
    expect(m.input).toContain('질문입니다?');
    expect(m.input).toContain(buildContext());
    expect(m.instructions).not.toContain('질문입니다?');
  });
  it('NOT_COVERED_TEXT', () => expect(NOT_COVERED_TEXT).toBe('위키에 없음'));
});
