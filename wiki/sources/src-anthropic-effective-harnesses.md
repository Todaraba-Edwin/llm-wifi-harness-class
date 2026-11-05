---
title: "Anthropic: Effective harnesses for long-running agents"
type: source
tags: [anthropic, long-running, handoff]
sources: [raw/blogs/anthropic-effective-harnesses-long-running-agents.md]
updated: 2026-11-05
---

# Anthropic: Effective harnesses for long-running agents

- 출처: https://www.anthropic.com/research/effective-harnesses-for-long-running-agents (2025-11-26, Anthropic Engineering)
- 문제: 에이전트는 세션 단위로 일하고 새 세션은 이전 기억이 없다. 교대 근무 엔지니어 비유. compaction만으로는 부족하다.
- 관찰된 실패 두 가지: (1) 한 번에 앱 전체를 one-shot 하려다 컨텍스트가 끊겨 반쯤 구현된 상태로 다음 세션에 넘김, (2) 이미 진척이 있는 걸 보고 후속 인스턴스가 "완료"를 선언.
- 해법: **initializer agent**(첫 세션: `init.sh`, `claude-progress.txt`, 초기 git 커밋, 기능 목록 JSON 작성)와 **coding agent**(매 세션 한 기능씩 진행하고 깨끗한 상태로 종료) -> [[long-running-agent-handoff]]
- 기능 목록은 claude.ai 클론 예에서 200개 이상, 전부 처음엔 "failing"으로 표시. 코딩 에이전트는 테스트를 거친 뒤에만 passing으로 바꾼다.
- 세션 시작 루틴: `pwd` -> git log와 progress 파일 읽기 -> 기능 목록에서 최우선 미완료 항목 선택 -> `init.sh`로 개발 서버를 띄우고 기본 E2E를 먼저 확인(Puppeteer MCP).
- 한계: Puppeteer MCP로는 브라우저 네이티브 alert 모달을 볼 수 없어 해당 기능에 버그가 많았다.
- 열린 질문: 단일 범용 코딩 에이전트 vs 테스트/QA/클린업 전문 멀티에이전트. 웹앱 외 영역(과학 연구, 금융 모델링)으로의 일반화.
- 관련: [[claude-agent-sdk]], [[context-resets-vs-compaction]], [[src-anthropic-harness-design]]
