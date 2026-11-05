---
title: Entropy and garbage collection for agent codebases
type: concept
tags: [maintenance, quality]
sources: [raw/blogs/openai-harness-engineering.md, raw/papers/arxiv-2605.13357.md]
updated: 2026-11-05
---

# Entropy and garbage collection for agent codebases

- 에이전트는 저장소의 기존 패턴(나쁜 것 포함)을 복제 -> drift.
- 초기에는 사람이 매주 금요일(주 20%) AI slop을 청소했으나 확장 불가.
- 대안: golden principles(공용 유틸 패키지 우선, 데이터를 YOLO 식으로 탐색하지 말고 경계에서 검증 또는 타입 SDK)를 저장소에 인코딩, 백그라운드 Codex 작업이 정기 스캔 -> 품질 등급 갱신 -> 리팩터링 PR(대부분 1분 내 리뷰, automerge).
- 기술 부채 = 고금리 대출: 작게 지속 상환. 인간 취향은 한 번 포착해 모든 줄에 지속 적용.
- 논문 2605.13357도 entropy auditing을 harness의 11개 책임에 포함.

출처: [[src-openai-harness-engineering]]. 관련: [[mechanical-architecture-enforcement]]

출처 페이지: [[src-arxiv-harness-papers]]
