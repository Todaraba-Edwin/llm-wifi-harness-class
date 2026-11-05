---
title: "모순과 긴장 지점"
type: synthesis
tags: [lint, analysis]
sources: [raw/blogs/anthropic-harness-design-long-running-apps.md, raw/blogs/anthropic-managed-agents.md, raw/blogs/openai-harness-engineering.md, raw/blogs/google-scaling-agent-systems.md, raw/papers/arxiv-2608.26197.md, raw/blogs/anthropic-effective-harnesses-long-running-agents.md]
updated: 2026-11-05
---

# 모순과 긴장 지점

- **모델과 compaction의 충돌 (출처 간 불일치)**: [[src-anthropic-effective-harnesses]]의 raw는 Opus 4.5 + Claude Agent SDK(compaction 포함)를 루프로 돌려도 고수준 프롬프트만으로는 프로덕션급 웹앱에 못 미친다고 쓰고, 리셋이나 Sonnet 4.5는 언급하지 않는다. 반면 [[src-anthropic-harness-design]]의 raw는 같은 '이전 장기 실행 harness'가 Sonnet 4.5에서 context anxiety 때문에 리셋이 필수였고 Opus 4.5는 그 행동을 거의 없앴다고 쓴다. 즉 이전 harness가 어떤 모델로 돌았는지, Opus 4.5에서 compaction이 충분한지에 대해 두 글의 서술이 어긋난다. 참고로 effective-harnesses의 "새 컨텍스트 세션 + 인계 아티팩트" 구조는 기능적으로 리셋에 해당하므로, 실제 쟁점은 이전 harness가 어떤 모델로 돌았는가이다. 해석은 미정이며 두 글의 게시 시점(2025-11 vs 2026-03)과 모델 세대 차이가 원인일 수 있으나 raw에서 확인되지 않는다. 근거: raw/blogs/anthropic-effective-harnesses-long-running-agents.md, raw/blogs/anthropic-harness-design-long-running-apps.md, raw/blogs/anthropic-managed-agents.md. 관련: [[harness-assumptions-go-stale]]
- **스캐폴딩 증가 vs 감소** ([[src-anthropic-harness-design]], [[harness-assumptions-go-stale]]): 평가자와 스프린트는 품질을 올리지만 20배 비용(solo $9 vs $200). 모델이 좋아지면 줄이라고 한다. 둘 다 같은 원칙에서 나오지만 실행 전 비용 판단이 필요.
- **엄격한 게이트 vs 느슨한 게이트** ([[src-openai-harness-engineering]], [[generator-evaluator-pattern]]): OpenAI는 처리량이 높을 때 블로킹 머지 게이트를 최소화하고, Anthropic 평가자는 hard threshold로 실패시킨다. 전자는 사람 리뷰 병목, 후자는 에이전트 간 검증이라 층위가 다름.
- **결정론 제약의 효과** ([[deterministic-execution-constraints]]): 2608.26197에서 harness 제약이 일부 셀에서 오히려 재현성을 악화시킴. "제약을 더하면 안정적"이라는 직관이 항상 맞지 않는다.
- **멀티에이전트** ([[multi-agent-scaling]]): Google은 순차 과제에서 멀티에이전트가 성능을 떨어뜨린다고 보고, Anthropic의 planner/generator/evaluator는 역할 분리로 이득을 본다. 병렬화 분산과 역할 분리는 다른 문제이므로 직접 충돌은 아니지만, 코딩 과제(순차 성향)에서 어떻게 해석할지 열려 있다. [[multi-agent-scaling]]
- **일반화 단서**: OpenAI 글은 결과가 해당 저장소의 구조와 툴링에 의존한다고 스스로 단서를 붙였다.
