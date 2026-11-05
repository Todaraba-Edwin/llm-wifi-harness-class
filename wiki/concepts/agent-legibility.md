---
title: Agent legibility
type: concept
tags: [observability, environment]
sources: [raw/blogs/openai-harness-engineering.md]
updated: 2026-11-05
---

# Agent legibility

- 병목이 인간 QA 시간으로 이동하면 앱의 UI, 로그, 메트릭을 에이전트가 직접 읽게 만든다.
- worktree별 앱 부팅, Chrome DevTools Protocol 연동(DOM 스냅샷, 스크린샷, 내비게이션 skill), worktree별 임시 관측 스택(LogQL, PromQL, TraceQL).
- 성능 목표를 프롬프트로 지정 가능: "서비스 시작 800ms 미만", "주요 4개 사용자 여정의 span이 2초 이하".
- 의존성 선택 기준: 저장소 안에서 완전히 내재화 가능하고 추론 가능한 것. "지루한" 기술이 에이전트가 모델링하기 쉽다. 불투명한 업스트림 대신 필요한 부분집합을 재구현하는 편이 쌀 때도 있다.
- 관련: [[repository-knowledge-system-of-record]], [[harness-engineering]]

출처: [[src-openai-harness-engineering]]
