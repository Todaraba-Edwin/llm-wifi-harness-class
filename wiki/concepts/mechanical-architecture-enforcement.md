---
title: Mechanical architecture enforcement
type: concept
tags: [architecture, lint]
sources: [raw/blogs/openai-harness-engineering.md]
updated: 2026-11-05
---

# Mechanical architecture enforcement

- 불변식은 강제하고 구현은 에이전트에 맡긴다 (경계에서 데이터 파싱은 요구하지만 Zod 사용은 규정하지 않음).
- 도메인별 고정 레이어 Types -> Config -> Repo -> Service -> Runtime -> UI, 횡단 관심사는 Providers 한 곳. 허용되지 않은 의존은 커스텀 린터와 구조 테스트가 차단.
- "taste invariants": 구조적 로깅, 스키마/타입 네이밍, 파일 크기 제한, 플랫폼별 신뢰성 요구를 정적으로 강제.
- 린트 에러 메시지에 **수정 지침**을 넣어 에이전트 컨텍스트로 주입한다.
- 사람이 하면 까다로운 규칙이 에이전트에게는 배수 효과: 한 번 인코딩하면 모든 곳에 적용. 문서가 부족하면 규칙을 코드로 승격.
- 보통 수백 명 규모에서 도입하는 아키텍처를 에이전트 시대에는 초기에 필요로 한다.

출처: [[src-openai-harness-engineering]]. 관련: [[agent-legibility]], [[entropy-and-garbage-collection]]

출처 페이지: [[src-openai-harness-engineering]]
