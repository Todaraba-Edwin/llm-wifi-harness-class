---
title: Deterministic execution constraints
type: concept
tags: [reliability, regulated]
sources: [raw/papers/arxiv-2608.26197.md]
updated: 2026-11-05
---

# Deterministic execution constraints

- 규제 도메인(금융, 컴플라이언스)에서는 실행 분산이 문제. 유한상태 제어, 강제 툴 선택, 출력 검증, 제한 재시도, 구조화된 planning으로 감싼다.
- 1차 결과는 혼재(4셀 중 1개 개선, 2개 악화). 원인: 자유 텍스트 planning 단계가 잔여 분산을 지배.
- Structured Planning(툴 호출 전 계획을 고정 스키마로 검증)으로 3/4 셀에서 Reproducibility 1.000, 성공률 100%. 토큰 비용은 모든 셀에서 감소, 지연은 모델별로 갈림(한 모델은 빨라지고 다른 모델은 크게 느려짐; abstract 기준). 비용은 모델에 의존하므로 측정해야 한다는 결론. 합성 과제 2개, 오픈 모델 2개 규모라 일반화 주의.

출처: [[src-arxiv-harness-papers]]. 관련: [[harness-engineering]]
