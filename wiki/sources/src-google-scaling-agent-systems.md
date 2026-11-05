---
title: "Google Research: Towards a science of scaling agent systems"
type: source
tags: [google-research, multi-agent, scaling]
sources: [raw/blogs/google-scaling-agent-systems.md]
updated: 2026-11-05
---

# Google Research: Towards a science of scaling agent systems

- 출처: https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/ (2026-01-28, Yubin Kim, Xin Liu)
- 180개 에이전트 구성의 통제 평가. 5개 아키텍처(single, independent, centralized, decentralized, hybrid) x 4개 벤치마크(Finance-Agent, BrowseComp-Plus, PlanCraft, Workbench) x 3개 모델 계열(GPT, Gemini, Claude).
- "agentic" 과제의 3 속성: 외부 환경과의 지속적 다단계 상호작용, 부분 관측 하에서 반복적 정보 수집, 환경 피드백 기반 전략 수정.
- 결과: 병렬화 가능한 과제(Finance-Agent)에서 centralized가 단일 에이전트 대비 +80.9%, 순차 추론(PlanCraft)에서는 모든 멀티에이전트 변형이 39~70% 하락. 툴이 많을수록(예: 16개 이상) 조율 비용이 불균형적으로 증가. 오류 증폭: independent는 최대 17.2배, centralized는 4.4배로 억제(orchestrator가 validation bottleneck 역할). centralized가 성공률과 오류 억제의 균형이 가장 좋았다.
- 예측 모델(R^2 = 0.513): 툴 개수와 분해 가능성 같은 측정 가능한 과제 속성으로 최적 조율 전략을 예측, 미지 과제 구성의 87%에서 정답.
- -> [[multi-agent-scaling]]
