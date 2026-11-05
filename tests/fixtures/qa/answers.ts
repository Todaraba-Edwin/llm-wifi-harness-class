import { loadCorpus, type Corpus } from '@/lib/qa/validate';

/** Verbatim slice of a real page's plain text (programmatic, so it tracks the corpus). */
export function realQuote(slug: string, start = 0, length = 40): string {
  return loadCorpus().plaintext[slug].slice(start, start + length);
}

export function realSlugs(n: number): string[] {
  return [...loadCorpus().slugs].sort().slice(0, n);
}

export function validAnswer(): any {
  const [a] = realSlugs(1);
  return {
    answerable: true,
    title_en: 'Harness overview',
    title_ko: '하네스 개요',
    summary: 'A one-line summary.',
    sentences: [{ text: 'The wiki says this once.', cites: [{ slug: a, quote: realQuote(a) }] }],
    notCovered: [],
  };
}

export type Adversarial = { name: string; reason: string; answer: any };

export function adversarialCases(): Adversarial[] {
  const [a, b] = realSlugs(2);
  const qa = { slug: a, quote: realQuote(a) };
  const mk = (patch: Record<string, unknown>) => ({ ...validAnswer(), ...patch });
  const sent = (text: string, cites: unknown[] = [qa]) => [{ text, cites }];
  // a quote that exists in page b but not in page a
  const foreign = [...Array(2000).keys()]
    .map((i) => realQuote(b, i * 20, 40))
    .find((q) => q.trim().length >= 20 && !loadCorpusNorm(a).includes(norm(q)))!;
  return [
    { name: '1 two sentences one cite', reason: 'multi_sentence', answer: mk({ sentences: sent('First claim. Second claim.') }) },
    { name: '2 korean two sentences', reason: 'multi_sentence', answer: mk({ sentences: sent('이것은 사실이다. 그리고 저것도 사실이다.') }) },
    { name: '3 trailing item without cites', reason: 'cite_count', answer: mk({ sentences: [...sent('Cited claim.'), { text: 'Uncited tail.', cites: [] }] }) },
    { name: '4 uncited sentence packed in cited item', reason: 'multi_sentence', answer: mk({ sentences: sent('Cited claim! Packed uncited claim.') }) },
    { name: '5 newline in text', reason: 'bad_sentence', answer: mk({ sentences: sent('Line one\nline two.') }) },
    { name: '6a slug index', reason: 'unknown_slug', answer: mk({ sentences: sent('Claim.', [{ slug: 'index', quote: qa.quote }]) }) },
    { name: '6b slug log', reason: 'unknown_slug', answer: mk({ sentences: sent('Claim.', [{ slug: 'log', quote: qa.quote }]) }) },
    { name: '6c unknown slug', reason: 'unknown_slug', answer: mk({ sentences: sent('Claim.', [{ slug: 'no-such-page', quote: qa.quote }]) }) },
    { name: '7 quote from different page', reason: 'quote_not_found', answer: mk({ sentences: sent('Claim.', [{ slug: a, quote: foreign }]) }) },
    { name: '8 quote shorter than 8', reason: 'bad_quote', answer: mk({ sentences: sent('Claim.', [{ slug: a, quote: realQuote(a, 0, 7) }]) }) },
    { name: '9 answerable=false with sentences', reason: 'answerable_with_sentences', answer: mk({ answerable: false }) },
    { name: '10 answerable=true without sentences', reason: 'answerable_without_sentences', answer: mk({ sentences: [] }) },
    { name: '11 inline wikilink', reason: 'bad_sentence', answer: mk({ sentences: sent('See [[fake]] for this.') }) },
    { name: '12a notCovered two sentences', reason: 'bad_not_covered', answer: mk({ notCovered: ['One part. Another part.'] }) },
    { name: '12b notCovered with cite', reason: 'schema', answer: mk({ notCovered: [{ text: 'x', cites: [qa] }] }) },
    { name: '13 four cites', reason: 'cite_count', answer: mk({ sentences: sent('Claim.', [qa, qa, qa, qa]) }) },
  ];
}

import { normQuote } from '@/lib/qa/normalize';
const norm = normQuote;
function loadCorpusNorm(slug: string): string {
  return norm(loadCorpus().plaintext[slug]);
}

export function syntheticCorpus(pages: Record<string, string>): Corpus {
  return { slugs: new Set(Object.keys(pages)), plaintext: pages };
}
