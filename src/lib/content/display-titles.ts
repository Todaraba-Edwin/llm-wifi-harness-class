// Bilingual "English (한글)" display titles for the sidebar and drawer.
//
// Source order per page: (1) the optional frontmatter pair `title_en` / `title_ko`, (2) this curated map for the
// pages that existed before the pair field. `wiki/` is read-only for site code, so the map covers those pages.
// A page with neither (or with both) is a build error: there is no silent fallback to the plain title.

export interface TitlePair {
  en: string;
  ko: string;
}

/** Curated pairs for the 39 pages that predate frontmatter pairs. `index` and `log` are intentionally absent. */
export const DISPLAY_TITLE_MAP: Record<string, TitlePair> = {
  'agent-harness': { en: 'Agent harness', ko: '에이전트 하네스' },
  'agent-legibility': { en: 'Agent legibility', ko: '에이전트 가독성' },
  'brain-hands-session-decoupling': { en: 'Brain / hands / session decoupling', ko: '두뇌·손·세션 분리' },
  'claude-agent-sdk': { en: 'Claude Agent SDK', ko: '클로드 에이전트 SDK' },
  'claude-managed-agents': { en: 'Claude Managed Agents', ko: '클로드 매니지드 에이전트' },
  'context-resets-vs-compaction': { en: 'Context reset vs compaction', ko: '컨텍스트 리셋과 압축 비교' },
  'contradictions-and-tensions': { en: 'Contradictions and tensions', ko: '모순과 긴장 지점' },
  'deterministic-execution-constraints': { en: 'Deterministic execution constraints', ko: '결정적 실행 제약' },
  'entropy-and-garbage-collection': { en: 'Entropy and garbage collection for agent codebases', ko: '에이전트 코드베이스의 엔트로피와 가비지 컬렉션' },
  'gaps-and-todo': { en: 'Gaps and follow-ups', ko: '공백과 후속 과제' },
  'generator-evaluator-pattern': { en: 'Generator-evaluator separation (planner / generator / evaluator)', ko: '생성-평가 분리' },
  'harness-assumptions-go-stale': { en: 'Harness assumptions go stale', ko: '하네스 가정은 낡는다' },
  'harness-automatic-evolution': { en: 'Automatic harness evolution', ko: '하네스 자동 진화' },
  'harness-engineering': { en: 'Harness engineering', ko: '하네스 엔지니어링' },
  'harness-evals-and-ablation': { en: 'Harness evals and ablations', ko: '하네스 평가와 제거 실험' },
  'harness-job-requirements': { en: 'Harness engineer requirements from job postings', ko: '공고로 본 harness 엔지니어 요구 역량' },
  'harness-reading-order': { en: 'Harness engineering reading order', ko: '학습 순서' },
  'llm-wiki-pattern': { en: 'LLM Wiki pattern', ko: 'LLM 위키 패턴' },
  'long-running-agent-handoff': { en: 'Long-running agent handoff artifacts', ko: '장기 실행 에이전트 인수인계 산출물' },
  'mechanical-architecture-enforcement': { en: 'Mechanical architecture enforcement', ko: '기계적 아키텍처 강제' },
  'multi-agent-scaling': { en: 'Multi-agent scaling: when more agents help', ko: '멀티 에이전트 확장: 에이전트가 늘수록 도움이 될 때' },
  'openai-codex': { en: 'OpenAI Codex', ko: '오픈AI 코덱스' },
  'org-anthropic': { en: 'Anthropic', ko: '앤트로픽' },
  'org-decagon': { en: 'Decagon', ko: '데카곤' },
  'org-harvey': { en: 'Harvey', ko: '하비' },
  'org-openai': { en: 'OpenAI', ko: '오픈AI' },
  'org-perplexity': { en: 'Perplexity', ko: '퍼플렉시티' },
  'org-scale-ai': { en: 'Scale AI', ko: '스케일 AI' },
  'org-thinking-machines': { en: 'Thinking Machines', ko: '씽킹 머신즈' },
  'repository-knowledge-system-of-record': { en: 'Repository knowledge as system of record', ko: '저장소 지식을 기준 기록으로' },
  'src-anthropic-effective-harnesses': { en: 'Anthropic: Effective harnesses for long-running agents', ko: '앤트로픽: 장기 실행 에이전트를 위한 효과적인 하네스' },
  'src-anthropic-harness-design': { en: 'Anthropic: Harness design for long-running application development', ko: '앤트로픽: 장기 실행 애플리케이션 개발을 위한 하네스 설계' },
  'src-anthropic-managed-agents': { en: 'Anthropic: Scaling Managed Agents with stable interfaces', ko: '앤트로픽: 안정적인 인터페이스로 매니지드 에이전트 확장' },
  'src-arxiv-harness-papers': { en: 'arXiv: 11 harness papers (abstracts only)', ko: 'arXiv: harness 관련 논문 11편 (abstract만)' },
  'src-google-scaling-agent-systems': { en: 'Google Research: Towards a science of scaling agent systems', ko: '구글 리서치: 에이전트 시스템 확장의 과학을 향하여' },
  'src-job-postings': { en: 'Job postings: 13 mentioning harness', ko: '채용공고 13건 (harness 언급)' },
  'src-karpathy-llm-wiki': { en: 'Karpathy: LLM Wiki (gist)', ko: '카파시: LLM 위키 (gist)' },
  'src-openai-harness-engineering': { en: 'OpenAI: Harness engineering: leveraging Codex in an agent-first world', ko: '오픈AI: 하네스 엔지니어링: 에이전트 우선 세계에서 코덱스 활용' },
  'swe-agent': { en: 'SWE-agent / Agent-Computer Interface', ko: 'SWE-에이전트 / 에이전트-컴퓨터 인터페이스' },
};

/** The one display format. A pre-existing parenthesis stays part of its own side; the pair parenthesis is last. */
export function formatDisplayTitle(pair: TitlePair): string {
  return `${pair.en} (${pair.ko})`;
}

const HAS_LATIN = /[A-Za-z]/;
const HAS_HANGUL = /[가-힣]/;
const LATIN_TOKEN = /[A-Za-z][A-Za-z0-9.+-]*/g;
const HANGUL_TOKEN = /[가-힣]+/g;

function tokens(re: RegExp, s: string): string[] {
  return s.match(re) ?? [];
}

/** Format rules shared by map entries and frontmatter pairs. Returns a message per violation. */
export function checkPairFormat(pair: TitlePair): string[] {
  const out: string[] = [];
  if (pair.en.trim() === '' || pair.ko.trim() === '') out.push('en/ko 중 빈 값');
  if (!HAS_LATIN.test(pair.en)) out.push('en 에 라틴 문자가 없음');
  if (!HAS_HANGUL.test(pair.ko)) out.push('ko 에 한글이 없음');
  if (/[\r\n]/.test(pair.en) || /[\r\n]/.test(pair.ko)) out.push('개행 포함');
  return out;
}

/** A map entry must reproduce the frontmatter title: exact side for single-language titles, all tokens for mixed ones. */
export function matchesFrontmatterTitle(pair: TitlePair, title: string): boolean {
  const hasL = HAS_LATIN.test(title);
  const hasH = HAS_HANGUL.test(title);
  if (hasL && !hasH) return pair.en === title;
  if (hasH && !hasL) return pair.ko === title;
  const hay = `${pair.en} ${pair.ko}`;
  return [...tokens(LATIN_TOKEN, title), ...tokens(HANGUL_TOKEN, title)].every((t) => hay.includes(t));
}

export interface TitlePageInput {
  slug: string;
  title: string;
  titleEn?: string;
  titleKo?: string;
}

export interface TitleCheck {
  displayTitles: Record<string, string>;
  errors: string[];
}

/**
 * Resolves the display title of every content page and reports every problem by name:
 * missing source, duplicated source, map entries for non-content slugs, format and title-match violations.
 */
export function resolveDisplayTitles(pages: TitlePageInput[], map: Record<string, TitlePair> = DISPLAY_TITLE_MAP): TitleCheck {
  const errors: string[] = [];
  const displayTitles: Record<string, string> = {};
  const slugs = new Set(pages.map((p) => p.slug));

  for (const slug of Object.keys(map)) {
    if (!slugs.has(slug)) errors.push(`display-titles: 맵에 콘텐츠 페이지가 아닌 슬러그가 있음: ${slug}`);
  }
  for (const p of pages) {
    const fromFrontmatter = p.titleEn !== undefined && p.titleKo !== undefined;
    const fromMap = Object.prototype.hasOwnProperty.call(map, p.slug);
    if (fromFrontmatter && fromMap) {
      errors.push(`display-titles: ${p.slug}: frontmatter 쌍과 맵 항목이 중복됨 (원천은 하나여야 함)`);
      continue;
    }
    if (!fromFrontmatter && !fromMap) {
      errors.push(`display-titles: ${p.slug}: 표시 제목 없음 (frontmatter title_en/title_ko 또는 display-titles 맵 항목 필요)`);
      continue;
    }
    const pair: TitlePair = fromFrontmatter ? { en: p.titleEn as string, ko: p.titleKo as string } : map[p.slug];
    for (const msg of checkPairFormat(pair)) errors.push(`display-titles: ${p.slug}: ${msg}`);
    // A frontmatter pair is itself the display source (saved pages keep the Korean question as `title`).
    if (!fromFrontmatter && !matchesFrontmatterTitle(pair, p.title)) {
      errors.push(`display-titles: ${p.slug}: 맵 항목이 frontmatter 제목 "${p.title}" 과 일치하지 않음`);
    }
    displayTitles[p.slug] = formatDisplayTitle(pair);
  }
  return { displayTitles, errors };
}
