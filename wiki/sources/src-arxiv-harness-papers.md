---
title: "arXiv: harness 관련 논문 11편 (abstract만)"
type: source
tags: [papers, arxiv]
sources: [raw/papers/arxiv-2405.15793.md, raw/papers/arxiv-2603.25723.md, raw/papers/arxiv-2604.08224.md, raw/papers/arxiv-2604.25850.md, raw/papers/arxiv-2605.13357.md, raw/papers/arxiv-2605.18747.md, raw/papers/arxiv-2606.10106.md, raw/papers/arxiv-2606.13643.md, raw/papers/arxiv-2607.03691.md, raw/papers/arxiv-2608.26197.md, raw/papers/arxiv-2610.20344.md]
updated: 2026-11-05
---

# arXiv: harness 관련 논문 11편 (abstract만)

모두 abstract만 읽었다. 본문 검증 전에는 수치를 인용 수준으로 쓰지 말 것.

**개념 정의 / 프레임**
- 2606.10106 *What makes a harness a harness*: 용어가 제품 전체(Claude Code, Codex CLI), 평가 스캐폴드(SWE-bench harness), 프레임워크/SDK/오케스트레이터와 뒤섞여 쓰임. 포함/배제 기준이 되는 참조 정의를 개념 분석으로 구축. -> [[agent-harness]]
- 2605.13357 *AI Harness Engineering: A Runtime Substrate*: SWE 에이전트 능력은 model-harness-environment 시스템에서 창발. 11개 구성 책임(task specification, context selection, tool access, project memory, task state, observability, failure attribution, verification, permissions, entropy auditing, intervention recording)과 4단계 사다리 H0~H3, trace 기반 평가 프로토콜. -> [[harness-engineering]]
- 2605.18747 *Code as Agent Harness*: 코드를 추론, 행동, 환경 모델링, 실행 기반 검증의 기반으로 보는 서베이(harness interface 등 3계층).
- 2604.08224 *Externalization in LLM Agents*: 능력을 메모리(시간 간 상태), 스킬(절차 지식), 프로토콜, harness로 외부화하는 흐름을 cognitive artifact 관점에서 리뷰.

**자동화 / 진화**
- 2604.25850 *Agentic Harness Engineering (AHE)*: 구성요소/경험/의사결정 3종 observability로 harness를 폐루프로 자동 진화. 10회 반복으로 Terminal-Bench 2 pass@1 69.7% -> 77.0%, 사람이 설계한 Codex-CLI(71.9%)를 상회, SWE-bench-verified로 재진화 없이 전이(abstract 기준). -> [[harness-automatic-evolution]]
- 2603.25723 *Natural-Language Agent Harnesses*: harness 정책을 편집 가능한 자연어 문서(NLAH)로 표현하고 공유 런타임(IHR)이 해석.
- 2606.13643 *Recursive Agent Harnesses*: 재귀 단위가 모델 호출이 아니라 파일시스템/코드 실행/계획을 가진 harness 전체. 부모가 스크립트로 서브에이전트 harness를 병렬 생성.

**실증 / 평가**
- 2607.03691 *Don't Blame the LLM*: 모델을 고정하고 harness 릴리스 35개(Qwen Code CLI)만 바꿔 효과 측정. 5개 오픈소스 harness(Codex, Qwen Code, Gemini, OpenCode, OpenHands)의 릴리스 속도는 하루 2회 이상. 실무자는 회귀를 모델 탓으로 돌리지만 harness 탓일 수 있다. -> [[harness-evals-and-ablation]]
- 2608.26197 *Harness Engineering for Predictable Agentic Systems*: 결정론적 실행 계층(FSM, 강제 툴 선택, 출력 검증, 제한 재시도)의 1차 결과는 혼재(4개 셀 중 1개 개선, 2개 악화, 1개 무효과). 자유 텍스트 planning 단계가 잔여 분산의 주원인이었고 Structured Planning(스키마 검증 후 툴 호출)으로 3/4 셀에서 재현성 1.000, 성공률 100%. 지연은 모델별로 갈림(한쪽 빨라짐, 다른 쪽 크게 느려짐), 토큰 비용은 모든 셀에서 감소. -> [[deterministic-execution-constraints]]
- 2610.20344 *Doc2Harness*: harness 엔지니어링 자체를 평가하는 2단계 벤치마크(12개 frontier harness를 정리한 개발 문서를 보고 빌드 모델이 harness를 구성).
- 이 세션에서 abstract를 봤지만 raw에 저장하지 않은 논문(MedicalHarness, LoopsBench 등)은 [[gaps-and-todo]]에 대기 목록으로 둠.

**기초**
- 2405.15793 *SWE-agent*: 에이전트를 새로운 종류의 최종 사용자로 보고 설계한 Agent-Computer Interface(ACI)가 성능을 크게 올림. -> [[swe-agent]]
