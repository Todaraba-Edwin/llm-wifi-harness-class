---
title: "Anthropic: Scaling Managed Agents with stable interfaces"
type: source
tags: [anthropic, infrastructure, sandbox]
sources: [raw/blogs/anthropic-managed-agents.md]
updated: 2026-11-05
---

# Anthropic: Scaling Managed Agents with stable interfaces

- 출처: https://www.anthropic.com/research/managed-agents (2026-04-08, Anthropic Engineering)
- 핵심 문장: harness는 "Claude가 혼자 못 하는 것"에 대한 가정을 인코딩하며 그 가정은 모델이 좋아지면 stale해진다. 예: Sonnet 4.5의 context anxiety를 컨텍스트 리셋으로 막았지만 Opus 4.5에서는 사라져 리셋이 dead weight가 됨. -> [[harness-assumptions-go-stale]]
- OS 비유: process/file 같은 추상화는 하드웨어가 바뀌어도 유지된다. 에이전트를 **session**(append-only 이벤트 로그), **harness**(Claude를 호출하고 툴 호출을 라우팅하는 루프), **sandbox**(코드 실행 환경)로 가상화한다. -> [[brain-hands-session-decoupling]]
- "Don't adopt a pet": 모두 한 컨테이너에 넣으면 컨테이너가 pet이 되어 죽으면 세션이 사라지고 디버깅 창구도 없었다. harness를 컨테이너 밖으로 꺼내 `execute(name, input) -> string`으로 호출하고, 실패는 툴 호출 에러로 Claude에게 전달. harness 크래시는 `wake(sessionId)` + `getSession(id)`로 복구.
- 보안 경계: 생성된 코드와 자격증명이 같은 컨테이너에 있으면 프롬프트 인젝션이 곧 토큰 탈취. 토큰을 샌드박스 밖(vault, MCP 프록시)에 두고 Git은 초기화 시 clone/remote 설정으로 처리.
- **세션은 컨텍스트 윈도우가 아니다**: 세션 로그는 윈도우 밖의 복구 가능한 컨텍스트 객체이며 `getEvents()`로 위치 기반 슬라이스를 읽는다. compaction/trimming 같은 비가역적 선택을 피하고, 컨텍스트 관리 정책은 harness에 둔다.
- Many brains: harness가 컨테이너 밖에 있으면 고객 VPC 연결 시 네트워크 피어링이 필요 없다. 컨테이너는 필요할 때만 툴 호출로 프로비저닝하므로 TTFT가 개선: p50 약 60% 감소, p95 90% 이상 감소. 다수의 brain = 다수의 stateless harness.
- Many hands: 각 hand는 `execute(name, input) -> string` 툴이며 컨테이너, 휴대폰, 에뮬레이터 어느 것인지 harness가 모른다. brain끼리 hand를 넘겨줄 수 있다. 단일 컨테이너는 실패 시 모든 hand의 상태를 잃는 한계였다.
- 결론: Managed Agents는 meta-harness, 특정 harness에 중립이며 인터페이스(상태를 다루는 session, 계산을 하는 sandbox, 다수의 brain/hand로의 확장)에만 의견을 둔다. Claude Code 같은 harness나 작업 특화 harness를 모두 수용할 수 있다.
- 관련: [[claude-managed-agents]]
