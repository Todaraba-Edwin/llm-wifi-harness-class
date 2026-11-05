# AGENTS.md - Harness Engineering LLM Wiki 스키마

이 저장소는 Karpathy의 LLM Wiki 패턴(https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)으로 운영한다. 주제: harness engineering (에이전트 하네스 설계, 장기 실행 에이전트, 평가, 채용 시장). 사람은 자료 선택, 질문, 해석을 맡고 LLM이 위키 작성과 유지보수를 맡는다.

## 계층
- `raw/` 불변 원본. 읽기만 하고 수정/삭제 금지. 새 자료는 추가만 한다.
  - `raw/blogs/` 블로그와 글, `raw/jobs/` 채용공고, `raw/papers/` 논문(abstract 또는 본문). 각 파일은 frontmatter에 `source`(URL)와 `fetched`(날짜)를 가진다.
- `wiki/` LLM이 소유. 사람은 읽는다.
  - `index.md` 전체 카탈로그(링크 + 한 줄 요약), `log.md` 시간순 기록(append-only)
  - `sources/` 원본별 요약 (`src-*`), `concepts/` 개념, `entities/` 제품과 회사와 논문, `syntheses/` 분석과 질의 결과
- 이 파일 = 스키마. 사용하면서 사람과 함께 고친다.
- `docs/` 사람이 읽는 해설 문서. 위키 페이지가 아니다.

## 페이지 규칙
- 파일명: 소문자 kebab-case 슬러그, 위키 전체에서 유일. 링크는 `[[slug]]`.
- `index.md`와 `log.md`는 frontmatter 면제. 그 외 페이지는 frontmatter 필수: `title`, `type`(source|concept|entity|synthesis), `tags`, `sources`(raw 경로 목록), `updated`(YYYY-MM-DD).
- 모든 주장은 `sources`의 raw 파일로 추적 가능해야 한다. 원문을 못 읽은 부분은 추측하지 말고 `syntheses/gaps-and-todo.md`에 기록한다.
- 원본끼리 충돌하면 덮어쓰지 말고 `syntheses/contradictions-and-tensions.md`에 양쪽 출처를 적는다.
- 수치는 abstract/블로그 기준임을 구분해 쓴다. 본문 검증 전 논문 수치는 단정하지 않는다.
- 언어: 한국어 본문, 고유명사와 기술 용어는 영어 유지.

## Ingest (새 자료 추가)
1. 자료를 `raw/<종류>/`에 저장(frontmatter 포함). 기존 raw는 건드리지 않는다.
2. 읽고 핵심을 사용자와 짧게 논의(배치 ingest면 생략 가능).
3. `wiki/sources/src-*.md` 작성.
4. 관련 `concepts/`, `entities/` 페이지를 갱신하거나 새로 만든다(자료 1건이 보통 10~15페이지에 영향). 새 개념은 별도 페이지로 승격.
5. 모순과 공백을 `syntheses/`에 반영.
6. `wiki/index.md` 갱신, `wiki/log.md`에 `## [날짜] ingest | 제목` + 변경 페이지 목록 추가.

## Query (질의)
1. `wiki/index.md`를 먼저 읽고 관련 페이지를 찾아 읽는다. 부족하면 `grep -ri` 로 검색.
2. 페이지를 근거로 답하고 `[[slug]]`로 인용한다. 위키에 없으면 없다고 말하고 raw나 웹으로 확인한다.
3. 가치 있는 답(비교표, 분석, 새 연결)은 `wiki/syntheses/`에 페이지로 저장하고 index와 log(`## [날짜] query | 질문`)를 갱신.

## Lint (점검, 주기적)
- 깨진 `[[링크]]`, 인바운드 링크 없는 고아 페이지, index에 없는 페이지
- frontmatter 누락과 YAML 파싱 오류(값에 `: `가 있으면 따옴표), `sources`의 raw 경로 부재, 본문이 인용한 자료가 `sources`에 빠진 경우(링크한 `src-*` 페이지의 raw를 합집합으로 확인)
- "읽지 못함"으로 기록된 공백이 이후 raw에 채워졌는지 대조
- 누락된 상호 참조(출력 링크가 없는 페이지, 자기 `src-*` 페이지로의 역링크 부재)
- 페이지 간 모순, 새 자료로 낡은 주장, 언급은 되지만 페이지가 없는 개념
- 채울 수 있는 공백(웹 검색으로 확인할 것) 목록화 -> `gaps-and-todo.md`
- 결과를 `log.md`에 `## [날짜] lint | 요약`으로 기록.

## log 작업 종류
`init`, `ingest`, `query`, `lint`, `synthesis`(자료 추가 없이 기존 페이지를 종합). 형식 `## [YYYY-MM-DD] 작업 | 제목`.

## source 페이지 규칙
원칙은 raw 1건당 `src-*` 1페이지. 같은 종류의 소량 자료(채용공고, 논문 abstract)는 묶음 요약 페이지(`src-job-postings`, `src-arxiv-harness-papers`)로 둘 수 있다.

## 금지
- raw 수정, log 기존 항목 수정, 출처 없는 사실 추가, 읽지 않은 원문의 내용 서술.
