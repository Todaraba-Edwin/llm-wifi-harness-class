# Log

append-only. 형식: `## [YYYY-MM-DD] 작업 | 제목`. 최근 5건: `grep "^## \[" wiki/log.md | tail -5`

## [2026-11-05] init | 위키 스캐폴드 (raw/, wiki/, AGENTS.md)
- Karpathy LLM Wiki 패턴 적용. 디렉터리와 스키마 생성.

## [2026-11-05] ingest | Anthropic 블로그 3편
- raw/blogs/anthropic-effective-harnesses-long-running-agents.md, anthropic-harness-design-long-running-apps.md, anthropic-managed-agents.md
- 생성: src-anthropic-effective-harnesses, src-anthropic-harness-design, src-anthropic-managed-agents, claude-managed-agents, claude-agent-sdk, long-running-agent-handoff, context-resets-vs-compaction, generator-evaluator-pattern, brain-hands-session-decoupling, harness-assumptions-go-stale

## [2026-11-05] ingest | OpenAI harness engineering
- raw/blogs/openai-harness-engineering.md (reader-mode 캡처 2부분 병합)
- 생성: src-openai-harness-engineering, openai-codex, repository-knowledge-system-of-record, mechanical-architecture-enforcement, entropy-and-garbage-collection, agent-legibility

## [2026-11-05] ingest | Google Research scaling agent systems
- 생성: src-google-scaling-agent-systems, multi-agent-scaling

## [2026-11-05] ingest | Karpathy LLM Wiki gist
- 생성: src-karpathy-llm-wiki, llm-wiki-pattern

## [2026-11-05] ingest | 채용공고 13건
- raw/jobs/*.md. 생성: src-job-postings, org-* 7건, harness-job-requirements

## [2026-11-05] ingest | arXiv 논문 11편 (abstract)
- raw/papers/arxiv-*.md. 생성: src-arxiv-harness-papers, agent-harness, harness-engineering, harness-evals-and-ablation, harness-automatic-evolution, deterministic-execution-constraints, swe-agent

## [2026-11-05] synthesis | 읽기 순서, 모순, 공백
- 생성: harness-reading-order, contradictions-and-tensions, gaps-and-todo

## [2026-11-05] lint | 초기 점검
- 깨진 링크 0, 누락된 raw 경로 0, 고아 페이지 1건(src-karpathy-llm-wiki) -> llm-wiki-pattern에서 링크해 해소. 총 39페이지.

## [2026-11-05] lint | 리뷰 지적 반영
- 출처 귀속 오류(Sonnet 4.5 리셋), 지연 결과 반전(2608.26197), 잘못된 공백 기록, 근거 없는 날짜와 raw 미저장 공고 서술을 수정. 누락된 raw 섹션(Managed Agents TTFT, Google 오류 증폭, harness design 결론, SWE-agent 수치)을 위키에 반영.
- frontmatter title YAML 따옴표 처리, 페이지별 `sources` 보강, index 요약 재작성, AGENTS.md에 log 작업 종류와 lint 규칙 추가.
- 변경 페이지: contradictions-and-tensions, deterministic-execution-constraints, src-arxiv-harness-papers, src-anthropic-harness-design, src-anthropic-managed-agents, src-google-scaling-agent-systems, swe-agent, multi-agent-scaling, gaps-and-todo, org-*, index

## [2026-11-05] lint | 출처 추적 보강
- 개념 페이지 8곳의 frontmatter `sources`에 본문이 인용하는 raw를 추가(multi-agent-scaling, brain-hands-session-decoupling, long-running-agent-handoff, entropy-and-garbage-collection, harness-assumptions-go-stale, harness-engineering, agent-harness, harness-evals-and-ablation).
- claude-managed-agents의 공개 베타 출처를 채용공고로 정정, '약 36개 보드' 문구를 수집 메타데이터로 재표기, contradictions-and-tensions에 리셋 해석 문장 추가.

## [2026-11-05] lint | cleaner 지적 반영
- 출처 없는 서술 2건 제거(claude-agent-sdk의 퀵스타트 URL, swe-agent의 '자주 인용' 문구). gaps-and-todo 정리, 출력 링크와 src 역링크 보강, AGENTS.md 스키마 보정(index/log frontmatter 면제, 상호 참조 lint 추가, ingest 페이지 수), 해설서 파일명 `llm wiki 해설서.md`로 정정, README에 해설서 링크 추가.

## [2026-11-05] lint | 복구와 backlink 보강
- append 실수로 비었던 개념 페이지 5곳(mechanical-architecture-enforcement, entropy-and-garbage-collection, agent-legibility, harness-automatic-evolution, deterministic-execution-constraints)을 원래 내용으로 복구하고 src 역링크를 추가.
- 나머지 개념 페이지 11곳에 `출처 페이지` 줄 추가, entropy 페이지의 근거 없는 자기참조 문장 제거.
