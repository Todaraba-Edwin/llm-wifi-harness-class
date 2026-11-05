import { describe, expect, it } from 'vitest';
import { loadCorpus, validateAnswer } from '@/lib/qa/validate';
import { adversarialCases, realQuote, realSlugs, syntheticCorpus, validAnswer } from '../../fixtures/qa/answers';

const base = (over: Record<string, unknown>) => ({ ...validAnswer(), ...over });

describe('loadCorpus', () => {
  it('is memoized and excludes index/log', () => {
    const c = loadCorpus();
    expect(loadCorpus()).toBe(c);
    expect(c.slugs.size).toBeGreaterThan(30);
    expect(c.slugs.has('index')).toBe(false);
    expect(c.slugs.has('log')).toBe(false);
  });
});

describe('adversarial fixtures (real corpus)', () => {
  for (const c of adversarialCases()) {
    it(`rejects ${c.name} with ${c.reason}`, () => {
      expect(validateAnswer(c.answer)).toEqual({ ok: false, reason: c.reason });
    });
  }
  it('unparseable input never throws', () => {
    for (const x of [null, undefined, 1, 'x', [], {}, { answerable: true }]) {
      expect(validateAnswer(x)).toEqual({ ok: false, reason: 'schema' });
    }
  });
});

describe('must-pass (real corpus)', () => {
  it('accepts a verbatim real quote and trims text', () => {
    const [a] = realSlugs(1);
    const r = validateAnswer(base({ sentences: [{ text: '  Claim here.  ', cites: [{ slug: a, quote: realQuote(a) }] }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answer.sentences[0].text).toBe('Claim here.');
  });
  it('accepts quotes from every real page and 3 cites', () => {
    for (const slug of loadCorpus().slugs) {
      const q = realQuote(slug, 0, 60);
      if ([...q.trim()].length < 8) continue;
      expect(validateAnswer(base({ sentences: [{ text: 'Claim.', cites: [{ slug, quote: q }] }] })).ok).toBe(true);
    }
    const [a, b, c] = realSlugs(3);
    const cites = [a, b, c].map((slug) => ({ slug, quote: realQuote(slug) }));
    expect(validateAnswer(base({ sentences: [{ text: 'Claim.', cites }] })).ok).toBe(true);
  });
  it('accepts 17.2배 and partial answers', () => {
    const [a] = realSlugs(1);
    const r = validateAnswer(
      base({ sentences: [{ text: '속도가 17.2배 빨라졌다.', cites: [{ slug: a, quote: realQuote(a) }] }], notCovered: ['가격 정보'] }),
    );
    expect(r.ok).toBe(true);
  });
  it('accepts answerable=false', () => {
    const r = validateAnswer(base({ answerable: false, sentences: [], notCovered: [] }));
    expect(r).toMatchObject({ ok: true, answer: { answerable: false, sentences: [] } });
  });
});

describe('must-pass (synthetic corpus)', () => {
  const corpus = syntheticCorpus({
    p: 'The model\u2019s speed rose 17.2배 overall. 전각 문장입니다！ Bold text here and a link target title. Name Value row cell. run `npm test` now',
    q: 'Totally different content lives on this page.',
  });
  const ask = (quote: string, slug = 'p') =>
    validateAnswer(base({ sentences: [{ text: 'Claim.', cites: [{ slug, quote }] }] }), corpus);
  it.each([
    ['bold markers', '**Bold** text here and'],
    ['wikilink span', 'here and a [[link target]] title'.replace('link target', 'link target')],
    ['table cell', '| Name | Value | row cell'],
    ['inline code', 'run npm test now'],
    ['curly vs straight apostrophe', "The model's speed rose"],
    ['curly in quote', 'The model\u2019s speed rose'],
    ['full-width punctuation', '전각 문장입니다！'],
    ['case and whitespace', 'BOLD   TEXT\nHERE'],
  ])('%s', (_n, quote) => {
    expect(ask(quote)).toMatchObject({ ok: true });
  });
  it('rejects quote of 7 and 301 code points, accepts 8 and 300', () => {
    const long = 'a'.repeat(400);
    const c2 = syntheticCorpus({ p: long });
    const run = (n: number) => validateAnswer(base({ sentences: [{ text: 'x.', cites: [{ slug: 'p', quote: 'a'.repeat(n) }] }] }), c2);
    expect(run(7)).toEqual({ ok: false, reason: 'bad_quote' });
    expect(run(8).ok).toBe(true);
    expect(run(300).ok).toBe(true);
    expect(run(301)).toEqual({ ok: false, reason: 'bad_quote' });
  });
  it('rejects a quote from a different page', () => {
    expect(ask('Totally different content')).toEqual({ ok: false, reason: 'quote_not_found' });
  });
});

describe('titles, summary, notCovered limits', () => {
  const r = (patch: Record<string, unknown>) => validateAnswer(base(patch));
  it('title rules', () => {
    expect(r({ title_en: '하네스' })).toEqual({ ok: false, reason: 'bad_title' });
    expect(r({ title_ko: 'Harness' })).toEqual({ ok: false, reason: 'bad_title' });
    expect(r({ title_en: 'A\nB' })).toEqual({ ok: false, reason: 'bad_title' });
    expect(r({ title_ko: '한'.repeat(121) })).toEqual({ ok: false, reason: 'bad_title' });
    expect(r({ title_en: '' })).toEqual({ ok: false, reason: 'bad_title' });
  });
  it('summary rules', () => {
    expect(r({ summary: 'x'.repeat(141) })).toEqual({ ok: false, reason: 'bad_summary' });
    expect(r({ summary: 'x'.repeat(140) }).ok).toBe(true);
    expect(r({ summary: 'a\nb' })).toEqual({ ok: false, reason: 'bad_summary' });
    expect(r({ summary: 'see [[x]]' })).toEqual({ ok: false, reason: 'bad_summary' });
  });
  it('notCovered rules', () => {
    expect(r({ notCovered: ['a', 'b', 'c'] }).ok).toBe(true);
    expect(r({ notCovered: ['a', 'b', 'c', 'd'] })).toEqual({ ok: false, reason: 'bad_not_covered' });
    expect(r({ notCovered: ['x'.repeat(121)] })).toEqual({ ok: false, reason: 'bad_not_covered' });
    expect(r({ notCovered: ['a\nb'] })).toEqual({ ok: false, reason: 'bad_not_covered' });
    expect(r({ notCovered: ['see [[x]]'] })).toEqual({ ok: false, reason: 'bad_not_covered' });
    expect(r({ notCovered: [''] })).toEqual({ ok: false, reason: 'bad_not_covered' });
  });
});
