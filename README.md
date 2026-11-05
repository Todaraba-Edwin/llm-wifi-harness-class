# 나만의 학습 도우미 

## 실습 
0. 진행순서
- 가재코드 설치, 공부 주제 정하기, 원본 자료 모으기
- 원본 자료로 LLM 위키 만들기, 위키에 질문해보기 
- /skill:deep-interview로 내 서비스 요구사항 정리
- /skill:ralplan 으로 만들 계획 세우기 
- 서비스 만들기(에이전트에게 맡기고 계속 고치기)
- 서비스 만들기 & 내 서비스로 실제 공부해보기, 서로 써 보고 공유

1. gajae-code 활용해보기 
- 4개의 에이전트, 4개의 스킬
- 예를 들어 : deep-interview > planner > **ralplan**
- 길면 30-40분 걸리면 서비스가 나옵니다. 


## LLM 위키 사용법 (harness engineering)
- 구조: `raw/`(불변 원본) -> `wiki/`(LLM이 관리하는 지식) / 규칙은 `AGENTS.md`. 시작점은 `wiki/index.md`.
- Ingest: 새 자료를 `raw/`에 넣고 에이전트에게 "AGENTS.md의 ingest 절차로 처리해줘".
- Query: "wiki/index.md를 보고 ...에 대해 답해줘". 좋은 답은 `wiki/syntheses/`에 저장.
- Lint: "AGENTS.md의 lint 절차로 점검해줘".
- 개념 해설: `docs/llm wiki 해설서.md`.
- 위키는 git 저장소의 마크다운이므로 Obsidian에서 열어 그래프 뷰로 볼 수 있다.

## 사이트 (Next.js, 읽기 전용 위키 뷰어)
- 구조: `wiki/**/*.md`를 빌드 시점에 파싱해 정적 페이지로 만든다. 원본(`raw/`)은 frontmatter의 `source`/`title`/`fetched`만 읽고, 본문은 사이트 코드가 읽지 않는다.
- 패키지 매니저는 pnpm. `pnpm install` 후: `pnpm dev`, `pnpm build`(content 빌드 + raw 접근 lint + next build + Scanner v2 검증), `pnpm start`.
- 점검: `pnpm lint:wiki`(깨진 링크, index 일치 규칙 IM, frontmatter, 출처 매핑), `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e`(포트는 `E2E_PORT`, 기본 3000), `pnpm check:baseline --exact`.
- 빌드 산출물 검증: `pnpm verify:selftest`(스캐너 자체 시험), `pnpm verify:build [--mutate]`, `pnpm verify:live <url>`.
- 환경 변수 없이 빌드된다. 단, `next`는 프로젝트 루트의 `.env*`를 항상 읽으므로 저장소 안의 `env -i ... pnpm build`는 비밀 없는 빌드가 아니다. 게이트는 `.env*`를 뺀 임시 복사본에서 실행한다: `pnpm gate:clean build|e2e|selftest|mutate|devorigin|optout [--dummy-secrets]`. 이름 목록은 `.env.example`. 검색 엔진 색인은 막혀 있다(`noindex` 메타 + `X-Robots-Tag`, robots.txt Disallow 없음).
- 글꼴은 CSS `@font-face`로 jsDelivr CDN에서 런타임에 불러오므로 빌드에 네트워크가 필요 없다(자세한 내용은 아래 `디자인`).
- 일일 한도 `QA_DAILY_CAP`: 비우면 미설정(기본 50). 양의 정수는 그 값. `0`(무제한)은 로컬 `next dev` 전용이며 `next start`, 프로덕션 빌드, Vercel(Preview 포함)에서는 무효라 Q&A가 503으로 닫힌다. 배포본에서 한도를 늘리려면 큰 양의 정수를 설정한다(한도는 계속 적용).
- LAN 주소(예: `http://192.168.0.52:3000`)로 `next dev`에 접속하면 기본 허용 범위(`192.168.*.*`, `10.*.*.*`)에서 동작한다. 다른 대역은 `DEV_ALLOWED_ORIGINS=호스트1,호스트2`로 지정한다. `next start`에는 영향이 없다.

### 메뉴 (헤더 `주요 메뉴`, 모바일은 `메뉴` 드로어)
| 메뉴 | 경로 | 설명 |
|---|---|---|
| 홈 | `/` | 위키 전체 문서 목록(index) |
| 검색 | `/search` | 제목, 본문, 태그 전문 검색. 같은 검색어를 다시 제출하거나 빈 검색어는 무시 |
| 그래프 | `/graph` | 문서 연결 그래프. 드래그 이동, 휠 확대, `화면에 맞추기`, 유형 필터 버튼, 노드 선택 시 해당 문서로 이동 |
| 학습 순서 | `/path` | 권장 읽기 순서 7단계. 단계 제목을 누르면 해당 문서로 이동하고, 문서 하단의 `이전`/`다음`으로 다음 단계를 이어서 읽음 |
| 직무 역량 | `/skills` | 채용공고에서 뽑은 직무 요구 역량 |
| 질문 | `/ask` | 소유자 전용 Q&A. 위키 본문만 인용해 답하고, 실패하면 웹 검색 버튼, 성공하면 저장(PR) 가능 |
| 변경 기록 | `/log` | 위키 작업 이력(ingest, query, lint) |

- 현재 페이지를 가리키는 메뉴는 강조(`aria-current`)되며, 같은 페이지 링크를 눌러도 다시 이동하지 않는다.
- 왼쪽 문서 목록은 `English (한글)` 제목으로 표시되고, 헤더의 햄버거(☰) 버튼으로 접고 펼친다(상태 저장). 모바일에서는 드로어를 쓴다.
- `다크 모드` 버튼은 라이트/다크를 전환하며 선택이 저장된다. `질문`(/ask) 메뉴는 소유자 전용 Q&A이며 아래 "Q&A" 절을 참고한다.

### 디자인
- Material(MUI, Material 3 for Figma) 컨셉: `src/app/globals.css`의 CSS 변수 토큰(primary `#1976d2`, 다크 `#90caf9`, 배경/표면/구분선/텍스트/hover/selected)을 `:root`와 `html.dark`에 정의하고 Tailwind `@theme inline`으로 `bg-surface`, `text-fg-2` 같은 클래스로 노출한다. 라이트/다크 전환은 기존 next-themes의 `dark` 클래스를 쓴다.
- 헤더는 primary AppBar(높이 49px, elevation 4), 카드/패널은 Paper(라이트 elevation 1, 다크 1px divider 테두리), 모서리 4px, 칩만 pill. 공통 클래스 상수는 `src/lib/ui.ts`.
- 글꼴: 본문 Pretendard(SIL OFL), 제목/디자인 글꼴 부산단디고딕(공공누리 제1유형 출처표시: 부산광역시). 둘 다 jsDelivr CDN에서 런타임에 불러오며 저장소에 포함하지 않는다.

### 인증 라이브러리 결정 (Q&A, 소유자 전용)
- 선택: `better-auth@1.7.17`(정확한 버전 고정), 테스트용 `msw@3.0.3`. GitHub 로그인만 허용하며 이메일·비밀번호, 계정 연결은 꺼져 있다. 범위는 `read:user`, 세션·계정 쿠키 수명은 24시간 이하.
- 소유자 id 출처 = D1-a: 계정 쿠키의 GitHub `accountId`(제공자 응답에서만 기록, `AUTH_SECRET`으로 암호화)를 라이브러리 API(`getAccountCookie`)로 읽는다. 클라이언트가 바꿀 수 있는 필드는 쓰지 않는다. 스파이크 점검 (i)-(vi) 통과, 음성 대조(`input:true` 구성은 위조 성공)로 시험이 위조를 탐지함을 확인(`tests/unit/auth/spike.test.ts`). D1-b(vii)는 시도하지 않았다.
- `/api/auth/*`는 (메서드, 경로) 정확 일치 allowlist(`sign-in/social`, `callback/github`, `get-session`, `sign-out`, `ok`, `error`)만 라이브러리로 전달하고 나머지는 404. 환경이 미구성이면 503.
- 기준 URL: `BETTER_AUTH_URL`, Vercel Production은 `VERCEL_PROJECT_PRODUCTION_URL`, 로컬은 `http://localhost:3000`. Vercel Preview에서 `BETTER_AUTH_URL`이 없으면 미구성(503).
- 비밀 변수 이름은 `src/lib/env.server.ts`와 `src/lib/qa/openai.ts`에서만 쓴다: `pnpm lint:secret-names`.

### Q&A 로컬 개발 모드
- 로컬 `next dev`(Vercel 아님)에서는 `OPENAI_API_KEY` 하나만 있으면 `/ask`가 동작한다. 소유자 로그인은 생략하고, 일일 한도(기본 50)는 서버 메모리로 센다(재시작하면 초기화). `AUTH_*`, `OWNER_GITHUB_ID`, `UPSTASH_*`는 필요 없다.
- 판정은 `QA_DAILY_CAP=0` 무제한 옵트아웃과 같은 3중 조건(빌드 리터럴, 런타임 `NODE_ENV`, `VERCEL` 부재)이다. 프로덕션 빌드, `next start`, Vercel(Preview 포함)에서는 적용되지 않고 모든 변수가 필요하다.
- 모델은 `OPENAI_MODEL`이 비어 있으면 기본값 `gpt-6-luna`를 쓴다.
- 셸에 `OPENAI_API_KEY`가 이미 export되어 있으면 Next.js는 `.env` 값을 무시한다. 401이 나면 `unset OPENAI_API_KEY` 후 서버를 다시 띄운다.
- 질문창은 Enter로 질문하고 Shift+Enter로 줄바꿈한다.

### Q&A 웹 검색과 저장
- 위키 근거 답변이 실패하거나 `위키에 없음`이면 "웹 검색으로 답변 받기" 버튼이 나온다(`POST /api/qa/web`). OpenAI 웹 검색 결과를 별도 박스로 보여주며 위키 근거가 없고 검증되지 않은 답이다. 저장할 수 없고 일일 한도에 1회로 포함된다.
- 답변 저장(`POST /api/qa/save`)은 `GH_WRITEBACK_TOKEN`과 `GITHUB_REPO`(`owner/name`)가 있을 때만 켜진다. 서명된 답을 다시 검증한 뒤 `qa/<slug>-<yyyymmddhhmm>` 브랜치(`createRef`만 사용, `main` 쓰기 없음)와 PR을 만든다. 열린 `qa/*` PR이 있으면 409.
- Preview에서 한도를 풀려면 큰 양수를 `QA_DAILY_CAP`에 넣는다(한도는 유지된다). `QA_DAILY_CAP=0`은 로컬 개발 전용이다.
- 오너 체크리스트: `docs/site-notes/owner-checklist.md`.

## 배포 환경 점검 (GitHub Actions)
- `.github/workflows/deploy-env-check.yml`은 Vercel과 같은 조건(`VERCEL=1`, `NODE_ENV=production`)에 저장소의 secrets/variables를 환경변수로 넣어 빌드하고, 서버를 띄워 `scripts/check-deploy-env.ts`로 점검한다. OpenAI, GitHub, Upstash는 호출하지 않고 값도 출력하지 않는다.
- 설정 이름: secrets `AUTH_SECRET`, `AUTH_GITHUB_SECRET`, `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `GH_WRITEBACK_TOKEN` / variables `AUTH_GITHUB_ID`, `OWNER_GITHUB_ID`, `OPENAI_MODEL`, `QA_DAILY_CAP`, `UPSTASH_REDIS_REST_URL`, `GITHUB_REPO`, `BETTER_AUTH_URL`.
- 수동 실행(`workflow_dispatch`)과 `main` 푸시에서는 Q&A 설정이 유효(익명 `POST /api/qa` = 401)해야 통과하고, PR(secrets 없음)에서는 미설정(503)도 통과한다.
- 로컬에서는 프로덕션 서버를 띄운 뒤 `pnpm check:deploy-env http://localhost:3000 [--require-env]`.
