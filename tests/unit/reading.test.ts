import { describe, expect, it } from 'vitest';
import { readingPosition, splitLeadingTitle } from '@/lib/reading';

const titles = { a: 'Alpha post', b: 'Beta post', c: 'Gamma' };
const steps = [
  { n: 1, text: 'Alpha post: first step.', slugs: ['a'] },
  { n: 2, text: 'No page here', slugs: [] },
  { n: 3, text: 'Beta post: second.', slugs: ['b'] },
  { n: 4, text: 'Other text with chip', slugs: ['c'] },
];

describe('splitLeadingTitle', () => {
  it('splits when the text starts with the page title and a colon', () => {
    expect(splitLeadingTitle(steps[0], titles)).toEqual({ slug: 'a', title: 'Alpha post', rest: 'first step.' });
  });
  it('splits when the text ends with the page title (description first)', () => {
    expect(splitLeadingTitle({ n: 9, text: 'Papers: a -> b. Gamma', slugs: ['c'] }, titles)).toEqual({ slug: 'c', title: 'Gamma', rest: 'Papers: a -> b' });
    expect(splitLeadingTitle({ n: 9, text: 'Do the checklist: Gamma', slugs: ['c'] }, titles)?.rest).toBe('Do the checklist');
  });
  it('returns null otherwise', () => {
    expect(splitLeadingTitle({ n: 9, text: 'Gamma', slugs: ['c'] }, titles)).toBeNull();
    expect(splitLeadingTitle(steps[3], titles)).toBeNull();
    expect(splitLeadingTitle(steps[1], titles)).toBeNull();
  });
});

describe('readingPosition', () => {
  it('finds neighbors and skips steps without a page', () => {
    const p = readingPosition(steps, 'b')!;
    expect(p.prev?.n).toBe(1);
    expect(p.next?.n).toBe(4);
    expect(p.total).toBe(4);
  });
  it('has no prev at the start and no next at the end; null for pages outside the order', () => {
    expect(readingPosition(steps, 'a')!.prev).toBeNull();
    expect(readingPosition(steps, 'c')!.next).toBeNull();
    expect(readingPosition(steps, 'zzz')).toBeNull();
  });
});
