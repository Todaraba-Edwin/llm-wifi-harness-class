---
title: "Anthropic: Harness design for long-running application development"
type: source
tags: [anthropic, evaluator, planner]
sources: [raw/blogs/anthropic-harness-design-long-running-apps.md]
updated: 2026-11-05
---

# Anthropic: Harness design for long-running application development

- 출처: https://www.anthropic.com/research/harness-design-long-running-apps (2026-03-24, Prithvi Rajasekaran, Labs)
- 두 가지 실패 모드: (1) 컨텍스트가 차면 일관성 상실 + "context anxiety"(한계가 가깝다고 느끼면 일을 서둘러 마감), (2) 자기 평가 편향: 자기 결과물을 과대평가한다. -> [[context-resets-vs-compaction]], [[generator-evaluator-pattern]]
- GAN에서 영감을 받은 generator/evaluator 분리. 프론트엔드 디자인은 4개 기준(design quality, originality, craft, functionality)으로 주관적 품질을 채점 가능하게 만들고, 앞의 둘에 가중치를 둠. few-shot 점수 예시로 평가자를 보정. Playwright MCP로 실제 페이지를 조작하며 평가. 생성당 5~15회 반복.
- 풀스택: **planner**(1~4문장 프롬프트 -> 제품 스펙, 기술 세부는 일부러 덜 규정) + **generator**(스프린트 단위, React/Vite/FastAPI/SQLite) + **evaluator**(Playwright로 실제 클릭, 기준별 hard threshold, 하나라도 미달이면 스프린트 실패). 스프린트 전에 generator와 evaluator가 **sprint contract**(완료 기준)를 합의, 파일로 소통.
- 비용 비교(레트로 게임 메이커, Opus 4.5): solo 20분 $9 vs 풀 하네스 6시간 $200. 품질 차이는 즉시 확인됨(solo는 게임이 실제로 작동하지 않음).
- QA 에이전트는 기본적으로 약하다: 문제를 찾고도 "큰 문제 아님"으로 합리화, 피상적 테스트. 로그를 읽고 판단이 어긋난 곳을 프롬프트에 반영하는 튜닝 루프를 여러 번 돌려야 했다.
- 하네스 단순화: 구성요소는 모델이 못 하는 일에 대한 가정이며 stale해진다. Opus 4.6에서 스프린트 구조를 제거하고 evaluator를 마지막 1회로 이동, planner는 유지. evaluator는 과제가 모델의 단독 신뢰 범위를 넘을 때 가치가 있다. -> [[harness-assumptions-go-stale]]
- V2 결과(브라우저 DAW): 약 3시간 50분, $124.70. QA가 여전히 스텁 기능(오디오 녹음 등)을 잡아냄.
- 한계: Claude는 소리를 못 들어 음악적 취향 QA가 약함.
- What comes next: 모델이 좋아지면 scaffold의 중요성이 줄어드는 경우도 있지만, 모델이 좋을수록 baseline 너머의 복잡한 과제를 위한 harness 설계 여지도 커진다. 교훈: 만드는 대상 모델로 실험하고 실제 과제의 trace를 읽고 튜닝하라, 복잡한 과제는 분해와 전문 에이전트로 여유가 생길 수 있다, 새 모델이 나오면 더 이상 load-bearing이 아닌 부분을 걷어내고 새 능력을 위한 부분을 더하라. 결론: "흥미로운 harness 조합의 공간은 모델이 좋아져도 줄지 않고 이동한다."
