import MiniSearch, { type SearchResult } from 'minisearch';
import { allowsPrefix, tokenize, words, wordTerms } from './tokenizer';

export interface SearchDoc {
  id: string;
  title: string;
  type: string;
  tags: string;
  body: string;
  summary: string;
}

export const MINISEARCH_OPTIONS = {
  fields: ['title', 'tags', 'body'],
  storeFields: ['title', 'type', 'summary'],
  tokenize,
  processTerm: (t: string) => t,
  searchOptions: { boost: { title: 3, tags: 2, body: 1 } },
};

export function buildSearchIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const ms = new MiniSearch<SearchDoc>(MINISEARCH_OPTIONS);
  ms.addAll(docs);
  return ms;
}

export function loadSearchIndex(json: string): MiniSearch<SearchDoc> {
  return MiniSearch.loadJSON<SearchDoc>(json, MINISEARCH_OPTIONS);
}

export interface Hit {
  id: string;
  title: string;
  type: string;
  summary: string;
  score: number;
}

/**
 * AND over query words; each word is an OR of its terms (Hangul bigrams, whole ASCII tokens with prefix).
 */
export function searchPages(ms: MiniSearch<SearchDoc>, query: string, limit = 50): Hit[] {
  const qwords = words(query);
  if (qwords.length === 0) return [];
  let acc: Map<string, { r: SearchResult; score: number }> | null = null;
  for (const w of qwords) {
    const terms = wordTerms(w);
    const res = ms.search(terms.join(' '), {
      combineWith: 'OR',
      prefix: (t: string) => allowsPrefix(t),
      boost: { title: 3, tags: 2, body: 1 },
    });
    const m = new Map(res.map((r) => [r.id as string, { r, score: r.score }]));
    if (acc === null) acc = m;
    else {
      const next = new Map<string, { r: SearchResult; score: number }>();
      for (const [id, v] of acc) {
        const o = m.get(id);
        if (o) next.set(id, { r: v.r, score: v.score + o.score });
      }
      acc = next;
    }
  }
  // Title phrase matches outrank scattered body matches.
  const phrase = qwords.join(' ');
  const bonus = (title: string): number => {
    const tw = words(title);
    if (tw.join(' ') === phrase) return 2000;
    if (tw.join(' ').includes(phrase)) return 1000;
    return qwords.every((w) => tw.includes(w)) ? 100 : 0;
  };
  return [...(acc ?? new Map()).values()]
    .map((v) => ({ ...v, score: v.score + bonus(v.r.title as string) }))
    .sort((a, b) => b.score - a.score || String(a.r.id).localeCompare(String(b.r.id)))
    .slice(0, limit)
    .map(({ r, score }) => ({
      id: r.id as string,
      title: r.title as string,
      type: r.type as string,
      summary: r.summary as string,
      score,
    }));
}
