---
title: "Harness assumptions go stale"
type: concept
tags: [model-evolution, principle]
sources: [raw/blogs/anthropic-managed-agents.md, raw/blogs/anthropic-harness-design-long-running-apps.md, raw/jobs/anthropic-managed-agents-staff-swe.md, raw/papers/arxiv-2607.03691.md]
updated: 2026-11-05
---

# Harness assumptions go stale

- 원칙: harness의 모든 구성요소는 "모델이 혼자 못 하는 것"에 대한 가정이다. 모델이 좋아지면 가정은 낡고 구성요소는 dead weight가 된다.
- 사례 1: context anxiety -> 리셋(Sonnet 4.5) -> 불필요(Opus 4.5).
- 사례 2: 스프린트 분해와 스프린트별 평가(Opus 4.5) -> Opus 4.6에서 스프린트 제거, 평가 1회.
- 방법: 한 번에 하나씩 제거하며 영향을 본다 (급진적 단순화는 어느 부분이 load-bearing인지 알 수 없게 만들었다). 단순한 해법에서 시작해 필요할 때만 복잡도를 올린다 (Building Effective Agents).
- 반대로 planner는 유지: 없으면 generator가 과소 범위 설정.
- 채용 요건에 직접 반영됨: "모델 세대마다 가정을 재검토하고 harness 품질을 측정하는 eval 인프라를 구축" (Managed Agents 공고).
- 관련: 논문 2607.03691은 harness 업데이트가 품질 회귀를 만들 수 있다고 보고하므로, 가정을 걷어내는 변경도 ablation으로 검증해야 한다 -> [[harness-evals-and-ablation]]

출처 페이지: [[src-anthropic-managed-agents]], [[src-anthropic-harness-design]], [[src-arxiv-harness-papers]]
