---
title: "OpenAI: Harness engineering: leveraging Codex in an agent-first world"
type: source
tags: [openai, codex, agents-md]
sources: [raw/blogs/openai-harness-engineering.md]
updated: 2026-11-05
---

# OpenAI: Harness engineering: leveraging Codex in an agent-first world

- 출처: https://openai.com/index/harness-engineering/ (2026-02-11, Ryan Lopopolo)
- 실험: 5개월간 수동 작성 코드 0줄, 약 100만 줄, 약 1,500 PR. 엔지니어 3명(후에 7명), 엔지니어당 일 3.5 PR, 팀이 커져도 처리량 증가. 첫 커밋 2025-08 말. AGENTS.md도 Codex가 작성. 약 1/10 시간 추정.
- "Humans steer. Agents execute." 엔지니어의 일은 코드가 아니라 환경 설계, 의도 명세, 피드백 루프. 실패 시 "더 열심히 해"가 아니라 "어떤 능력이 빠졌고 어떻게 에이전트가 읽고 강제할 수 있게 만들까?" PR은 에이전트 간 리뷰 루프("Ralph Wiggum Loop")로 마무리.
- 앱 legibility: worktree마다 앱 부팅, Chrome DevTools Protocol을 런타임에 연결(DOM 스냅샷, 스크린샷, 내비게이션 skill), 로컬 관측 스택(LogQL/PromQL/TraceQL)을 worktree마다 임시로 띄움. "서비스 시작 800ms 미만" 같은 프롬프트가 가능해짐. 단일 Codex 실행이 6시간 이상 이어지기도 함. -> [[agent-legibility]]
- **지도, 1000쪽 매뉴얼이 아님**: 거대한 AGENTS.md는 컨텍스트를 잡아먹고, 모든 게 중요하면 아무것도 아니고, 즉시 썩고, 검증이 어렵다. AGENTS.md(약 100줄)는 목차이고 `docs/`가 system of record. progressive disclosure. 린터/CI가 문서의 최신성과 링크를 검증하고 doc-gardening 에이전트가 stale 문서에 수정 PR을 연다. -> [[repository-knowledge-system-of-record]]
- 아키텍처 강제: 도메인마다 Types -> Config -> Repo -> Service -> Runtime -> UI 레이어, 횡단 관심사는 Providers 하나로. 커스텀 린터와 구조 테스트(Codex가 작성)로 강제, 린트 에러 메시지에 수정 지침을 넣어 에이전트 컨텍스트로 주입. 불변식은 강제하되 구현 방식은 규정하지 않음. -> [[mechanical-architecture-enforcement]]
- 머지 철학: 처리량이 인간 주의력을 넘으면 블로킹 게이트를 줄이고 flake는 재실행으로 처리. 저처리량 환경에서는 무책임할 수 있다고 명시.
- 자율성 단계: 한 프롬프트로 현상 검증, 버그 재현(영상 녹화), 수정, 앱 구동 검증, PR, 피드백 대응, 빌드 실패 복구, 판단이 필요할 때만 사람에게 에스컬레이션, 머지까지. 이 저장소의 구조와 툴링에 크게 의존하며 일반화를 가정하면 안 된다고 단서를 붙임.
- 엔트로피: Codex는 기존 패턴을 복제해 drift 발생. 매주 금요일 20%를 "AI slop" 청소에 쓰던 것을 "golden principles"를 저장소에 인코딩하고 백그라운드 Codex 작업이 정기적으로 위반을 스캔, 품질 등급 갱신, 리팩터링 PR(대부분 1분 내 리뷰, automerge)로 대체. 기술 부채는 고금리 대출. -> [[entropy-and-garbage-collection]]
- 모르는 것: 완전 에이전트 생성 시스템의 아키텍처 일관성이 수년에 걸쳐 어떻게 진화하는지.
- 관련: [[openai-codex]]
