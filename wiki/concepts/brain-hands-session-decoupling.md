---
title: "Brain / hands / session decoupling"
type: concept
tags: [architecture, infrastructure, security]
sources: [raw/blogs/anthropic-managed-agents.md, raw/jobs/anthropic-managed-agents-staff-swe.md]
updated: 2026-11-05
---

# Brain / hands / session decoupling

- brain = 모델 + harness 루프, hands = 샌드박스와 툴, session = append-only 이벤트 로그. 각각을 인터페이스로 분리해 독립적으로 실패하고 교체된다.
- 컨테이너는 cattle: `provision({resources})`로 재생성, 실패는 툴 에러로 모델에 전달. harness도 cattle: `wake(sessionId)`, `getSession(id)`, `emitEvent(id, event)`.
- 보안: 자격증명은 샌드박스 밖(vault, MCP 프록시). 구조적 해법이며 "범위를 좁힌 토큰"은 모델이 똑똑해질수록 불안정한 가정.
- 고객 VPC 연결, 병렬 brain/hand 확장에 유리.
- 인터페이스에 대한 태도: 구현이 아니라 형태에 의견을 둔다 (OS의 process/file 비유). Managed Agents 공고도 "implementations change, contracts hold"를 요구.
- 관련: [[claude-managed-agents]], [[src-anthropic-managed-agents]]

출처 페이지: [[src-anthropic-managed-agents]]
