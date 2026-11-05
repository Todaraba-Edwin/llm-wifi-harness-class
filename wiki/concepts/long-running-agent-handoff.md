---
title: "Long-running agent handoff artifacts"
type: concept
tags: [long-running, state]
sources: [raw/blogs/anthropic-effective-harnesses-long-running-agents.md, raw/blogs/anthropic-harness-design-long-running-apps.md, raw/blogs/openai-harness-engineering.md]
updated: 2026-11-05
---

# Long-running agent handoff artifacts

컨텍스트 윈도우를 넘는 작업에서 세션 간 상태를 파일과 git으로 인계한다.

- Anthropic 구성: initializer(세션 1: `init.sh`, `claude-progress.txt`, 초기 커밋, 기능 목록 JSON) + coding agent(세션마다 한 기능, 종료 시 커밋과 진행 기록).
- 기능 목록은 처음에 모두 failing. 충분히 테스트한 뒤에만 passing으로 전환 -> "너무 일찍 완료 선언" 방지.
- "깨끗한 상태" = main에 머지 가능한 수준 (큰 버그 없음, 정돈된 코드, 문서화).
- 세션 시작 의식: pwd, git log, progress, 기능 목록, `init.sh` 실행 후 기본 E2E.
- 실패 모드 표: 조기 완료 선언 / 환경 훼손 / 기능 조기 passing / 실행 방법 탐색 비용 -> 각각 기능 목록 / progress+git / 자체 검증 / init.sh.
- OpenAI는 같은 문제를 저장소 내 exec-plans(active/completed)와 진행/결정 로그로 푼다 ([[repository-knowledge-system-of-record]]).
- 이 위키 자체도 같은 원리: `log.md`와 `index.md`가 세션 간 인계 장치.
출처: [[src-anthropic-effective-harnesses]], [[src-anthropic-harness-design]], [[src-openai-harness-engineering]]
