---
title: "LLM Wiki pattern"
type: concept
tags: [meta, knowledge-base]
sources: [raw/blogs/karpathy-llm-wiki.md]
updated: 2026-11-05
---

# LLM Wiki pattern

- 이 위키의 운영 방식. 원본 요약: [[src-karpathy-llm-wiki]]. RAG의 "질의 때마다 재발견" 대신 "수집 때 통합해 누적".
- 3계층: `raw/`(불변 원본), `wiki/`(LLM이 소유), `AGENTS.md`(스키마). 연산: ingest, query, lint. 특수 파일: `wiki/index.md`, `wiki/log.md`.
- 좋은 답변은 `wiki/syntheses/`에 환류. 사람의 일은 자료 선택, 질문, 해석.
- 상세 절차는 루트 `AGENTS.md` 참조. 번역 요약은 `docs/llm wiki 해설서.md`.
