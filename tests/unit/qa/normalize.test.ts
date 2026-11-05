import { describe, expect, it } from 'vitest';
import { countSentences, normQuote } from '@/lib/qa/normalize';

describe('normQuote', () => {
  it('normalizes quotes, dashes, zero-width, markup chars, case, whitespace', () => {
    expect(normQuote('It\u2019s \u201CQuoted\u201D \u2013 a\u2014b')).toBe('it\'s "quoted" - a-b');
    expect(normQuote('a\u200Bb\uFEFFc')).toBe('abc');
    expect(normQuote('**Bold** [[Link]] `code` | cell ~x~ # h > q _u_')).toBe('bold link code cell x h q u');
    expect(normQuote('  A \n\t B  ')).toBe('a b');
  });
  it('is NFC', () => {
    expect(normQuote('\u1112\u1161\u11AB')).toBe(normQuote('\uD55C'));
  });
  it('is idempotent', () => {
    const s = 'X \u2018y\u2019 **z**';
    expect(normQuote(normQuote(s))).toBe(normQuote(s));
  });
});

describe('countSentences', () => {
  it.each([
    ['17.2배 빨라진다.', 1],
    ['Use v1.2 at https://example.com/a.b today.', 1],
    ['A. B.', 2],
    ['이것은 사실이다. 그리고 저것도 사실이다.', 2],
    ['Really? Yes!', 2],
    ['전각 문장이다。 다음 문장이다。', 2],
    ['Single sentence without period', 1],
    ['Ends with ellipsis...', 1],
    ['', 0],
  ])('%s -> %i', (text, n) => {
    expect(countSentences(text)).toBe(n);
  });
});
