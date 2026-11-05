---
title: "Context reset vs compaction"
type: concept
tags: [context-engineering]
sources: [raw/blogs/anthropic-harness-design-long-running-apps.md, raw/blogs/anthropic-managed-agents.md]
updated: 2026-11-05
---

# Context reset vs compaction

- **Compaction**: 같은 에이전트가 요약된 짧은 히스토리로 계속. 연속성은 유지되지만 clean slate가 없어 context anxiety가 남을 수 있다.
- **Context reset**: 컨텍스트를 완전히 비우고 새 에이전트 + 구조화된 인계(상태, 다음 단계). clean slate를 얻지만 인계 아티팩트가 충분해야 하고 오케스트레이션 복잡도, 토큰, 지연이 늘어난다.
- Sonnet 4.5에서는 리셋이 필수였고, Opus 4.5에서는 거의 불필요(단일 연속 세션 + SDK 자동 compaction). -> [[harness-assumptions-go-stale]]
- Managed Agents의 제3의 길: 세션 로그를 윈도우 밖 컨텍스트 객체로 영구 보관하고 `getEvents()`로 필요한 슬라이스를 다시 읽는다. 비가역적 요약 대신 복구 가능한 저장 + harness 쪽 변환 ([[brain-hands-session-decoupling]]).
- context anxiety: 컨텍스트 한계를 느끼면 작업을 서둘러 마감하는 행동.

출처 페이지: [[src-anthropic-harness-design]], [[src-anthropic-managed-agents]]
