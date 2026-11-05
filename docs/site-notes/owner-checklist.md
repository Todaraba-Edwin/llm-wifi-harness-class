# 오너 체크리스트 (O-1..O-14)

실행자는 커밋, 푸시, 계정 작업을 하지 않는다. 아래 항목은 오너가 직접 한다. 로컬 검증은 가짜(fake) 기반이므로 실제 Lua, OpenAI 스키마, OAuth 동작은 O-4..O-12에서 확인한다.

- **O-1** 사이트 코드를 커밋하고 푸시한다(M0b). `.env*`는 커밋하지 않는다.
- **O-2** Vercel 프로젝트: 저장소 import, Next.js, 기본 빌드 명령, Fluid Compute ON(`maxDuration=180`), Source Protection ON, Preview Deployment Protection ON. 시스템 환경변수를 노출해 `VERCEL_PROJECT_PRODUCTION_URL`이 풀리게 하거나 `BETTER_AUTH_URL`을 직접 설정한다. 그 외 env는 아직 넣지 않는다.
- **O-3** 첫 배포: `curl -I` = 200. 위키 한 글자를 바꿔 푸시하면 재배포된다. `/_src`, `/_logs`는 200이 아니어야 하고 `/raw/x`는 404. `pnpm verify:live https://<project>.vercel.app` 결과 0건. Preview는 env 없이 빌드된다.
- **O-4** GitHub OAuth App: 프로덕션(callback `https://<project>.vercel.app/api/auth/callback/github`)과 localhost(`http://localhost:3000/api/auth/callback/github`). 오너 숫자 id는 `https://api.github.com/users/<login>`에서 얻는다. `AUTH_SECRET`(32바이트 이상 난수), `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `OWNER_GITHUB_ID`를 설정한다.
- **O-5** Upstash(Marketplace)를 연결한다. 무료 한도를 확인한다. `QA_DAILY_CAP`은 50 유지(비우면 미설정). Preview에서 한도를 풀려면 큰 양수를 넣는다. `0`은 로컬 `next dev` 전용이다.
- **O-6** OpenAI 키, 월 예산 한도, `OPENAI_MODEL`(비우면 기본값 `gpt-6-luna`)을 설정한다. 셸에 같은 이름의 환경변수가 export되어 있으면 `.env` 값이 무시되므로(Next.js 동작) 로컬에서는 `unset`한다.
- **O-7** 저장 기능용 PAT: 저장소 한정, Contents RW, Pull requests RW, Metadata R, 90일 이하. `GH_WRITEBACK_TOKEN`과 `GITHUB_REPO`(`owner/name`)를 설정한다. 만료 전 교체 알림을 설정한다.
- **O-8** env를 바꾸면 재배포한다.
- **O-9** 인증 라이브: 비로그인 `curl -X POST /api/qa` = 401, `/api/auth/update-user`와 `/api/auth/sign-up/email` = 404. 오너 로그인이 된다. `OWNER_GITHUB_ID`를 일부러 틀리게 두고 재배포하면 거부(또는 403)되고 OpenAI 호출이 없다. 복구한다.
- **O-10** Q&A 라이브: 3회(범위 안 2, 밖 1)로 인용과 `위키에 없음`을 확인한다. `QA_DAILY_CAP=2`로 재배포해 3번째가 429인지 확인하고 50으로 복구한다. 함수 로그에 질문, 답변, 비밀이 없어야 한다. 웹 검색 버튼도 한도에 포함되는지 확인한다.
- **O-11** 배포 신원: 오너 직접 푸시 1회와 머지된 PR 1회가 모두 차단되지 않은 Production 배포를 만든다.
- **O-12** 저장 라이브: 실제 답변을 저장한다. PR 커밋 작성자가 오너(봇이 아님)이고, secretless Preview가 초록이며 보호되어 있다. 머지하면 Production이 재배포되고 `/wiki/<slug>`가 열린다. 페이지 수가 하나 늘고 `/_src`는 보호된다.
- **O-13** `docs/site-notes/agents-md-site-section.md`의 AGENTS.md "사이트" 절 초안을 검토하고 적용한다.
- **O-14** 최종 조정: noindex 방식, 한도 50과 일 경계(Asia/Seoul), PAT(GitHub App 아님), `artifacts/`, 모델, 인증 라이브러리(better-auth)와 오너 id 출처(계정 쿠키 `accountId`)를 실제 사용한 값과 대조한다.

## 열린 위험 (오너 공개)
- 2560px 초광폭에서 산문 줄 길이가 길다(`max-w-none` 유지, OQ-8).
- `src/lib/content/display-titles.ts`의 영한 제목 쌍 일부는 에이전트가 작성했다. 검토한다.
- 모바일 핀치 줌은 e2e로 검증하지 않았다. 휠 줌만 문서화했다.
- Pretendard, 부산단디고딕은 CDN에서 불러온다. 샌드박스에서는 시각 확인을 못 했다.
- `OPENAI_MODEL` 기본값 `gpt-6-luna`가 실제 사용 가능한 모델 ID인지, 구조화 출력과 웹 검색 도구를 지원하는지는 실제 호출로 확인하지 않았다.
- "웹 검색으로 답변 받기"는 위키 근거가 없는 답이다. 저장할 수 없고 일일 한도에 포함된다.
