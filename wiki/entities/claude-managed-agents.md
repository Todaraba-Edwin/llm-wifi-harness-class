---
title: "Claude Managed Agents"
type: entity
tags: [anthropic, product]
sources: [raw/blogs/anthropic-managed-agents.md, raw/jobs/anthropic-managed-agents-staff-swe.md]
updated: 2026-11-05
---

# Claude Managed Agents

Anthropic의 호스팅 에이전트 플랫폼(공개 베타(2026-11 채용공고 기준), 설계 글은 2026-04). 개발자가 에이전트 루프, 샌드박스 실행, 상태 관리, 자격증명, 에러 복구를 직접 만들지 않도록 Anthropic 제작 harness + 세션/환경/툴/메모리/권한 인프라를 작은 API 집합으로 제공.
- 설계 원칙: [[brain-hands-session-decoupling]], 안정된 인터페이스 vs 교체되는 구현.
- 채용: Agentic Systems 팀(Platform). 장시간 stateful 세션, 내구성 있는 세션/이벤트 저장, 샌드박스 오케스트레이션, 멀티테넌트 격리, harness 진화와 eval, outcome 기반 실행, 멀티에이전트, 메모리, 관측성.
- [[src-anthropic-managed-agents]], [[org-anthropic]]
