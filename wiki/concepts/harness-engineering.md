---
title: "Harness engineering"
type: concept
tags: [definition, practice]
sources: [raw/blogs/openai-harness-engineering.md, raw/blogs/anthropic-harness-design-long-running-apps.md, raw/papers/arxiv-2605.13357.md, raw/papers/arxiv-2604.25850.md, raw/papers/arxiv-2607.03691.md]
updated: 2026-11-05
---

# Harness engineering

모델을 바꾸지 않고 모델 주변의 환경, 도구, 컨텍스트, 검증, 피드백 루프를 설계해 에이전트의 신뢰성과 성능을 올리는 일.

- OpenAI의 정식화: 엔지니어의 주 업무가 코드 작성에서 "환경 설계, 의도 명세, 피드백 루프 구축"으로 이동. 에이전트가 막히면 빠진 능력(도구, 가드레일, 문서)을 찾아 저장소에 되돌려 넣는다 ([[src-openai-harness-engineering]]).
- Anthropic의 정식화: harness 구성요소는 모델의 한계에 대한 가정이므로 모델 세대마다 재검증한다 ([[harness-assumptions-go-stale]]).
- 연구 쪽: harness 변경만으로 성능이 움직이고(2607.03691: 모델 고정, 릴리스 35개 비교), 자동 진화도 가능(2604.25850). 하지만 수동 공예에 가깝다는 진단.
- 주요 실천: [[long-running-agent-handoff]], [[generator-evaluator-pattern]], [[repository-knowledge-system-of-record]], [[mechanical-architecture-enforcement]], [[agent-legibility]], [[entropy-and-garbage-collection]], [[harness-evals-and-ablation]].

출처 페이지: [[src-openai-harness-engineering]], [[src-anthropic-harness-design]], [[src-arxiv-harness-papers]]
