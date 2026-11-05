---
title: "Multi-agent scaling: when more agents help"
type: concept
tags: [multi-agent, architecture]
sources: [raw/blogs/google-scaling-agent-systems.md, raw/blogs/anthropic-harness-design-long-running-apps.md, raw/blogs/anthropic-effective-harnesses-long-running-agents.md]
updated: 2026-11-05
---

# Multi-agent scaling: when more agents help

- Google Research: 병렬화 가능한 과제는 멀티에이전트로 큰 이득(+80.9%), 순차 과제는 39~70% 하락. 툴이 많을수록 조율 비용 증가. 오류 증폭이 아키텍처에 따라 다름: independent 17.2배 vs centralized 4.4배.
- 아키텍처: single, independent, centralized(hub-and-spoke), decentralized(mesh), hybrid.
- Anthropic 쪽 맥락: planner/generator/evaluator는 역할 분리이며 병렬 확장과는 다른 문제. 장기 코딩 글은 단일 vs 멀티에이전트를 열린 질문으로 남김.
- 실무: 에이전트를 늘리기 전에 과제의 분해 가능성(병렬/순차)을 확인.
- 관련: [[src-google-scaling-agent-systems]], [[generator-evaluator-pattern]], [[contradictions-and-tensions]]

출처 페이지: [[src-google-scaling-agent-systems]], [[src-anthropic-harness-design]], [[src-anthropic-effective-harnesses]]
