import corpusJson from '@/generated/qa-corpus.json';
import plaintextJson from '@/generated/qa-plaintext.json';
import { AnswerSchema } from './schema';
import { countSentences, normQuote } from './normalize';

export interface Corpus {
  slugs: ReadonlySet<string>;
  plaintext: Readonly<Record<string, string>>;
}

export interface ValidatedAnswer {
  answerable: boolean;
  title_en: string;
  title_ko: string;
  summary: string;
  sentences: { text: string; cites: { slug: string; quote: string }[] }[];
  notCovered: string[];
}

export type ValidationReason =
  | 'schema'
  | 'answerable_with_sentences'
  | 'answerable_without_sentences'
  | 'bad_title'
  | 'bad_summary'
  | 'bad_sentence'
  | 'multi_sentence'
  | 'cite_count'
  | 'unknown_slug'
  | 'bad_quote'
  | 'quote_not_found'
  | 'bad_not_covered';

export type ValidationResult =
  | { ok: true; answer: ValidatedAnswer }
  | { ok: false; reason: ValidationReason };

const NOT_CITABLE = new Set(['index', 'log']);
const NEWLINE_RE = /[\r\n\u0085\u2028\u2029]/;
const TITLE_MAX = 120;
const SUMMARY_MAX = 140;
const NOT_COVERED_MAX = 120;
const NOT_COVERED_ITEMS = 3;
const MAX_CITES = 3;
const QUOTE_MIN = 8;
const QUOTE_MAX = 300;

let memo: Corpus | undefined;

export function loadCorpus(): Corpus {
  if (memo) return memo;
  const slugs = new Set(
    (corpusJson as { pages: { slug: string }[] }).pages.map((p) => p.slug).filter((s) => !NOT_CITABLE.has(s)),
  );
  const plaintext: Record<string, string> = {};
  for (const [slug, text] of Object.entries(plaintextJson as Record<string, string>)) {
    if (slugs.has(slug)) plaintext[slug] = text;
  }
  memo = { slugs, plaintext };
  return memo;
}

const len = (s: string): number => [...s].length;
const fail = (reason: ValidationReason): ValidationResult => ({ ok: false, reason });

function oneLine(s: string, max: number): boolean {
  return s !== '' && !NEWLINE_RE.test(s) && !s.includes('[[') && !s.includes(']]') && len(s) <= max;
}

export function validateAnswer(raw: unknown, corpus?: Corpus): ValidationResult {
  try {
    const parsed = AnswerSchema.safeParse(raw);
    if (!parsed.success) return fail('schema');
    const a = parsed.data;
    const c = corpus ?? loadCorpus();

    const title_en = a.title_en.trim();
    const title_ko = a.title_ko.trim();
    if (!oneLine(title_en, TITLE_MAX) || !/[A-Za-z]/.test(title_en)) return fail('bad_title');
    if (!oneLine(title_ko, TITLE_MAX) || !/[\uAC00-\uD7A3]/.test(title_ko)) return fail('bad_title');
    const summary = a.summary.trim();
    if (!oneLine(summary, SUMMARY_MAX)) return fail('bad_summary');

    if (!a.answerable && a.sentences.length > 0) return fail('answerable_with_sentences');
    if (a.answerable && a.sentences.length === 0) return fail('answerable_without_sentences');

    const sentences: ValidatedAnswer['sentences'] = [];
    for (const s of a.sentences) {
      const text = s.text.trim();
      if (text === '' || NEWLINE_RE.test(text) || text.includes('[[') || text.includes(']]')) {
        return fail('bad_sentence');
      }
      if (countSentences(text) !== 1) return fail('multi_sentence');
      if (s.cites.length < 1 || s.cites.length > MAX_CITES) return fail('cite_count');
      for (const cite of s.cites) {
        if (NOT_CITABLE.has(cite.slug) || !c.slugs.has(cite.slug)) return fail('unknown_slug');
        const q = normQuote(cite.quote);
        const n = len(q);
        if (n < QUOTE_MIN || n > QUOTE_MAX) return fail('bad_quote');
        const page = c.plaintext[cite.slug];
        if (page === undefined || !normQuote(page).includes(q)) return fail('quote_not_found');
      }
      sentences.push({ text, cites: s.cites.map((x) => ({ slug: x.slug, quote: x.quote })) });
    }

    if (a.notCovered.length > NOT_COVERED_ITEMS) return fail('bad_not_covered');
    const notCovered: string[] = [];
    for (const item of a.notCovered) {
      const t = item.trim();
      if (!oneLine(t, NOT_COVERED_MAX) || countSentences(t) !== 1) return fail('bad_not_covered');
      notCovered.push(t);
    }

    return { ok: true, answer: { answerable: a.answerable, title_en, title_ko, summary, sentences, notCovered } };
  } catch {
    return fail('schema');
  }
}
