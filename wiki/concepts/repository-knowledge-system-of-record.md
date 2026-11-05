---
title: "Repository knowledge as system of record"
type: concept
tags: [context-engineering, agents-md, docs]
sources: [raw/blogs/openai-harness-engineering.md]
updated: 2026-11-05
---

# Repository knowledge as system of record

- "지도를 줘라, 1000쪽 매뉴얼이 아니라." 거대 AGENTS.md의 실패 4가지: 컨텍스트 점유, 모두 중요 = 무가치, 즉시 부패, 기계 검증 불가.
- AGENTS.md는 약 100줄의 목차. 구조화된 `docs/`(design-docs, exec-plans/active|completed, product-specs, references, generated, QUALITY_SCORE, RELIABILITY, SECURITY 등)가 진실의 원천. progressive disclosure.
- 기계적 유지: 문서 린터, CI, 주기적 doc-gardening 에이전트가 stale 문서에 수정 PR.
- 에이전트가 컨텍스트에서 접근할 수 없는 지식(Google Docs, Slack, 사람 머릿속)은 존재하지 않는 것과 같다 -> 저장소 안의 버전 관리되는 마크다운으로 끌어온다. [[agent-legibility]]
- 이 위키의 구조(AGENTS.md가 스키마와 지도, index.md가 카탈로그)는 같은 철학이다. [[llm-wiki-pattern]]

출처 페이지: [[src-openai-harness-engineering]]
