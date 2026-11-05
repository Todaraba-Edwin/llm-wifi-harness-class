---
source: https://arxiv.org/abs/2605.13357
title: "AI Harness Engineering: A Runtime Substrate for Foundation-Model Software Agents"
published: 2026-05-13
authors: Hailin Zhong, Shengxin Zhu
fetched: 2026-11-05
note: abstract only
---

# AI Harness Engineering: A Runtime Substrate for Foundation-Model Software Agents

Foundation models have transformed automated code generation, yet autonomous software-engineering agents remain unreliable in realistic development settings. The dominant explanation locates this gap in model capability. We propose a different locus: software-engineering capability emerges from a model-harness-environment system, in which a runtime substrate -- the harness -- mediates how a foundation-model agent observes a project, acts on it, receives feedback, and establishes that a change is complete. We formalize this substrate as an AI Harness Engineering and identify eleven component responsibilities: task specification, context selection, tool access, project memory, task state, observability, failure attribution, verification, permissions, entropy auditing, and intervention recording. We operationalize the harness through a four-level ladder (H0-H3) that progressively exposes runtime support to the agent, and we propose a trace-based evaluation protocol that converts each agent run into an auditable episode package. Applied to a controlled validation task, the framework yields episode packages whose evidence structure varies systematically with harness level: lower levels produce only a final patch, higher levels produce reproduction logs, failure attributions, deterministic requirement checks, and structured verification reports. The framework reframes the central question of autonomous software engineering from whether a foundation model can produce a patch to whether the model-harness-environment system can produce a verifiably correct, attributed, and maintainable change. We outline a research program for the runtime systems that foundation-model software agents will require.
