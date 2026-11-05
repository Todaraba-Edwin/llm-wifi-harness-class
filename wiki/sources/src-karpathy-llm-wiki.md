---
title: "Karpathy: LLM Wiki (gist)"
type: source
tags: [llm-wiki, knowledge-base]
sources: [raw/blogs/karpathy-llm-wiki.md]
updated: 2026-11-05
---

# Karpathy: LLM Wiki (gist)

- 출처: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- 이 위키의 설계 근거. 상세는 [[llm-wiki-pattern]].
- RAG는 질의 때마다 조각을 재발견하지만, LLM Wiki는 자료를 넣을 때 위키에 통합해 지식을 누적한다. 세 계층: raw sources(불변), wiki(LLM 소유), schema(AGENTS.md/CLAUDE.md). 연산: ingest, query, lint. 특수 파일: index.md(내용 카탈로그), log.md(시간순, `## [날짜] ingest | 제목` 접두사).
