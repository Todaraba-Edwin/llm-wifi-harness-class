---
title: "Agent harness"
type: concept
tags: [definition]
sources: [raw/blogs/anthropic-managed-agents.md, raw/blogs/openai-harness-engineering.md, raw/papers/arxiv-2606.10106.md, raw/jobs/openai-codex-core-agents.md, raw/papers/arxiv-2605.13357.md]
updated: 2026-11-05
---

# Agent harness

모델 바깥에서 모델을 감싸 "능력"을 "실제 행동"으로 바꾸는 실행 시스템.

- Anthropic: Claude를 호출하고 툴 호출을 관련 인프라로 라우팅하는 **루프**. 컨텍스트 관리(caching, compaction, memory)와 에러 복구를 포함 ([[src-anthropic-managed-agents]], [[src-job-postings]]의 Managed Agents 공고).
- OpenAI Codex 팀: 모델 출력 해석, 안전한 실행, 프로덕션 경험의 환류. 프롬프트, 모델 상호작용, 추론, 샌드박스 실행, 오케스트레이션, evals를 포괄.
- Decagon: 라우팅, 실행 로직, 툴 오케스트레이션, 컨트롤 플레인.
- 용어 혼선(2606.10106): 제품 전체(Claude Code, Codex CLI), 평가 스캐폴드(SWE-bench harness), 프레임워크/SDK/오케스트레이터가 섞여 쓰인다. 공고를 읽을 때는 **agent harness(런타임)** 인지 **eval harness(평가)** 인지 구분한다.
- 구성 책임 후보(2605.13357): task specification, context selection, tool access, project memory, task state, observability, failure attribution, verification, permissions, entropy auditing, intervention recording.

관련: [[harness-engineering]], [[brain-hands-session-decoupling]]

출처 페이지: [[src-anthropic-managed-agents]], [[src-openai-harness-engineering]], [[src-arxiv-harness-papers]], [[src-job-postings]]
