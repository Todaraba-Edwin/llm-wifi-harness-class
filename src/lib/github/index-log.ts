/** A save failure with a fixed, content-free code. The message is the code; no user text ever enters it. */
export class SaveError extends Error {
  constructor(
    readonly status: 409 | 422 | 502,
    readonly code: string,
  ) {
    super(code);
    this.name = 'SaveError';
  }
}

const NEWLINE_RUN = /[\r\n\u0085\u2028\u2029]+/g;

/** Truncates to `max` code points; a truncated value ends with '…' and is `max` code points long (`ellipsisExtra` appends the '…' beyond `max`). */
export function truncate(s: string, max: number, ellipsisExtra = false): string {
  const cps = [...s];
  if (cps.length <= max) return s;
  return ellipsisExtra ? `${cps.slice(0, max).join('')}…` : `${cps.slice(0, max - 1).join('')}…`;
}

/** One trimmed line without wikilink brackets, so user text can never create or break a wikilink. */
export function oneLine(s: string): string {
  return s.replace(NEWLINE_RUN, ' ').replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim();
}

const ENTRY_RE = /^- \[\[([^\]\n]+)\]\][^\n]*$/gm;

/**
 * Inserts `- [[slug]]: summary` into the `## Syntheses` section in ascending slug order.
 * Every other byte is unchanged; the inserted entry ends with exactly one newline.
 */
export function insertIndexEntry(index: string, slug: string, summary: string): string {
  const heading = /^## Syntheses[^\n]*/m.exec(index);
  if (!heading) throw new SaveError(422, 'NO_SYNTHESES_SECTION');
  const headingEnd = heading.index + heading[0].length;
  const next = /\n## /.exec(index.slice(headingEnd));
  const sectionEnd = next ? headingEnd + next.index + 1 : index.length;
  const section = index.slice(headingEnd, sectionEnd);
  const entry = `- [[${slug}]]: ${summary}`;

  let insertAt = -1;
  let lastEnd = -1;
  for (const m of section.matchAll(ENTRY_RE)) {
    const start = headingEnd + (m.index ?? 0);
    if (m[1] > slug) {
      insertAt = start;
      break;
    }
    lastEnd = start + m[0].length;
  }
  if (insertAt >= 0) return `${index.slice(0, insertAt)}${entry}\n${index.slice(insertAt)}`;
  if (lastEnd >= 0) {
    if (lastEnd >= index.length) return `${index}\n${entry}\n`;
    // lastEnd points at the item's newline; the entry goes on the next line.
    return `${index.slice(0, lastEnd + 1)}${entry}\n${index.slice(lastEnd + 1)}`;
  }
  // Empty section: heading, blank line, entry.
  const rest = index.slice(headingEnd);
  return `${index.slice(0, headingEnd)}\n\n${entry}${rest === '' ? '\n' : rest}`;
}

/** Appends a query record at EOF; existing bytes are unchanged. */
export function appendLog(log: string, date: string, question: string, slug: string): string {
  const base = log.endsWith('\n') ? log : `${log}\n`;
  const q = truncate(oneLine(question), 120);
  return `${base}\n## [${date}] query | ${q}\n- 생성: ${slug}\n`;
}
