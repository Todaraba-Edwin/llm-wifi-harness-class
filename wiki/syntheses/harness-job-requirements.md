---
title: "공고로 본 harness 엔지니어 요구 역량"
type: synthesis
tags: [jobs, skills]
sources: [raw/jobs/anthropic-computer-use-product-engineer.md, raw/jobs/perplexity-enterprise-agent-evals.md, raw/jobs/scale-rl-environments.md, raw/jobs/perplexity-agent-engine.md, raw/jobs/anthropic-managed-agents-staff-swe.md, raw/jobs/decagon-staff-agent-platform.md, raw/jobs/openai-codex-core-agents.md, raw/jobs/harvey-staff-agents.md, raw/jobs/thinkingmachines-post-training-evals.md, raw/jobs/scale-agent-robustness.md, raw/jobs/anthropic-applied-ai-science-engineering.md, raw/jobs/perplexity-search-agent-rl.md, raw/jobs/decagon-ai-platform.md]
updated: 2026-11-05
---

# 공고로 본 harness 엔지니어 요구 역량

13건의 공고([[src-job-postings]])에서 반복되는 요구. 빈도는 엄밀한 통계가 아니라 이 13건에서의 관찰.

1. **Harness 자체 설계**: 에이전트 루프, 툴 오케스트레이션, 컨트롤 플레인 (OpenAI, Anthropic, Decagon, Perplexity). [[agent-harness]]
2. **샌드박스, 격리, 상태, 인프라**: 분산 시스템, 내구성 세션/이벤트 저장, 멀티테넌트 격리, 자격증명 처리 (OpenAI, Anthropic Managed Agents). [[brain-hands-session-decoupling]]
3. **Evals와 ablation**: 평가 환경, user simulator, harness vs 모델 원인 분리, 모델 세대마다 재검증 (거의 모든 공고). [[harness-evals-and-ablation]]
4. **컨텍스트 관리**: caching, compaction, memory, 윈도우 관리 (Anthropic, Harvey). [[context-resets-vs-compaction]]
5. **관측성/디버깅**: 로그, 트레이스, 프로파일링, 실패 사례 분석을 durable fix로 (OpenAI, Decagon, Harvey).
6. **성능 포락선**: 토큰, 지연, 비용, 용량 (OpenAI, Anthropic "intelligence per dollar", Decagon 음성 지연).
7. **연구와의 근접성**: harness가 학습/평가에 쓰이므로 연구팀과 협업 (OpenAI, Anthropic, Perplexity RL, Thinking Machines).
8. **AI 도구 사용 문화**: Claude 등을 빌드의 핵심 도구로 쓰고 "좋은 harness란 무엇인가"에 의견이 있을 것 (Anthropic).
9. **API/인터페이스 안정성**: 구현은 바뀌어도 계약은 유지 (Anthropic Managed Agents). [[harness-assumptions-go-stale]]

학습 순서는 [[harness-reading-order]]. 공고 범위 한계는 [[src-job-postings]] 참조.
