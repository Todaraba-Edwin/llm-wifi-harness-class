---
title: "Generator-evaluator separation (planner / generator / evaluator)"
type: concept
tags: [evaluation, multi-agent]
sources: [raw/blogs/anthropic-harness-design-long-running-apps.md]
updated: 2026-11-05
---

# Generator-evaluator separation (planner / generator / evaluator)

- 자기 평가는 관대하다. 일하는 에이전트와 판정하는 에이전트를 분리하고 평가자를 회의적으로 튜닝하는 편이 생성자를 자기 비판적으로 만드는 것보다 쉽다. 단, 평가자도 LLM이라 LLM 산출물에 관대하다.
- 주관적 품질은 구체적 기준으로 바꾼다. 프론트엔드 4기준(design quality, originality, craft, functionality), 가중치로 위험 감수를 유도, few-shot 점수 예시로 drift 억제. 기준의 표현("museum quality")이 결과 스타일을 끌고 간다.
- 평가자는 정적 스크린샷이 아니라 Playwright MCP로 실제 앱을 조작한다.
- sprint contract: 구현 전에 "완료"의 정의와 검증 방법을 합의. 스프린트 3 하나에 27개 기준 예시.
- 기준별 hard threshold: 하나라도 미달이면 실패.
- 평가자의 가치는 고정이 아니다: 과제가 모델의 단독 신뢰 범위를 넘을 때 비용 대비 가치가 있다 (Opus 4.6에서는 마지막 1회 평가로 축소).
- 기본 QA 에이전트는 약하다 -> 로그를 읽고 판단 격차를 프롬프트에 반영하는 튜닝 루프가 필요.
- 관련: [[harness-evals-and-ablation]], [[src-anthropic-harness-design]]

출처 페이지: [[src-anthropic-harness-design]]
