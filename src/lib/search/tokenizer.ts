// Korean-aware tokenizer: NFC, lowercase, split on anything that is not a letter or number.
// ASCII/other runs stay whole (prefix-searchable); Hangul runs become bigrams, a 1-char run a unigram.
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

export function words(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function runs(word: string): { hangul: boolean; text: string }[] {
  const out: { hangul: boolean; text: string }[] = [];
  for (const ch of word) {
    const h = HANGUL.test(ch);
    const last = out.at(-1);
    if (last && last.hangul === h) last.text += ch;
    else out.push({ hangul: h, text: ch });
  }
  return out;
}

export function wordTerms(word: string): string[] {
  const terms: string[] = [];
  for (const r of runs(word)) {
    if (!r.hangul) {
      terms.push(r.text);
      continue;
    }
    const chars = [...r.text];
    if (chars.length === 1) terms.push(chars[0]);
    else for (let i = 0; i < chars.length - 1; i++) terms.push(chars[i] + chars[i + 1]);
  }
  return terms;
}

export function tokenize(text: string): string[] {
  return words(text).flatMap(wordTerms);
}

/** True when the term is plain ASCII/Latin (prefix matching allowed) or a single character. */
export function allowsPrefix(term: string): boolean {
  return [...term].length === 1 || !HANGUL.test(term);
}
