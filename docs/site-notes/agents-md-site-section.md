# AGENTS.md "사이트" 절 초안 (적용은 오너 O-13)

## 사이트 (Next.js 뷰어, `src/`)
- `wiki/**/*.md`를 빌드 시점에 파싱해 정적 페이지로 만든다. 사이트 코드는 `raw/`의 frontmatter(`source`, `title`, `fetched`)만 읽고 본문은 읽지 않는다.
- 사이트 작업은 `wiki/`, `raw/`, `docs/`(`docs/site-notes` 제외), `artifacts/`, 이 파일을 수정하지 않는다.
- **인제스트 규칙: 위키에 새 페이지를 만들 때 frontmatter에 `title_en`/`title_ko` 쌍을 반드시 추가한다.** 누락은 빌드(`build-content`)가 실패시킨다(`pnpm lint:titles`로도 확인 가능). 사이드바 제목은 `English (한글)`로 표시된다.
- Q&A(`/ask`)는 오너 전용이며 위키 본문만 근거로 인용 검증을 거친 답을 낸다. 저장은 `qa/*` 브랜치의 PR로만 하고 `main`에 직접 쓰지 않는다. 오너가 Preview 초록을 확인한 뒤 머지한다.
- `.env*`는 열람, 출력, 커밋하지 않는다. 비밀 변수 이름은 `src/lib/env.server.ts`와 `src/lib/qa/openai.ts`에만 나타난다(`pnpm lint:secret-names`).
- 검증 명령: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm lint:secret-names`, `pnpm gate:clean <build|e2e|selftest|mutate|devorigin|optout>`.
