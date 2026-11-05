---
source: https://arxiv.org/abs/2608.26197
title: "Harness Engineering for Predictable Agentic Systems: An Empirical Study of Deterministic Execution Constraints"
published: 2026-08-25
authors: Saransh Dhage
fetched: 2026-11-05
note: abstract only
---

# Harness Engineering for Predictable Agentic Systems: An Empirical Study of Deterministic Execution Constraints

Large Language Model (LLM) based agents exhibit substantial run-to-run execution variance even when given identical tasks and tools -- acceptable for exploratory use but unacceptable in regulated domains such as finance and compliance. We study harness engineering: wrapping an agent in a deterministic execution layer (finite-state control, forced tool selection, output validation, bounded retry, and structured planning) and measuring its effect on execution determinism and task success. Across two synthetic tasks (finance and legal) and two open-weight models (Qwen-2.5-7B-Instruct, Gemma-3-27B), a first-pass harness produces a mixed result: it significantly improves reproducibility in one of four model-task cells, significantly degrades it in two, and has no effect in the fourth. A trace-level diagnostic finds the cause: once tool sequence, state sequence, and output are already highly consistent, an unconstrained free-text planning step becomes the dominant remaining source of variance. Adding Structured Planning -- validating the plan against a fixed schema before any tool is invoked -- eliminates the effect entirely: three of four cells reach a Reproducibility Rate and Determinism Index of 1.000 at N=100, and task success rises to 100% in three of four cells. The gain is not free: token cost falls in every cell, but latency shows a genuine, sample-size-robust split by model -- one becomes faster under the constraint, the other markedly slower. We argue harness engineering is a distinct, effective discipline for agent reliability, but its cost is model-dependent and must be measured, not assumed.
