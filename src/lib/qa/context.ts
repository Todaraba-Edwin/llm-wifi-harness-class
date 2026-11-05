import corpusJson from '@/generated/qa-corpus.json';
import plaintextJson from '@/generated/qa-plaintext.json';

interface CorpusPage {
  slug: string;
  title: string;
}

const NOT_CITABLE = new Set(['index', 'log']);
let memo: string | undefined;

/** Whole-wiki context: one delimited block per citable page (slug, title, full plain text). */
export function buildContext(): string {
  if (memo !== undefined) return memo;
  const plain = plaintextJson as Record<string, string>;
  const pages = (corpusJson as { pages: CorpusPage[] }).pages
    .filter((p) => !NOT_CITABLE.has(p.slug))
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  memo = pages
    .map((p) => `<<<PAGE slug=${p.slug} title=${JSON.stringify(p.title)}>>>\n${plain[p.slug] ?? ''}\n<<<END PAGE ${p.slug}>>>`)
    .join('\n\n');
  return memo;
}
