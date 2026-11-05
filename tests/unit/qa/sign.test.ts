import { describe, expect, it } from 'vitest';
import { signAnswer, verifyAnswerSignature, type SignedPayload } from '@/lib/qa/sign';
import type { ValidatedAnswer } from '@/lib/qa/validate';

const answer: ValidatedAnswer = {
  answerable: true,
  title_en: 'Harness design',
  title_ko: '하네스 설계',
  summary: '요약',
  sentences: [{ text: '문장입니다.', cites: [{ slug: 'a', quote: 'quote one' }] }],
  notCovered: ['x'],
};
const SECRET = 'secret-0123456789abcdef0123456789abcdef';
const NOW = Date.parse('2026-11-05T12:00:00+09:00');
const DAY = 24 * 60 * 60 * 1000;
const payload: SignedPayload = { question: '하네스란 무엇인가?', answer, iat: NOW };

describe('answer signature', () => {
  it('verifies and is stable under key order', () => {
    const sig = signAnswer(payload, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyAnswerSignature(payload, sig, SECRET, NOW)).toBe(true);
    const reordered = { notCovered: answer.notCovered, sentences: answer.sentences, summary: answer.summary, title_ko: answer.title_ko, title_en: answer.title_en, answerable: true } as ValidatedAnswer;
    expect(signAnswer({ iat: NOW, answer: reordered, question: payload.question }, SECRET)).toBe(sig);
  });
  it('rejects a wrong secret and a malformed signature', () => {
    const sig = signAnswer(payload, SECRET);
    expect(verifyAnswerSignature(payload, sig, 'other-secret', NOW)).toBe(false);
    expect(verifyAnswerSignature(payload, 'zz', SECRET, NOW)).toBe(false);
    expect(verifyAnswerSignature(payload, '', SECRET, NOW)).toBe(false);
  });
  it.each<[string, (a: ValidatedAnswer) => ValidatedAnswer]>([
    ['answerable', (a) => ({ ...a, answerable: false })],
    ['title_en', (a) => ({ ...a, title_en: 'Other' })],
    ['title_ko', (a) => ({ ...a, title_ko: '다른' })],
    ['summary', (a) => ({ ...a, summary: 'x' })],
    ['sentence text', (a) => ({ ...a, sentences: [{ ...a.sentences[0], text: '변조.' }] })],
    ['cite slug', (a) => ({ ...a, sentences: [{ ...a.sentences[0], cites: [{ slug: 'b', quote: 'quote one' }] }] })],
    ['cite quote', (a) => ({ ...a, sentences: [{ ...a.sentences[0], cites: [{ slug: 'a', quote: 'quote two' }] }] })],
    ['extra sentence', (a) => ({ ...a, sentences: [...a.sentences, a.sentences[0]] })],
    ['notCovered', (a) => ({ ...a, notCovered: [] })],
  ])('tampering %s invalidates the signature', (_n, mutate) => {
    const sig = signAnswer(payload, SECRET);
    expect(verifyAnswerSignature({ ...payload, answer: mutate(answer) }, sig, SECRET, NOW)).toBe(false);
  });
  it('tampering the question or iat invalidates the signature', () => {
    const sig = signAnswer(payload, SECRET);
    expect(verifyAnswerSignature({ ...payload, question: '다른 질문' }, sig, SECRET, NOW)).toBe(false);
    expect(verifyAnswerSignature({ ...payload, iat: NOW + 1 }, sig, SECRET, NOW + 1)).toBe(false);
  });
  it('accepts up to 7 days of age and rejects older', () => {
    const sig = signAnswer(payload, SECRET);
    expect(verifyAnswerSignature(payload, sig, SECRET, NOW + 7 * DAY)).toBe(true);
    expect(verifyAnswerSignature(payload, sig, SECRET, NOW + 7 * DAY + 1)).toBe(false);
  });
  it('rejects an iat in the future beyond 5 minutes of skew', () => {
    const future = { ...payload, iat: NOW + 5 * 60 * 1000 };
    expect(verifyAnswerSignature(future, signAnswer(future, SECRET), SECRET, NOW)).toBe(true);
    const tooFar = { ...payload, iat: NOW + 5 * 60 * 1000 + 1 };
    expect(verifyAnswerSignature(tooFar, signAnswer(tooFar, SECRET), SECRET, NOW)).toBe(false);
  });
});
