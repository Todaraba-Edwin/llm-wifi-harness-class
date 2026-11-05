const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const SENTENCE_BOUNDARY_RE = /[.!?。！？]+(?:\s+|$)/;

/**
 * Normalization applied identically to the corpus plain text and to a quote
 * before the substring check.
 */
export function normQuote(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(ZERO_WIDTH_RE, '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/[*_`|~#>]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Number of non-empty segments after splitting on [.!?。！？] followed by whitespace or end. */
export function countSentences(text: string): number {
  return text.trim().split(SENTENCE_BOUNDARY_RE).filter((seg) => seg.trim() !== '').length;
}
