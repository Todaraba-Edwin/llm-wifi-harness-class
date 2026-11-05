---
title: "Harness evals and ablations"
type: concept
tags: [evaluation, measurement]
sources: [raw/papers/arxiv-2607.03691.md, raw/papers/arxiv-2610.20344.md, raw/jobs/openai-codex-core-agents.md, raw/jobs/anthropic-managed-agents-staff-swe.md, raw/papers/arxiv-2604.25850.md]
updated: 2026-11-05
---

# Harness evals and ablations

- 모델 고정 + harness 변화로 효과를 분리하는 설계가 필요하다. 2607.03691은 Qwen Code CLI 35개 릴리스를 모델 고정으로 평가.
- 실패 원인 분리: harness 문제 vs 모델 행동 vs 추론/런타임 vs 제품 실패 (OpenAI Codex 공고).
- ablation 축: 프롬프트, 모델 대면 인터페이스, 컨텍스트 구성, 툴 사용 전략, harness 동작 -> solve rate, 신뢰성, 지연, 비용.
- 회귀의 책임 소재: 실무자는 회귀를 모델 탓으로 돌리는 경향 (2607.03691의 문제 제기).
- 벤치마크: Terminal-Bench 2, SWE-bench-verified(AHE 논문), Doc2Harness(harness 구성 능력 자체를 평가).
- 채용 시장에서 가장 자주 함께 요구되는 역량: [[harness-job-requirements]]

출처 페이지: [[src-arxiv-harness-papers]], [[src-job-postings]]
