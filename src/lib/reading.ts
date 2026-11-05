export interface ReadingStepLike {
  n: number;
  text: string;
  slugs: string[];
}

export interface StepTitle {
  /** Leading page title that the step text starts with, rendered as a link. */
  slug: string;
  title: string;
  /** Text after "<title>: ". */
  rest: string;
}

/**
 * Splits a step into the page title (rendered as the link) and its description. The title is either the text prefix
 * ("<title>: <description>") or the text suffix ("<description>: <title>"). Null when neither matches.
 */
export function splitLeadingTitle(step: ReadingStepLike, titles: Record<string, string>): StepTitle | null {
  for (const slug of step.slugs) {
    const title = titles[slug];
    if (!title) continue;
    if (step.text.startsWith(`${title}: `)) return { slug, title, rest: step.text.slice(title.length + 2) };
    if (step.text.endsWith(title) && step.text.length > title.length) {
      const rest = step.text.slice(0, -title.length).replace(/[\s:.]+$/, '');
      if (rest !== '') return { slug, title, rest };
    }
  }
  return null;
}

export interface ReadingPosition {
  step: ReadingStepLike;
  prev: ReadingStepLike | null;
  next: ReadingStepLike | null;
  total: number;
}

/** Position of a wiki page in the reading order (first step that lists it), with the neighboring steps that have a page to open. */
export function readingPosition(steps: ReadingStepLike[], slug: string): ReadingPosition | null {
  const i = steps.findIndex((s) => s.slugs.includes(slug));
  if (i === -1) return null;
  const openable = (s: ReadingStepLike | undefined) => (s && s.slugs.length > 0 ? s : null);
  let prev: ReadingStepLike | null = null;
  for (let j = i - 1; j >= 0 && !prev; j--) prev = openable(steps[j]);
  let next: ReadingStepLike | null = null;
  for (let j = i + 1; j < steps.length && !next; j++) next = openable(steps[j]);
  return { step: steps[i], prev, next, total: steps.length };
}
