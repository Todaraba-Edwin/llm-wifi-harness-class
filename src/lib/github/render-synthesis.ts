import { checkPairFormat } from '@/lib/content/display-titles';
import { NOT_COVERED_TEXT } from '@/lib/qa/prompt';
import type { ValidatedAnswer } from '@/lib/qa/validate';
import { oneLine, SaveError, truncate } from './index-log';

/** YAML double-quoted scalar. JSON string syntax is valid YAML; the line separators JSON leaves raw are escaped too. */
export function yamlString(s: string): string {
  return JSON.stringify(s).replace(/[\u0085\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export interface RenderInput {
  question: string;
  answer: ValidatedAnswer;
  /** YYYY-MM-DD in KST. */
  today: string;
  /** Frontmatter `sources` of a deployed page, or undefined when the page is unknown. */
  sourcesOf(slug: string): readonly string[] | undefined;
}

/** Slugs cited by the answer, in first-use order. */
export function citedSlugs(answer: ValidatedAnswer): string[] {
  return [...new Set(answer.sentences.flatMap((s) => s.cites.map((c) => c.slug)))];
}

/** The `wiki/syntheses/<slug>.md` file text. Throws SaveError(422) for a bad title pair, an empty question or no sources. */
export function renderSynthesis(input: RenderInput): string {
  const { answer } = input;
  const question = oneLine(input.question);
  if (question === '') throw new SaveError(422, 'BAD_QUESTION');
  if (checkPairFormat({ en: answer.title_en, ko: answer.title_ko }).length > 0) throw new SaveError(422, 'BAD_TITLE');

  const sources = [...new Set(citedSlugs(answer).flatMap((slug) => input.sourcesOf(slug) ?? []))].sort();
  if (sources.length === 0) throw new SaveError(422, 'NO_SOURCES');

  const lines = [
    '---',
    `title: ${yamlString(truncate(question, 80))}`,
    `title_en: ${yamlString(answer.title_en)}`,
    `title_ko: ${yamlString(answer.title_ko)}`,
    'type: synthesis',
    'tags: [query]',
    `sources: [${sources.map(yamlString).join(', ')}]`,
    `updated: ${input.today}`,
    '---',
    '',
    `# ${question}`,
    '',
  ];
  for (const s of answer.sentences) {
    const links = [...new Set(s.cites.map((c) => c.slug))].map((slug) => `[[${slug}]]`);
    lines.push(`${s.text} ${links.join(' ')}`, '');
  }
  for (const item of answer.notCovered) lines.push(`${NOT_COVERED_TEXT}: ${item}`, '');
  return `${lines.join('\n').trimEnd()}\n`;
}
