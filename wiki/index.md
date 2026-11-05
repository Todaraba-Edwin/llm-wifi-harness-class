# Index

Harness engineering 위키 카탈로그. 모든 ingest에서 갱신한다. 원본은 `raw/`, 규칙은 루트 `AGENTS.md`.

## Sources (원본 요약)

- [[src-anthropic-effective-harnesses]]: initializer/coding agent 구조와 progress 파일, 기능 목록, git으로 세션 간 인계하는 방법
- [[src-anthropic-harness-design]]: planner/generator/evaluator와 sprint contract, 비용-품질 비교, 모델 개선에 따른 하네스 단순화
- [[src-anthropic-managed-agents]]: session/harness/sandbox 분리, 자격증명 보호, TTFT 개선, meta-harness 철학
- [[src-arxiv-harness-papers]]: harness 관련 논문 11편의 abstract 요약 (정의, 자동화, 실증)
- [[src-google-scaling-agent-systems]]: 180개 구성 실험: 병렬 과제는 멀티에이전트 이득, 순차 과제는 손해, 오류 증폭 17.2배 vs 4.4배(블로그 기준)
- [[src-job-postings]]: harness를 언급한 채용공고 13건 표 (OpenAI, Anthropic, Perplexity, Decagon, Harvey 등)
- [[src-karpathy-llm-wiki]]: RAG 대신 누적되는 위키를 LLM이 유지하는 패턴 (이 위키의 설계 근거)
- [[src-openai-harness-engineering]]: 수동 코드 0줄로 100만 줄을 만든 Codex 실험과 저장소 지식, 아키텍처 강제, 엔트로피 관리

## Concepts

- [[agent-harness]]: 에이전트 하네스의 정의와 용어 혼선(런타임 vs 평가 harness)
- [[agent-legibility]]: UI, 로그, 메트릭을 에이전트가 직접 읽게 만드는 환경 설계
- [[brain-hands-session-decoupling]]: brain/hands/session 분리와 cattle 컨테이너, 보안 경계
- [[context-resets-vs-compaction]]: 컨텍스트 리셋과 compaction의 차이, context anxiety, 외부 세션 로그
- [[deterministic-execution-constraints]]: 결정론적 실행 제약과 structured planning의 효과 및 모델 의존 비용
- [[entropy-and-garbage-collection]]: 에이전트 코드베이스의 drift를 golden principles와 정기 청소 작업으로 관리
- [[generator-evaluator-pattern]]: 생성자와 평가자를 분리하고 주관적 품질을 채점 기준으로 바꾸는 패턴
- [[harness-assumptions-go-stale]]: 하네스 구성요소는 모델 한계에 대한 가정이며 모델이 좋아지면 낡는다
- [[harness-automatic-evolution]]: 관측성 기반 harness 자동 진화(AHE), 자연어 harness, 재귀 harness
- [[harness-engineering]]: 모델 주변 환경, 도구, 컨텍스트, 검증 루프를 설계하는 실천의 개요
- [[harness-evals-and-ablation]]: 모델 고정 harness ablation, 실패 원인 분리, 회귀 책임 소재
- [[llm-wiki-pattern]]: raw/wiki/schema 3계층과 ingest, query, lint 운영 방식
- [[long-running-agent-handoff]]: 컨텍스트 윈도우를 넘는 작업의 세션 간 인계 아티팩트와 실패 모드
- [[mechanical-architecture-enforcement]]: 레이어 규칙을 커스텀 린터와 구조 테스트로 강제하고 에러에 수정 지침 넣기
- [[multi-agent-scaling]]: 멀티에이전트가 도움되는 과제 유형과 아키텍처별 오류 증폭
- [[repository-knowledge-system-of-record]]: AGENTS.md는 목차, docs/가 진실의 원천이라는 progressive disclosure

## Entities

- [[claude-agent-sdk]]: Anthropic의 범용 agent harness SDK
- [[claude-managed-agents]]: Anthropic의 호스팅 에이전트 플랫폼과 요구 역량
- [[openai-codex]]: OpenAI 코딩 에이전트와 Core Agents 팀의 harness
- [[org-anthropic]]: Anthropic의 harness 관련 공고 3건과 블로그
- [[org-decagon]]: Decagon의 agent platform 공고와 harness 정의
- [[org-harvey]]: Harvey의 법무 에이전트 공고
- [[org-openai]]: OpenAI의 harness 관련 공고와 글
- [[org-perplexity]]: Perplexity의 agent engine, evals, search agent RL 공고
- [[org-scale-ai]]: Scale AI의 RL 환경, 에이전트 견고성 공고
- [[org-thinking-machines]]: Thinking Machines의 post-training evals 공고
- [[swe-agent]]: Agent-Computer Interface로 SWE-bench 12.5%, HumanEvalFix 87.7% (abstract 기준)

## Syntheses (분석/질의 결과)

- [[contradictions-and-tensions]]: 출처 간 불일치와 긴장 지점 (리셋/compaction, 게이트, 멀티에이전트 등)
- [[gaps-and-todo]]: 읽지 못한 자료, 검증 필요 항목, 다음 ingest 후보
- [[harness-job-requirements]]: 13건 공고에서 반복되는 harness 엔지니어 요구 역량 9가지
- [[harness-reading-order]]: harness engineering 학습용 추천 읽기 순서

