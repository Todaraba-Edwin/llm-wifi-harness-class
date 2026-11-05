import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSearchIndex, searchPages } from '@/lib/search/search';
import { allowsPrefix, tokenize } from '@/lib/search/tokenizer';
import { REPO } from './helpers';

const ms = loadSearchIndex(fs.readFileSync(path.join(REPO, 'src/generated/search-index.json'), 'utf8'));
const ids = (q: string) => searchPages(ms, q).map((h) => h.id);

describe('tokenizer', () => {
  it('NFC-normalizes, lowercases, keeps ASCII whole and makes Hangul bigrams', () => {
    expect(tokenize('Agent-Harness v2')).toEqual(['agent', 'harness', 'v2']);
    expect(tokenize('하네스를')).toEqual(['하네', '네스', '스를']);
    expect(tokenize('툴')).toEqual(['툴']);
    expect(tokenize('LLM하네스')).toEqual(['llm', '하네', '네스']);
    expect(tokenize('\u1112\u1161\u1102\u1166')).toEqual(['하네']);
  });
  it('prefix only for ASCII or single-character terms', () => {
    expect(allowsPrefix('compac')).toBe(true);
    expect(allowsPrefix('툴')).toBe(true);
    expect(allowsPrefix('하네')).toBe(false);
  });
});

describe('search over the real index', () => {
  it('title match ranks first', () => {
    expect(ids('Agent harness')[0]).toBe('agent-harness');
  });
  it('body-only Korean query finds pages', () => {
    expect(ids('컨텍스트').length).toBeGreaterThan(0);
  });
  it('English body term', () => {
    expect(ids('compaction')).toContain('context-resets-vs-compaction');
  });
  it('tag match', () => {
    expect(ids('jobs')).toEqual(expect.arrayContaining(['src-job-postings', 'harness-job-requirements']));
  });
  it('Korean particle query matches the stem', () => {
    expect(ids('하네스를').length).toBeGreaterThan(0);
    expect(ids('하네스를')).toEqual(expect.arrayContaining(ids('하네스').slice(0, 1)));
  });
  it('AND across words; empty and nonsense queries return nothing', () => {
    expect(ids('compaction nonexistentwordzz')).toEqual([]);
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
    expect(ids('zzzqqqxxyy')).toEqual([]);
  });
  it('ASCII prefix match', () => {
    expect(ids('compac')).toContain('context-resets-vs-compaction');
  });
});
